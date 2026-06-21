import {
  appendAndroidIntentBrowserFallback,
  clearStashedNaverMapFallback,
  promptNaverMapFallback,
} from "@/lib/mapDirectionFallback";
import { isInStandaloneMode, openExternalUrl } from "@/lib/pwa";

/**
 * 네이버 지도 웹에서 매장 위치 열기 (좌표가 있으면 해당 지점 중심, 없으면 매장명 검색).
 * v5 지도 중심 `c` 값은 EPSG:3857(미터) 좌표를 사용합니다.
 */
export type MapDirectionInput = {
  name: string;
  address?: string;
  lat?: number;
  lon?: number;
};

const EARTH_RADIUS_M = 6378137;

const NAVER_MAP_ANDROID_PACKAGE = "com.nhn.android.nmap";
const NAVER_MAP_WEB_ZOOM = 18;

/**
 * 좌표 기반 공식 웹 URL (마커 표시).
 * nmap://place?lat=&lng=&name= 과 동일하게 좌표로 핀을 찍고, name은 라벨로만 사용.
 * https://map.naver.com/p/entry/address/{x},{y},{label}?c={zoom},0,0,0,dh
 */
export function buildNaverMapCoordEntryUrl(
  lon: number,
  lat: number,
  label?: string,
): string {
  const { x, y } = wgs84ToWebMercator(lon, lat);
  const displayLabel = label?.trim() || `${lat},${lon}`;
  return (
    `https://map.naver.com/p/entry/address/${x},${y},` +
    `${encodeURIComponent(displayLabel)}?c=${NAVER_MAP_WEB_ZOOM},0,0,0,dh`
  );
}

/** 공식 장소 상세 URL — map.naver.com/p/entry/place/{id} */
export function buildNaverMapPlaceEntryUrl(placeId: string): string {
  return `https://map.naver.com/p/entry/place/${placeId}?placePath=%2Fhome`;
}

function hasValidCoords(lat?: number, lon?: number): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/** WGS84(위도·경도) → Web Mercator(EPSG:3857), 단위 m */
function wgs84ToWebMercator(lon: number, lat: number): { x: number; y: number } {
  const x = (EARTH_RADIUS_M * lon * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const y = EARTH_RADIUS_M * Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  return { x, y };
}

function getMobileEnv() {
  const ua = navigator.userAgent;
  return {
    isIOS: /iPhone|iPad|iPod/i.test(ua),
    isAndroid: /Android/i.test(ua),
  };
}

/** 모바일 웹: 페이지 URL (네이버 지도 URL Scheme 가이드) */
function getNaverMapAppName(): string {
  return encodeURIComponent(window.location.href);
}

const DEEP_LINK_FALLBACK_MS = 1500;

const PLAY_STORE_URL_PATTERN =
  /play\.google\.com|market\.android\.com|market:\/\/details/i;

function isPlayStoreNavigation(): boolean {
  return PLAY_STORE_URL_PATTERN.test(window.location.href);
}

function tryOpenDeepLink(
  schemeUrl: string,
  options?: { webFallback?: string; intentUrl?: string },
) {
  const { isIOS, isAndroid } = getMobileEnv();
  const webFallback = options?.webFallback ?? "https://map.naver.com/";

  if (!isIOS && !isAndroid) {
    openNaverMapWebFallback(webFallback);
    return;
  }

  let appOpened = false;
  const onHide = () => {
    appOpened = true;
    clearStashedNaverMapFallback();
    document.removeEventListener("visibilitychange", onHide);
  };

  document.addEventListener("visibilitychange", onHide);

  let launchUrl = schemeUrl;
  if (isAndroid && options?.intentUrl && !isInStandaloneMode()) {
    launchUrl = appendAndroidIntentBrowserFallback(
      options.intentUrl,
      webFallback,
    );
  }

  try {
    openExternalUrl(launchUrl);
  } catch {
    // openExternalUrl 실패 시 타임아웃 fallback으로 처리
  }

  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);

    // Play Store로 넘어간 경우(visibility만 바뀐 케이스)에도 팝업 표시
    if (appOpened && !isPlayStoreNavigation()) {
      return;
    }

    if (isPlayStoreNavigation()) {
      clearStashedNaverMapFallback();
      window.history.back();
      window.setTimeout(() => {
        promptNaverMapFallback(webFallback, isIOS ? "ios" : "android");
      }, 300);
      return;
    }

    if (isIOS || isAndroid) {
      clearStashedNaverMapFallback();
      promptNaverMapFallback(webFallback, isIOS ? "ios" : "android");
      return;
    }

    openNaverMapWebFallback(webFallback);
  }, DEEP_LINK_FALLBACK_MS);
}

/** 리다이렉트 해석 후 nmap/intent 등 네이티브 스킴 실행 */
export function openNativeDeepLink(
  schemeUrl: string,
  options?: { webFallback?: string; intentUrl?: string },
): void {
  tryOpenDeepLink(schemeUrl, options);
}

/** 딥링크 실패·좌표 없음 등 최종 웹 fallback (모바일 포함) */
export function openNaverMapWebFallback(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * 카드 등에서 네이버 지도를 열 때 사용 (공식 /p/ 웹 URL).
 * - lat/lon 있음: entry/address 좌표 핀 (매장명은 라벨만, 검색 아님)
 * - lat/lon 없음 + name: 장소명 검색
 */
export function buildNaverMapOpenUrl(input: MapDirectionInput): string {
  const { name, lat, lon } = input;
  const q = name.trim();

  if (hasValidCoords(lat, lon) && lat != null && lon != null) {
    return buildNaverMapCoordEntryUrl(lon, lat, q || undefined);
  }

  if (q) {
    return `https://map.naver.com/p/search/${encodeURIComponent(q)}`;
  }

  return "https://map.naver.com/";
}

export type ParsedNmapSchemeUrl = {
  lat?: number;
  lon?: number;
  name?: string;
  placeId?: string;
};

function parseNmapCoord(value: string | null): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toNmapSchemeUrl(url: string): string | null {
  if (url.startsWith("nmap://")) return url;
  if (url.startsWith("intent://")) {
    const path = url.match(/^intent:\/\/([^#]+)/)?.[1];
    return path ? `nmap://${path}` : null;
  }
  return null;
}

/** nmap:// / intent:// URL에서 좌표·장소명·place ID 추출 */
export function parseNmapSchemeUrl(url: string): ParsedNmapSchemeUrl | null {
  const normalized = toNmapSchemeUrl(url);
  if (!normalized) return null;

  const queryIndex = normalized.indexOf("?");
  if (queryIndex === -1) return {};

  const params = new URLSearchParams(normalized.slice(queryIndex + 1));
  const name = params.get("name");

  return {
    placeId: params.get("id") ?? undefined,
    lat: parseNmapCoord(params.get("lat") ?? params.get("latitude")),
    lon: parseNmapCoord(params.get("lng") ?? params.get("longitude")),
    name: name ? decodeURIComponent(name) : undefined,
  };
}

/** nmap/intent 스킴 → 공식 HTTPS 네이버지도 URL */
export function buildNaverMapWebUrlFromScheme(
  schemeUrl: string,
  context?: MapDirectionInput,
): string | undefined {
  const parsed = parseNmapSchemeUrl(schemeUrl);
  const placeId = parsed?.placeId?.trim();
  if (placeId) {
    return buildNaverMapPlaceEntryUrl(placeId);
  }

  const lat = parsed?.lat ?? context?.lat;
  const lon = parsed?.lon ?? context?.lon;
  const name = parsed?.name?.trim() || context?.name?.trim();

  if (hasValidCoords(lat, lon) && lat != null && lon != null) {
    return buildNaverMapOpenUrl({
      name: name ?? "",
      lat,
      lon,
    });
  }

  if (name) {
    return buildNaverMapOpenUrl({ name });
  }

  return undefined;
}

function buildNaverMapMarkerDeepLinks(input: {
  lat: number;
  lon: number;
  name: string;
}) {
  const { lat, lon, name } = input;
  const appName = getNaverMapAppName();
  const encodedName = encodeURIComponent(name.trim());
  const nmapUrl =
    `nmap://place?lat=${lat}&lng=${lon}&name=${encodedName}&appname=${appName}`;
  const intentUrl =
    `intent://place?lat=${lat}&lng=${lon}&name=${encodedName}&appname=${appName}` +
    `#Intent;scheme=nmap;action=android.intent.action.VIEW;` +
    `category=android.intent.category.BROWSABLE;` +
    `package=${NAVER_MAP_ANDROID_PACKAGE};end`;
  return { nmapUrl, intentUrl };
}

/**
 * 네이버지도 앱 딥링크로 장소 마커를 연다 (공식 place?lat/lng/name 스킴).
 */
export function openNaverMapMarker(input: {
  lat: number;
  lon: number;
  name: string;
  webFallback?: string;
}): void {
  const { lat, lon, name, webFallback } = input;
  if (!hasValidCoords(lat, lon)) return;

  const { nmapUrl, intentUrl } = buildNaverMapMarkerDeepLinks({
    lat,
    lon,
    name,
  });
  const { isIOS, isAndroid } = getMobileEnv();
  const webUrl =
    webFallback ?? buildNaverMapOpenUrl({ name, lat, lon });

  if (isAndroid) {
    tryOpenDeepLink(nmapUrl, { webFallback: webUrl, intentUrl });
    return;
  }

  if (isIOS) {
    tryOpenDeepLink(nmapUrl, { webFallback: webUrl });
    return;
  }

  openNaverMapWebFallback(webUrl);
}

/**
 * 네이버지도 앱 딥링크로 매장 위치를 열어준다.
 * - Android: intent(+browser_fallback_url) 또는 PWA에서 nmap://
 * - iOS: nmap:// 시도 후 실패 시 설치·웹 선택 팝업
 * - 데스크탑/기타: 웹 네이버지도 새 탭
 */
export function openNaverMapsApp(input: MapDirectionInput): void {
  const { name, lat, lon } = input;
  const { isIOS, isAndroid } = getMobileEnv();

  if (!hasValidCoords(lat, lon) || lat == null || lon == null) {
    openNaverMapWebFallback(buildNaverMapOpenUrl({ name }));
    return;
  }

  const appName = getNaverMapAppName();
  const nmapUrl = `nmap://map?lat=${lat}&lng=${lon}&zoom=16&appname=${appName}`;
  const intentUrl =
    `intent://map?lat=${lat}&lng=${lon}&zoom=16&appname=${appName}` +
    `#Intent;scheme=nmap;action=android.intent.action.VIEW;` +
    `category=android.intent.category.BROWSABLE;package=${NAVER_MAP_ANDROID_PACKAGE};end`;
  const webUrl = buildNaverMapOpenUrl({ name, lat, lon });

  if (isAndroid) {
    tryOpenDeepLink(nmapUrl, { webFallback: webUrl, intentUrl });
    return;
  }

  if (isIOS) {
    tryOpenDeepLink(nmapUrl, { webFallback: webUrl });
    return;
  }

  openNaverMapWebFallback(buildNaverMapOpenUrl({ name, lat, lon }));
}

/** map.naver.com 장소 URL에서 place ID 추출 */
export function parsePlaceIdFromNaverUrl(url: string): string | undefined {
  try {
    const match = new URL(url).pathname.match(/\/place\/(\d+)/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

function resolveDirectionsWebFallback(input: {
  url?: string;
  placeId?: string;
  lat?: number;
  lon?: number;
  name?: string;
}): string | undefined {
  const url = input.url?.trim();
  if (url) return url;

  const placeId = input.placeId?.trim();
  if (placeId) {
    return buildNaverMapPlaceEntryUrl(placeId);
  }

  const name = input.name?.trim();
  if (!name) return undefined;

  return buildNaverMapOpenUrl({
    name,
    lat: input.lat,
    lon: input.lon,
  });
}

/**
 * 네이버 지도 장소 ID(place)로 연다.
 * place ID가 있으면 nmap/intent(place?id=)를 사용하고, 좌표 마커보다 우선합니다.
 */
export function openNaverMapPlace(
  placeId: string,
  webFallback?: string,
): void {
  const webUrl =
    webFallback ?? buildNaverMapPlaceEntryUrl(placeId);
  const appName = getNaverMapAppName();
  const { isAndroid, isIOS } = getMobileEnv();
  const nmapUrl = `nmap://place?id=${placeId}&appname=${appName}`;
  const intentUrl =
    `intent://place?id=${placeId}&appname=${appName}` +
    `#Intent;scheme=nmap;action=android.intent.action.VIEW;` +
    `category=android.intent.category.BROWSABLE;` +
    `package=${NAVER_MAP_ANDROID_PACKAGE};end`;

  if (isAndroid) {
    tryOpenDeepLink(nmapUrl, { webFallback: webUrl, intentUrl });
    return;
  }

  if (isIOS) {
    tryOpenDeepLink(nmapUrl, { webFallback: webUrl });
    return;
  }

  window.open(webUrl, "_blank", "noopener,noreferrer");
}

/**
 * 배너 등 길안내 CTA — 앱 스킴 우선, 실패·데이터 부족 시 webFallback.
 * 1. placeId (또는 map.naver.com URL에서 추출) → intent/nmap + 웹 fallback
 * 2. lat/lon/name → intent/nmap + 웹 fallback
 * 3. url / 장소명만 → 웹 fallback (모바일·iOS 포함, 좌표 없어도 동작)
 */
export function openNaverMapDirections(input: {
  lat?: number;
  lon?: number;
  name?: string;
  placeId?: string;
  url?: string;
}): void {
  const placeId =
    input.placeId?.trim() ||
    (input.url ? parsePlaceIdFromNaverUrl(input.url) : undefined);
  const webFallback = resolveDirectionsWebFallback({
    ...input,
    placeId,
  });

  if (placeId) {
    openNaverMapPlace(placeId, webFallback);
    return;
  }

  if (
    hasValidCoords(input.lat, input.lon) &&
    input.lat != null &&
    input.lon != null &&
    input.name?.trim()
  ) {
    openNaverMapMarker({
      lat: input.lat,
      lon: input.lon,
      name: input.name.trim(),
      webFallback,
    });
    return;
  }

  if (webFallback) {
    openNaverMapWebFallback(webFallback);
  }
}

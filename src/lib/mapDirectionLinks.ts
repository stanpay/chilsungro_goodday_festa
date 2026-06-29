import {
  promptNaverMapFallback,
  type NaverMapFallbackContext,
  type NaverMapFallbackDetail,
  type NaverMapFallbackPlatform,
} from "@/lib/mapDirectionFallback";
import { openExternalUrl } from "@/lib/pwa";

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

/** 딥링크 실패 팝업에서 웹 URL을 계산할 때 사용 */
export type NaverMapDeepLinkFallback = {
  /** nmap/intent 스킴 — 웹 URL 재구성에 사용 */
  targetUrl: string;
  context?: NaverMapFallbackContext;
  /** naver.me·place 등 그대로 열 HTTPS URL (검색 URL 제외) */
  webFallbackUrl?: string;
};

function isNativeMapSchemeUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.startsWith("nmap://") || lower.startsWith("intent://");
}

function isNaverMapSearchUrl(url: string): boolean {
  try {
    return new URL(url).pathname.includes("/search/");
  } catch {
    return /\/p\/search\//i.test(url);
  }
}

/**
 * http → 그대로, nmap/intent → URL 내 lat/lon(또는 place ID)만 재구성.
 * context 좌표 핀·매장명 검색은 사용하지 않음.
 */
export function computeNaverMapWebUrl(
  targetUrl: string,
  _context?: NaverMapFallbackContext,
): string {
  const url = targetUrl.trim();

  if (url.startsWith("http")) {
    return url;
  }

  if (isNativeMapSchemeUrl(url)) {
    const parsed = parseNmapSchemeUrl(url);
    const placeId = parsed?.placeId?.trim();
    if (placeId) {
      return buildNaverMapPlaceEntryUrl(placeId);
    }

    const lat = parsed?.lat;
    const lon = parsed?.lon;
    const label = parsed?.name?.trim();

    if (hasValidCoords(lat, lon) && lat != null && lon != null) {
      return buildNaverMapCoordWebUrl(lon, lat, label);
    }
  }

  return "https://map.naver.com/";
}

/** @deprecated computeNaverMapWebUrl 사용 */
export function buildNaverMapWebFallbackUrl(
  targetUrl: string,
  context?: NaverMapFallbackContext,
): string {
  return computeNaverMapWebUrl(targetUrl, context);
}

/** 팝업 "웹 지도로 보기" 클릭 시 최종 URL */
export function resolveNaverMapFallbackWebUrl(
  detail: Pick<
    NaverMapFallbackDetail,
    "targetUrl" | "context" | "webFallbackUrl"
  >,
): string {
  const targetUrl = (detail.targetUrl ?? "").trim();

  if (isNativeMapSchemeUrl(targetUrl)) {
    const fromNmap = computeNaverMapWebUrl(targetUrl, detail.context);
    if (isNaverMapCoordWebUrl(fromNmap)) {
      return fromNmap;
    }
  }

  const httpCandidate = [detail.webFallbackUrl, targetUrl]
    .map((u) => u?.trim())
    .find((u) => u?.startsWith("http") && !isNaverMapSearchUrl(u));
  if (httpCandidate) {
    return httpCandidate;
  }

  if (isNativeMapSchemeUrl(targetUrl)) {
    return computeNaverMapWebUrl(targetUrl, detail.context);
  }

  return "https://map.naver.com/";
}

const EARTH_RADIUS_M = 6378137;

const NAVER_MAP_ANDROID_PACKAGE = "com.nhn.android.nmap";
const NAVER_MAP_WEB_ZOOM = 18;

/**
 * 데스크탑 웹 전용 — EPSG:3857 entry/address URL (마커 표시).
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
    `${encodeURIComponent(displayLabel)}?c=${NAVER_MAP_WEB_ZOOM.toFixed(2)},0,0,0,dh`
  );
}

/**
 * 모바일 웹 fallback — WGS84 lat/lng 쿼리.
 * /p/entry/address/ 는 모바일에서 매장명 검색으로 리다이렉트되는 경우가 있음.
 * @see https://stickode.tistory.com/1195
 */
export function buildNaverMapMobileCoordUrl(
  lon: number,
  lat: number,
): string {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lon),
    zoom: String(NAVER_MAP_WEB_ZOOM),
  });
  return `https://map.naver.com/?${params.toString()}`;
}

/** 데스크탑·모바일 환경에 맞는 좌표 웹 URL */
export function buildNaverMapCoordWebUrl(
  lon: number,
  lat: number,
  label?: string,
): string {
  const { isIOS, isAndroid } = getMobileEnv();
  if (isIOS || isAndroid) {
    return buildNaverMapMobileCoordUrl(lon, lat);
  }
  return buildNaverMapCoordEntryUrl(lon, lat, label);
}

function isNaverMapCoordWebUrl(url: string): boolean {
  if (isNaverMapEntryUrl(url)) return true;
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.includes("map.naver.com") &&
      parsed.searchParams.has("lat") &&
      parsed.searchParams.has("lng")
    );
  } catch {
    return /map\.naver\.com\/\?[^#]*\blat=/.test(url);
  }
}

function isNaverMapEntryUrl(url: string): boolean {
  return (
    url.includes("/p/entry/address/") || url.includes("/p/entry/place/")
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

function toFallbackDetail(
  platform: NaverMapFallbackPlatform,
  fallback: NaverMapDeepLinkFallback,
): NaverMapFallbackDetail {
  const fromNmap = isNativeMapSchemeUrl(fallback.targetUrl)
    ? computeNaverMapWebUrl(fallback.targetUrl, fallback.context)
    : undefined;

  const httpFallback =
    fallback.webFallbackUrl?.startsWith("http") &&
    !isNaverMapSearchUrl(fallback.webFallbackUrl)
      ? fallback.webFallbackUrl
      : undefined;

  const webFallbackUrl =
    (fromNmap && isNaverMapCoordWebUrl(fromNmap) ? fromNmap : undefined) ??
    httpFallback ??
    fromNmap ??
    computeNaverMapWebUrl(fallback.targetUrl, fallback.context);

  return {
    platform,
    targetUrl: fallback.targetUrl,
    context: fallback.context,
    webFallbackUrl,
  };
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

const ANDROID_DEEP_LINK_FALLBACK_MS = 1500;
const IOS_DEEP_LINK_FALLBACK_MS = ANDROID_DEEP_LINK_FALLBACK_MS;

const PLAY_STORE_URL_PATTERN =
  /play\.google\.com|market\.android\.com|market:\/\/details/i;

function isPlayStoreNavigation(): boolean {
  return PLAY_STORE_URL_PATTERN.test(window.location.href);
}

function isIosPageHidden(): boolean {
  const doc = document as Document & { webkitHidden?: boolean };
  return document.hidden || doc.webkitHidden === true;
}

/**
 * iOS(사파리·크롬 등 WebKit 공통):
 * - window.open 보조 탭은 스크립트로 닫을 수 없음(iOS 보안 제한) → 같은 탭에서 nmap 시도
 * - 보조 탭에서 앱을 열면 원본 탭은 hidden 되지 않아 오탐 fallback 발생 → location.href 사용
 * - 한 번이라도 백그라운드로 가면(앱 전환) 웹 fallback 취소 (복귀 후 visible이어도 유지)
 */
function tryOpenDeepLinkOnIos(
  schemeUrl: string,
  fallback: NaverMapDeepLinkFallback,
): void {
  let leftPage = false;

  const markLeftPage = () => {
    leftPage = true;
  };

  const onVisibilityChange = () => {
    if (isIosPageHidden()) {
      markLeftPage();
    }
  };

  const onPageHide = () => {
    markLeftPage();
  };

  const onBlur = () => {
    // iOS Chrome: 확인 없이 앱이 바로 열릴 때 visibilitychange가 늦게 올 수 있음
    window.setTimeout(() => {
      if (isIosPageHidden()) {
        markLeftPage();
      }
    }, 500);
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("blur", onBlur);

  window.location.href = schemeUrl;

  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("blur", onBlur);

    if (leftPage) {
      return;
    }

    promptNaverMapFallback(toFallbackDetail("ios", fallback));
  }, IOS_DEEP_LINK_FALLBACK_MS);
}

function showAndroidDeepLinkFallback(fallback: NaverMapDeepLinkFallback): void {
  promptNaverMapFallback(toFallbackDetail("android", fallback));
}

/**
 * Android(PWA·모바일 웹 공통):
 * - intent + package로 네이버지도 앱 시도
 * - 앱 실행 성공 시 페이지가 hidden 상태로 유지 → fallback 취소
 * - 미설치·실패 시 timeout 또는 Play Store 복귀 후 설치/웹 선택 팝업
 */
function tryOpenDeepLinkOnAndroid(
  schemeUrl: string,
  options?: { fallback?: NaverMapDeepLinkFallback; intentUrl?: string },
): void {
  const fallback = options?.fallback ?? {
    targetUrl: schemeUrl,
  };

  let leftPage = false;

  const markLeftPage = () => {
    leftPage = true;
  };

  const onVisibilityChange = () => {
    if (document.hidden) {
      markLeftPage();
    }
  };

  const onPageHide = () => {
    markLeftPage();
  };

  const onBlur = () => {
    // intent 전환 시 visibilitychange가 늦게 오거나 누락되는 기기 대응
    window.setTimeout(() => {
      if (document.hidden) {
        markLeftPage();
      }
    }, 300);
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("blur", onBlur);

  const launchUrl = options?.intentUrl ?? schemeUrl;

  try {
    openExternalUrl(launchUrl);
  } catch {
    /* timeout fallback으로 처리 */
  }

  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("blur", onBlur);

    if (isPlayStoreNavigation()) {
      window.history.back();
      window.setTimeout(() => {
        showAndroidDeepLinkFallback(fallback);
      }, 300);
      return;
    }

    // 앱이 전면에 있으면 성공 — 복귀 후에도 fallback을 띄우지 않음
    if (leftPage && document.hidden) {
      return;
    }

    // 페이지를 벗어나지 않았거나, timeout 전에 이미 복귀한 경우 실패로 간주
    showAndroidDeepLinkFallback(fallback);
  }, ANDROID_DEEP_LINK_FALLBACK_MS);
}

function tryOpenDeepLink(
  schemeUrl: string,
  options?: { fallback?: NaverMapDeepLinkFallback; intentUrl?: string },
) {
  const { isIOS, isAndroid } = getMobileEnv();
  const fallback = options?.fallback ?? { targetUrl: schemeUrl };

  if (!isIOS && !isAndroid) {
    openNaverMapWebFallback(
      buildNaverMapWebFallbackUrl(fallback.targetUrl, fallback.context),
    );
    return;
  }

  if (isIOS) {
    tryOpenDeepLinkOnIos(schemeUrl, fallback);
    return;
  }

  tryOpenDeepLinkOnAndroid(schemeUrl, options);
}

/** 리다이렉트 해석 후 nmap/intent 등 네이티브 스킴 실행 */
export function openNativeDeepLink(
  schemeUrl: string,
  options?: { fallback?: NaverMapDeepLinkFallback; intentUrl?: string },
): void {
  tryOpenDeepLink(schemeUrl, {
    ...options,
    fallback: options?.fallback ?? { targetUrl: schemeUrl },
  });
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
    return buildNaverMapCoordWebUrl(lon, lat, q || undefined);
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
  const rawName = params.get("name") ?? params.get("query");

  return {
    placeId: params.get("id") ?? undefined,
    lat: parseNmapCoord(params.get("lat") ?? params.get("latitude")),
    lon: parseNmapCoord(
      params.get("lng") ??
        params.get("lon") ??
        params.get("longitude") ??
        params.get("long"),
    ),
    name: rawName ? decodeURIComponent(rawName) : undefined,
  };
}

/** nmap/intent 스킴 → 공식 HTTPS 네이버지도 URL */
export function buildNaverMapWebUrlFromScheme(
  schemeUrl: string,
  context?: NaverMapFallbackContext,
): string | undefined {
  if (!isNativeMapSchemeUrl(schemeUrl)) return undefined;

  const result = computeNaverMapWebUrl(schemeUrl, context);
  if (result.startsWith("http") && !isNaverMapSearchUrl(result)) {
    return result;
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
  targetUrl?: string;
}): void {
  const { lat, lon, name, targetUrl } = input;
  if (!hasValidCoords(lat, lon)) return;

  const { nmapUrl, intentUrl } = buildNaverMapMarkerDeepLinks({
    lat,
    lon,
    name,
  });
  const { isIOS, isAndroid } = getMobileEnv();
  const httpTarget =
    targetUrl?.startsWith("http") && !isNaverMapSearchUrl(targetUrl)
      ? targetUrl
      : undefined;
  const fallback: NaverMapDeepLinkFallback = {
    targetUrl: nmapUrl,
    context: { lat, lon, name },
    webFallbackUrl: httpTarget,
  };

  if (isAndroid) {
    tryOpenDeepLink(nmapUrl, { fallback, intentUrl });
    return;
  }

  if (isIOS) {
    tryOpenDeepLink(nmapUrl, { fallback });
    return;
  }

  openNaverMapWebFallback(
    buildNaverMapWebFallbackUrl(fallback.targetUrl, fallback.context),
  );
}

/**
 * 네이버지도 앱 딥링크로 매장 위치를 열어준다.
 * - Android: intent + package (실패 시 timeout·Play Store 복귀 후 팝업)
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
  const fallback: NaverMapDeepLinkFallback = {
    targetUrl: nmapUrl,
    context: { lat, lon, name },
  };

  if (isAndroid) {
    tryOpenDeepLink(nmapUrl, { fallback, intentUrl });
    return;
  }

  if (isIOS) {
    tryOpenDeepLink(nmapUrl, { fallback });
    return;
  }

  openNaverMapWebFallback(
    buildNaverMapWebFallbackUrl(fallback.targetUrl, fallback.context),
  );
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

/**
 * 네이버 지도 장소 ID(place)로 연다.
 * place ID가 있으면 nmap/intent(place?id=)를 사용하고, 좌표 마커보다 우선합니다.
 */
export function openNaverMapPlace(
  placeId: string,
  options?: {
    targetUrl?: string;
    context?: NaverMapFallbackContext;
  },
): void {
  const targetUrl =
    options?.targetUrl ?? buildNaverMapPlaceEntryUrl(placeId);
  const nmapUrl = `nmap://place?id=${placeId}&appname=${getNaverMapAppName()}`;
  const fallback: NaverMapDeepLinkFallback = {
    targetUrl: nmapUrl,
    context: options?.context,
    webFallbackUrl: targetUrl.startsWith("http") ? targetUrl : undefined,
  };
  const { isAndroid, isIOS } = getMobileEnv();
  const appName = getNaverMapAppName();
  const intentUrl =
    `intent://place?id=${placeId}&appname=${appName}` +
    `#Intent;scheme=nmap;action=android.intent.action.VIEW;` +
    `category=android.intent.category.BROWSABLE;` +
    `package=${NAVER_MAP_ANDROID_PACKAGE};end`;

  if (isAndroid) {
    tryOpenDeepLink(nmapUrl, { fallback, intentUrl });
    return;
  }

  if (isIOS) {
    tryOpenDeepLink(nmapUrl, { fallback });
    return;
  }

  window.open(
    buildNaverMapWebFallbackUrl(fallback.targetUrl, fallback.context),
    "_blank",
    "noopener,noreferrer",
  );
}

/**
 * 배너 등 길안내 CTA — 앱 스킴 우선, 실패·데이터 부족 시 fallback 팝업에서 웹 URL 계산.
 * 1. placeId (또는 map.naver.com URL에서 추출) → intent/nmap
 * 2. lat/lon/name → intent/nmap
 * 3. url / 장소명만 → 즉시 웹 (좌표 없어도 동작)
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
  const context: NaverMapFallbackContext = {
    lat: input.lat,
    lon: input.lon,
    name: input.name?.trim(),
  };
  const targetUrl = input.url?.trim();

  if (placeId) {
    openNaverMapPlace(placeId, { targetUrl, context });
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
      targetUrl,
    });
    return;
  }

  const webUrl = buildNaverMapWebFallbackUrl(targetUrl ?? "nmap://", context);
  if (webUrl.startsWith("http")) {
    openNaverMapWebFallback(webUrl);
  }
}

import { promptNaverMapFallback } from "@/lib/mapDirectionFallback";

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

function navigateToUrl(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

const DEEP_LINK_FALLBACK_MS = 1500;

function tryOpenDeepLink(
  deepLink: string,
  options?: { webFallback?: string },
) {
  const { isIOS, isAndroid } = getMobileEnv();
  const webFallback = options?.webFallback;

  if (!isIOS && !isAndroid) {
    if (webFallback) {
      window.open(webFallback, "_blank", "noopener,noreferrer");
    }
    return;
  }

  let appOpened = false;
  const onHide = () => {
    appOpened = true;
    document.removeEventListener("visibilitychange", onHide);
  };
  document.addEventListener("visibilitychange", onHide);

  if (isAndroid) {
    window.location.href = deepLink;
  } else {
    navigateToUrl(deepLink);
  }

  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    if (appOpened) return;
    if (webFallback && (isIOS || isAndroid)) {
      promptNaverMapFallback(webFallback, isIOS ? "ios" : "android");
      return;
    }
    if (webFallback) {
      openNaverMapWebFallback(webFallback);
    }
  }, DEEP_LINK_FALLBACK_MS);
}

/** 딥링크 실패·좌표 없음 등 최종 웹 fallback (모바일 포함) */
export function openNaverMapWebFallback(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * 카드 등에서 네이버 지도를 열 때 사용.
 * - lat/lon 있음: 해당 좌표를 지도 중심으로 이동(주소 검색 아님).
 * - 없음: 매장명만으로 통합 검색(정밀 좌표 없을 때 대비).
 */
export function buildNaverMapOpenUrl(input: MapDirectionInput): string {
  const { name, lat, lon } = input;
  if (hasValidCoords(lat, lon) && lat != null && lon != null) {
    const { x, y } = wgs84ToWebMercator(lon, lat);
    return `https://map.naver.com/v5/?c=${x},${y},18,0,0,0,dh`;
  }
  const q = name.trim();
  return `https://map.naver.com/v5/search/${encodeURIComponent(q)}`;
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
    tryOpenDeepLink(intentUrl, { webFallback: webUrl });
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
 * - Android: Intent URI 사용 → 앱 미설치 시 Play Store 자동 이동
 * - iOS: nmap:// 스킴 시도 후 실패 시 App Store·웹 선택 팝업
 * - 데스크탑/기타: 웹 네이버지도 새 탭
 */
export function openNaverMapsApp(input: MapDirectionInput): void {
  const { name, lat, lon } = input;
  const { isIOS, isAndroid } = getMobileEnv();

  if (!hasValidCoords(lat, lon) || lat == null || lon == null) {
    window.open(
      `https://map.naver.com/v5/search/${encodeURIComponent(name.trim())}`,
      "_blank",
      "noopener,noreferrer",
    );
    return;
  }

  const appName = getNaverMapAppName();

  if (isAndroid) {
    window.location.href =
      `intent://map?lat=${lat}&lng=${lon}&zoom=16&appname=${appName}` +
      `#Intent;scheme=nmap;action=android.intent.action.VIEW;` +
      `category=android.intent.category.BROWSABLE;package=${NAVER_MAP_ANDROID_PACKAGE};end`;
    return;
  }

  if (isIOS) {
    const appUrl = `nmap://map?lat=${lat}&lng=${lon}&zoom=16&appname=${appName}`;
    const webUrl = buildNaverMapOpenUrl({ name, lat, lon });
    tryOpenDeepLink(appUrl, { webFallback: webUrl });
    return;
  }

  const { x, y } = wgs84ToWebMercator(lon, lat);
  window.open(
    `https://map.naver.com/v5/?c=${x},${y},18,0,0,0,dh`,
    "_blank",
    "noopener,noreferrer",
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
    return `https://map.naver.com/p/entry/place/${placeId}?placePath=%2Fhome`;
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
    webFallback ??
    `https://map.naver.com/p/entry/place/${placeId}?placePath=%2Fhome`;
  const appName = getNaverMapAppName();
  const { isAndroid, isIOS } = getMobileEnv();
  const nmapUrl = `nmap://place?id=${placeId}&appname=${appName}`;
  const intentUrl =
    `intent://place?id=${placeId}&appname=${appName}` +
    `#Intent;scheme=nmap;action=android.intent.action.VIEW;` +
    `category=android.intent.category.BROWSABLE;` +
    `package=${NAVER_MAP_ANDROID_PACKAGE};end`;

  if (isAndroid) {
    tryOpenDeepLink(intentUrl, { webFallback: webUrl });
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

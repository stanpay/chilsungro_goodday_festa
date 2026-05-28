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

const NAVER_MAP_IOS_STORE =
  "https://apps.apple.com/kr/app/naver-map-navigation/id311867728";
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

function tryOpenDeepLink(
  deepLink: string,
  options?: { webFallback?: string; iosStoreFallback?: boolean },
) {
  const { isIOS, isAndroid } = getMobileEnv();

  if (!isIOS && !isAndroid) {
    if (options?.webFallback) {
      window.open(options.webFallback, "_blank", "noopener,noreferrer");
    }
    return;
  }

  if (isAndroid) {
    window.location.href = deepLink;
    return;
  }

  let appOpened = false;
  const onHide = () => {
    appOpened = true;
    document.removeEventListener("visibilitychange", onHide);
  };
  document.addEventListener("visibilitychange", onHide);

  navigateToUrl(deepLink);

  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    if (appOpened) return;
    if (options?.iosStoreFallback) {
      window.open(NAVER_MAP_IOS_STORE, "_blank", "noopener,noreferrer");
      return;
    }
    if (options?.webFallback) {
      window.location.href = options.webFallback;
    }
  }, 1500);
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
  const webUrl = buildNaverMapOpenUrl({ name, lat, lon });
  return { nmapUrl, intentUrl, webUrl };
}

/**
 * 네이버지도 앱 딥링크로 장소 마커를 연다 (공식 place?lat/lng/name 스킴).
 */
export function openNaverMapMarker(input: {
  lat: number;
  lon: number;
  name: string;
}): void {
  const { lat, lon, name } = input;
  if (!hasValidCoords(lat, lon)) return;

  const { nmapUrl, intentUrl, webUrl } = buildNaverMapMarkerDeepLinks({
    lat,
    lon,
    name,
  });
  const { isIOS, isAndroid } = getMobileEnv();

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
 * 네이버지도 앱 딥링크로 매장 위치를 열어준다.
 * - Android: Intent URI 사용 → 앱 미설치 시 Play Store 자동 이동
 * - iOS: nmap:// 스킴 시도 후 1.5s 대기 → 앱 미설치 시 App Store 이동
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
    tryOpenDeepLink(appUrl, { iosStoreFallback: true });
    return;
  }

  const { x, y } = wgs84ToWebMercator(lon, lat);
  window.open(
    `https://map.naver.com/v5/?c=${x},${y},18,0,0,0,dh`,
    "_blank",
    "noopener,noreferrer",
  );
}

/**
 * 네이버 지도 장소 ID(place)로 연다. 가능하면 lat/lng/name 딥링크를 우선 사용하세요.
 */
export function openNaverMapPlace(
  placeId: string,
  options?: { lat?: number; lon?: number; name?: string },
): void {
  if (
    hasValidCoords(options?.lat, options?.lon) &&
    options?.lat != null &&
    options?.lon != null &&
    options?.name
  ) {
    openNaverMapMarker({
      lat: options.lat,
      lon: options.lon,
      name: options.name,
    });
    return;
  }

  const webUrl = `https://map.naver.com/p/entry/place/${placeId}?placePath=%2Fhome`;
  const appName = getNaverMapAppName();
  const { isAndroid, isIOS } = getMobileEnv();
  const nmapUrl = `nmap://place?id=${placeId}&appname=${appName}`;
  const intentUrl =
    `intent://place?id=${placeId}&appname=${appName}` +
    `#Intent;scheme=nmap;action=android.intent.action.VIEW;` +
    `category=android.intent.category.BROWSABLE;` +
    `package=${NAVER_MAP_ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;

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

export function openNaverMapDirections(input: {
  lat?: number;
  lon?: number;
  name?: string;
  placeId?: string;
  url?: string;
}): void {
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
    });
    return;
  }

  if (input.placeId) {
    openNaverMapPlace(input.placeId, {
      lat: input.lat,
      lon: input.lon,
      name: input.name,
    });
    return;
  }

  if (input.url) {
    const { isIOS, isAndroid } = getMobileEnv();
    if (isIOS || isAndroid) {
      window.location.href = input.url;
      return;
    }
    window.open(input.url, "_blank", "noopener,noreferrer");
  }
}

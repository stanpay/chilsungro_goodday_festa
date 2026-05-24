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

const NAVER_MAP_IOS_STORE = "https://apps.apple.com/kr/app/naver-map-navigation/id311867728";
const NAVER_MAP_ANDROID_STORE = "https://play.google.com/store/apps/details?id=com.nhn.android.nmap";

/**
 * 네이버지도 앱 딥링크로 매장 위치를 열어준다.
 * - Android: Intent URI 사용 → 앱 미설치 시 Play Store 자동 이동
 * - iOS: nmap:// 스킴 시도 후 1.5s 대기 → 앱 미설치 시 App Store 이동
 * - 데스크탑/기타: 웹 네이버지도 새 탭
 */
export function openNaverMapsApp(input: MapDirectionInput): void {
  const { name, lat, lon } = input;
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);

  if (!hasValidCoords(lat, lon) || lat == null || lon == null) {
    window.open(
      `https://map.naver.com/v5/search/${encodeURIComponent(name.trim())}`,
      "_blank",
      "noopener,noreferrer"
    );
    return;
  }

  if (isAndroid) {
    // Intent URI: 앱 설치 시 Naver Maps 앱, 미설치 시 Play Store 자동 이동
    window.location.href =
      `intent://map?lat=${lat}&lng=${lon}&zoom=16&appname=com.stan.app` +
      `#Intent;scheme=nmap;action=android.intent.action.VIEW;` +
      `category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;end`;
    return;
  }

  if (isIOS) {
    const appUrl = `nmap://map?lat=${lat}&lng=${lon}&zoom=16&appname=com.stan.app`;
    let appOpened = false;

    const onHide = () => {
      appOpened = true;
      document.removeEventListener("visibilitychange", onHide);
    };
    document.addEventListener("visibilitychange", onHide);

    window.location.href = appUrl;

    setTimeout(() => {
      document.removeEventListener("visibilitychange", onHide);
      if (!appOpened) {
        window.open(NAVER_MAP_IOS_STORE, "_blank", "noopener,noreferrer");
      }
    }, 1500);
    return;
  }

  // 데스크탑
  const { x, y } = wgs84ToWebMercator(lon, lat);
  window.open(
    `https://map.naver.com/v5/?c=${x},${y},18,0,0,0,dh`,
    "_blank",
    "noopener,noreferrer"
  );
}

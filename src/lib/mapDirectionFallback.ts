import { getStoredLocale, type AppLocale } from "@/lib/locale";
import { isInStandaloneMode, openExternalUrl } from "@/lib/pwa";

export const NAVER_MAP_FALLBACK_EVENT = "naver-map:fallback";

/** @deprecated NAVER_MAP_FALLBACK_EVENT 사용 */
export const NAVER_MAP_ANDROID_FALLBACK_EVENT = NAVER_MAP_FALLBACK_EVENT;

export type NaverMapFallbackPlatform = "ios" | "android";

export type NaverMapFallbackContext = {
  lat?: number;
  lon?: number;
  name?: string;
};

export type NaverMapFallbackDetail = {
  platform: NaverMapFallbackPlatform;
  /** 리다이렉트·nmap 등 — 팝업 표시 시 웹 URL 계산에 사용 */
  targetUrl?: string;
  context?: NaverMapFallbackContext;
  /** 미리 계산된 URL (DevTools 등), 또는 naver.me·place 등 그대로 열 HTTPS URL */
  webFallbackUrl?: string;
};

/** @deprecated NaverMapFallbackDetail 사용 */
export type NaverMapAndroidFallbackDetail = NaverMapFallbackDetail;

export const NAVER_MAP_IOS_STORE_URL =
  "https://apps.apple.com/kr/app/naver-map-navigation/id311867728";

export const NAVER_MAP_ANDROID_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.nhn.android.nmap";

const COPY: Record<
  AppLocale,
  {
    title: string;
    install: string;
    web: string;
    close: string;
  }
> = {
  ko: {
    title: "네이버 지도를 열 수 없습니다",
    install: "네이버 지도 설치",
    web: "웹 지도로 보기",
    close: "닫기",
  },
  en: {
    title: "Cannot open Naver Map",
    install: "Install Naver Map",
    web: "Open web map",
    close: "Close",
  },
  zh: {
    title: "无法打开 Naver 地图",
    install: "安装 Naver 地图",
    web: "在网页地图中查看",
    close: "关闭",
  },
  ja: {
    title: "Naverマップを開けません",
    install: "Naverマップをインストール",
    web: "Web地図で見る",
    close: "閉じる",
  },
};

export function getNaverMapFallbackCopy(locale?: AppLocale) {
  const key = locale ?? getStoredLocale();
  return COPY[key] ?? COPY.ko;
}

/** @deprecated getNaverMapFallbackCopy 사용 */
export const getNaverMapAndroidFallbackCopy = getNaverMapFallbackCopy;

export function promptNaverMapFallback(detail: NaverMapFallbackDetail): void {
  window.dispatchEvent(
    new CustomEvent<NaverMapFallbackDetail>(NAVER_MAP_FALLBACK_EVENT, {
      detail,
    }),
  );
}

/** @deprecated promptNaverMapFallback 사용 */
export function promptNaverMapAndroidFallback(webFallbackUrl: string): void {
  promptNaverMapFallback({ platform: "android", webFallbackUrl });
}

export function openNaverMapIosStore(): void {
  window.location.href = NAVER_MAP_IOS_STORE_URL;
}

export function openNaverMapAndroidStore(): void {
  const marketUrl = "market://details?id=com.nhn.android.nmap";
  if (isInStandaloneMode()) {
    openExternalUrl(marketUrl, { targetBlank: true });
  } else {
    window.location.href = marketUrl;
  }
  window.setTimeout(() => {
    if (document.visibilityState === "visible") {
      window.open(NAVER_MAP_ANDROID_STORE_URL, "_blank", "noopener,noreferrer");
    }
  }, 1500);
}

export function openNaverMapStore(platform: NaverMapFallbackPlatform): void {
  if (platform === "ios") {
    openNaverMapIosStore();
    return;
  }
  openNaverMapAndroidStore();
}

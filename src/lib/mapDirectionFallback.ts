import { getStoredLocale, type AppLocale } from "@/lib/locale";

export const NAVER_MAP_FALLBACK_EVENT = "naver-map:fallback";

/** @deprecated NAVER_MAP_FALLBACK_EVENT 사용 */
export const NAVER_MAP_ANDROID_FALLBACK_EVENT = NAVER_MAP_FALLBACK_EVENT;

export type NaverMapFallbackPlatform = "ios" | "android";

export type NaverMapFallbackDetail = {
  webFallbackUrl: string;
  platform: NaverMapFallbackPlatform;
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
    description: string;
    install: string;
    web: string;
    close: string;
  }
> = {
  ko: {
    title: "네이버 지도를 열 수 없습니다",
    description:
      "네이버 지도 앱을 설치하거나 웹 지도에서 위치를 확인해 주세요.",
    install: "네이버 지도 설치",
    web: "웹 지도로 보기",
    close: "닫기",
  },
  en: {
    title: "Cannot open Naver Map",
    description: "Install the Naver Map app or view the location on the web.",
    install: "Install Naver Map",
    web: "Open web map",
    close: "Close",
  },
  zh: {
    title: "无法打开 Naver 地图",
    description: "请安装 Naver 地图应用，或在网页地图中查看位置。",
    install: "安装 Naver 地图",
    web: "在网页地图中查看",
    close: "关闭",
  },
  ja: {
    title: "Naverマップを開けません",
    description:
      "Naverマップアプリをインストールするか、Web地図で位置を確認してください。",
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

export function promptNaverMapFallback(
  webFallbackUrl: string,
  platform: NaverMapFallbackPlatform,
): void {
  window.dispatchEvent(
    new CustomEvent<NaverMapFallbackDetail>(NAVER_MAP_FALLBACK_EVENT, {
      detail: { webFallbackUrl, platform },
    }),
  );
}

/** @deprecated promptNaverMapFallback 사용 */
export function promptNaverMapAndroidFallback(webFallbackUrl: string): void {
  promptNaverMapFallback(webFallbackUrl, "android");
}

export function openNaverMapIosStore(): void {
  window.location.href = NAVER_MAP_IOS_STORE_URL;
}

export function openNaverMapAndroidStore(): void {
  const marketUrl = "market://details?id=com.nhn.android.nmap";
  window.location.href = marketUrl;
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

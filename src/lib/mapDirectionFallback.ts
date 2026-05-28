import { getStoredLocale, type AppLocale } from "@/lib/locale";
import { isInStandaloneMode, openExternalUrl } from "@/lib/pwa";

export const NAVER_MAP_FALLBACK_EVENT = "naver-map:fallback";

/** intent 실패 시 Chrome이 돌아오는 해시 (Play Store 대신 팝업 표시) */
export const NAVER_MAP_FALLBACK_HASH = "#naver-map-fallback";

const NAVER_MAP_FALLBACK_STORAGE_KEY = "naverMapFallbackPending";

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

/** Android intent 실패 시 팝업에 쓸 web URL·플랫폼을 저장 */
export function stashNaverMapFallbackForIntent(webFallbackUrl: string): void {
  sessionStorage.setItem(
    NAVER_MAP_FALLBACK_STORAGE_KEY,
    JSON.stringify({
      webFallbackUrl,
      platform: "android" satisfies NaverMapFallbackPlatform,
    }),
  );
}

export function clearStashedNaverMapFallback(): void {
  sessionStorage.removeItem(NAVER_MAP_FALLBACK_STORAGE_KEY);
}

function readStashedNaverMapFallback(): NaverMapFallbackDetail | null {
  const raw = sessionStorage.getItem(NAVER_MAP_FALLBACK_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as NaverMapFallbackDetail;
    if (parsed?.webFallbackUrl && parsed.platform) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

/** intent S.browser_fallback_url 로 돌아온 뒤 설치/웹 선택 팝업 표시 */
export function resumeNaverMapFallbackFromNavigation(): void {
  const fromHash = window.location.hash === NAVER_MAP_FALLBACK_HASH;
  const stashed = readStashedNaverMapFallback();
  if (!fromHash && !stashed) return;

  clearStashedNaverMapFallback();
  if (fromHash) {
    history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  }

  promptNaverMapFallback(
    stashed?.webFallbackUrl ?? "https://map.naver.com/",
    stashed?.platform ?? "android",
  );
}

/**
 * Android Chrome: package만 있으면 미설치 시 Play Store로 이동.
 * S.browser_fallback_url을 넣으면 실패 시 해당 URL(현재 페이지)로 복귀한다.
 */
export function appendAndroidIntentBrowserFallback(
  intentUrl: string,
  webFallbackUrl: string,
): string {
  stashNaverMapFallbackForIntent(webFallbackUrl);
  const fallbackTarget = encodeURIComponent(
    `${window.location.origin}${window.location.pathname}${window.location.search}${NAVER_MAP_FALLBACK_HASH}`,
  );
  if (intentUrl.endsWith(";end")) {
    return intentUrl.replace(
      ";end",
      `;S.browser_fallback_url=${fallbackTarget};end`,
    );
  }
  return `${intentUrl};S.browser_fallback_url=${fallbackTarget};end`;
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

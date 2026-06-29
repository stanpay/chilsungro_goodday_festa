import { getStoredLocale, type AppLocale } from "@/lib/locale";
import { isInStandaloneMode, openExternalUrl } from "@/lib/pwa";

export const NAVER_MAP_FALLBACK_EVENT = "naver-map:fallback";

/** intent 실패 시 Chrome이 돌아오는 해시 (Play Store 대신 팝업 표시) */
export const NAVER_MAP_FALLBACK_HASH = "#naver-map-fallback";

const NAVER_MAP_FALLBACK_STORAGE_KEY = "naverMapFallbackPending";

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
  /** 미리 계산된 URL (DevTools 등). 없으면 targetUrl+context로 계산 */
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

/** Android intent 실패 시 팝업에 쓸 fallback 정보 저장 */
export function stashNaverMapFallbackForIntent(
  detail: NaverMapFallbackDetail,
): void {
  sessionStorage.setItem(
    NAVER_MAP_FALLBACK_STORAGE_KEY,
    JSON.stringify(detail),
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
    if (
      parsed?.platform &&
      (parsed.webFallbackUrl || parsed.targetUrl || parsed.context)
    ) {
      return parsed;
    }
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

  promptNaverMapFallback({
    platform: stashed?.platform ?? "android",
    targetUrl: stashed?.targetUrl,
    context: stashed?.context,
    webFallbackUrl: stashed?.webFallbackUrl,
  });
}

/**
 * Android Chrome: package만 있으면 미설치 시 Play Store로 이동.
 * S.browser_fallback_url을 넣으면 실패 시 해당 URL(현재 페이지)로 복귀한다.
 */
export function appendAndroidIntentBrowserFallback(
  intentUrl: string,
  fallback: NaverMapFallbackDetail,
): string {
  stashNaverMapFallbackForIntent(fallback);
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

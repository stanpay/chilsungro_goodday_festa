import {
  buildNaverMapOpenUrl,
  openNativeDeepLink,
  openNaverMapMarker,
  openNaverMapPlace,
  openNaverMapWebFallback,
  parsePlaceIdFromNaverUrl,
} from "@/lib/mapDirectionLinks";
import { isInStandaloneMode, openExternalUrl } from "@/lib/pwa";

const NAVER_MAP_ANDROID_PACKAGE = "com.nhn.android.nmap";
const REDIRECT_CACHE = new Map<string, string>();
const MAX_REDIRECT_HOPS = 8;

export type StoreRedirectContext = {
  lat?: number;
  lon?: number;
  name?: string;
};

function isMapRelatedUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.startsWith("nmap://") ||
    lower.startsWith("intent://") ||
    lower.includes("map.naver.com") ||
    lower.includes("naver.me/")
  );
}

/** HTTP 리다이렉트 체인을 따라 최종 URL을 반환 */
export async function resolveRedirectTarget(
  redirectUrl: string,
): Promise<string> {
  let current = redirectUrl;

  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop += 1) {
    const response = await fetch(current, {
      method: "GET",
      redirect: "manual",
      credentials: "omit",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      if (!location) break;
      current = new URL(location, current).href;
      continue;
    }

    break;
  }

  return current;
}

export function prefetchStoreRedirect(redirectUrl: string): void {
  if (!redirectUrl || REDIRECT_CACHE.has(redirectUrl)) return;

  void resolveRedirectTarget(redirectUrl)
    .then((resolved) => {
      REDIRECT_CACHE.set(redirectUrl, resolved);
    })
    .catch(() => {
      /* prefetch 실패는 클릭 시 재시도 */
    });
}

export function prefetchStoreRedirects(redirectUrls: string[]): void {
  for (const url of redirectUrls) {
    prefetchStoreRedirect(url);
  }
}

function buildIntentFromNmap(nmapUrl: string): string {
  const withoutScheme = nmapUrl.replace(/^nmap:\/\//, "");
  return (
    `intent://${withoutScheme}` +
    `#Intent;scheme=nmap;action=android.intent.action.VIEW;` +
    `category=android.intent.category.BROWSABLE;` +
    `package=${NAVER_MAP_ANDROID_PACKAGE};end`
  );
}

function launchMapTarget(
  targetUrl: string,
  context?: StoreRedirectContext,
): void {
  const webFallback =
    isMapRelatedUrl(targetUrl) && targetUrl.startsWith("http")
      ? targetUrl
      : context?.name
        ? buildNaverMapOpenUrl({
            name: context.name,
            lat: context.lat,
            lon: context.lon,
          })
        : targetUrl;

  if (targetUrl.startsWith("nmap://")) {
    openNativeDeepLink(targetUrl, {
      webFallback,
      intentUrl: buildIntentFromNmap(targetUrl),
    });
    return;
  }

  if (targetUrl.startsWith("intent://")) {
    openNativeDeepLink(targetUrl, { webFallback });
    return;
  }

  const placeId = parsePlaceIdFromNaverUrl(targetUrl);
  if (placeId) {
    openNaverMapPlace(placeId, webFallback);
    return;
  }

  if (
    context?.lat != null &&
    context?.lon != null &&
    context.name?.trim() &&
    isMapRelatedUrl(targetUrl)
  ) {
    openNaverMapMarker({
      lat: context.lat,
      lon: context.lon,
      name: context.name.trim(),
      webFallback,
    });
    return;
  }

  if (isInStandaloneMode()) {
    openExternalUrl(targetUrl, { targetBlank: true });
    return;
  }

  openNaverMapWebFallback(targetUrl);
}

function launchResolvedTarget(
  targetUrl: string,
  context?: StoreRedirectContext,
): void {
  if (isMapRelatedUrl(targetUrl)) {
    launchMapTarget(targetUrl, context);
    return;
  }

  if (isInStandaloneMode()) {
    openExternalUrl(targetUrl, { targetBlank: true });
    return;
  }

  window.open(targetUrl, "_blank", "noopener,noreferrer");
}

async function openStoreRedirectInPwa(
  redirectUrl: string,
  context?: StoreRedirectContext,
): Promise<void> {
  const cached = REDIRECT_CACHE.get(redirectUrl);
  if (cached) {
    launchResolvedTarget(cached, context);
    return;
  }

  try {
    const resolved = await resolveRedirectTarget(redirectUrl);
    REDIRECT_CACHE.set(redirectUrl, resolved);
    launchResolvedTarget(resolved, context);
  } catch {
    openExternalUrl(redirectUrl, { targetBlank: true });
  }
}

/**
 * 스토어 카드 리다이렉트 URL 실행.
 * - PWA: redirect를 클라이언트에서 해석 → nmap:// 직접 실행(브라우저 선택 회피)
 * - 일반 브라우저: 기존처럼 redirect URL을 새 탭에서 열기
 */
export function openStoreRedirect(
  redirectUrl: string,
  context?: StoreRedirectContext,
): void {
  if (!redirectUrl) return;

  if (!isInStandaloneMode()) {
    window.open(redirectUrl, "_blank", "noopener,noreferrer");
    return;
  }

  void openStoreRedirectInPwa(redirectUrl, context);
}

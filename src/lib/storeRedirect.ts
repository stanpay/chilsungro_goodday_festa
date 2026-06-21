import {
  buildNaverMapOpenUrl,
  buildNaverMapWebUrlFromScheme,
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
      // nmap/intent 등 fetch로 따라갈 수 없는 스킴은 여기서 종료
      if (!/^https?:/i.test(current)) break;
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

function toNmapUrl(url: string): string | null {
  if (url.startsWith("nmap://")) return url;
  if (url.startsWith("intent://")) {
    const path = url.match(/^intent:\/\/([^#]+)/)?.[1];
    return path ? `nmap://${path}` : null;
  }
  return null;
}

function isNativeMapScheme(url: string): boolean {
  return url.startsWith("nmap://") || url.startsWith("intent://");
}

function resolveWebFallbackUrl(
  targetUrl: string,
  context?: StoreRedirectContext,
): string {
  if (isMapRelatedUrl(targetUrl) && targetUrl.startsWith("http")) {
    return targetUrl;
  }

  if (isNativeMapScheme(targetUrl)) {
    const httpsUrl = buildNaverMapWebUrlFromScheme(targetUrl, context);
    if (httpsUrl) return httpsUrl;
  }

  if (context?.name?.trim()) {
    return buildNaverMapOpenUrl({
      name: context.name,
      lat: context.lat,
      lon: context.lon,
    });
  }

  return targetUrl;
}

function openNmapOnWeb(
  schemeUrl: string,
  context?: StoreRedirectContext,
): boolean {
  if (isInStandaloneMode()) return false;

  const httpsUrl = resolveWebFallbackUrl(schemeUrl, context);
  if (!httpsUrl.startsWith("http")) return false;

  openNaverMapWebFallback(httpsUrl);
  return true;
}

function launchMapTarget(
  targetUrl: string,
  context?: StoreRedirectContext,
): void {
  const webFallback = resolveWebFallbackUrl(targetUrl, context);

  if (isNativeMapScheme(targetUrl)) {
    // 일반 웹: redirect 1차 응답이 nmap이면 앱 시도 없이 HTTPS로 바로 연다
    if (openNmapOnWeb(targetUrl, context)) return;

    const nmapUrl = toNmapUrl(targetUrl) ?? targetUrl;

    openNativeDeepLink(nmapUrl, {
      webFallback,
      intentUrl: buildIntentFromNmap(nmapUrl),
    });
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

async function openStoreRedirectResolved(
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
    const httpsUrl = context?.name?.trim()
      ? resolveWebFallbackUrl("nmap://", context)
      : undefined;

    if (httpsUrl?.startsWith("http")) {
      openNaverMapWebFallback(httpsUrl);
      return;
    }

    if (isInStandaloneMode()) {
      openExternalUrl(redirectUrl, { targetBlank: true });
      return;
    }

    window.open(redirectUrl, "_blank", "noopener,noreferrer");
  }
}

/**
 * 스토어 카드 리다이렉트 URL 실행.
 * redirect를 클라이언트에서 해석한 뒤 nmap:// → HTTPS fallback 등 지도 링크 처리.
 */
export function openStoreRedirect(
  redirectUrl: string,
  context?: StoreRedirectContext,
): void {
  if (!redirectUrl) return;

  void openStoreRedirectResolved(redirectUrl, context);
}

import {
  buildNaverMapCoordEntryUrl,
  buildNaverMapOpenUrl,
  buildNaverMapWebFallbackUrl,
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
const STORE_REDIRECT_RESOLVE_PATH = "/api/store-redirect-target";
const STORE_API_REDIRECT_PATH_RE = /\/redirect\/\d+\/?$/;

export type StoreRedirectContext = {
  lat?: number;
  lon?: number;
  name?: string;
};

/** PWA·모바일 웹이 아닌 데스크톱 브라우저 — nmap/intent 시도 없이 HTTPS 웹으로 바로 연다 */
function isDesktopWebBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  if (isInStandaloneMode()) return false;
  return !/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function isNaverMeUrl(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase() === "naver.me";
  } catch {
    return /naver\.me(\/|$)/i.test(url);
  }
}

function isStoreApiRedirectUrl(url: string): boolean {
  try {
    return STORE_API_REDIRECT_PATH_RE.test(new URL(url).pathname);
  } catch {
    return /\/redirect\/\d+/.test(url);
  }
}

function shouldOpenRedirectUrlDirectlyOnDesktop(url: string): boolean {
  return (
    isNaverMeUrl(url) ||
    isStoreApiRedirectUrl(url) ||
    parsePlaceIdFromNaverUrl(url) != null
  );
}

function buildDesktopRegeneratedUrl(
  context?: StoreRedirectContext,
): string | undefined {
  if (
    context?.lat != null &&
    context?.lon != null &&
    !Number.isNaN(context.lat) &&
    !Number.isNaN(context.lon)
  ) {
    return buildNaverMapCoordEntryUrl(
      context.lon,
      context.lat,
      context.name?.trim(),
    );
  }
  if (!context?.name?.trim()) return undefined;
  return buildNaverMapOpenUrl({ name: context.name });
}

/** 데스크톱: naver.me·네이버 place URL이면 해당 URL만, 없으면 context로 재생성 후 단일 window.open */
async function openDesktopStoreRedirect(
  redirectUrl: string,
  context?: StoreRedirectContext,
): Promise<void> {
  let resolved = REDIRECT_CACHE.get(redirectUrl);
  const hasStaleApiRedirectCache =
    resolved === redirectUrl && isStoreApiRedirectUrl(redirectUrl);

  if (!resolved || hasStaleApiRedirectCache) {
    try {
      resolved = await resolveRedirectTarget(redirectUrl, { stopAtNaverMe: true });
      REDIRECT_CACHE.set(redirectUrl, resolved);
    } catch {
      resolved = redirectUrl;
    }
  }

  const targetUrl = shouldOpenRedirectUrlDirectlyOnDesktop(resolved)
    ? resolved
    : buildDesktopRegeneratedUrl(context) ?? resolved;

  openNaverMapWebFallback(targetUrl);
}

function isMapRelatedUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.startsWith("nmap://") ||
    lower.startsWith("intent://") ||
    lower.includes("map.naver.com") ||
    lower.includes("naver.me/")
  );
}

type ResolveRedirectOptions = {
  /** true면 체인 중 naver.me를 만나면 더 따라가지 않고 즉시 반환 */
  stopAtNaverMe?: boolean;
};

async function resolveRedirectTargetViaServer(
  redirectUrl: string,
  options?: ResolveRedirectOptions,
): Promise<string> {
  const params = new URLSearchParams({ url: redirectUrl });
  if (options?.stopAtNaverMe) {
    params.set("stopAtNaverMe", "1");
  }

  const response = await fetch(`${STORE_REDIRECT_RESOLVE_PATH}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`store redirect resolve failed: ${response.status}`);
  }

  const payload = (await response.json()) as { target?: string };
  if (!payload.target) {
    throw new Error("store redirect resolve missing target");
  }

  return payload.target;
}

/** HTTP 리다이렉트 체인을 따라 최종 URL을 반환 */
export async function resolveRedirectTarget(
  redirectUrl: string,
  options?: ResolveRedirectOptions,
): Promise<string> {
  if (options?.stopAtNaverMe && isNaverMeUrl(redirectUrl)) {
    return redirectUrl;
  }

  // 브라우저 fetch는 CORS로 Location 헤더를 읽지 못함 → 동일 출처 API로 해석
  if (isStoreApiRedirectUrl(redirectUrl)) {
    return resolveRedirectTargetViaServer(redirectUrl, options);
  }

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
      const next = new URL(location, current).href;

      if (options?.stopAtNaverMe && isNaverMeUrl(next)) {
        return next;
      }

      current = next;
      // nmap/intent 등 fetch로 따라갈 수 없는 스킴은 여기서 종료
      if (!/^https?:/i.test(current)) break;
      continue;
    }

    break;
  }

  return current;
}

export function prefetchStoreRedirect(redirectUrl: string): void {
  if (!redirectUrl) return;

  const cached = REDIRECT_CACHE.get(redirectUrl);
  if (cached && !(cached === redirectUrl && isStoreApiRedirectUrl(redirectUrl))) {
    return;
  }

  const stopAtNaverMe = isDesktopWebBrowser();
  void resolveRedirectTarget(redirectUrl, { stopAtNaverMe })
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

/**
 * 데스크톱 전용: redirect 해석 결과가 nmap/intent 이면 앱 시도 없이 HTTPS 로 변환해 새 탭.
 * 모바일(PWA·iOS·Android 웹)은 false 를 반환해 openNativeDeepLink 경로로 넘긴다.
 */
function openNmapOnWeb(
  schemeUrl: string,
  context?: StoreRedirectContext,
): boolean {
  // 모바일(iOS Safari·Android)은 nmap/intent 앱 시도 후 실패 시에만 웹으로 연다.
  if (!isDesktopWebBrowser()) return false;

  const httpsUrl = buildNaverMapWebFallbackUrl(schemeUrl, context);
  if (!httpsUrl.startsWith("http")) return false;

  openNaverMapWebFallback(httpsUrl);
  return true;
}

function launchMapTarget(
  targetUrl: string,
  context?: StoreRedirectContext,
): void {
  if (isNativeMapScheme(targetUrl)) {
    // 데스크톱: nmap/intent → HTTPS 변환 후 새 탭 (모바일은 아래 openNativeDeepLink)
    if (openNmapOnWeb(targetUrl, context)) return;

    const nmapUrl = toNmapUrl(targetUrl) ?? targetUrl;

    openNativeDeepLink(nmapUrl, {
      fallback: { targetUrl: nmapUrl, context },
      intentUrl: buildIntentFromNmap(nmapUrl),
    });
    return;
  }

  const placeId = parsePlaceIdFromNaverUrl(targetUrl);
  if (placeId) {
    openNaverMapPlace(placeId, { targetUrl, context });
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
      targetUrl,
    });
    return;
  }

  if (isInStandaloneMode()) {
    // PWA: 외부 HTTPS 는 anchor click 새 탭 (현재 SPA 유지)
    openExternalUrl(targetUrl, { targetBlank: true });
    return;
  }

  // 데스크톱·모바일 웹: map 관련 HTTPS 새 탭
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
    if (isInStandaloneMode()) {
      openExternalUrl(redirectUrl, { targetBlank: true });
      return;
    }

    window.open(redirectUrl, "_blank", "noopener,noreferrer");
  }
}

/**
 * 스토어 카드 리다이렉트 URL 실행.
 * - 데스크톱: API redirect 등을 따라 naver.me가 나오면 해당 URL만 연다. 없으면 context로 재생성해 단일 window.open
 * - PWA·모바일 웹: redirect를 클라이언트에서 해석한 뒤 nmap:// → HTTPS fallback 등 처리
 */
export function openStoreRedirect(
  redirectUrl: string,
  context?: StoreRedirectContext,
): void {
  if (!redirectUrl) return;

  if (isDesktopWebBrowser()) {
    void openDesktopStoreRedirect(redirectUrl, context);
    return;
  }

  void openStoreRedirectResolved(redirectUrl, context);
}

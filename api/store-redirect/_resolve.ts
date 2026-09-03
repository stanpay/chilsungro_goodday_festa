const MAX_REDIRECT_HOPS = 8;

export function isNaverMeHostname(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase() === "naver.me";
  } catch {
    return /naver\.me(\/|$)/i.test(url);
  }
}

/** 매장 API 호스트. 클라이언트의 VITE_ 값과 동일한 대상을 가리킨다. */
function storeApiHostname(): string | undefined {
  const base =
    process.env.STORE_API_BASE_URL ??
    process.env.VITE_STORE_API_BASE_URL ??
    "https://mac.kurl.kr:5001";
  try {
    return new URL(base).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/** 사설·링크로컬·루프백 IP 리터럴 차단 (화이트리스트가 넓어질 경우를 대비한 2차 방어) */
function isPrivateAddress(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (h === "localhost" || h === "::1" || h === "0.0.0.0") return true;
  if (/^fc|^fd|^fe80:/.test(h)) return true;

  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;

  const [a, b] = [Number(v4[1]), Number(v4[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

/** 이 엔드포인트가 대신 요청을 보내도 되는 호스트인가 */
function isFetchableHost(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }

  if (isPrivateAddress(hostname)) return false;

  const storeHost = storeApiHostname();
  if (storeHost && hostname === storeHost) return true;
  if (hostname === "naver.me") return true;
  // 매장 API redirect는 naver.me를 거쳐 네이버 지도로 이어진다
  if (hostname === "naver.com" || hostname.endsWith(".naver.com")) return true;

  return false;
}

/** 클라이언트가 이 엔드포인트에 넘길 수 있는 진입 URL인가 (매장 API redirect 또는 naver.me) */
export function isAllowedEntryUrl(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (isPrivateAddress(hostname)) return false;

  const storeHost = storeApiHostname();
  return (storeHost != null && hostname === storeHost) || hostname === "naver.me";
}

export type ResolveRedirectServerOptions = {
  stopAtNaverMe?: boolean;
};

/** 서버에서만 Location 헤더를 읽을 수 있어 브라우저 fetch 대신 사용 */
export async function resolveRedirectTargetServer(
  redirectUrl: string,
  options?: ResolveRedirectServerOptions,
): Promise<string> {
  if (options?.stopAtNaverMe && isNaverMeHostname(redirectUrl)) {
    return redirectUrl;
  }

  let current = redirectUrl;

  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop += 1) {
    // 매 hop마다 재검증한다. 허용 밖 호스트면 요청을 보내지 않고 그대로 반환한다
    // (SSRF의 위험은 "우리 서버가 대신 요청하는 것"이지 URL을 돌려주는 것이 아니다).
    if (!isFetchableHost(current)) return current;

    const response = await fetch(current, {
      method: "GET",
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      if (!location) break;
      const next = new URL(location, current).href;

      if (options?.stopAtNaverMe && isNaverMeHostname(next)) {
        return next;
      }

      current = next;
      if (!/^https?:/i.test(current)) break;
      continue;
    }

    break;
  }

  return current;
}

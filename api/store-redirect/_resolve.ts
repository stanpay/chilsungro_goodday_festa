const MAX_REDIRECT_HOPS = 8;

export function isNaverMeHostname(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase() === "naver.me";
  } catch {
    return /naver\.me(\/|$)/i.test(url);
  }
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

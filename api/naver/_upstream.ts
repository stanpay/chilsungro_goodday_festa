export type NaverCreds = { clientId: string; clientSecret: string };

export function resolveNaverCredsFromEnv(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): NaverCreds | null {
  const clientId =
    env.VITE_NAVER_API_KEY_ID ??
    env.NAVER_API_KEY_ID ??
    env.VITE_NAVER_NCP_KEY_ID ??
    env.VITE_NAVER_CLIENT_ID ??
    env.NAVER_CLIENT_ID;
  const clientSecret =
    env.VITE_NAVER_API_KEY ??
    env.NAVER_API_KEY ??
    env.VITE_NAVER_CLIENT_SECRET ??
    env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export async function fetchNaverUpstream(
  path: string,
  searchParams: URLSearchParams,
  creds: NaverCreds
): Promise<{ status: number; body: string }> {
  const url = new URL(`https://maps.apigw.ntruss.com${path}`);
  url.search = searchParams.toString();

  const upstream = await fetch(url.toString(), {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": creds.clientId,
      "X-NCP-APIGW-API-KEY": creds.clientSecret,
      Accept: "application/json",
    },
  });

  return { status: upstream.status, body: await upstream.text() };
}

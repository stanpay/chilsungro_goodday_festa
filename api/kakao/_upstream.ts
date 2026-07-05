export function resolveKakaoRestKeyFromEnv(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): string | null {
  const raw =
    env.KAKAO_REST_API_KEY ??
    env.VITE_KAKAO_REST_API_KEY ??
    env.KAKAO_API_KEY ??
    env.VITE_KAKAO_API_KEY ??
    env.KAKAO_REST_KEY ??
    env.VITE_KAKAO_REST_KEY;
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^["']|["']$/g, "");
  return trimmed.length > 0 ? trimmed : null;
}

export async function fetchKakaoKeywordSearch(
  searchParams: URLSearchParams,
  restApiKey: string
): Promise<{ status: number; body: string }> {
  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.search = searchParams.toString();

  const upstream = await fetch(url.toString(), {
    headers: {
      Authorization: `KakaoAK ${restApiKey}`,
      Accept: "application/json",
    },
  });

  return { status: upstream.status, body: await upstream.text() };
}

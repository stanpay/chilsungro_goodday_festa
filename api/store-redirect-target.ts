import { resolveRedirectTargetServer, isAllowedEntryUrl } from "./store-redirect/_resolve.js";
import { guardGetRequest, type ApiRequest, type ApiResponse } from "./_http.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!guardGetRequest(req, res)) return;

  const rawUrl = req.query.url;
  if (!rawUrl || typeof rawUrl !== "string") {
    return res.status(400).json({ error: "url is required" });
  }

  let redirectUrl: string;
  try {
    redirectUrl = new URL(rawUrl).href;
  } catch {
    return res.status(400).json({ error: "url is invalid" });
  }

  if (!/^https?:\/\//i.test(redirectUrl)) {
    return res.status(400).json({ error: "url must be http(s)" });
  }

  // 이 엔드포인트는 매장 API redirect와 naver.me 해석에만 쓰인다.
  // 호스트를 제한하지 않으면 서버가 임의 주소로 대신 요청을 보내는 통로가 된다.
  if (!isAllowedEntryUrl(redirectUrl)) {
    return res.status(400).json({ error: "url host is not allowed" });
  }

  const stopAtNaverMe = req.query.stopAtNaverMe === "1";

  try {
    const target = await resolveRedirectTargetServer(redirectUrl, { stopAtNaverMe });
    return res.status(200).json({ target });
  } catch (error) {
    // 실패를 조용히 삼키면 Vercel 로그에도 남지 않는다 (안내서 B-4)
    console.error("[store-redirect-target] resolve failed", redirectUrl, error);
    return res.status(502).json({ error: "Failed to resolve redirect" });
  }
}

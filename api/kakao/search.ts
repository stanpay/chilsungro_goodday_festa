import { fetchKakaoKeywordSearch } from "./_upstream.js";
import { getKakaoServerCredentials } from "./_credentials.js";
import { guardGetRequest, sendUpstreamJson, type ApiRequest, type ApiResponse } from "../_http.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!guardGetRequest(req, res)) return;

  const query = req.query.query;
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "query is required" });
  }

  const restApiKey = getKakaoServerCredentials();
  if (!restApiKey) {
    return res.status(500).json({ error: "Kakao REST API key not configured" });
  }

  // size와 마찬가지로 page도 클램프한다 (카카오 키워드 검색 최대 45페이지)
  const pageRaw = typeof req.query.page === "string" ? req.query.page : "1";
  const page = Math.min(Math.max(parseInt(pageRaw, 10) || 1, 1), 45);

  const sizeRaw = typeof req.query.size === "string" ? req.query.size : "15";
  const size = Math.min(Math.max(parseInt(sizeRaw, 10) || 15, 1), 15);

  const upstreamParams = new URLSearchParams({
    query,
    page: String(page),
    size: String(size),
  });

  const { status, body } = await fetchKakaoKeywordSearch(upstreamParams, restApiKey);

  return sendUpstreamJson(res, status, body);
}

import { fetchNaverUpstream } from "./_upstream.js";
import { getNaverServerCredentials } from "./_credentials.js";
import { normalizeGeocodeRestLanguage } from "./_language.js";
import { guardGetRequest, sendUpstreamJson, type ApiRequest, type ApiResponse } from "../_http.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!guardGetRequest(req, res)) return;

  const query = req.query.query;
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "query is required" });
  }

  const creds = getNaverServerCredentials();
  if (!creds) {
    return res.status(500).json({ error: "Naver API credentials not configured" });
  }

  const upstreamParams = new URLSearchParams({ query });
  if (req.query.count) upstreamParams.set("count", String(req.query.count));
  if (req.query.language) {
    upstreamParams.set("language", normalizeGeocodeRestLanguage(String(req.query.language)));
  }

  const { status, body } = await fetchNaverUpstream(
    "/map-geocode/v2/geocode",
    upstreamParams,
    creds
  );

  return sendUpstreamJson(res, status, body);
}

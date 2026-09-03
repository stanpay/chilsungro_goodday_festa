import { fetchNaverUpstream } from "./_upstream.js";
import { getNaverServerCredentials } from "./_credentials.js";
import { guardGetRequest, sendUpstreamJson, type ApiRequest, type ApiResponse } from "../_http.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!guardGetRequest(req, res)) return;

  const coords = req.query.coords;
  if (!coords || typeof coords !== "string") {
    return res.status(400).json({ error: "coords is required (longitude,latitude)" });
  }

  const creds = getNaverServerCredentials();
  if (!creds) {
    return res.status(500).json({ error: "Naver API credentials not configured" });
  }

  const upstreamParams = new URLSearchParams({
    coords,
    output: "json",
    sourcecrs: typeof req.query.sourcecrs === "string" ? req.query.sourcecrs : "epsg:4326",
    orders:
      typeof req.query.orders === "string" ? req.query.orders : "roadaddr,addr,admcode",
  });
  if (typeof req.query.request === "string") {
    upstreamParams.set("request", req.query.request);
  }

  const { status, body } = await fetchNaverUpstream(
    "/map-reversegeocode/v2/gc",
    upstreamParams,
    creds
  );

  return sendUpstreamJson(res, status, body);
}

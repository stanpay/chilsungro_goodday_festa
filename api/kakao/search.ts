import { fetchKakaoKeywordSearch } from "./_upstream.js";
import { getKakaoServerCredentials } from "./_credentials.js";

type Req = { method?: string; query: Record<string, string | string[] | undefined> };
type Res = {
  setHeader: (k: string, v: string) => void;
  status: (n: number) => { json: (b: unknown) => void; end: () => void; send: (b: string) => void };
};

export default async function handler(req: Req, res: Res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = req.query.query;
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "query is required" });
  }

  const restApiKey = getKakaoServerCredentials();
  if (!restApiKey) {
    return res.status(500).json({ error: "Kakao REST API key not configured" });
  }

  const page = typeof req.query.page === "string" ? req.query.page : "1";
  const sizeRaw = typeof req.query.size === "string" ? req.query.size : "15";
  const size = Math.min(Math.max(parseInt(sizeRaw, 10) || 15, 1), 15);

  const upstreamParams = new URLSearchParams({
    query,
    page,
    size: String(size),
  });

  const { status, body } = await fetchKakaoKeywordSearch(upstreamParams, restApiKey);

  res.setHeader("Content-Type", "application/json");
  return res.status(status).send(body);
}

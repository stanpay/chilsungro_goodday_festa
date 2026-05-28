import { fetchNaverUpstream } from "./_upstream";
import { getNaverServerCredentials } from "./_credentials";
import { normalizeGeocodeRestLanguage } from "./_language";

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

  res.setHeader("Content-Type", "application/json");
  return res.status(status).send(body);
}

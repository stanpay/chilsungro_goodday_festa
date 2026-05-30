import { fetchNaverUpstream } from "./_upstream.js";
import { getNaverServerCredentials } from "./_credentials.js";

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

  res.setHeader("Content-Type", "application/json");
  return res.status(status).send(body);
}

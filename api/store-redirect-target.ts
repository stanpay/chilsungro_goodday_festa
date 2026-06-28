import { resolveRedirectTargetServer } from "./store-redirect/_resolve.js";

type Req = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
};
type Res = {
  setHeader: (k: string, v: string) => void;
  status: (n: number) => {
    json: (b: unknown) => void;
    end: () => void;
  };
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

  const stopAtNaverMe = req.query.stopAtNaverMe === "1";

  try {
    const target = await resolveRedirectTargetServer(redirectUrl, { stopAtNaverMe });
    return res.status(200).json({ target });
  } catch {
    return res.status(502).json({ error: "Failed to resolve redirect" });
  }
}

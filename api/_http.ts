/**
 * /api 서버리스 함수 공용 전처리.
 *
 * 이 프록시들은 서버에 보관된 카카오 REST 키·네이버 NCP 자격증명으로 대신 호출하므로,
 * 개방되어 있으면 제3자가 우리 쿼터·과금으로 무제한 호출할 수 있다.
 *
 * 주의: Origin/Referer는 브라우저만 강제되는 값이라 curl 등 직접 호출은 막지 못한다.
 * 여기서 차단되는 것은 "다른 웹사이트가 우리 프록시를 공짜 게이트웨이로 임베드하는" 경로이고,
 * 스크립트 대량 호출 차단은 별도의 레이트리밋(Vercel KV / Upstash)이 필요하다.
 */

export type ApiRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
};

export type ApiResponse = {
  setHeader: (k: string, v: string) => void;
  status: (n: number) => {
    json: (b: unknown) => void;
    end: () => void;
    send: (b: string) => void;
  };
};

/** ALLOWED_ORIGINS 미설정 시 사용하는 운영 도메인 */
const DEFAULT_ALLOWED_ORIGINS = ["https://stan.ai.kr", "https://www.stan.ai.kr"];

function headerValue(req: ApiRequest, name: string): string | undefined {
  const raw = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? String(value) : undefined;
}

function safeOrigin(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

/**
 * 이 요청이 도달한 우리 자신의 출처.
 *
 * 운영 도메인이 코드에 하드코딩되어 있지 않고 모바일 WebView도 별도 env로 URL을 받으므로,
 * 자기 자신의 호스트는 항상 허용해야 한다. 이렇게 하면 도메인이 무엇이든 동일 출처 요청은
 * 통과하고, 차단 대상인 "다른 사이트에서의 호출"만 걸러진다.
 */
function selfOrigin(req: ApiRequest): string | undefined {
  const host = headerValue(req, "x-forwarded-host") ?? headerValue(req, "host");
  if (!host) return undefined;
  const proto = headerValue(req, "x-forwarded-proto") ?? "https";
  return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
}

export function getAllowedOrigins(req?: ApiRequest): string[] {
  const configured = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const origins = configured.length > 0 ? [...configured] : [...DEFAULT_ALLOWED_ORIGINS];

  // 요청이 실제로 도달한 호스트 (운영 도메인·프리뷰·모바일 WebView 대응)
  const own = req ? selfOrigin(req) : undefined;
  if (own) origins.push(own);

  // Vercel 배포 URL
  if (process.env.VERCEL_URL) origins.push(`https://${process.env.VERCEL_URL}`);
  if (process.env.VERCEL_BRANCH_URL) origins.push(`https://${process.env.VERCEL_BRANCH_URL}`);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    origins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }

  // 로컬 개발
  if (process.env.VERCEL_ENV !== "production") {
    origins.push("http://localhost:8080", "http://127.0.0.1:8080");
  }

  return origins;
}

/**
 * CORS 헤더를 세팅하고 요청 출처를 검증한다.
 *
 * 동일 출처 GET 요청에는 브라우저가 Origin을 보내지 않으므로 Origin 부재를 거부하면 앱이 깨진다.
 * 따라서 "존재하는 경우에만" 검증한다.
 */
function applyCors(req: ApiRequest, res: ApiResponse): boolean {
  const allowed = getAllowedOrigins(req);

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  const origin = headerValue(req, "origin");
  if (origin) {
    if (!allowed.includes(origin)) return false;
    res.setHeader("Access-Control-Allow-Origin", origin);
    return true;
  }

  // Origin이 없으면 동일 출처 요청이거나 브라우저가 아닌 호출.
  // Referer가 있는데 우리 도메인이 아니면 타 사이트에서 임베드한 것이다.
  const referer = headerValue(req, "referer");
  if (referer) {
    const refOrigin = safeOrigin(referer);
    if (refOrigin && !allowed.includes(refOrigin)) return false;
  }

  return true;
}

/** 공용 가드. false를 반환하면 이미 응답을 보냈으므로 핸들러는 즉시 종료해야 한다. */
export function guardGetRequest(req: ApiRequest, res: ApiResponse): boolean {
  if (!applyCors(req, res)) {
    res.status(403).json({ error: "Forbidden origin" });
    return false;
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return false;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return false;
  }
  return true;
}

/**
 * 업스트림 응답 전달. 2xx만 본문을 그대로 통과시키고,
 * 그 외에는 상태 코드만 유지한 채 표준 에러 객체로 바꾼다
 * (업스트림 오류 본문에 계정·키 관련 정보가 섞여 나올 수 있다).
 */
export function sendUpstreamJson(res: ApiResponse, status: number, body: string) {
  res.setHeader("Content-Type", "application/json");
  if (status >= 200 && status < 300) {
    return res.status(status).send(body);
  }
  return res.status(status).json({ error: "Upstream request failed", upstreamStatus: status });
}

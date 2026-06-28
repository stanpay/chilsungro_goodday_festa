import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolveNaverCredsFromEnv, fetchNaverUpstream } from "../api/naver/_upstream";
import { resolveRedirectTargetServer } from "../api/store-redirect/_resolve";
import { normalizeGeocodeRestLanguage } from "../src/lib/naverGeocodeLanguage";
function sendJson(res: ServerResponse, status: number, body: string) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(body);
}
function handleOptions(res: ServerResponse) {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.end();
}
async function handleStoreRedirectTarget(
    req: IncomingMessage,
    res: ServerResponse,
): Promise<boolean> {
    const rawUrl = req.url ?? "";
    if (!rawUrl.startsWith("/api/store-redirect-target")) {
        return false;
    }
    if (req.method === "OPTIONS") {
        handleOptions(res);
        return true;
    }
    if (req.method !== "GET") {
        sendJson(res, 405, JSON.stringify({ error: "Method not allowed" }));
        return true;
    }

    const parsed = new URL(rawUrl, "http://127.0.0.1");
    const redirectUrl = parsed.searchParams.get("url");
    if (!redirectUrl) {
        sendJson(res, 400, JSON.stringify({ error: "url is required" }));
        return true;
    }

    let normalized: string;
    try {
        normalized = new URL(redirectUrl).href;
    } catch {
        sendJson(res, 400, JSON.stringify({ error: "url is invalid" }));
        return true;
    }

    if (!/^https?:\/\//i.test(normalized)) {
        sendJson(res, 400, JSON.stringify({ error: "url must be http(s)" }));
        return true;
    }

    try {
        const target = await resolveRedirectTargetServer(normalized, {
            stopAtNaverMe: parsed.searchParams.get("stopAtNaverMe") === "1",
        });
        sendJson(res, 200, JSON.stringify({ target }));
        return true;
    } catch {
        sendJson(res, 502, JSON.stringify({ error: "Failed to resolve redirect" }));
        return true;
    }
}

async function handleNaverApi(req: IncomingMessage, res: ServerResponse, env: Record<string, string>): Promise<boolean> {
    const rawUrl = req.url ?? "";
    if (!rawUrl.startsWith("/api/naver/"))
        return false;
    if (req.method === "OPTIONS") {
        handleOptions(res);
        return true;
    }
    if (req.method !== "GET") {
        sendJson(res, 405, JSON.stringify({ error: "Method not allowed" }));
        return true;
    }
    const creds = resolveNaverCredsFromEnv(env);
    if (!creds) {
        sendJson(res, 500, JSON.stringify({ error: "Naver API credentials not configured" }));
        return true;
    }
    const parsed = new URL(rawUrl, "http://127.0.0.1");
    const params = parsed.searchParams;
    try {
        if (parsed.pathname === "/api/naver/geocode") {
            const query = params.get("query");
            if (!query) {
                sendJson(res, 400, JSON.stringify({ error: "query is required" }));
                return true;
            }
            const upstreamParams = new URLSearchParams({ query });
            if (params.get("count"))
                upstreamParams.set("count", params.get("count")!);
            if (params.get("language")) {
                upstreamParams.set("language", normalizeGeocodeRestLanguage(params.get("language")));
            }
            const { status, body } = await fetchNaverUpstream("/map-geocode/v2/geocode", upstreamParams, creds);
            sendJson(res, status, body);
            return true;
        }
        if (parsed.pathname === "/api/naver/reverse-geocode") {
            const coords = params.get("coords");
            if (!coords) {
                sendJson(res, 400, JSON.stringify({ error: "coords is required (longitude,latitude)" }));
                return true;
            }
            const upstreamParams = new URLSearchParams({
                coords,
                output: "json",
                sourcecrs: params.get("sourcecrs") ?? "epsg:4326",
                orders: params.get("orders") ?? "roadaddr,addr,admcode",
            });
            if (params.get("request"))
                upstreamParams.set("request", params.get("request")!);
            const { status, body } = await fetchNaverUpstream("/map-reversegeocode/v2/gc", upstreamParams, creds);
            sendJson(res, status, body);
            return true;
        }
        sendJson(res, 404, JSON.stringify({ error: "Not found" }));
        return true;
    }
    catch (error) {
        sendJson(res, 502, JSON.stringify({ error: "Upstream request failed" }));
        return true;
    }
}
/** Vite dev: http-proxy가 쿼리를 누락해 400이 나는 문제를 피하기 위한 로컬 API */
export function naverDevApiPlugin(env: Record<string, string>): Plugin {
    return {
        name: "naver-dev-api",
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                void handleStoreRedirectTarget(req, res).then((handled) => {
                    if (handled) return;
                    void handleNaverApi(req, res, env).then((handledNaver) => {
                        if (!handledNaver)
                            next();
                    });
                });
            });
        },
    };
}

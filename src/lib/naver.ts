import type { AppLocale } from "@/lib/locale";
import { buildGeocodeQueryVariants, getKnownCoordsForQuery, } from "@/lib/naverGeocodeFallback";
import { normalizeGeocodeRestLanguage } from "@/lib/naverGeocodeLanguage";
let naverLoaded = false;
let naverGeocoderLoaded = false;
export const NAVER_GEOCODE_SETUP_HINT = "네이버 클라우드 콘솔 > Maps > Application(stan) > 수정에서 Geocoding을 체크한 뒤 저장하세요. 사용량 화면에 'Geocoding' 행이 보여야 합니다. (Reverse Geocoding만 켜져 있으면 주소→좌표 검색은 403입니다)";
function normalizeNaverLanguageTag(input?: string | null): string {
    const tag = (input ?? "").trim().toLowerCase().replace(/_/g, "-");
    if (tag.startsWith("ko"))
        return "ko";
    if (tag.startsWith("ja"))
        return "ja";
    if (tag.startsWith("zh"))
        return "zh";
    if (tag.startsWith("en"))
        return "en";
    return "en";
}
function resolveNaverLanguage(preferredLanguage?: string): string {
    if (preferredLanguage)
        return normalizeNaverLanguageTag(preferredLanguage);
    if (typeof document !== "undefined" && document.documentElement.lang) {
        return normalizeNaverLanguageTag(document.documentElement.lang);
    }
    if (typeof navigator !== "undefined") {
        const first = navigator.languages?.[0] ?? navigator.language;
        return normalizeNaverLanguageTag(first);
    }
    return "en";
}
function buildNaverMapsScriptUrl(clientId: string, language: string, withGeocoder: boolean): string {
    const params = new URLSearchParams({
        ncpKeyId: clientId,
        language,
    });
    if (withGeocoder)
        params.set("submodules", "geocoder");
    return `https://oapi.map.naver.com/openapi/v3/maps.js?${params.toString()}`;
}
function getNaverMapClientId(): string {
    const env = (import.meta as any).env ?? {};
    const clientId = env.VITE_NAVER_NCP_KEY_ID ??
        env.VITE_NAVER_CLIENT_ID ??
        env.VITE_NAVER_MAP_CLIENT_ID ??
        env.VITE_NAVER_NCP_CLIENT_ID;
    if (!clientId) {
        throw new Error("VITE_NAVER_CLIENT_ID(또는 VITE_NAVER_NCP_KEY_ID)가 설정되지 않았습니다.");
    }
    return clientId;
}
export async function loadNaverMaps(preferredLanguage?: string, options?: {
    geocoder?: boolean;
}): Promise<void> {
    if (typeof window === "undefined")
        throw new Error("Window is undefined");
    const w = window as any;
    const withGeocoder = options?.geocoder === true;
    const clientId = getNaverMapClientId();
    const language = resolveNaverLanguage(preferredLanguage);
    const scriptUrl = buildNaverMapsScriptUrl(clientId, language, withGeocoder);
    let existing = document.querySelector('script[data-naver-maps="true"]') as HTMLScriptElement | null;
    if (existing && existing.src !== scriptUrl) {
        existing.remove();
        delete w.naver;
        naverLoaded = false;
        naverGeocoderLoaded = false;
        existing = null;
    }
    if (w.naver?.maps && naverLoaded && (!withGeocoder || naverGeocoderLoaded)) {
        return;
    }
    if (!existing || existing.src !== scriptUrl) {
        await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.setAttribute("data-naver-maps", "true");
            script.async = true;
            script.src = scriptUrl;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Naver Maps SDK 로드 실패 — Web 서비스 URL(http://localhost) 등록 및 ncpKeyId를 확인해주세요."));
            document.head.appendChild(script);
        });
    }
    else {
        await new Promise<void>((resolve) => {
            if ((window as any).naver?.maps) {
                resolve();
                return;
            }
            existing!.addEventListener("load", () => resolve(), { once: true });
        });
    }
    let retries = 0;
    while (!(w.naver?.maps) && retries < 50) {
        await new Promise((r) => setTimeout(r, 100));
        retries++;
    }
    if (!w.naver?.maps)
        throw new Error("Naver Maps SDK 초기화 실패");
    naverLoaded = true;
    if (withGeocoder) {
        retries = 0;
        while (!w.naver?.maps?.Service && retries < 50) {
            await new Promise((r) => setTimeout(r, 100));
            retries++;
        }
        naverGeocoderLoaded = !!w.naver?.maps?.Service;
    }
}
export interface NaverSearchResult {
    place_name: string;
    address_name: string;
    road_address_name: string;
    x: string;
    y: string;
    category_name?: string;
}
export interface NaverSearchResponse {
    documents: NaverSearchResult[];
    meta: {
        total_count: number;
        is_end: boolean;
    };
    geocodingForbidden?: boolean;
    usedFallbackCoords?: boolean;
}
const emptySearch: NaverSearchResponse = {
    documents: [],
    meta: { total_count: 0, is_end: true },
};
function mapGeocodeAddresses(addresses: any[], query: string): NaverSearchResult[] {
    return addresses.map((addr) => ({
        place_name: addr.roadAddress || addr.jibunAddress || query,
        address_name: addr.jibunAddress || "",
        road_address_name: addr.roadAddress || "",
        x: String(addr.x ?? ""),
        y: String(addr.y ?? ""),
    }));
}
function coordsToSearchResult(query: string, latitude: number, longitude: number): NaverSearchResponse {
    return {
        documents: [
            {
                place_name: query,
                address_name: query,
                road_address_name: "",
                x: String(longitude),
                y: String(latitude),
            },
        ],
        meta: { total_count: 1, is_end: true },
        usedFallbackCoords: true,
    };
}
async function searchAddressViaProxy(query: string, locale?: AppLocale): Promise<{
    documents: NaverSearchResult[];
    forbidden: boolean;
}> {
    const url = new URL("/api/naver/geocode", window.location.origin);
    url.searchParams.set("query", query.trim());
    url.searchParams.set("count", "10");
    if (locale) {
        url.searchParams.set("language", normalizeGeocodeRestLanguage(resolveNaverLanguage(locale)));
    }
    const res = await fetch(url.toString());
    if (!res.ok) {
        return { documents: [], forbidden: res.status === 403 };
    }
    const data = await res.json();
    if (data?.status !== "OK") {
        return { documents: [], forbidden: false };
    }
    const documents = mapGeocodeAddresses(data?.addresses ?? [], query);
    return { documents, forbidden: false };
}
function prioritizeJejuResults(results: NaverSearchResult[]): NaverSearchResult[] {
    const isJeju = (r: NaverSearchResult) => `${r.address_name}${r.road_address_name}`.includes("제주");
    const jeju = results.filter(isJeju);
    if (jeju.length === 0)
        return results;
    return [...jeju, ...results.filter((r) => !isJeju(r))];
}
/** Geocoding은 주소만 반환 — 장소명은 Kakao 키워드 검색으로 보완 */
async function searchPlaceViaKakao(query: string): Promise<NaverSearchResult[]> {
    try {
        const { searchAddress: kakaoSearch } = await import("@/lib/kakao");
        const result = await kakaoSearch(query.trim(), 1, 10);
        if (result.documents.length === 0)
            return [];
        const mapped = result.documents.map((doc) => ({
            place_name: doc.place_name,
            address_name: doc.address_name,
            road_address_name: doc.road_address_name,
            x: doc.x,
            y: doc.y,
            category_name: doc.category_name,
        }));
        return prioritizeJejuResults(mapped);
    }
    catch (error) {
        return [];
    }
}
async function searchAddressViaJs(query: string, locale?: AppLocale): Promise<NaverSearchResult[]> {
    await loadNaverMaps(locale, { geocoder: true });
    const naver = (window as any).naver;
    if (!naver?.maps?.Service) {
        return [];
    }
    return new Promise((resolve) => {
        const timeoutId = window.setTimeout(() => resolve([]), 10000);
        naver.maps.Service.geocode({ query: query.trim() }, (status: any, response: any) => {
            window.clearTimeout(timeoutId);
            if (status !== naver.maps.Service.Status.OK) {
                resolve([]);
                return;
            }
            const addresses: any[] = response?.v2?.addresses ?? [];
            resolve(mapGeocodeAddresses(addresses, query));
        });
    });
}
/** 주소·장소 검색: 주소 Geocoding → 장소명 Kakao → 알려진 제주 좌표 폴백 */
export async function searchAddress(query: string, locale?: AppLocale): Promise<NaverSearchResponse> {
    if (!query?.trim())
        return emptySearch;
    let geocodingForbidden = false;
    const variants = buildGeocodeQueryVariants(query);
    for (const variant of variants) {
        try {
            const fromProxy = await searchAddressViaProxy(variant, locale);
            if (fromProxy.forbidden)
                geocodingForbidden = true;
            if (fromProxy.documents.length > 0) {
                return {
                    documents: fromProxy.documents,
                    meta: { total_count: fromProxy.documents.length, is_end: true },
                    geocodingForbidden,
                };
            }
        }
        catch (error) {
        }
    }
    if (!geocodingForbidden) {
        for (const variant of variants) {
            try {
                const fromJs = await searchAddressViaJs(variant, locale);
                if (fromJs.length > 0) {
                    return {
                        documents: fromJs,
                        meta: { total_count: fromJs.length, is_end: true },
                    };
                }
            }
            catch (error) {
            }
        }
    }
    const fromKakao = await searchPlaceViaKakao(query);
    if (fromKakao.length > 0) {
        return {
            documents: fromKakao,
            meta: { total_count: fromKakao.length, is_end: true },
            geocodingForbidden,
        };
    }
    const known = getKnownCoordsForQuery(query);
    if (known) {
        return coordsToSearchResult(query, known.latitude, known.longitude);
    }
    return { ...emptySearch, geocodingForbidden };
}

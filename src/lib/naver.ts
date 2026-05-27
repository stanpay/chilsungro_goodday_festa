let naverLoaded = false;

function normalizeNaverLanguageTag(input?: string | null): string {
  const tag = (input ?? "").trim().toLowerCase().replace(/_/g, "-");
  if (tag.startsWith("ko")) return "ko";
  if (tag.startsWith("ja")) return "ja";
  if (tag.startsWith("zh")) return "zh";
  if (tag.startsWith("en")) return "en";
  return "en";
}

function resolveNaverLanguage(preferredLanguage?: string): string {
  if (preferredLanguage) return normalizeNaverLanguageTag(preferredLanguage);
  if (typeof document !== "undefined" && document.documentElement.lang) {
    return normalizeNaverLanguageTag(document.documentElement.lang);
  }
  if (typeof navigator !== "undefined") {
    const first = navigator.languages?.[0] ?? navigator.language;
    return normalizeNaverLanguageTag(first);
  }
  return "en";
}

function buildNaverMapsScriptUrl(clientId: string, language: string): string {
  return `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&submodules=geocoder&language=${encodeURIComponent(language)}`;
}

export async function loadNaverMaps(preferredLanguage?: string): Promise<void> {
  if (typeof window === "undefined") throw new Error("Window is undefined");
  const w = window as any;
  const env = (import.meta as any).env ?? {};
  const clientId =
    env.VITE_NAVER_NCP_KEY_ID ??
    env.VITE_NAVER_CLIENT_ID ??
    env.VITE_NAVER_MAP_CLIENT_ID ??
    env.VITE_NAVER_NCP_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      "VITE_NAVER_CLIENT_ID(또는 VITE_NAVER_NCP_KEY_ID)가 설정되지 않았습니다."
    );
  }

  const language = resolveNaverLanguage(preferredLanguage);
  const scriptUrl = buildNaverMapsScriptUrl(clientId, language);
  let existing = document.querySelector(
    'script[data-naver-maps="true"]'
  ) as HTMLScriptElement | null;

  if (existing && existing.src !== scriptUrl) {
    existing.remove();
    delete w.naver;
    naverLoaded = false;
    existing = null;
  }

  if (w.naver?.maps && naverLoaded) return;

  if (!existing) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.setAttribute("data-naver-maps", "true");
      script.async = true;
      script.src = scriptUrl;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(
          new Error(
            "Naver Maps SDK 로드 실패 — Web 서비스 URL(http://localhost) 등록 및 ncpKeyId를 확인해주세요."
          )
        );
      document.head.appendChild(script);
    });
  } else {
    await new Promise<void>((resolve) => {
      if ((window as any).naver?.maps) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
    });
  }

  let retries = 0;
  while (!(w.naver?.maps) && retries < 50) {
    await new Promise((r) => setTimeout(r, 100));
    retries++;
  }
  if (!w.naver?.maps) throw new Error("Naver Maps SDK 초기화 실패");

  retries = 0;
  while (!w.naver?.maps?.Service && retries < 50) {
    await new Promise((r) => setTimeout(r, 100));
    retries++;
  }
  if (!w.naver?.maps?.Service) {
    throw new Error(
      "Naver Maps Geocoder(submodules=geocoder) 로드 실패 — 콘솔에서 Geocoding 서비스를 활성화해주세요."
    );
  }

  naverLoaded = true;
}

// Location.tsx 에서 KakaoSearchResult 와 동일한 shape 를 기대하므로 호환 타입 유지
export interface NaverSearchResult {
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string; // longitude
  y: string; // latitude
}

export interface NaverSearchResponse {
  documents: NaverSearchResult[];
  meta: { total_count: number; is_end: boolean };
}

export async function searchAddress(
  query: string
): Promise<NaverSearchResponse> {
  if (!query?.trim()) {
    return { documents: [], meta: { total_count: 0, is_end: true } };
  }

  await loadNaverMaps();
  const naver = (window as any).naver;
  if (!naver?.maps?.Service) {
    return { documents: [], meta: { total_count: 0, is_end: true } };
  }

  return new Promise((resolve) => {
    naver.maps.Service.geocode({ query }, (status: any, response: any) => {
      if (status !== naver.maps.Service.Status.OK) {
        resolve({ documents: [], meta: { total_count: 0, is_end: true } });
        return;
      }
      const addresses: any[] = response.v2?.addresses ?? [];
      const documents: NaverSearchResult[] = addresses.map((addr) => ({
        place_name: addr.roadAddress || addr.jibunAddress || query,
        address_name: addr.jibunAddress || "",
        road_address_name: addr.roadAddress || "",
        x: addr.x || "",
        y: addr.y || "",
      }));
      resolve({
        documents,
        meta: { total_count: documents.length, is_end: true },
      });
    });
  });
}

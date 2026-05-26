let naverLoaded = false;

export async function loadNaverMaps(): Promise<void> {
  if (typeof window === "undefined") throw new Error("Window is undefined");
  const w = window as any;
  if (w.naver?.maps && naverLoaded) return;

  const clientId = (import.meta as any).env?.VITE_NAVER_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      "VITE_NAVER_CLIENT_ID is not set. 배포 환경에 환경 변수를 설정해주세요."
    );
  }

  const existing = document.querySelector(
    'script[data-naver-maps="true"]'
  ) as HTMLScriptElement | null;

  if (!existing) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.setAttribute("data-naver-maps", "true");
      script.async = true;
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}&submodules=geocoder`;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(
          new Error(
            "Naver Maps SDK 로드 실패 — 도메인 등록 여부 및 Client ID를 확인해주세요."
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

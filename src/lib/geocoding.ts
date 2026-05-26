import { loadNaverMaps } from "@/lib/naver";

export async function getAddressFromCoords(
  latitude: number,
  longitude: number
): Promise<string> {
  try {
    await loadNaverMaps();
    const naver = (window as any).naver;
    if (!naver?.maps?.Service) return "위치를 확인할 수 없음";

    return new Promise<string>((resolve) => {
      const timeoutId = setTimeout(() => resolve("위치를 확인할 수 없음"), 10000);

      naver.maps.Service.reverseGeocode(
        { coords: new naver.maps.LatLng(latitude, longitude) },
        (status: any, response: any) => {
          clearTimeout(timeoutId);

          if (status !== naver.maps.Service.Status.OK) {
            resolve("위치를 확인할 수 없음");
            return;
          }

          try {
            // v2.results 배열에서 addr 타입 결과 우선 사용
            const results: any[] = response.v2?.results ?? [];
            const addrResult =
              results.find((r: any) => r.name === "addr") || results[0];

            if (addrResult) {
              const region = addrResult.region ?? {};
              const area2 = region.area2?.name || ""; // 시/군/구
              const area3 = region.area3?.name || ""; // 읍/면/동
              const land = addrResult.land;
              let lot = "";
              if (land?.number1) {
                lot = ` ${land.number1}`;
                if (land.number2) lot += `-${land.number2}`;
              }
              const parts = [area2, area3].filter(Boolean).join(" ") + lot;
              if (parts.trim()) {
                resolve(parts.trim());
                return;
              }
            }

            // fallback: jibunAddress 에서 광역시/도 제거
            const jibun: string = response.v2?.address?.jibunAddress ?? "";
            if (jibun) {
              const short = jibun
                .replace(/^[가-힣]+특별자치도\s*/, "")
                .replace(/^[가-힣]+특별시\s*/, "")
                .replace(/^[가-힣]+광역시\s*/, "")
                .replace(/^[가-힣]+도\s*/, "")
                .trim();
              resolve(short || jibun);
              return;
            }
          } catch {
            /* ignore parse errors */
          }

          resolve("위치를 확인할 수 없음");
        }
      );
    });
  } catch {
    return "위치를 확인할 수 없음";
  }
}

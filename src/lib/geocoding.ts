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
            const results: any[] = response.v2?.results ?? [];
            const road = results.find((r: any) => r.name === "roadaddr");
            const addr = results.find((r: any) => r.name === "addr");
            const item = road ?? addr;
            if (!item) { resolve("위치를 확인할 수 없음"); return; }

            const region = item.region ?? {};
            const land = item.land ?? {};
            const area2 = region.area2?.name ?? "";
            const area3 = region.area3?.name ?? "";

            if (road) {
              const street = land.name ?? "";
              const number1 = land.number1 ?? "";
              const number2 = land.number2 ? `-${land.number2}` : "";
              const parts = [area2, area3, street, number1 + number2].filter(Boolean);
              const result = parts.join(" ").trim();
              if (result) { resolve(result); return; }
            }

            const number1 = land.number1 ?? "";
            const number2 = land.number2 ? `-${land.number2}` : "";
            const parts = [area2, area3, number1 + number2].filter(Boolean);
            resolve(parts.join(" ").trim() || "위치를 확인할 수 없음");
          } catch {
            resolve("위치를 확인할 수 없음");
          }
        }
      );
    });
  } catch {
    return "위치를 확인할 수 없음";
  }
}

export async function getAddressFromCoords(
  latitude: number,
  longitude: number
): Promise<string> {
  try {
    const clientId = (import.meta as any).env?.VITE_NAVER_CLIENT_ID;
    const clientSecret = (import.meta as any).env?.VITE_NAVER_CLIENT_SECRET;

    if (!clientId || !clientSecret) return "위치를 확인할 수 없음";

    const url = `https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${longitude},${latitude}&output=json&orders=addr,roadaddr`;
    const res = await fetch(url, {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret,
      },
    });

    if (!res.ok) return "위치를 확인할 수 없음";

    const data = await res.json();
    const results: any[] = data.results ?? [];
    if (results.length === 0) return "위치를 확인할 수 없음";

    // roadaddr 우선, 없으면 addr
    const road = results.find((r: any) => r.name === "roadaddr");
    const addr = results.find((r: any) => r.name === "addr");
    const item = road ?? addr;
    if (!item) return "위치를 확인할 수 없음";

    const region = item.region ?? {};
    const land = item.land ?? {};

    const area2 = region.area2?.name ?? "";
    const area3 = region.area3?.name ?? "";

    if (road) {
      const street = land.name ?? "";
      const number1 = land.number1 ?? "";
      const number2 = land.number2 ? `-${land.number2}` : "";
      const parts = [area2, area3, street, number1 + number2].filter(Boolean);
      return parts.join(" ").trim() || "위치를 확인할 수 없음";
    }

    const number1 = land.number1 ?? "";
    const number2 = land.number2 ? `-${land.number2}` : "";
    const parts = [area2, area3, number1 + number2].filter(Boolean);
    return parts.join(" ").trim() || "위치를 확인할 수 없음";
  } catch {
    return "위치를 확인할 수 없음";
  }
}

import { loadNaverMaps } from "@/lib/naver";
import type { AppLocale } from "@/lib/locale";

export const UNKNOWN_ADDRESS = "위치를 확인할 수 없음";

const REVERSE_GEOCODE_ORDERS = "roadaddr,addr,admcode";

function formatReverseGeocodeItem(item: any): string {
  const region = item?.region ?? {};
  const land = item?.land ?? {};
  const area2 = region.area2?.name ?? "";
  const area3 = region.area3?.name ?? "";

  if (item?.name === "roadaddr") {
    const street = land.name ?? "";
    const number1 = land.number1 ?? "";
    const number2 = land.number2 ? `-${land.number2}` : "";
    return [area2, area3, street, `${number1}${number2}`]
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  const number1 = land.number1 ?? "";
  const number2 = land.number2 ? `-${land.number2}` : "";
  const lot = number1 ? `${number1}${number2}` : "";
  return [area2, area3, lot].filter(Boolean).join(" ").trim();
}

function pickAddressFromReverseResponse(response: any): string | null {
  const results: any[] =
    response?.v2?.results ??
    response?.result?.results ??
    response?.results ??
    [];

  for (const type of ["roadaddr", "addr", "admcode", "legalcode"]) {
    const item = results.find((r) => r?.name === type);
    if (!item) continue;
    const formatted = formatReverseGeocodeItem(item);
    if (formatted) return formatted;
  }
  return null;
}

function getNaverApiCredentials(): { clientId: string; clientSecret: string } | null {
  const env = (import.meta as any).env ?? {};
  const clientId =
    env.VITE_NAVER_NCP_KEY_ID ??
    env.VITE_NAVER_CLIENT_ID ??
    env.VITE_NAVER_MAP_CLIENT_ID ??
    env.VITE_NAVER_NCP_CLIENT_ID;
  const clientSecret = env.VITE_NAVER_CLIENT_SECRET ?? env.VITE_NAVER_NCP_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

async function reverseGeocodeWithNaverJs(
  latitude: number,
  longitude: number,
  locale?: AppLocale
): Promise<string | null> {
  await loadNaverMaps(locale);
  const naver = (window as any).naver;
  if (!naver?.maps?.Service) {
    console.warn("[geocoding] naver.maps.Service unavailable after SDK load");
    return null;
  }

  return new Promise<string | null>((resolve) => {
    const timeoutId = window.setTimeout(() => resolve(null), 10000);

    naver.maps.Service.reverseGeocode(
      {
        coords: new naver.maps.LatLng(latitude, longitude),
        orders: REVERSE_GEOCODE_ORDERS,
      },
      (status: any, response: any) => {
        window.clearTimeout(timeoutId);

        if (status !== naver.maps.Service.Status.OK) {
          console.warn("[geocoding] reverseGeocode status:", status, response);
          resolve(null);
          return;
        }

        resolve(pickAddressFromReverseResponse(response));
      }
    );
  });
}

/** 네이버 클라우드 Reverse Geocoding REST (동일 Maps API, Geocoding 서비스) */
async function reverseGeocodeWithNaverRest(
  latitude: number,
  longitude: number
): Promise<string | null> {
  const creds = getNaverApiCredentials();
  if (!creds) return null;

  const url = new URL("https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc");
  url.searchParams.set("coords", `${longitude},${latitude}`);
  url.searchParams.set("output", "json");
  url.searchParams.set("orders", REVERSE_GEOCODE_ORDERS);

  const res = await fetch(url.toString(), {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": creds.clientId,
      "X-NCP-APIGW-API-KEY": creds.clientSecret,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    console.warn("[geocoding] REST reverseGeocode HTTP", res.status, await res.text().catch(() => ""));
    return null;
  }

  const data = await res.json();
  if (data?.status?.code !== 0) {
    console.warn("[geocoding] REST reverseGeocode status:", data?.status);
    return null;
  }

  return pickAddressFromReverseResponse(data);
}

export async function getAddressFromCoords(
  latitude: number,
  longitude: number,
  locale?: AppLocale
): Promise<string> {
  try {
    const fromJs = await reverseGeocodeWithNaverJs(latitude, longitude, locale);
    if (fromJs) return fromJs;
  } catch (error) {
    console.warn("[geocoding] JS reverseGeocode error:", error);
  }

  try {
    const fromRest = await reverseGeocodeWithNaverRest(latitude, longitude);
    if (fromRest) return fromRest;
  } catch (error) {
    console.warn("[geocoding] REST reverseGeocode error:", error);
  }

  return UNKNOWN_ADDRESS;
}

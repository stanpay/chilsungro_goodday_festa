import type { AppLocale } from "@/lib/locale";
import { loadNaverMaps } from "@/lib/naver";

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
    response?.results ??
    response?.v2?.results ??
    response?.result?.results ??
    [];

  for (const type of ["roadaddr", "addr", "admcode", "legalcode"]) {
    const item = results.find((r) => r?.name === type);
    if (!item) continue;
    const formatted = formatReverseGeocodeItem(item);
    if (formatted) return formatted;
  }
  return null;
}

async function reverseGeocodeWithNaverProxy(
  latitude: number,
  longitude: number
): Promise<string | null> {
  const url = new URL("/api/naver/reverse-geocode", window.location.origin);
  url.searchParams.set("coords", `${longitude},${latitude}`);
  url.searchParams.set("orders", REVERSE_GEOCODE_ORDERS);
  url.searchParams.set("output", "json");
  url.searchParams.set("sourcecrs", "epsg:4326");

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.warn(
      "[geocoding] reverse-geocode proxy HTTP",
      res.status,
      await res.text().catch(() => "")
    );
    return null;
  }

  const data = await res.json();
  if (data?.status?.code !== 0) {
    console.warn("[geocoding] reverse-geocode status:", data?.status);
    return null;
  }

  return pickAddressFromReverseResponse(data);
}

async function reverseGeocodeWithJs(
  latitude: number,
  longitude: number,
  locale?: AppLocale
): Promise<string | null> {
  await loadNaverMaps(locale, { geocoder: true });
  const naver = (window as any).naver;
  if (!naver?.maps?.Service) return null;

  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => resolve(null), 10000);

    naver.maps.Service.reverseGeocode(
      {
        coords: new naver.maps.LatLng(latitude, longitude),
        orders: REVERSE_GEOCODE_ORDERS,
      },
      (status: any, response: any) => {
        window.clearTimeout(timeoutId);
        if (status !== naver.maps.Service.Status.OK) {
          console.warn("[geocoding] JS reverseGeocode status:", status);
          resolve(null);
          return;
        }
        resolve(pickAddressFromReverseResponse(response?.v2 ?? response));
      }
    );
  });
}

export async function getAddressFromCoords(
  latitude: number,
  longitude: number,
  locale?: AppLocale
): Promise<string> {
  try {
    const fromProxy = await reverseGeocodeWithNaverProxy(latitude, longitude);
    if (fromProxy) return fromProxy;
  } catch (error) {
    console.warn("[geocoding] reverse-geocode proxy error:", error);
  }

  try {
    const fromJs = await reverseGeocodeWithJs(latitude, longitude, locale);
    if (fromJs) return fromJs;
  } catch (error) {
    console.warn("[geocoding] JS reverseGeocode error:", error);
  }

  return UNKNOWN_ADDRESS;
}

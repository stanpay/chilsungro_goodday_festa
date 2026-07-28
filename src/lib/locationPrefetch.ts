import { getAddressFromCoords, UNKNOWN_ADDRESS } from "@/lib/geocoding";
import { getBrowserPosition, isValidCoords, parseStoredCoords, type GeoCoords } from "@/lib/geolocation";
import type { AppLocale } from "@/lib/locale";
import { headerStrings } from "@/lib/locale";

export const LOCATION_PREFETCH_AT_KEY = "locationPrefetchAt";
export const LOCATION_PREFETCH_TTL_MS = 5 * 60 * 1000;

export type PrefetchedLocation = {
  coords: GeoCoords;
  address: string;
  prefetchedAt: number;
};

function isManualLocationStored(): boolean {
  return localStorage.getItem("isManualLocation") === "true";
}

export function clearLocationPrefetchTimestamp(): void {
  localStorage.removeItem(LOCATION_PREFETCH_AT_KEY);
}

/** TTL 안의 자동(비수동) 프리패치 캐시가 있으면 반환 */
export function readValidPrefetchedLocation(): PrefetchedLocation | null {
  if (typeof localStorage === "undefined") return null;
  if (isManualLocationStored()) return null;

  const prefetchedAtRaw = localStorage.getItem(LOCATION_PREFETCH_AT_KEY);
  const prefetchedAt = prefetchedAtRaw ? Number(prefetchedAtRaw) : NaN;
  if (!Number.isFinite(prefetchedAt)) return null;
  if (Date.now() - prefetchedAt > LOCATION_PREFETCH_TTL_MS) return null;

  const coords = parseStoredCoords(localStorage.getItem("currentCoordinates"));
  if (!coords) return null;

  const address = localStorage.getItem("selectedLocation");
  if (!address) return null;

  return { coords, address, prefetchedAt };
}

export function persistPrefetchedLocation(
  latitude: number,
  longitude: number,
  address: string
): void {
  localStorage.setItem("selectedLocation", address);
  localStorage.setItem("currentCoordinates", JSON.stringify({ latitude, longitude }));
  localStorage.setItem(LOCATION_PREFETCH_AT_KEY, Date.now().toString());
  localStorage.removeItem("isManualLocation");
}

function formatDisplayAddress(address: string, locale: AppLocale): string {
  if (address === UNKNOWN_ADDRESS) {
    return headerStrings(locale).locationUnknownGeo;
  }
  return address;
}

/**
 * Navigate 등에서 GPS + 역지오코딩을 미리 수행해 localStorage에 저장.
 * 수동 위치이거나 TTL 내 캐시가 있으면 스킵.
 * 좌표만 확보되면 주소 실패 시에도 좌표는 저장한다.
 */
export async function prefetchBrowserLocation(locale: AppLocale): Promise<PrefetchedLocation | null> {
  if (typeof localStorage === "undefined") return null;
  if (isManualLocationStored()) return null;

  const existing = readValidPrefetchedLocation();
  if (existing) return existing;

  try {
    const { loadNaverMaps } = await import("@/lib/naver");
    await loadNaverMaps(locale);
  } catch {
    // 역지오코딩 실패해도 GPS 좌표는 저장
  }

  const { latitude, longitude } = await getBrowserPosition();
  if (!isValidCoords({ latitude, longitude })) return null;

  let displayAddress: string;
  try {
    const address = await getAddressFromCoords(latitude, longitude, locale);
    displayAddress = formatDisplayAddress(address, locale);
  } catch {
    displayAddress = headerStrings(locale).locationUnknownGeo;
  }

  persistPrefetchedLocation(latitude, longitude, displayAddress);

  return {
    coords: { latitude, longitude },
    address: displayAddress,
    prefetchedAt: Date.now(),
  };
}

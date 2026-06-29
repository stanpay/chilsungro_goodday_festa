export type GeoCoords = { latitude: number; longitude: number };

export function isValidCoords(coords: unknown): coords is GeoCoords {
  if (!coords || typeof coords !== "object") return false;
  const { latitude, longitude } = coords as GeoCoords;
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function parseStoredCoords(raw: string | null): GeoCoords | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isValidCoords(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getCurrentPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

/** GPS 조회 최대 대기 시간 (초과 시 실패 처리) */
export const GEOLOCATION_TIMEOUT_MS = 10000;

/** 브라우저 위치 조회 — 10초 내 응답 없으면 실패 */
export async function getBrowserPosition(): Promise<GeoCoords> {
  if (!navigator.geolocation) {
    throw new Error("Geolocation not supported");
  }

  try {
    const position = await getCurrentPosition({
      enableHighAccuracy: false,
      timeout: GEOLOCATION_TIMEOUT_MS,
      maximumAge: 60000,
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch (error) {
    throw error as GeolocationPositionError;
  }
}

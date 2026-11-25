/**
 * 두 좌표 사이의 거리(미터).
 *
 * 지도 클러스터링과 매장 거리 표시 두 곳에서 같은 Haversine 식을 각각 구현하고
 * 있어(한쪽은 km 반환 후 다시 1000을 곱했다) 하나로 합쳤다.
 */
const EARTH_RADIUS_M = 6371000;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function medianSorted(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * fitBounds용 좌표. 중앙값에서 멀리 떨어진 이상치(잘못된 GPS 등)를 제외한다.
 * 제주 지하상가 매장 한 곳이 서울 좌표로 들어오면 전국 지도로 벌어지는 문제를 막는다.
 */
export function filterCoordsForMapFit<T extends { lat: number; lon: number }>(
  points: readonly T[],
  maxDistanceKm = 40,
): T[] {
  if (points.length <= 1) return [...points];

  const lats = points.map((p) => p.lat).sort((a, b) => a - b);
  const lons = points.map((p) => p.lon).sort((a, b) => a - b);
  const medLat = medianSorted(lats);
  const medLon = medianSorted(lons);
  if (!Number.isFinite(medLat) || !Number.isFinite(medLon)) return [...points];

  const maxM = maxDistanceKm * 1000;
  const kept = points.filter(
    (p) => distanceMeters(medLat, medLon, p.lat, p.lon) <= maxM,
  );
  return kept.length > 0 ? kept : [...points];
}

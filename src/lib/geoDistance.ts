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

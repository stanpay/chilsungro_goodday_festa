/** Geocoding API 비활성 시 임시 좌표 (제주 앱 전용) */
export const JEJU_DOWNTOWN_COORDS = {
  latitude: 33.5098,
  longitude: 126.5219,
} as const;

const KNOWN_LOCATION_PATTERNS: {
  pattern: RegExp;
  coords: { latitude: number; longitude: number };
}[] = [
  {
    pattern: /올레길\s*17|17\s*코스|광령.*올레|제주원도심\s*올레/i,
    coords: JEJU_DOWNTOWN_COORDS,
  },
];

export function getKnownCoordsForQuery(
  query: string
): { latitude: number; longitude: number } | null {
  const trimmed = query.trim();
  for (const { pattern, coords } of KNOWN_LOCATION_PATTERNS) {
    if (pattern.test(trimmed)) return coords;
  }
  return null;
}

/** 긴 관광지명·괄호 포함 주소를 단계적으로 짧게 */
export function buildGeocodeQueryVariants(query: string): string[] {
  const trimmed = query.trim();
  const variants: string[] = [];

  const add = (value: string) => {
    const v = value.trim();
    if (v.length >= 2 && !variants.includes(v)) variants.push(v);
  };

  add(trimmed);
  add(trimmed.replace(/\s*\([^)]*\)/g, ""));
  add(trimmed.split("(")[0] ?? "");
  add(trimmed.split(/[-–]/)[0] ?? "");

  if (/올레/i.test(trimmed)) {
    add("제주 올레길 17");
    add("제주 올레길");
    add("제주시");
  }

  return variants;
}

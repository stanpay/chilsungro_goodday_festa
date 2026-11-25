import { DUMMY_STORES, DUMMY_FRANCHISES } from "./dummyData";

export interface Store {
  id: string;
  name: string;
  franchise_id: string;
  kakao_place_id: string;
  local_currency_available: boolean;
  local_currency_discount_rate: number | null;
  parking_available: boolean;
  free_parking: boolean;
  parking_size: string | null;
  high_oil_support_available?: boolean;
}

export interface NearbyStore {
  area: string | null;
  business_hours_today: string | null;
  category: string | null;
  distance: string;
  distance_m: number;
  downtown_coupon: boolean;
  id: number;
  image_url: string | null;
  latitude: number;
  localpay: boolean;
  longitude: number;
  name: string;
  oil_subsidy: boolean;
}

export interface Franchise {
  id: string;
  name: string;
}

const STORE_API_BASE_URL =
  import.meta.env.VITE_STORE_API_BASE_URL ?? "https://mac.kurl.kr:5001";

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${STORE_API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Store API request failed: ${response.status}`);
  }
  return response.json();
}

function normalizeNearbyResponse(payload: unknown): NearbyStore[] {
  if (Array.isArray(payload)) return payload as NearbyStore[];
  if (
    payload &&
    typeof payload === "object" &&
    "value" in payload &&
    Array.isArray((payload as { value: unknown }).value)
  ) {
    return (payload as { value: NearbyStore[] }).value;
  }
  return [];
}

/** API는 radius 필수. 서울·해외에서도 제주 매장이 잡히도록 사실상 무제한(약 1만 km). */
export const NEARBY_RADIUS_UNLIMITED_M = 10_000_000;

/**
 * API에 잘못된 GPS가 올라온 매장 좌표 보정.
 * 제주신협(221): 서울 좌표 → 중앙지하상가 (Plus Code 8Q58GG7F+7V)
 * https://maps.app.goo.gl/55kXVQZdEo7Hpjw66
 */
const NEARBY_STORE_COORD_OVERRIDES: Record<
  number,
  { latitude: number; longitude: number }
> = {
  221: { latitude: 33.5131281, longitude: 126.5246281 },
};

function applyNearbyStoreCoordOverrides(stores: NearbyStore[]): NearbyStore[] {
  return stores.map((store) => {
    const override = NEARBY_STORE_COORD_OVERRIDES[store.id];
    if (!override) return store;
    return {
      ...store,
      latitude: override.latitude,
      longitude: override.longitude,
    };
  });
}

export const storesApi = {
  getNearbyStores: async (
    latitude: number,
    longitude: number,
    radius = NEARBY_RADIUS_UNLIMITED_M
  ): Promise<NearbyStore[]> => {
    const payload = await fetchJson<unknown>(
      `/nearby/${latitude}/${longitude}?radius=${radius}`
    );
    return applyNearbyStoreCoordOverrides(normalizeNearbyResponse(payload));
  },

  getStoreRedirectUrl: (storeId: string | number): string =>
    `${STORE_API_BASE_URL}/redirect/${storeId}`,

  getStoreByKakaoPlaceId: async (
    kakaoPlaceId: string
  ): Promise<Store | null> => {
    // TODO: GET /api/stores?kakaoPlaceId={kakaoPlaceId}
    await delay(200);
    return (
      DUMMY_STORES.find((s) => s.kakao_place_id === kakaoPlaceId) ?? null
    );
  },

  getStoreByFranchiseId: async (
    franchiseId: string
  ): Promise<Store | null> => {
    // TODO: GET /api/stores?franchiseId={franchiseId}
    await delay(200);
    return DUMMY_STORES.find((s) => s.franchise_id === franchiseId) ?? null;
  },

  getFranchiseByName: async (name: string): Promise<Franchise | null> => {
    // TODO: GET /api/franchises?name={name}
    await delay(200);
    return DUMMY_FRANCHISES[name] ?? null;
  },
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import {
  DUMMY_STORES,
  DUMMY_FRANCHISES,
  DUMMY_FRANCHISE_PAYMENT_METHODS,
} from "./dummyData";

export interface Store {
  id: string;
  name: string;
  franchise_id: string;
  kakao_place_id: string;
  local_currency_available: boolean;
  local_currency_discount_rate: number | null;
  gifticon_available: boolean;
  parking_available: boolean;
  free_parking: boolean;
  parking_size: string | null;
  high_oil_support_available?: boolean;
}

export interface NearbyStore {
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

export interface FranchisePaymentMethod {
  franchise_id: string;
  method_name: string;
  method_type: string | null;
  rate: number | null;
}

const STORE_API_BASE_URL =
  import.meta.env.VITE_STORE_API_BASE_URL ?? "http://mac.kurl.kr:5001";

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

export const storesApi = {
  getNearbyStores: async (
    latitude: number,
    longitude: number,
    radius = 1500
  ): Promise<NearbyStore[]> => {
    const payload = await fetchJson<unknown>(
      `/nearby/${latitude}/${longitude}?radius=${radius}`
    );
    return normalizeNearbyResponse(payload);
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

  getPaymentMethods: async (
    franchiseId: string
  ): Promise<FranchisePaymentMethod[]> => {
    // TODO: GET /api/franchises/{franchiseId}/payment-methods
    await delay(200);
    return DUMMY_FRANCHISE_PAYMENT_METHODS.filter(
      (m) => m.franchise_id === franchiseId
    );
  },
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

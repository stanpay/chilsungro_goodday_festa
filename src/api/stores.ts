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

export const storesApi = {
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

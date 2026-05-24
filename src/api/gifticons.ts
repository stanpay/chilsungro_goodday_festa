import { DUMMY_GIFTICONS, DUMMY_USED_GIFTICONS } from "./dummyData";

export interface Gifticon {
  id: string;
  user_id: string;
  brand: string;
  name: string;
  original_price: number;
  image: string;
  expiry_date: string;
  status: "사용가능" | "사용완료" | "판매완료";
  is_selling: boolean;
  barcode?: string;
  created_at: string;
  updated_at: string;
  sale_price?: number;
}

export interface UsedGifticon {
  id: string;
  seller_id: string;
  available_at: string;
  name?: string;
  barcode: string;
  original_price: number;
  sale_price: number;
  expiry_date: string;
  status: string;
}

// 인메모리 더미 저장소 (로컬에서만 변경 사항 유지)
let gifticonStore = [...DUMMY_GIFTICONS] as Gifticon[];
let usedGifticonStore = [...DUMMY_USED_GIFTICONS] as UsedGifticon[];

export const gifticonsApi = {
  getMyGifticons: async (userId: string): Promise<Gifticon[]> => {
    // TODO: GET /api/gifticons?userId={userId}
    await delay(300);
    const myGifticons = gifticonStore.filter((g) => g.user_id === userId);
    const usedMap = new Map(usedGifticonStore.map((u) => [u.id, u]));
    return myGifticons.map((g) => ({
      ...g,
      sale_price: usedMap.get(g.id)?.sale_price,
    }));
  },

  sellGifticon: async (
    gifticonId: string,
    sellerId: string,
    salePrice: number
  ): Promise<void> => {
    // TODO: POST /api/gifticons/{id}/sell
    await delay(300);
    const gifticon = gifticonStore.find((g) => g.id === gifticonId);
    if (!gifticon) throw new Error("기프티콘을 찾을 수 없습니다.");

    const existingIdx = usedGifticonStore.findIndex((u) => u.id === gifticonId);
    const usedEntry: UsedGifticon = {
      id: gifticonId,
      seller_id: sellerId,
      available_at: gifticon.brand,
      name: gifticon.name,
      barcode: gifticon.barcode || "",
      original_price: gifticon.original_price,
      sale_price: salePrice,
      expiry_date: gifticon.expiry_date,
      status: "판매중",
    };

    if (existingIdx >= 0) {
      usedGifticonStore[existingIdx] = usedEntry;
    } else {
      usedGifticonStore.push(usedEntry);
    }

    const idx = gifticonStore.findIndex((g) => g.id === gifticonId);
    if (idx >= 0) gifticonStore[idx] = { ...gifticonStore[idx], is_selling: true };
  },

  cancelSell: async (gifticonId: string): Promise<void> => {
    // TODO: DELETE /api/gifticons/{id}/sell
    await delay(300);
    usedGifticonStore = usedGifticonStore.filter((u) => u.id !== gifticonId);
    const idx = gifticonStore.findIndex((g) => g.id === gifticonId);
    if (idx >= 0) gifticonStore[idx] = { ...gifticonStore[idx], is_selling: false };
  },

  restoreGifticon: async (gifticonId: string): Promise<void> => {
    // TODO: PATCH /api/gifticons/{id}/restore
    await delay(300);
    const idx = gifticonStore.findIndex((g) => g.id === gifticonId);
    if (idx >= 0) {
      gifticonStore[idx] = {
        ...gifticonStore[idx],
        status: "사용가능",
        is_selling: false,
        updated_at: new Date().toISOString(),
      };
    }
  },

  getUsedGifticons: async (brand?: string): Promise<UsedGifticon[]> => {
    // TODO: GET /api/used-gifticons?brand={brand}
    await delay(300);
    if (brand) return usedGifticonStore.filter((u) => u.available_at === brand);
    return usedGifticonStore;
  },

  reserveGifticon: async (
    gifticonId: string,
    userId: string
  ): Promise<UsedGifticon> => {
    // TODO: POST /api/used-gifticons/{id}/reserve
    await delay(300);
    const gifticon = usedGifticonStore.find((u) => u.id === gifticonId);
    if (!gifticon) throw new Error("기프티콘을 찾을 수 없습니다.");
    return gifticon;
  },
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

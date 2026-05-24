import { DUMMY_COUPONS } from "./dummyData";

export interface Coupon {
  id: string;
  name: string;
  description: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_purchase_amount: number | null;
  expiry_date: string;
  used_at: string | null;
  status: "available" | "used" | "expired";
}

export const couponsApi = {
  getMyCoupons: async (userId: string): Promise<Coupon[]> => {
    // TODO: GET /api/coupons?userId={userId}
    await delay(300);
    return DUMMY_COUPONS as Coupon[];
  },

  useCoupon: async (couponId: string, userId: string): Promise<void> => {
    // TODO: POST /api/coupons/{couponId}/use
    await delay(200);
  },
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

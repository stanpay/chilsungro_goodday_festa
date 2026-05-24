import { DUMMY_PAYMENT_HISTORY } from "./dummyData";

export interface PaymentRecord {
  id: string;
  user_id: string;
  store: string;
  date: string;
  time: string;
  amount: number;
  method: string;
  status: string;
  created_at: string;
}

let paymentStore = [...DUMMY_PAYMENT_HISTORY] as PaymentRecord[];

export const paymentHistoryApi = {
  getHistory: async (userId: string): Promise<PaymentRecord[]> => {
    // TODO: GET /api/payment-history?userId={userId}
    await delay(300);
    return paymentStore
      .filter((p) => p.user_id === userId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  },

  addRecord: async (record: Omit<PaymentRecord, "id" | "created_at">): Promise<PaymentRecord> => {
    // TODO: POST /api/payment-history
    await delay(300);
    const newRecord: PaymentRecord = {
      ...record,
      id: `pay-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    paymentStore.unshift(newRecord);
    return newRecord;
  },

  getCount: async (userId: string): Promise<number> => {
    // TODO: GET /api/payment-history/count?userId={userId}
    await delay(100);
    return paymentStore.filter((p) => p.user_id === userId).length;
  },
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

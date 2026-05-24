import { DUMMY_USER_SETTINGS } from "./dummyData";

export interface UserSettings {
  user_id: string;
  kakaopay: boolean;
  samsungpay: boolean;
  naverpay: boolean;
  payco: boolean;
  tosspay: boolean;
  kbpay: boolean;
  shinhan: boolean;
  one_touch_payment_enabled: boolean;
  happy_point: boolean;
  cjone: boolean;
  hpoint: boolean;
  lpoint: boolean;
  starbucks: boolean;
  ediya: boolean;
  twosome: boolean;
  compose_coffee: boolean;
  mega_coffee: boolean;
  paik: boolean;
}

let settingsStore: Record<string, UserSettings> = {
  "user-001": { ...DUMMY_USER_SETTINGS },
};

export const userSettingsApi = {
  getSettings: async (userId: string): Promise<UserSettings> => {
    // TODO: GET /api/user-settings/{userId}
    await delay(200);
    return (
      settingsStore[userId] ?? {
        ...DUMMY_USER_SETTINGS,
        user_id: userId,
      }
    );
  },

  updateSettings: async (
    userId: string,
    patch: Partial<UserSettings>
  ): Promise<UserSettings> => {
    // TODO: PATCH /api/user-settings/{userId}
    await delay(200);
    settingsStore[userId] = {
      ...(settingsStore[userId] ?? { ...DUMMY_USER_SETTINGS, user_id: userId }),
      ...patch,
    };
    return settingsStore[userId];
  },
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

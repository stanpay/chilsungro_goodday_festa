export interface DayHours {
  open: string;
  close: string;
}

interface BrandProfile {
  /** Indexed by JS Date.getDay(): 0=Sun 1=Mon … 6=Sat. null = 해당 요일 휴무 */
  weeklyHours: (DayHours | null)[];
  closedDayNote: string;
  photos: string[];
}

function h(open: string, close: string): DayHours {
  return { open, close };
}

const PROFILES: Record<string, BrandProfile> = {
  starbucks: {
    weeklyHours: [
      h("07:00", "22:00"), h("07:00", "22:00"), h("07:00", "22:00"),
      h("07:00", "22:00"), h("07:00", "22:00"), h("07:00", "22:30"), h("07:00", "22:30"),
    ],
    closedDayNote: "",
    photos: [],
  },
  baskin: {
    weeklyHours: Array(7).fill(h("10:00", "22:00")),
    closedDayNote: "",
    photos: [],
  },
  mega: {
    weeklyHours: Array(7).fill(h("08:00", "22:00")),
    closedDayNote: "",
    photos: [],
  },
  pascucci: {
    weeklyHours: Array(7).fill(h("08:30", "21:30")),
    closedDayNote: "",
    photos: [],
  },
  twosome: {
    weeklyHours: [
      h("09:00", "22:00"), h("08:00", "22:00"), h("08:00", "22:00"),
      h("08:00", "22:00"), h("08:00", "22:00"), h("08:00", "22:30"), h("09:00", "22:30"),
    ],
    closedDayNote: "",
    photos: [],
  },
  restaurant: {
    weeklyHours: [
      h("11:00", "21:00"), null, h("11:00", "21:00"),
      h("11:00", "21:00"), h("11:00", "21:00"), h("11:00", "21:30"), h("11:00", "21:30"),
    ],
    closedDayNote: "매주 월요일 휴무",
    photos: [
      "https://picsum.photos/seed/jeju-restaurant-1/400/250",
      "https://picsum.photos/seed/jeju-restaurant-2/400/250",
      "https://picsum.photos/seed/jeju-restaurant-3/400/250",
    ],
  },
  cafe: {
    weeklyHours: [
      h("09:00", "21:00"), h("09:00", "21:00"), h("09:00", "21:00"),
      h("09:00", "21:00"), h("09:00", "21:00"), h("09:00", "21:30"), h("09:00", "21:30"),
    ],
    closedDayNote: "",
    photos: [
      "https://picsum.photos/seed/jeju-cafe-1/400/250",
      "https://picsum.photos/seed/jeju-cafe-2/400/250",
      "https://picsum.photos/seed/jeju-cafe-3/400/250",
    ],
  },
  shopping: {
    weeklyHours: Array(7).fill(h("10:00", "22:00")),
    closedDayNote: "",
    photos: [
      "https://picsum.photos/seed/jeju-shopping-1/400/250",
      "https://picsum.photos/seed/jeju-shopping-2/400/250",
    ],
  },
};

const DEFAULT_PROFILE: BrandProfile = {
  weeklyHours: Array(7).fill(h("09:00", "21:00")),
  closedDayNote: "",
  photos: [],
};

function timeToMinutes(t: string): number {
  const [hh, mm] = t.split(":").map(Number);
  return hh * 60 + mm;
}

export interface StoreOpenStatus {
  isOpen: boolean;
  todayHours: DayHours | null;
  closedDayNote: string;
  photos: string[];
}

export function getStoreOpenStatus(
  brandImage: string,
  now: Date = new Date()
): StoreOpenStatus {
  const profile = PROFILES[brandImage] ?? DEFAULT_PROFILE;
  const dayIndex = now.getDay();
  const todayHours = profile.weeklyHours[dayIndex] ?? null;

  let isOpen = false;
  if (todayHours) {
    const cur = now.getHours() * 60 + now.getMinutes();
    isOpen =
      cur >= timeToMinutes(todayHours.open) && cur < timeToMinutes(todayHours.close);
  }

  return {
    isOpen,
    todayHours,
    closedDayNote: profile.closedDayNote,
    photos: profile.photos,
  };
}

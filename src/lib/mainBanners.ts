import type { AppLocale } from "@/lib/locale";

type LocalizedText = Partial<Record<AppLocale, string>> & { ko: string };

export type MainBanner = {
  id: string;
  /** 캐러셀 배너 이미지 URL */
  imageUrl?: string;
  /** 팝업 하단 이미지 URL (캐러셀 배너와 별도 — mainBanners.ts에서 지정) */
  popupImageUrl?: string;
  /**
   * 매장 카드와 동일 — 클릭 시 팝업 없이 `/redirect/{storeId}` 네이버 지도 이동
   * (있으면 popup보다 우선)
   */
  storeRedirect?: {
    storeId: number;
    lat: number;
    lon: number;
    name: LocalizedText;
  };
  /** 길안내 — 네이버 place ID (있으면 앱 스킴 최우선) */
  naverMapPlaceId?: string;
  /** 길안내 — place ID 없을 때 nmap://place?lat=&lng= 용 */
  naverMapLat?: number;
  naverMapLon?: number;
  naverMapName?: LocalizedText;
  /** 데스크톱 웹 fallback URL (선택) */
  naverMapWebUrl?: string;
  /** @deprecated naverMapLat/Lon/Name 사용 */
  naverMapUrl?: string;
  imageAlt?: LocalizedText;
  imageCtaLabel?: LocalizedText;
  /** 텍스트 배너용 */
  title?: LocalizedText;
  description?: LocalizedText;
  /** 클릭 시 이동 URL (선택) */
  href?: string;
  /** 텍스트 배너 배경 스타일 */
  variant?: "primary" | "accent" | "muted";
  /** 팝업에서 길안내 CTA를 숨긴다 */
  hideNaverMapDirections?: boolean;
};

/** API nearby 기준 — 매장 카드와 동일한 redirect 대상 */
const STORE_COVERNAT = {
  storeId: 76,
  lat: 33.5143379,
  lon: 126.5251028,
  name: {
    ko: "커버낫 제주점",
    en: "Covernat Jeju",
    zh: "Covernat济州店",
    ja: "カバーナット済州店",
  } satisfies LocalizedText,
};
const STORE_MATIN_KIM = {
  storeId: 77,
  lat: 33.5156625,
  lon: 126.5252695,
  name: {
    ko: "마뗑킴 하고하우스 제주점",
    en: "Matin Kim HAGO:HAUS Jeju",
    zh: "Matin Kim HAGO:HAUS济州店",
    ja: "マーティンキム HAGO:HAUS済州店",
  } satisfies LocalizedText,
};
const STORE_TRAVELER_CENTER = {
  storeId: 436,
  lat: 33.5143324,
  lon: 126.5248371,
  name: {
    ko: "제주여행자센터",
    en: "Jeju Traveler Center",
    zh: "济州旅行者中心",
    ja: "済州旅行者センター",
  } satisfies LocalizedText,
};

const TRAVEL_CENTER_PLACE_ID = "2031464673";
const TRAVEL_CENTER_WEB_URL =
  `https://map.naver.com/p/entry/place/${TRAVEL_CENTER_PLACE_ID}?placePath=%2Fhome`;
/** 제주 제주시 중앙로 43 — 제주여행자센터 */
const TRAVEL_CENTER_LAT = 33.509906;
const TRAVEL_CENTER_LON = 126.523648;
const TRAVEL_CENTER_MAP_NAME: LocalizedText = {
  ko: "제주여행자센터",
  en: "Jeju Traveler Center",
  zh: "济州旅行者中心",
  ja: "済州旅行者センター",
};

/** 제주 제주시 관덕로17길 27-1 — 칠성로 굿데이 페스타 (naver.me/xpjja0mM) */
const CHILSEONGRO_FESTA_LAT = 33.514337;
const CHILSEONGRO_FESTA_LON =  126.525519;
const CHILSEONGRO_FESTA_MAP_NAME: LocalizedText = {
  ko: "칠성로 굿데이 페스타",
  en: "Chilseong-ro Good Day Festa",
  zh: "七星路 Good Day 庆典",
  ja: "七星路 Good Day フェスタ",
};
const CHILSEONGRO_GOOD_DAY_FESTA_MAP_URL = "https://naver.me/xpjja0mM";

/** 팝업용 포스터 — 언어별 WebP */
const JEJU_TRAVELER_CENTER_COUPON_POSTER: Record<AppLocale, string> = {
  ko: "/banners/jeju-traveler-center-coupon-poster-ko.webp",
  en: "/banners/jeju-traveler-center-coupon-poster-en.webp",
  zh: "/banners/jeju-traveler-center-coupon-poster-zh.webp",
  ja: "/banners/jeju-traveler-center-coupon-poster-ja.webp",
};
const CHILSEONGRO_GOOD_DAY_FESTA_POSTER =
  "/banners/chilseongro-good-day-festa-poster.webp";
const EVENT_VENUE_MAP_POPUP = "/banners/event-venue-map-popup.jpeg";

/** 메인 배너 마운트 시 팝업 이미지 선로딩용 — 활성 배너의 팝업 이미지만 대상 */
export function getActiveBannerPopupImageUrls(locale: AppLocale): string[] {
  const urls = getMainBanners(locale)
    .map((banner) => banner.popupImageUrl)
    .filter((url): url is string => !!url);
  return Array.from(new Set(urls));
}

/** 캐러셀 배너 — 언어별 원본 PNG */
const TRAVEL_CENTER_IMAGE: Record<AppLocale, string> = {
  ko: "/banners/travel-center-ko.png",
  en: "/banners/travel-center-en.png",
  zh: "/banners/travel-center-zh.png",
  ja: "/banners/travel-center-ja.png",
};

/** 2번 캐러셀 배너(쿠폰) — 언어별 WebP */
const COUPON_IMAGE: Record<AppLocale, string> = {
  ko: "/banners/coupon-ko.webp",
  en: "/banners/coupon-en.webp",
  zh: "/banners/coupon-zh.webp",
  ja: "/banners/coupon-ja.webp",
};

/** 팝업 길안내 CTA — 모바일 다이얼로그 폭에 맞게 리사이즈·WebP */
export const NAVER_MAP_DIRECTIONS_IMAGE: Record<AppLocale, string> = {
  ko: "/banners/naver-map-directions-ko.webp",
  en: "/banners/naver-map-directions-en.webp",
  zh: "/banners/naver-map-directions-zh.webp",
  ja: "/banners/naver-map-directions-ja.webp",
};

export const NAVER_MAP_DIRECTIONS_ALT: Record<AppLocale, string> = {
  ko: "네이버 지도 길안내",
  en: "Naver Map directions",
  zh: "Naver 地图路线指南",
  ja: "Naverマップ アクセス案内",
};

/** 메인 화면 상단 배너 — 광고·공지·팝업 이미지는 여기서 수정 */
export function getMainBanners(locale: AppLocale): MainBanner[] {
  return [
    {
      id: "travel-center",
      imageUrl: TRAVEL_CENTER_IMAGE[locale],
      popupImageUrl: JEJU_TRAVELER_CENTER_COUPON_POSTER[locale],
      naverMapPlaceId: TRAVEL_CENTER_PLACE_ID,
      naverMapLat: TRAVEL_CENTER_LAT,
      naverMapLon: TRAVEL_CENTER_LON,
      naverMapName: TRAVEL_CENTER_MAP_NAME,
      naverMapWebUrl: TRAVEL_CENTER_WEB_URL,
      imageAlt: {
        ko: "제주 여행자센터 안내",
        en: "Jeju Travel Center",
        zh: "济州旅行者中心",
        ja: "済州旅行者センター",
      },
      href: TRAVEL_CENTER_WEB_URL,
    },
    {
      id: "coupon",
      imageUrl: COUPON_IMAGE[locale],
      popupImageUrl: JEJU_TRAVELER_CENTER_COUPON_POSTER[locale],
      naverMapPlaceId: TRAVEL_CENTER_PLACE_ID,
      naverMapLat: TRAVEL_CENTER_LAT,
      naverMapLon: TRAVEL_CENTER_LON,
      naverMapName: TRAVEL_CENTER_MAP_NAME,
      naverMapWebUrl: TRAVEL_CENTER_WEB_URL,
      imageAlt: {
        ko: "제주 여행자센터 쿠폰 이벤트",
        en: "Jeju Travel Center coupon event",
        zh: "济州旅行者中心优惠券活动",
        ja: "済州旅行者センタークーポンイベント",
      },
    },
    {
      id: "hago-haus-matin-kim",
      imageUrl: "/banners/hago-haus-matin-kim.webp",
      storeRedirect: STORE_MATIN_KIM,
      imageAlt: {
        ko: "HAGO:HAUS JEJU Matin Kim TAX FREE",
        en: "HAGO:HAUS JEJU Matin Kim TAX FREE",
        zh: "HAGO:HAUS JEJU Matin Kim TAX FREE",
        ja: "HAGO:HAUS JEJU Matin Kim TAX FREE",
      },
    },
    {
      id: "covernat",
      imageUrl: "/banners/covernat.webp",
      storeRedirect: STORE_COVERNAT,
      imageAlt: {
        ko: "Covernat TAX FREE",
        en: "Covernat TAX FREE",
        zh: "Covernat TAX FREE",
        ja: "Covernat TAX FREE",
      },
    },
    {
      id: "ad-inquiry",
      imageUrl: "/banners/ad-inquiry.webp",
      storeRedirect: STORE_TRAVELER_CENTER,
      imageAlt: {
        ko: "광고문의",
        en: "Advertising inquiry",
        zh: "广告咨询",
        ja: "広告のお問い合わせ",
      },
    },
    // 칠성로 굿데이 페스타 1·2, 행사장 배치도 비활성화
    // {
    //   id: "chilseongro-good-day-festa-1",
    //   imageUrl: "/banners/chilseongro-good-day-festa-1.webp",
    //   popupImageUrl: CHILSEONGRO_GOOD_DAY_FESTA_POSTER,
    //   naverMapLat: CHILSEONGRO_FESTA_LAT,
    //   naverMapLon: CHILSEONGRO_FESTA_LON,
    //   naverMapName: CHILSEONGRO_FESTA_MAP_NAME,
    //   naverMapWebUrl: CHILSEONGRO_GOOD_DAY_FESTA_MAP_URL,
    //   imageAlt: {
    //     ko: "칠성로 굿데이 페스타",
    //     en: "Chilseong-ro Good Day Festa",
    //     zh: "七星路 Good Day 庆典",
    //     ja: "七星路 Good Day フェスタ",
    //   },
    // },
    // {
    //   id: "chilseongro-good-day-festa-2",
    //   imageUrl: "/banners/chilseongro-good-day-festa-2.webp",
    //   popupImageUrl: CHILSEONGRO_GOOD_DAY_FESTA_POSTER,
    //   naverMapLat: CHILSEONGRO_FESTA_LAT,
    //   naverMapLon: CHILSEONGRO_FESTA_LON,
    //   naverMapName: CHILSEONGRO_FESTA_MAP_NAME,
    //   naverMapWebUrl: CHILSEONGRO_GOOD_DAY_FESTA_MAP_URL,
    //   imageAlt: {
    //     ko: "칠성로 굿데이 페스타",
    //     en: "Chilseong-ro Good Day Festa",
    //     zh: "七星路 Good Day 庆典",
    //     ja: "七星路 Good Day フェスタ",
    //   },
    // },
    // {
    //   id: "event-venue-map",
    //   imageUrl: "/banners/event-venue-map-banner.webp",
    //   popupImageUrl: EVENT_VENUE_MAP_POPUP,
    //   imageAlt: {
    //     ko: "행사장 배치도",
    //     en: "Event venue layout",
    //     zh: "活动场地布置图",
    //     ja: "会場配置図",
    //   },
    // },
  ];
}

export function getBannerText(
  text: LocalizedText | undefined,
  locale: AppLocale,
): string {
  if (!text) return "";
  return text[locale] ?? text.ko;
}

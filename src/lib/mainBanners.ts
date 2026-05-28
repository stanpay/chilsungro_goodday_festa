import type { AppLocale } from "@/lib/locale";

type LocalizedText = Partial<Record<AppLocale, string>> & { ko: string };

export type MainBanner = {
  id: string;
  /** 캐러셀 배너 이미지 URL */
  imageUrl?: string;
  /** 팝업 하단 이미지 URL (캐러셀 배너와 별도 — mainBanners.ts에서 지정) */
  popupImageUrl?: string;
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
const CHILSEONGRO_FESTA_LAT = 33.514333;
const CHILSEONGRO_FESTA_LON =  126.525519;
const CHILSEONGRO_FESTA_MAP_NAME: LocalizedText = {
  ko: "칠성로 굿데이 페스타",
  en: "Chilseong-ro Good Day Festa",
  zh: "七星路 Good Day 庆典",
  ja: "七星路 Good Day フェスタ",
};
const CHILSEONGRO_GOOD_DAY_FESTA_MAP_URL = "https://naver.me/xpjja0mM";

/** 팝업용 포스터 — 모바일 표시에 맞게 리사이즈·WebP (원본 PNG 대비 ~98% 용량 절감) */
const JEJU_TRAVELER_CENTER_COUPON_POSTER =
  "/banners/jeju-traveler-center-coupon-poster.webp";
const CHILSEONGRO_GOOD_DAY_FESTA_POSTER =
  "/banners/chilseongro-good-day-festa-poster.webp";

/** 메인 배너 마운트 시 팝업 이미지 선로딩용 */
export const MAIN_BANNER_POPUP_IMAGE_URLS = [
  JEJU_TRAVELER_CENTER_COUPON_POSTER,
  CHILSEONGRO_GOOD_DAY_FESTA_POSTER,
] as const;

const TRAVEL_CENTER_IMAGE: Record<AppLocale, string> = {
  ko: "/banners/travel-center-ko.png",
  en: "/banners/travel-center-en.png",
  zh: "/banners/travel-center-zh.png",
  ja: "/banners/travel-center-ja.png",
};

export const NAVER_MAP_DIRECTIONS_IMAGE: Record<AppLocale, string> = {
  ko: "/banners/naver-map-directions-ko.png",
  en: "/banners/naver-map-directions-en.png",
  zh: "/banners/naver-map-directions-zh.png",
  ja: "/banners/naver-map-directions-ja.png",
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
      popupImageUrl: JEJU_TRAVELER_CENTER_COUPON_POSTER,
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
      id: "coupon-ko",
      imageUrl: "/banners/coupon-ko.png",
      popupImageUrl: JEJU_TRAVELER_CENTER_COUPON_POSTER,
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
      id: "chilseongro-good-day-festa-1",
      imageUrl: "/banners/chilseongro-good-day-festa-1.png",
      popupImageUrl: CHILSEONGRO_GOOD_DAY_FESTA_POSTER,
      naverMapLat: CHILSEONGRO_FESTA_LAT,
      naverMapLon: CHILSEONGRO_FESTA_LON,
      naverMapName: CHILSEONGRO_FESTA_MAP_NAME,
      naverMapWebUrl: CHILSEONGRO_GOOD_DAY_FESTA_MAP_URL,
      imageAlt: {
        ko: "칠성로 굿데이 페스타",
        en: "Chilseong-ro Good Day Festa",
        zh: "七星路 Good Day 庆典",
        ja: "七星路 Good Day フェスタ",
      },
    },
    {
      id: "chilseongro-good-day-festa-2",
      imageUrl: "/banners/chilseongro-good-day-festa-2.png",
      popupImageUrl: CHILSEONGRO_GOOD_DAY_FESTA_POSTER,
      naverMapLat: CHILSEONGRO_FESTA_LAT,
      naverMapLon: CHILSEONGRO_FESTA_LON,
      naverMapName: CHILSEONGRO_FESTA_MAP_NAME,
      naverMapWebUrl: CHILSEONGRO_GOOD_DAY_FESTA_MAP_URL,
      imageAlt: {
        ko: "칠성로 굿데이 페스타",
        en: "Chilseong-ro Good Day Festa",
        zh: "七星路 Good Day 庆典",
        ja: "七星路 Good Day フェスタ",
      },
    },
  ];
}

export function getBannerText(
  text: LocalizedText | undefined,
  locale: AppLocale,
): string {
  if (!text) return "";
  return text[locale] ?? text.ko;
}

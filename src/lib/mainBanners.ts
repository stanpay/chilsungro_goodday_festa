import type { AppLocale } from "@/lib/locale";

type LocalizedText = Partial<Record<AppLocale, string>> & { ko: string };

export type MainBanner = {
  id: string;
  /** 이미지 URL — 있으면 이미지 배너로 표시 */
  imageUrl?: string;
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

/** 메인 화면 상단 배너 — 광고·공지 내용은 여기서 수정 */
export const MAIN_BANNERS: MainBanner[] = [
  {
    id: "jeju-travel-center-coupon-event",
    imageUrl: "/banners/jeju-travel-center-coupon-event.png",
    imageAlt: {
      ko: "제주 여행자센터 폭풍감동 쿠폰 이벤트",
      en: "Jeju Travel Center coupon event",
      zh: "济州旅行者中心优惠券活动",
      ja: "済州旅行者センタークーポンイベント",
    },
    imageCtaLabel: {
      ko: "길찾기",
      en: "Directions",
      zh: "路线",
      ja: "道案内",
    },
    href: "https://naver.me/Fbqwjezy",
  },
];

export function getBannerText(
  text: LocalizedText | undefined,
  locale: AppLocale,
): string {
  if (!text) return "";
  return text[locale] ?? text.ko;
}

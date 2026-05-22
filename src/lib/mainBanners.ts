import type { AppLocale } from "@/lib/locale";

type LocalizedText = Partial<Record<AppLocale, string>> & { ko: string };

export type MainBanner = {
  id: string;
  /** 이미지 URL — 있으면 이미지 배너로 표시 */
  imageUrl?: string;
  imageAlt?: LocalizedText;
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
    id: "festa-notice",
    title: {
      ko: "칠성로 굿데이 페스타",
      en: "Chilsungro Goodday Festa",
      zh: "七星路 Goodday Festa",
      ja: "チルソンロ Goodday Festa",
    },
    description: {
      ko: "주변 매장에서 할인 혜택을 받아보세요",
      en: "Get discounts at nearby stores",
      zh: "在附近门店享受折扣优惠",
      ja: "近くの店舗で割引特典を受け取りましょう",
    },
    variant: "primary",
  },
  {
    id: "sample-ad",
    title: {
      ko: "이벤트 안내",
      en: "Event notice",
      zh: "活动公告",
      ja: "イベントのお知らせ",
    },
    description: {
      ko: "광고·공지 이미지는 mainBanners.ts에서 추가할 수 있어요",
      en: "Add ad and notice images in mainBanners.ts",
      zh: "可在 mainBanners.ts 中添加广告和公告图片",
      ja: "mainBanners.ts で広告・お知らせ画像を追加できます",
    },
    variant: "accent",
  },
];

export function getBannerText(
  text: LocalizedText | undefined,
  locale: AppLocale,
): string {
  if (!text) return "";
  return text[locale] ?? text.ko;
}

import { Button } from "@/components/ui/button";
import { useAppLocale } from "@/contexts/AppLocaleContext";
import type { AppLocale } from "@/lib/locale";
import {
  getMainBanners,
  getBannerText,
  NAVER_MAP_DIRECTIONS_ALT,
  NAVER_MAP_DIRECTIONS_IMAGE,
} from "@/lib/mainBanners";
import { openNaverMapDirections } from "@/lib/mapDirectionLinks";
import { SquareArrowOutUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PAGE_TITLE: Record<AppLocale, string> = {
  ko: "바로가기",
  en: "Shortcuts",
  zh: "快捷入口",
  ja: "ショートカット",
};

const COUPON_GUIDE_BUTTON_LABEL: Record<AppLocale, string> = {
  ko: "여행자 소비쿠폰 사용처 안내 서비스",
  en: "Traveler Coupon Usage Guide Service",
  zh: "旅行者消费券使用处指南服务",
  ja: "旅行者消費クーポン利用先案内サービス",
};

const DIRECTIONS_DESCRIPTION: Record<AppLocale, string> = {
  ko: "제주여행자센터까지 네이버 지도로 길안내를 받을 수 있습니다.",
  en: "Get directions to Jeju Traveler Center via Naver Map.",
  zh: "可通过 Naver 地图导航至济州旅行者中心。",
  ja: "済州旅行者センターまでNaverマップで案内を受けられます。",
};

const COUPON_GUIDE_DESCRIPTION: Record<AppLocale, string> = {
  ko: "제주 여행자 소비쿠폰 사용 가능 매장을 검색하고 할인·적립 정보를 확인할 수 있습니다.",
  en: "Search stores that accept Jeju traveler coupons and view discounts and rewards.",
  zh: "可搜索可使用济州旅行者消费券的店铺，并查看折扣与积分信息。",
  ja: "済州旅行者消費クーポンが使える店舗を検索し、割引・ポイント情報を確認できます。",
};

const NavigatePage = () => {
  const navigate = useNavigate();
  const { locale } = useAppLocale();
  const mainBanners = getMainBanners(locale);
  const firstBanner = mainBanners[0];
  const firstBannerAlt =
    getBannerText(firstBanner?.imageAlt, locale) ||
    getBannerText(firstBanner?.title, locale);
  const directionsAlt = NAVER_MAP_DIRECTIONS_ALT[locale];

  const handleTravelCenterDirections = () => {
    if (!firstBanner) return;

    openNaverMapDirections({
      lat: firstBanner.naverMapLat,
      lon: firstBanner.naverMapLon,
      name: getBannerText(firstBanner.naverMapName, locale),
      placeId: firstBanner.naverMapPlaceId,
      url: firstBanner.naverMapWebUrl ?? firstBanner.naverMapUrl,
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-6">
      <h1 className="text-2xl font-semibold text-foreground">
        {PAGE_TITLE[locale]}
      </h1>

      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="block w-full shrink-0 overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={firstBannerAlt}
            onClick={handleTravelCenterDirections}
          >
            {firstBanner?.imageUrl ? (
              <img
                src={firstBanner.imageUrl}
                alt={firstBannerAlt}
                className="w-full object-contain"
              />
            ) : null}
          </button>
          <button
            type="button"
            className="block w-full shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={directionsAlt}
            onClick={handleTravelCenterDirections}
          >
            <img
              src={NAVER_MAP_DIRECTIONS_IMAGE[locale]}
              alt={directionsAlt}
              className="w-full object-contain"
            />
          </button>
          <p className="px-1 text-center text-sm leading-relaxed text-muted-foreground">
            {DIRECTIONS_DESCRIPTION[locale]}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            className="h-auto w-full py-6 text-base font-semibold"
            onClick={() => navigate("/main")}
          >
            <SquareArrowOutUpRight className="mr-2 h-5 w-5" />
            {COUPON_GUIDE_BUTTON_LABEL[locale]}
          </Button>
          <p className="px-1 text-center text-sm leading-relaxed text-muted-foreground">
            {COUPON_GUIDE_DESCRIPTION[locale]}
          </p>
        </div>
      </div>
    </div>
  );
};

export default NavigatePage;

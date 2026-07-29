import { AutoFitMarquee } from "@/components/AutoFitMarquee";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppLocale } from "@/contexts/AppLocaleContext";
import {
  APP_LOCALES,
  isAppLocale,
  LOCALE_MENU_LABELS,
  mainStrings,
  type AppLocale,
} from "@/lib/locale";
import { prefetchBrowserLocation } from "@/lib/locationPrefetch";
import {
  getMainBanners,
  getBannerText,
  NAVER_MAP_DIRECTIONS_ALT,
  NAVER_MAP_DIRECTIONS_IMAGE,
} from "@/lib/mainBanners";
import { openNaverMapDirections } from "@/lib/mapDirectionLinks";
import { ChevronDown, Languages, SquareArrowOutUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

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
  ko: "여행자 소비쿠폰 사용 가능 매장을 검색하고\n길안내 받을 수 있습니다.",
  en: "Search stores that accept traveler coupons\nand get directions.",
  zh: "可搜索可使用旅行者消费券的店铺\n并获得路线指引。",
  ja: "旅行者消費クーポンが使える店舗を検索し、\n道案内を受けられます。",
};

/** 일본어 번역본 준비 전까지 en 폴백 */
const COUPON_GUIDE_BANNER_IMAGE: Record<AppLocale, string> = {
  ko: "/jeju-traveler-coupon-guide-ko.jpg",
  en: "/jeju-traveler-coupon-guide-en.jpg",
  zh: "/jeju-traveler-coupon-guide-zh.jpg",
  ja: "/jeju-traveler-coupon-guide-en.jpg",
};

const COUPON_GUIDE_BANNER_ALT: Record<AppLocale, string> = {
  ko: "여행자 소비쿠폰 사용처 안내",
  en: "Participating Stores for Traveler Discount Coupons",
  zh: "游客消费优惠券使用商户",
  ja: "旅行者消費クーポン利用先案内",
};

const TRAVEL_CENTER_AREA_MAP_IMAGE = "/jeju-traveler-center-area-map.png";

const TRAVEL_CENTER_AREA_MAP_ALT: Record<AppLocale, string> = {
  ko: "제주여행자센터 주변 주요 상권 및 랜드마크 안내 지도",
  en: "Map of major areas and landmarks around Jeju Traveler Center",
  zh: "济州旅行者中心周边主要商圈与地标导览图",
  ja: "済州旅行者センター周辺の主要エリア・ランドマーク案内地図",
};

const NavigatePage = () => {
  const navigate = useNavigate();
  const { locale, setLocale } = useAppLocale();
  const t = mainStrings(locale);
  const mainBanners = getMainBanners(locale);
  const firstBanner = mainBanners[0];
  const couponGuideBannerAlt = COUPON_GUIDE_BANNER_ALT[locale];
  const couponGuideBannerImage = COUPON_GUIDE_BANNER_IMAGE[locale];
  const directionsAlt = NAVER_MAP_DIRECTIONS_ALT[locale];
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await prefetchBrowserLocation(locale);
      } catch {
        // 권한 거부·타임아웃 등은 조용히 무시 — Main에서 GPS 폴백
      }
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [locale]);

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
    <div className="flex min-h-screen flex-col items-center justify-start gap-8 bg-background p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="mb-2 flex justify-end">
            <DropdownMenu open={isLanguageMenuOpen} onOpenChange={setIsLanguageMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-[8rem] shrink-0 gap-1.5 rounded-xl border border-primary bg-card px-3 text-foreground transition-colors hover:bg-card hover:text-foreground focus:bg-card focus:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 active:bg-card active:text-foreground data-[state=open]:bg-card data-[state=open]:text-foreground"
                  aria-label={t.languageMenuAria}
                  title={LOCALE_MENU_LABELS[locale]}
                  onPointerDown={(event) => event.preventDefault()}
                  onPointerLeave={(event) => event.currentTarget.blur()}
                  onPointerCancel={(event) => event.currentTarget.blur()}
                  onPointerUp={(event) => event.currentTarget.blur()}
                  onClick={() => setIsLanguageMenuOpen((open) => !open)}
                >
                  <Languages className="h-4 w-4 shrink-0" />
                  <AutoFitMarquee
                    text={LOCALE_MENU_LABELS[locale]}
                    className="flex-1 pr-0"
                    textClassName="text-center text-sm !leading-4"
                    fontSizeClasses={["text-sm", "text-xs"]}
                  />
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 p-1.5">
                <DropdownMenuRadioGroup
                  value={locale}
                  onValueChange={(value) => {
                    if (!isAppLocale(value)) return;
                    setLocale(value);
                  }}
                >
                  {APP_LOCALES.map((code) => (
                    <DropdownMenuRadioItem
                      key={code}
                      value={code}
                      className="rounded-lg py-3 pl-10 pr-3 text-base font-medium [&>span]:left-3 [&>span]:h-4 [&>span]:w-4 [&>span_svg]:h-2.5 [&>span_svg]:w-2.5"
                    >
                      {LOCALE_MENU_LABELS[code]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button
            size="lg"
            className="h-auto w-full whitespace-normal px-4 py-3 text-center text-base font-semibold leading-snug"
            onClick={() => navigate("/main")}
          >
            <SquareArrowOutUpRight className="mr-2 h-5 w-5 shrink-0" />
            {COUPON_GUIDE_BUTTON_LABEL[locale]}
          </Button>
          <p className="whitespace-pre-line px-1 text-center text-sm leading-relaxed text-muted-foreground">
            {COUPON_GUIDE_DESCRIPTION[locale]}
          </p>

          <button
            type="button"
            className="mt-2 block w-full shrink-0 overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={couponGuideBannerAlt}
            onClick={handleTravelCenterDirections}
          >
            <img
              src={couponGuideBannerImage}
              alt={couponGuideBannerAlt}
              className="w-full object-contain"
            />
          </button>
          <button
            type="button"
            className="mt-2 block w-full shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
          <img
            src={TRAVEL_CENTER_AREA_MAP_IMAGE}
            alt={TRAVEL_CENTER_AREA_MAP_ALT[locale]}
            className="mt-2 w-full rounded-xl object-contain"
          />
        </div>
      </div>
    </div>
  );
};

export default NavigatePage;

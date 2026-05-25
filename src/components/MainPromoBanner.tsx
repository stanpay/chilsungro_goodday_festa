import { useCallback, useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  getBannerText,
  MAIN_BANNERS,
  type MainBanner,
} from "@/lib/mainBanners";
import type { AppLocale } from "@/lib/locale";
import { cn } from "@/lib/utils";

const VARIANT_CLASS: Record<NonNullable<MainBanner["variant"]>, string> = {
  primary: "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground",
  accent: "bg-gradient-to-r from-violet-600 to-primary text-white",
  muted: "bg-muted text-foreground",
};

type MainPromoBannerProps = {
  locale: AppLocale;
  className?: string;
};
const openNaverMap = () => {
  const placeId = "2031464673";
  const webUrl =
    "https://map.naver.com/p/entry/place/2031464673?placePath=%2Fhome";

  // 모바일 웹이면 본인 서비스 도메인을 appname으로 넣는 게 좋습니다.
  const appName = encodeURIComponent(window.location.origin);

  const isAndroid = /Android/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isAndroid) {
    // Android Chrome 계열: 네이버지도 앱 설치 시 앱으로 열림
    window.location.href =
      `intent://place?id=${placeId}&appname=${appName}` +
      `#Intent;scheme=nmap;action=android.intent.action.VIEW;` +
      `category=android.intent.category.BROWSABLE;` +
      `package=com.nhn.android.nmap;` +
      `S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
    return;
  }

  if (isIOS) {
    const deepLink = `nmap://place?id=${placeId}&appname=${appName}`;
    const clickedAt = Date.now();

    window.location.href = deepLink;

    // 앱이 안 열리면 웹 네이버지도로 fallback
    setTimeout(() => {
      if (Date.now() - clickedAt < 2000) {
        window.location.href = webUrl;
      }
    }, 1500);
    return;
  }

  // PC에서는 그냥 웹 네이버지도
  window.open(webUrl, "_blank");
};
function BannerSlide({
  banner,
  locale,
}: {
  banner: MainBanner;
  locale: AppLocale;
}) {
  const title = getBannerText(banner.title, locale);
  const description = getBannerText(banner.description, locale);
  const imageAlt = getBannerText(banner.imageAlt, locale) || title;
  const imageCtaLabel = getBannerText(banner.imageCtaLabel, locale) || "길찾기";

  const content = banner.imageUrl ? (
    <div className="relative h-full w-full bg-card">
      <img
        src={banner.imageUrl}
        alt={imageAlt}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </div>
  ) : (
    <div
      className={cn(
        "flex h-full w-full items-center gap-3 px-4 py-3",
        VARIANT_CLASS[banner.variant ?? "primary"],
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
        <Megaphone className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        {title ? <p className="break-words text-sm font-semibold leading-snug">{title}</p> : null}
        {description ? (
          <p className="break-words text-xs leading-snug opacity-90">{description}</p>
        ) : null}
      </div>
    </div>
  );

  if (banner.href) {
    return (
      <a
        // href={banner.href}
        // target="_blank"
        // rel="noopener noreferrer"
        className="block h-full w-full overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={title || imageAlt}
        onClick={openNaverMap}
      >
        {content}
      </a>
    );
  }

  return <div className="h-full w-full overflow-hidden rounded-xl">{content}</div>;
}

export default function MainPromoBanner({
  locale,
  className,
}: MainPromoBannerProps) {
  const banners = MAIN_BANNERS;
  const [api, setApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!api) return;
    setActiveIndex(api.selectedScrollSnap());
  }, [api]);

  useEffect(() => {
    if (!api) return;
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api, onSelect]);

  useEffect(() => {
    if (!api || banners.length <= 1) return;
    const timer = window.setInterval(() => {
      api.scrollNext();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [api, banners.length]);

  if (banners.length === 0) return null;

  if (banners.length === 1) {
    return (
      <div className={cn("mb-4 aspect-[2.39/1] w-full overflow-hidden", className)}>
        <BannerSlide banner={banners[0]} locale={locale} />
      </div>
    );
  }

  return (
    <div className={cn("relative mb-4", className)}>
      <Carousel
        setApi={setApi}
        opts={{ loop: true }}
        className="w-full"
      >
        <CarouselContent className="-ml-0">
          {banners.map((banner) => (
            <CarouselItem key={banner.id} className="basis-full pl-0">
              <div className="aspect-[2.39/1] w-full overflow-hidden">
                <BannerSlide banner={banner} locale={locale} />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
        {banners.map((banner, index) => (
          <button
            key={banner.id}
            type="button"
            aria-label={`배너 ${index + 1}`}
            className={cn(
              "h-1.5 rounded-full transition-all",
              index === activeIndex
                ? "w-4 bg-white"
                : "w-1.5 bg-white/50",
            )}
            onClick={() => api?.scrollTo(index)}
          />
        ))}
      </div>
    </div>
  );
}

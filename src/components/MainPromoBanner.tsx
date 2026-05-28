import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Megaphone } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getBannerText,
  getMainBanners,
  NAVER_MAP_DIRECTIONS_ALT,
  NAVER_MAP_DIRECTIONS_IMAGE,
  type MainBanner,
} from "@/lib/mainBanners";
import type { AppLocale } from "@/lib/locale";
import { openNaverMapDirections } from "@/lib/mapDirectionLinks";
import { cn } from "@/lib/utils";
import { AutoFitMarquee } from "@/components/AutoFitMarquee";

const AUTO_SLIDE_MS = 1500;

const VARIANT_CLASS: Record<NonNullable<MainBanner["variant"]>, string> = {
  primary: "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground",
  accent: "bg-gradient-to-r from-violet-600 to-primary text-white",
  muted: "bg-muted text-foreground",
};

type MainPromoBannerProps = {
  locale: AppLocale;
  className?: string;
};

function BannerSlide({
  banner,
  locale,
  onOpen,
}: {
  banner: MainBanner;
  locale: AppLocale;
  onOpen: () => void;
}) {
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const skippedClick = useRef(false);

  const title = getBannerText(banner.title, locale);
  const description = getBannerText(banner.description, locale);
  const imageAlt = getBannerText(banner.imageAlt, locale) || title;

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    pointerStart.current = { x: event.clientX, y: event.clientY };
    skippedClick.current = false;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerStart.current) return;
    const dx = Math.abs(event.clientX - pointerStart.current.x);
    const dy = Math.abs(event.clientY - pointerStart.current.y);
    if (dx > 8 || dy > 8) {
      skippedClick.current = true;
    }
  };

  const handleClick = () => {
    if (skippedClick.current) return;
    onOpen();
  };

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
        {title ? (
          <AutoFitMarquee
            as="p"
            text={title}
            textClassName="font-semibold"
            fontSizeClasses={["text-sm", "text-xs"]}
          />
        ) : null}
        {description ? (
          <AutoFitMarquee
            as="p"
            text={description}
            textClassName="opacity-90"
            fontSizeClasses={["text-xs"]}
          />
        ) : null}
      </div>
    </div>
  );

  return (
    <button
      type="button"
      className="block min-h-full w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={title || imageAlt}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
    >
      {content}
    </button>
  );
}

export default function MainPromoBanner({
  locale,
  className,
}: MainPromoBannerProps) {
  const banners = useMemo(() => getMainBanners(locale), [locale]);
  const [api, setApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoSlidePaused, setIsAutoSlidePaused] = useState(false);
  const [selectedBanner, setSelectedBanner] = useState<MainBanner | null>(null);

  const selectedBannerAlt = selectedBanner
    ? getBannerText(selectedBanner.imageAlt, locale) ||
      getBannerText(selectedBanner.title, locale)
    : "";
  const selectedPopupImageUrl = selectedBanner?.popupImageUrl;
  const showNaverMapDirections =
    !!selectedBanner?.naverMapPlaceId || !!selectedBanner?.naverMapUrl;
  const directionsAlt = NAVER_MAP_DIRECTIONS_ALT[locale];

  const pauseAutoSlide = useCallback(() => {
    setIsAutoSlidePaused(true);
  }, []);

  const resumeAutoSlide = useCallback(() => {
    setIsAutoSlidePaused(false);
  }, []);

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
    if (!api || banners.length <= 1 || isAutoSlidePaused || selectedBanner) return;

    const timer = window.setTimeout(() => {
      api.scrollNext();
    }, AUTO_SLIDE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [api, activeIndex, banners.length, isAutoSlidePaused, selectedBanner]);

  if (banners.length === 0) return null;

  return (
    <div
      className={cn("relative mb-4 overflow-hidden rounded-xl", className)}
      onPointerDown={pauseAutoSlide}
      onPointerUp={resumeAutoSlide}
      onPointerCancel={resumeAutoSlide}
    >
      <Carousel
        setApi={setApi}
        opts={{ loop: true, dragFree: false }}
        className="w-full"
      >
        <CarouselContent className="-ml-0">
          {banners.map((banner) => (
            <CarouselItem key={banner.id} className="basis-full pl-0">
              <div className="aspect-[2.39/1] w-full overflow-hidden">
                <BannerSlide
                  banner={banner}
                  locale={locale}
                  onOpen={() => setSelectedBanner(banner)}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      {banners.length > 1 ? (
        <div
          className="pointer-events-none absolute right-2 top-2 rounded-md bg-black/50 px-2 py-0.5 text-xs font-medium text-white tabular-nums"
          aria-live="polite"
          aria-atomic="true"
        >
          {activeIndex + 1}/{banners.length}
        </div>
      ) : null}
      <Dialog
        open={selectedBanner !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedBanner(null);
        }}
      >
        <DialogContent className="max-w-md gap-0 overflow-hidden rounded-xl p-0">
          <DialogTitle className="sr-only">{selectedBannerAlt}</DialogTitle>
          <DialogDescription className="sr-only">
            {selectedBannerAlt}
          </DialogDescription>
          <div className="flex max-h-[85vh] flex-col overflow-hidden">
            <div className="h-10 shrink-0" aria-hidden="true" />
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="flex flex-col gap-4 px-4 pb-4">
                {showNaverMapDirections ? (
                  <button
                    type="button"
                    className="block w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label={directionsAlt}
                    onClick={() =>
                      openNaverMapDirections({
                        placeId: selectedBanner?.naverMapPlaceId,
                        url: selectedBanner?.naverMapUrl,
                      })
                    }
                  >
                    <img
                      src={NAVER_MAP_DIRECTIONS_IMAGE[locale]}
                      alt={directionsAlt}
                      className="w-full object-contain"
                    />
                  </button>
                ) : null}
                {selectedPopupImageUrl ? (
                  <img
                    src={selectedPopupImageUrl}
                    alt={selectedBannerAlt}
                    className="w-full object-contain"
                  />
                ) : null}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { Card } from "@/components/ui/card";
import { Coffee, MapPin, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppLocale } from "@/contexts/AppLocaleContext";
import { parkingSizeLabel, storeCardStrings } from "@/lib/locale";
import { useTranslatedKoreanText } from "@/hooks/useKoreanDisplayText";
import { AutoFitMarquee } from "@/components/AutoFitMarquee";
import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { openStoreRedirect } from "@/lib/storeRedirect";

interface StoreCardProps {
  id: string;
  name: string;
  distance: string;
  image: string;
  maxDiscount: string | null;
  maxDiscountPercent?: number | null;
  address?: string;
  lat?: number;
  lon?: number;
  local_currency_available?: boolean;
  local_currency_discount_rate?: number | null;
  high_oil_support_available?: boolean;
  parking_available?: boolean;
  free_parking?: boolean;
  parking_size?: string | null;
  isOpen?: boolean;
  todayHours?: { open: string; close: string } | null;
  photos?: string[];
  closedDayNote?: string;
  hasGifticonDiscount?: boolean;
  tutorialMode?: boolean;
  isHighlighted?: boolean;
  disabled?: boolean;
  detailUrl?: string;
  /** 부모에서 카드 활성화 동작(예: 지도 동기화/리다이렉트)을 직접 처리할 때 사용 */
  onActivate?: () => void;
}

const brandLogos: Record<string, string> = {
  starbucks: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTA4MjlfMjgx%2FMDAxNzU2NDc1MzQ5MDg3.DfBA7igmTBTBDImxB5xYeYo2u0CkoEE7koZ4ftZd88kg.38N8phV00xjgzB4Nxlokk5y-5jQlNguJKmhDGEKH0Tog.PNG%2F4.png&type=sc960_832",
  baskin: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMzAyMjJfODMg%2FMDAxNjc3MDY4NjQ1NTI5.M_v0jLl65iN6AZLntTDRNHLnKpFZo9qV8PLwsOTvC_Ug.t8CrUh9Qz--ZORSdxyWEIwo2ShJTpngAmJ4-1A5ulFkg.PNG.futurara%2F%25BA%25A3%25B6%25F3%25B7%25CE%25B0%25ED.png&type=a340",
  mega: "https://img.79plus.co.kr/megahp/common/img/new_logo.png",
  pascucci: "https://www.pascucci.co.kr/lib/images/common/foot_logo2.png",
  twosome: "https://www.twosome.co.kr/resources/images/content/bi_img_logo_.svg",
};

const NAME_MARQUEE_TOLERANCE_PX = 1;
const NAME_SAFE_RIGHT_PADDING_PX = 6;
const CHIPS_MARQUEE_TOLERANCE_PX = 1;

const StoreCard = ({
  id,
  name,
  distance,
  image,
  maxDiscount,
  maxDiscountPercent = null,
  address,
  lat,
  lon,
  local_currency_available = false,
  local_currency_discount_rate = null,
  high_oil_support_available = false,
  parking_available = false,
  free_parking = false,
  parking_size = null,
  isOpen,
  todayHours,
  photos,
  closedDayNote,
  hasGifticonDiscount = false,
  tutorialMode = false,
  isHighlighted = false,
  disabled = false,
  detailUrl,
  onActivate,
}: StoreCardProps) => {
  const { locale } = useAppLocale();
  const sc = storeCardStrings(locale);
  const displayName = useTranslatedKoreanText(name, locale);
  const brandLogoUrl = brandLogos[image as keyof typeof brandLogos];
  const nameContainerRef = useRef<HTMLHeadingElement>(null);
  const chipsContainerRef = useRef<HTMLDivElement>(null);
  const chipsInnerRef = useRef<HTMLSpanElement>(null);
  const [nameFontSizeClass, setNameFontSizeClass] = useState("text-base");
  const [nameMarqueeDistance, setNameMarqueeDistance] = useState(0);
  const [chipsMarqueeDistance, setChipsMarqueeDistance] = useState(0);

  useLayoutEffect(() => {
    const container = nameContainerRef.current;
    if (!container) return;

    const measure = (fontSizeClass: string) => {
      const probe = document.createElement("span");
      probe.className = `${fontSizeClass} font-bold whitespace-nowrap`;
      probe.textContent = displayName;
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      probe.style.pointerEvents = "none";
      probe.style.left = "-9999px";
      probe.style.top = "-9999px";
      document.body.appendChild(probe);
      const width = probe.scrollWidth;
      probe.remove();
      return width;
    };

    const updateNameLayout = () => {
      const containerWidth = container.clientWidth - NAME_SAFE_RIGHT_PADDING_PX;
      if (containerWidth <= 0) return;

      const baseWidth = measure("text-base");
      if (baseWidth <= containerWidth + NAME_MARQUEE_TOLERANCE_PX) {
        setNameFontSizeClass("text-base");
        setNameMarqueeDistance(0);
        return;
      }

      const smallWidth = measure("text-sm");
      if (smallWidth <= containerWidth + NAME_MARQUEE_TOLERANCE_PX) {
        setNameFontSizeClass("text-sm");
        setNameMarqueeDistance(0);
        return;
      }

      const extraSmallWidth = measure("text-xs");
      const extraSmallOverflow = extraSmallWidth - containerWidth;
      setNameFontSizeClass("text-xs");
      setNameMarqueeDistance(
        extraSmallOverflow > NAME_MARQUEE_TOLERANCE_PX ? extraSmallOverflow : 0
      );
    };

    updateNameLayout();
    document.fonts?.ready.then(updateNameLayout);

    if (!("ResizeObserver" in globalThis)) {
      globalThis.addEventListener("resize", updateNameLayout);
      return () => globalThis.removeEventListener("resize", updateNameLayout);
    }

    const observer = new ResizeObserver(updateNameLayout);
    observer.observe(container);

    return () => observer.disconnect();
  }, [displayName]);

  const handleClick = () => {
    if (disabled) return;

    // 부모에서 동작을 직접 제어하는 경우 (예: 지도 선택 + 리다이렉트)
    if (onActivate) {
      onActivate();
      return;
    }

    if (detailUrl) {
      openStoreRedirect(detailUrl, { lat, lon, name });
    }
  };

  // 지역화폐 칩 표시 여부
  const showLocalCurrencyChip = local_currency_available;
  
  // 주차 칩 표시 여부
  const showParkingChip = parking_available;
  
  // 주차 칩 텍스트 생성
  const getParkingText = () => {
    if (!parking_available) return "";
    const sizeLabel = parking_size ? parkingSizeLabel(locale, parking_size) : "";
    if (free_parking) {
      return sizeLabel ? sc.freeParkingWithSize(sizeLabel) : sc.freeParking;
    }
    return sizeLabel ? sc.paidParkingWithSize(sizeLabel) : sc.paidParking;
  };

  const discountBadgeText =
    typeof maxDiscountPercent === "number" && maxDiscountPercent > 0
      ? sc.maxDiscountPercent(maxDiscountPercent)
      : maxDiscount;

  const parkingText = getParkingText();
  const localCurrencyText =
    local_currency_discount_rate != null && local_currency_discount_rate > 0
      ? sc.localCurrencyDiscount(local_currency_discount_rate)
      : sc.localCurrency;
  const showChipsRow =
    showLocalCurrencyChip ||
    hasGifticonDiscount ||
    (locale === "ko" && high_oil_support_available) ||
    showParkingChip;

  useLayoutEffect(() => {
    const container = chipsContainerRef.current;
    const inner = chipsInnerRef.current;
    if (!container || !inner || !showChipsRow) {
      setChipsMarqueeDistance(0);
      return;
    }

    const updateChipsLayout = () => {
      const containerWidth = container.clientWidth;
      if (containerWidth <= 0) return;

      const contentWidth = inner.scrollWidth;
      const overflow = contentWidth - containerWidth;
      setChipsMarqueeDistance(
        overflow > CHIPS_MARQUEE_TOLERANCE_PX ? overflow : 0
      );
    };

    updateChipsLayout();
    document.fonts?.ready.then(updateChipsLayout);

    if (!("ResizeObserver" in globalThis)) {
      globalThis.addEventListener("resize", updateChipsLayout);
      return () => globalThis.removeEventListener("resize", updateChipsLayout);
    }

    const observer = new ResizeObserver(updateChipsLayout);
    observer.observe(container);

    return () => observer.disconnect();
  }, [
    showChipsRow,
    hasGifticonDiscount,
    showLocalCurrencyChip,
    localCurrencyText,
    high_oil_support_available,
    showParkingChip,
    parkingText,
    locale,
  ]);

  const chipClassName =
    "inline-flex items-center px-1.5 py-1 rounded text-[11px] font-medium leading-none whitespace-nowrap shrink-0";

  return (
    <div
      onClick={handleClick}
      className={cn(
        "relative h-full",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <Card
        className={cn(
          "relative h-full overflow-hidden bg-card",
          isHighlighted
            ? "box-border border-[3px] border-solid border-primary shadow-sm"
            : "border-border/50",
          !disabled && "cursor-pointer"
        )}
      >
        <div className="flex flex-col">
          <div className="relative flex h-28 items-center justify-center overflow-hidden bg-primary/10 p-4">
            {/* 비브랜드 매장: 더미 사진 배경 */}
            {!brandLogoUrl && photos && photos.length > 0 && (
              <img
                src={photos[0]}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            )}
            {/* 사진 위 오버레이 */}
            {!brandLogoUrl && photos && photos.length > 0 && (
              <div className="absolute inset-0 bg-black/25" aria-hidden />
            )}

            {/* 로고 / 아이콘 */}
            {brandLogoUrl ? (
              <img
                src={brandLogoUrl}
                alt={displayName}
                className="relative z-10 h-20 w-20 object-contain"
              />
            ) : !(photos && photos.length > 0) && (
              image === "shopping" ? (
                <ShoppingBag className="relative z-10 h-20 w-20 text-primary/70" strokeWidth={1.5} aria-hidden />
              ) : image === "restaurant" ? (
                <UtensilsCrossed className="relative z-10 h-20 w-20 text-primary/70" strokeWidth={1.5} aria-hidden />
              ) : (
                <Coffee className="relative z-10 h-20 w-20 text-primary/70" strokeWidth={1.5} aria-hidden />
              )
            )}

            {discountBadgeText && (
              <div className="absolute top-2 right-2 z-20 flex flex-col items-end gap-1.5">
                <div className="bg-destructive text-destructive-foreground px-2 py-1 rounded-lg text-xs font-bold shadow-sm">
                  {discountBadgeText}
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 grid-rows-[1.75rem_1.125rem_1.125rem_1.75rem] gap-y-1 bg-card p-3">
            <h3
              ref={nameContainerRef}
              className="flex h-7 min-w-0 items-center pr-1.5"
            >
              <span className="min-w-0 flex-1 overflow-hidden">
                <span
                  className={cn(
                    "block whitespace-nowrap text-left font-bold !leading-7",
                    nameFontSizeClass,
                    nameMarqueeDistance > 0 && "marquee-on-overflow"
                  )}
                  style={
                    nameMarqueeDistance > 0
                      ? ({
                          "--marquee-distance": `${nameMarqueeDistance}px`,
                        } as CSSProperties)
                      : undefined
                  }
                >
                  {displayName}
                </span>
              </span>
            </h3>
            <div className="flex h-[1.125rem] min-w-0 items-center text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
              <AutoFitMarquee
                text={distance}
                className="flex-1"
                textClassName="text-muted-foreground !leading-[1.125rem]"
                fontSizeClasses={["text-xs"]}
              />
            </div>
            <div className="flex h-[1.125rem] min-w-0 items-center gap-1 text-xs">
              {isOpen === false && (
                <>
                  <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-muted-foreground/50" />
                  <AutoFitMarquee
                    text={closedDayNote || (todayHours ? `오늘 ${todayHours.open} 오픈` : "영업종료")}
                    className="flex-1"
                    textClassName="text-muted-foreground !leading-[1.125rem]"
                    fontSizeClasses={["text-xs"]}
                  />
                </>
              )}
            </div>
            <div
              ref={chipsContainerRef}
              className="flex h-[1.75rem] min-w-0 items-center overflow-x-hidden"
            >
              {showChipsRow && (
                <span className="flex min-w-0 flex-1 items-center overflow-x-hidden">
                  <span
                    className={cn(
                      "leading-none",
                      chipsMarqueeDistance > 0 && "marquee-on-overflow"
                    )}
                    style={
                      chipsMarqueeDistance > 0
                        ? ({
                            "--marquee-distance": `${chipsMarqueeDistance}px`,
                          } as CSSProperties)
                        : undefined
                    }
                  >
                    <span
                      ref={chipsInnerRef}
                      className="inline-flex flex-nowrap items-center gap-1"
                    >
                      {hasGifticonDiscount && (
                        <span
                          className={cn(
                            chipClassName,
                            "border border-[#1EA2DC]/25 bg-[#1EA2DC]/10 text-[#1EA2DC] dark:border-[#1EA2DC]/35 dark:bg-[#1EA2DC]/15 dark:text-[#5BC8E8]"
                          )}
                        >
                          {sc.travelConsumerCoupon}
                        </span>
                      )}
                      {showLocalCurrencyChip && (
                        <span
                          className={cn(
                            chipClassName,
                            "border border-[#FF9E09]/25 bg-[#FF9E09]/10 text-[#FF9E09] dark:border-[#FF9E09]/35 dark:bg-[#FF9E09]/15 dark:text-[#FFB84D]"
                          )}
                        >
                          {localCurrencyText}
                        </span>
                      )}
                      {locale === "ko" && high_oil_support_available && (
                        <span
                          className={cn(
                            chipClassName,
                            "border border-[#F5B800]/30 bg-[#F5B800]/12 text-[#C98A00] dark:border-[#F5B800]/35 dark:bg-[#F5B800]/18 dark:text-[#FFD54F]"
                          )}
                        >
                          {sc.highOilSupport}
                        </span>
                      )}
                      {showParkingChip && (
                        <span
                          className={cn(
                            chipClassName,
                            "bg-secondary text-secondary-foreground border border-border"
                          )}
                        >
                          {parkingText}
                        </span>
                      )}
                    </span>
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default StoreCard;

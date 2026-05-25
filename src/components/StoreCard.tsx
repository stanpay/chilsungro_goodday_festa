import { Card } from "@/components/ui/card";
import { Coffee, MapPin, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAppLocale } from "@/contexts/AppLocaleContext";
import { parkingSizeLabel, storeCardStrings } from "@/lib/locale";
import { useTranslatedKoreanText } from "@/hooks/useKoreanDisplayText";
import { openNaverMapsApp } from "@/lib/mapDirectionLinks";
import { AutoFitMarquee } from "@/components/AutoFitMarquee";

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
}

const brandLogos: Record<string, string> = {
  starbucks: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTA4MjlfMjgx%2FMDAxNzU2NDc1MzQ5MDg3.DfBA7igmTBTBDImxB5xYeYo2u0CkoEE7koZ4ftZd88kg.38N8phV00xjgzB4Nxlokk5y-5jQlNguJKmhDGEKH0Tog.PNG%2F4.png&type=sc960_832",
  baskin: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMzAyMjJfODMg%2FMDAxNjc3MDY4NjQ1NTI5.M_v0jLl65iN6AZLntTDRNHLnKpFZo9qV8PLwsOTvC_Ug.t8CrUh9Qz--ZORSdxyWEIwo2ShJTpngAmJ4-1A5ulFkg.PNG.futurara%2F%25BA%25A3%25B6%25F3%25B7%25CE%25B0%25ED.png&type=a340",
  mega: "https://img.79plus.co.kr/megahp/common/img/new_logo.png",
  pascucci: "https://www.pascucci.co.kr/lib/images/common/foot_logo2.png",
  twosome: "https://www.twosome.co.kr/resources/images/content/bi_img_logo_.svg",
};

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
}: StoreCardProps) => {
  const { locale } = useAppLocale();
  const sc = storeCardStrings(locale);
  const displayName = useTranslatedKoreanText(name, locale);
  const navigate = useNavigate();
  const location = useLocation();
  const isTutorial = location.pathname.includes("/tutorial");
  const brandLogoUrl = brandLogos[image as keyof typeof brandLogos];

  const handleClick = () => {
    if (disabled) return;

    if (isTutorial) {
      navigate(`/tutorial/payment/${id}`);
      return;
    }

    openNaverMapsApp({ name, address, lat, lon });
  };

  // 지역화폐 칩 표시 여부
  const showLocalCurrencyChip = local_currency_available && local_currency_discount_rate !== null && local_currency_discount_rate > 0;
  
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
          "relative h-full overflow-hidden bg-card border-border/50",
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
            ) : image === "shopping" ? (
              <ShoppingBag className="relative z-10 h-20 w-20 text-primary/70" strokeWidth={1.5} aria-hidden />
            ) : image === "restaurant" ? (
              <UtensilsCrossed className="relative z-10 h-20 w-20 text-primary/70" strokeWidth={1.5} aria-hidden />
            ) : (
              <Coffee className="relative z-10 h-20 w-20 text-primary/70" strokeWidth={1.5} aria-hidden />
            )}

            {discountBadgeText && (
              <div className="absolute top-2 right-2 z-20 flex flex-col items-end gap-1.5">
                <div className="bg-destructive text-destructive-foreground px-2 py-1 rounded-lg text-xs font-bold shadow-sm">
                  {discountBadgeText}
                </div>
              </div>
            )}
          </div>
          <div className="p-3 bg-card">
            <AutoFitMarquee
              as="h3"
              text={displayName}
              className="mb-1 h-6"
              textClassName="font-bold !leading-6"
              fontSizeClasses={["text-base", "text-sm"]}
            />
            <div className="mb-1.5 flex h-4 items-center text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
              <AutoFitMarquee
                text={distance}
                className="flex-1"
                textClassName="text-muted-foreground !leading-4"
                fontSizeClasses={["text-xs"]}
              />
            </div>
            {isOpen === false && (
              <div className="flex items-center gap-1 text-xs mb-1.5">
                <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-muted-foreground/50" />
                <span className="text-muted-foreground">
                  {closedDayNote || (todayHours ? `오늘 ${todayHours.open} 오픈` : "영업종료")}
                </span>
              </div>
            )}
            {(showLocalCurrencyChip || hasGifticonDiscount || showParkingChip) && (
              <div className="flex flex-nowrap gap-1 overflow-x-auto scrollbar-hide">
                {showLocalCurrencyChip && local_currency_discount_rate != null && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 whitespace-nowrap shrink-0">
                    {sc.localCurrencyDiscount(local_currency_discount_rate)}
                  </span>
                )}
                {hasGifticonDiscount && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-600 border border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800/50 whitespace-nowrap shrink-0">
                    {sc.chilsungroCoupon}
                  </span>
                )}
                {showParkingChip && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground border border-border whitespace-nowrap shrink-0">
                    {getParkingText()}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default StoreCard;

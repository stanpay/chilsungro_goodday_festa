import { Card } from "@/components/ui/card";
import { Coffee, MapPin, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAppLocale } from "@/contexts/AppLocaleContext";
import { parkingSizeLabel, storeCardStrings } from "@/lib/locale";
import { useTranslatedKoreanText } from "@/hooks/useKoreanDisplayText";
import { buildNaverMapOpenUrl } from "@/lib/mapDirectionLinks";

interface StoreCardProps {
  id: string;
  name: string;
  distance: string;
  image: string;
  maxDiscount: string | null; // 할인율이 없으면 null
  maxDiscountPercent?: number | null; // 표시용 % (있으면 언어별 배지 문구 생성)
  address?: string;
  lat?: number;
  lon?: number;
  local_currency_available?: boolean; // 지역화폐 사용가능 여부
  local_currency_discount_rate?: number | null; // 지역화폐 할인율
  parking_available?: boolean; // 주차가능 여부
  free_parking?: boolean; // 무료주차 여부
  parking_size?: string | null; // 주차장 규모 ('넓음', '보통', '좁음')
  tutorialMode?: boolean; // 튜토리얼 모드 여부
  isHighlighted?: boolean; // 강조 표시 여부
  disabled?: boolean; // 비활성화 여부
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
  
  // 매장명 길이에 따라 폰트 크기 자동 조절
  const getFontSizeClass = () => {
    if (displayName.length <= 8) return "text-base";
    if (displayName.length <= 12) return "text-sm";
    if (displayName.length <= 16) return "text-xs";
    return "text-[0.65rem]";
  };

  const handleClick = () => {
    if (disabled) return;

    if (isTutorial) {
      navigate(`/tutorial/payment/${id}`);
      return;
    }

    const url = buildNaverMapOpenUrl({ name, address, lat, lon });
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
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
        "relative",
        disabled && "opacity-50 cursor-not-allowed",
        isHighlighted && "animate-pulse"
      )}
    >
      <Card 
        className={cn(
          "relative overflow-hidden transition-all duration-300 bg-card border-border/50",
          !disabled && "cursor-pointer hover:shadow-lg hover:-translate-y-1",
          isHighlighted && "border-4 border-primary shadow-[0_0_20px_rgba(var(--primary),0.5)]"
        )}
      >
        {isHighlighted && (
          <>
            <div
              className="absolute inset-0 bg-primary/20 animate-pulse pointer-events-none rounded-lg"
              aria-hidden="true"
            />
            {/* 터치 유도 회색 동그라미 - 카드의 펄스(밝기 변화)와 별도로 동작하도록 타이밍 조절 */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 translate-x-12">
              <div className="w-8 h-8 bg-gray-600/60 rounded-full animate-[pulse_1.5s_infinite_500ms] backdrop-blur-sm border-2 border-white/40 shadow-inner" />
            </div>
          </>
        )}
        <div className="flex flex-col">
          <div className="flex-1 bg-primary/10 flex items-center justify-center p-4 relative">
            {brandLogoUrl ? (
              <img
                src={brandLogoUrl}
                alt={displayName}
                className="w-20 h-20 object-contain"
              />
            ) : image === "shopping" ? (
              <ShoppingBag className="h-14 w-14 text-primary/70" strokeWidth={1.5} aria-hidden />
            ) : image === "restaurant" ? (
              <UtensilsCrossed className="h-14 w-14 text-primary/70" strokeWidth={1.5} aria-hidden />
            ) : (
              <Coffee className="h-14 w-14 text-primary/70" strokeWidth={1.5} aria-hidden />
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
            <h3 className={`font-bold mb-1 whitespace-nowrap ${getFontSizeClass()}`}>{displayName}</h3>
            <div className="flex items-center text-xs text-muted-foreground mb-2">
              <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="break-words">{distance}</span>
            </div>
            {(showLocalCurrencyChip || showParkingChip) && (
              <div className="flex flex-nowrap gap-1 overflow-x-auto scrollbar-hide">
                {showLocalCurrencyChip && local_currency_discount_rate != null && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 whitespace-nowrap shrink-0">
                    {sc.localCurrencyDiscount(local_currency_discount_rate)}
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

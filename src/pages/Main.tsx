import {
  MapPin,
  ArrowUpDown,
  Search,
  Loader2,
  RefreshCw,
  Languages,
  ChevronDown,
  LocateFixed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import StoreCard from "@/components/StoreCard";
import MapViewBottomSheet from "@/components/MapViewBottomSheet";
import MainPromoBanner from "@/components/MainPromoBanner";
import BottomNav from "@/components/BottomNav";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect, useRef, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { paymentHistoryApi } from "@/api/paymentHistory";
import { storesApi } from "@/api/stores";
import { gifticonsApi } from "@/api/gifticons";
import { getStoreOpenStatus, type DayHours } from "@/api/storeDetails";
import { getAddressFromCoords } from "@/lib/geocoding";
import { Skeleton } from "@/components/ui/skeleton";
import TutorialModal from "@/components/TutorialModal";
import { shouldShowTutorial } from "@/lib/tutorial";
import {
  mainStrings,
  LOCALE_MENU_LABELS,
  APP_LOCALES,
  isAppLocale,
  headerStrings,
} from "@/lib/locale";
import { useAppLocale } from "@/contexts/AppLocaleContext";
import { useTranslatedAddressLine } from "@/hooks/useKoreanDisplayText";
import { cn } from "@/lib/utils";
import { translateKoText } from "@/lib/koTranslate";

type StoreFilterChipId =
  | "all"
  | "chilsungro"
  | "localCurrency"
  | "restaurant"
  | "cafe"
  | "other";

const STORE_FILTER_CHIP_ORDER: StoreFilterChipId[] = [
  "all",
  "chilsungro",
  "localCurrency",
  "restaurant",
  "cafe",
  "other",
];

function inferChainImageFromPlaceName(placeName: string): string | null {
  const rules: [string, string][] = [
    ["스타벅스", "starbucks"],
    ["스타벅", "starbucks"],
    ["베스킨", "baskin"],
    ["메가커피", "mega"],
    ["메가 MGC", "mega"],
    ["파스쿠찌", "pascucci"],
    ["투썸", "twosome"],
  ];
  for (const [kw, img] of rules) {
    if (placeName.includes(kw)) return img;
  }
  return null;
}

function categoryDefaultImage(place: {
  place_name?: string;
  category_group_code?: string;
}): string {
  const chain = inferChainImageFromPlaceName(place.place_name || "");
  if (chain) return chain;
  const g = place.category_group_code;
  if (g === "MT1" || g === "CS2") return "shopping";
  if (g === "CE7") return "cafe";
  if (g === "FD6") return "restaurant";
  return "restaurant";
}

type StoreLikeForChip = {
  image: string;
  categoryGroupCode?: string;
  categoryName?: string;
  local_currency_available?: boolean;
  hasGifticonDiscount?: boolean;
};

function storeChipIsCafe(store: StoreLikeForChip): boolean {
  if (store.categoryGroupCode === "CE7") return true;
  const cafeImages = new Set(["starbucks", "mega", "pascucci", "twosome", "baskin"]);
  if (cafeImages.has(store.image)) return true;
  if (store.image === "cafe") return true;
  return false;
}

function storeChipIsRestaurant(store: StoreLikeForChip): boolean {
  if (storeChipIsCafe(store)) return false;
  if (store.image === "restaurant") return true;
  if (store.categoryGroupCode === "FD6") return true;
  return false;
}

function storeChipIsShopping(store: StoreLikeForChip): boolean {
  if (["MT1", "CS2"].includes(store.categoryGroupCode || "")) return true;
  if (store.image === "shopping") return true;
  return false;
}

function storeHasChilsungroCoupon(store: StoreLikeForChip): boolean {
  return store.hasGifticonDiscount === true;
}

function storeChipIsOther(store: StoreLikeForChip): boolean {
  return !storeChipIsRestaurant(store) && !storeChipIsCafe(store);
}

function storeMatchesChipFilters(
  store: StoreLikeForChip,
  chips: ReadonlySet<StoreFilterChipId>
): boolean {
  if (chips.has("all")) return true;
  const parts: boolean[] = [];
  if (chips.has("chilsungro")) parts.push(storeHasChilsungroCoupon(store));
  if (chips.has("localCurrency")) parts.push(!!store.local_currency_available);
  if (chips.has("restaurant")) parts.push(storeChipIsRestaurant(store));
  if (chips.has("cafe")) parts.push(storeChipIsCafe(store));
  if (chips.has("other")) parts.push(storeChipIsOther(store));
  return parts.length > 0 && parts.some(Boolean);
}

/** StoreCard의 brandLogos와 동일 — 실제 로고 이미지가 있는 매장만 표시 */
const STORE_CARD_LOGO_IMAGE_KEYS = new Set([
  "starbucks",
  "baskin",
  "mega",
  "pascucci",
  "twosome",
]);

const Main = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState<"distance" | "discount">("distance");
  const [currentLocation, setCurrentLocation] = useState("위치 가져오는 중...");
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const { isLoggedIn } = useAuth();
  const [isManualLocation, setIsManualLocation] = useState(false);

  interface StoreData {
    id: string;
    name: string;
    distance: string;
    distanceNum: number;
    image: string;
    maxDiscount: string | null; // 할인율이 없으면 null
    discountNum: number; // 정렬용 할인율 (0-100)
    maxDiscountPercent: number | null; // 최대 할인율 (%)
    lat?: number;
    lon?: number;
    address?: string;
    local_currency_available?: boolean; // 지역화폐 사용가능 여부
    local_currency_discount_rate?: number | null; // 지역화폐 할인율
    parking_available?: boolean; // 주차가능 여부
    free_parking?: boolean; // 무료주차 여부
    parking_size?: string | null; // 주차장 규모 ('넓음', '보통', '좁음')
    categoryGroupCode?: string;
    categoryName?: string;
    hasGifticonDiscount?: boolean;
    isOpen?: boolean;
    todayHours?: DayHours | null;
    photos?: string[];
    closedDayNote?: string;
  }

  const [stores, setStores] = useState<StoreData[]>([]);
  const [isLoadingStores, setIsLoadingStores] = useState(true);
  const [isLoadingMoreStores, setIsLoadingMoreStores] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{latitude: number, longitude: number} | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [storeFilterChips, setStoreFilterChips] = useState<Set<StoreFilterChipId>>(
    () => new Set<StoreFilterChipId>(["all"])
  );
  const { locale, setLocale } = useAppLocale();
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const isMapView = searchParams.get("map") === "1";
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const storeOverlaysRef = useRef<{ id: string; overlay: any }[]>([]);
  const clusterOverlaysRef = useRef<any[]>([]);
  const selectStoreOnMapRef = useRef<(id: string) => void>(() => {});
  const [selectedMapStoreId, setSelectedMapStoreId] = useState<string | null>(null);
  const [showResearchButton, setShowResearchButton] = useState(false);
  const [mapPinLabels, setMapPinLabels] = useState<Record<string, string>>({});
  const mapPinLabelsRef = useRef<Record<string, string>>({});

  const mapPinTranslationKey = useMemo(
    () =>
      stores
        .filter((s) => typeof s.lat === "number" && typeof s.lon === "number")
        .map((s) => `${s.id}\t${s.name}`)
        .sort()
        .join("\n"),
    [stores]
  );

  useEffect(() => {
    const list = stores.filter((s) => typeof s.lat === "number" && typeof s.lon === "number");
    if (list.length === 0) {
      setMapPinLabels({});
      return;
    }
    if (locale === "ko") {
      setMapPinLabels(Object.fromEntries(list.map((s) => [s.id, s.name])));
      return;
    }
    let cancelled = false;
    void Promise.all(
      list.map(async (s) => [s.id, await translateKoText(s.name, locale)] as const)
    ).then((pairs) => {
      if (!cancelled) setMapPinLabels(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [locale, mapPinTranslationKey]);

  const toggleMapView = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (next.get("map") === "1") next.delete("map");
        else next.set("map", "1");
        return next;
      },
      { replace: true }
    );
  };

  selectStoreOnMapRef.current = (id: string) => {
    setSelectedMapStoreId(id);
  };

  useEffect(() => {
    if (!isMapView) {
      setSelectedMapStoreId(null);
      setShowResearchButton(false);
    }
  }, [isMapView]);


  useEffect(() => {
    // 이전 로그인 상태를 추적하기 위한 ref 사용
    const prevSessionRef = { current: null as any };
    
    const checkAuthAndInitLocation = async () => {
      console.log("🔐 [인증 확인] 시작");
      
      // 로그인 상태 확인 (AuthContext에서 관리)
      console.log(`🔐 [인증 상태] ${isLoggedIn ? '로그인됨' : '로그인 안됨'}`);

      // 초기 세션 상태를 ref에 저장 (onAuthStateChange에서 사용)
      prevSessionRef.current = isLoggedIn ? { user: { id: "user-001" } } : null;

      // 튜토리얼 모달 표시 여부 확인
      if (isLoggedIn) {
        try {
          const count = await paymentHistoryApi.getCount("user-001");
          const paymentHistoryExists = count > 0;
          const needTutorial = await shouldShowTutorial(paymentHistoryExists);
          if (needTutorial) {
            setShowTutorialModal(true);
          }
        } catch (error) {
          console.error("튜토리얼 모달 표시 판단 실패:", error);
        }
      }

      // 최근 위치 조회 시간 확인 (5분 이내면 재조회 하지 않음)
      const lastLocationFetchTime = localStorage.getItem("lastLocationFetchTime");
      const now = Date.now();
      const LOCATION_CACHE_DURATION = 5 * 60 * 1000; // 5분
      
      console.log("🔍 [위치 캐시 확인] 시작");
      console.log("📍 [위치 캐시] lastLocationFetchTime:", lastLocationFetchTime, "(타입:", typeof lastLocationFetchTime, ")");
      console.log("📍 [위치 캐시] 현재 시간:", now);
      
      // localStorage 전체 상태 확인
      console.log("🔍 [localStorage 전체 상태]:", Object.keys(localStorage).filter(key => key.includes('location') || key.includes('Location')).reduce((obj, key) => {
        obj[key] = localStorage.getItem(key);
        return obj;
      }, {} as Record<string, string | null>));

      let cacheMissReason = "";
      let lastFetchTimestamp = 0;
      let timeSinceLastFetch = Number.POSITIVE_INFINITY;

      if (!lastLocationFetchTime) {
        cacheMissReason = "❌ 위치 조회 기록이 없음 (lastLocationFetchTime이 null/undefined)";
        console.log(cacheMissReason);
      } else {
        lastFetchTimestamp = parseInt(lastLocationFetchTime);
        if (isNaN(lastFetchTimestamp)) {
          cacheMissReason = "❌ 위치 조회 기록이 숫자가 아님 (parseInt 실패)";
          console.log(cacheMissReason);
        } else {
          timeSinceLastFetch = now - lastFetchTimestamp;
        const secondsSinceLastFetch = Math.floor(timeSinceLastFetch / 1000);
        const minutesSinceLastFetch = Math.floor(secondsSinceLastFetch / 60);
        
          console.log("⏱️ [위치 캐시] 마지막 위치 조회:", `${secondsSinceLastFetch}초 전 (${minutesSinceLastFetch}분 전)`);
        console.log("⏱️ [위치 캐시] 캐시 유효 기간:", LOCATION_CACHE_DURATION / 1000, "초");

          if (timeSinceLastFetch >= LOCATION_CACHE_DURATION) {
            cacheMissReason = `❌ 캐시 만료됨 (${timeSinceLastFetch / 1000}초 경과 > ${LOCATION_CACHE_DURATION / 1000}초)`;
            console.log(cacheMissReason);
          }
        }
      }

      const hasValidRecentCache = !!lastFetchTimestamp && timeSinceLastFetch < LOCATION_CACHE_DURATION;
      console.log("⏱️ [위치 캐시] 캐시 유효 여부:", hasValidRecentCache, hasValidRecentCache ? "✅ HIT" : "❌ MISS");

      if (hasValidRecentCache) {
        console.log("✅✅✅ [위치 캐시 HIT] 5분 이내 캐시 유효 - 저장된 위치 사용 시도 ✅✅✅");

        const savedCoordinates = localStorage.getItem("currentCoordinates");
        const savedLocation = localStorage.getItem("selectedLocation");
        const isManualLocationValue = localStorage.getItem("isManualLocation") === "true";

        console.log("📍 [위치 캐시] savedLocation:", savedLocation);
        console.log("📍 [위치 캐시] savedCoordinates:", savedCoordinates);

        setIsManualLocation(isManualLocationValue);
        setIsLoadingLocation(false);

        if (savedLocation) {
          setCurrentLocation(savedLocation);
        } else {
          setCurrentLocation("위치 불러올 수 없음");
        }

        let cacheFullyApplied = false;

        if (savedCoordinates) {
          try {
            const coords = JSON.parse(savedCoordinates);
            const { latitude, longitude } = coords;
            if (
              typeof latitude === "number" &&
              typeof longitude === "number" &&
              !isNaN(latitude) &&
              !isNaN(longitude) &&
              latitude >= -90 &&
              latitude <= 90 &&
              longitude >= -180 &&
              longitude <= 180
            ) {
              setCurrentCoords({ latitude, longitude });

              const savedStores = localStorage.getItem("nearbyStores");
              if (savedStores) {
                try {
                  const storesData = JSON.parse(savedStores);
                  setStores(storesData);
                  setIsLoadingStores(false);
                  console.log("✅ [위치 캐시] 저장된 매장 정보 사용");
                  cacheFullyApplied = true;
                } catch (e) {
                  console.log("⚠️ [위치 캐시] 저장된 매장 정보 파싱 실패, 다시 조회");
                  try {
                    await fetchNearbyStores(latitude, longitude);
                    cacheFullyApplied = true;
                  } catch {
                    /* fall through: 타임스탬프 무효화 후 전체 위치 재조회 */
                  }
                }
              } else {
                console.log("⚠️ [위치 캐시] 저장된 매장 정보 없음, 다시 조회");
                try {
                  await fetchNearbyStores(latitude, longitude);
                  cacheFullyApplied = true;
                } catch {
                  /* fall through */
                }
              }
            }
          } catch (error) {
            console.error("❌ [위치 캐시] 저장된 좌표 파싱 오류:", error);
          }
        }

        if (cacheFullyApplied) {
          console.log("✅✅✅ [위치 캐시 완료] 저장 좌표·매장까지 반영 — 조회 종료 ✅✅✅");
          return;
        }

        console.warn(
          "⚠️ [위치 캐시] 타임스탬프만 유효하고 좌표/매장을 복구하지 못함 — lastLocationFetchTime 제거 후 재조회"
        );
        localStorage.removeItem("lastLocationFetchTime");
      }

      if (cacheMissReason) {
        console.log("❌❌❌ [위치 캐시 MISS] 이유:", cacheMissReason, "- 위치 다시 조회 ❌❌❌");
      } else {
        console.log("❌❌❌ [위치 캐시 MISS] 알 수 없는 이유로 캐시 무효 - 위치 다시 조회 ❌❌❌");
      }
      
      console.log("🌍🌍🌍 [위치 조회 시작] 새로운 위치 정보 가져오기 🌍🌍🌍");

      // 로그인한 경우 실제 위치 가져오기
      console.log("🚀🚀🚀 [위치 초기화] 시작 - 위치 조회 🚀🚀🚀");
      
      // 위치 조회 시작 시간 기록
      const fetchTimestamp = Date.now();
      const timestampString = fetchTimestamp.toString();
      console.log("📝 [위치 타임스탬프 저장 전] localStorage 상태:", Object.keys(localStorage).filter(key => key.includes('location') || key.includes('Location')).reduce((obj, key) => {
        obj[key] = localStorage.getItem(key);
        return obj;
      }, {} as Record<string, string | null>));

      localStorage.setItem("lastLocationFetchTime", timestampString);
      console.log("✅ [위치 타임스탬프] 기록 완료:", fetchTimestamp, "(문자열:", timestampString, ")");

      const savedValue = localStorage.getItem("lastLocationFetchTime");
      console.log("✅ [위치 타임스탬프] localStorage에서 읽은 값:", savedValue, "(타입:", typeof savedValue, ")");
      console.log("✅ [위치 타임스탬프] 저장 값과 일치:", savedValue === timestampString ? "✅ 일치" : "❌ 불일치");

      console.log("📝 [위치 타임스탬프 저장 후] localStorage 상태:", Object.keys(localStorage).filter(key => key.includes('location') || key.includes('Location')).reduce((obj, key) => {
        obj[key] = localStorage.getItem(key);
        return obj;
      }, {} as Record<string, string | null>));
      
      // Kakao SDK 로드 보장
      try {
        const { loadKakaoMaps } = await import("@/lib/kakao");
        await loadKakaoMaps();
        console.log("✅ [Kakao SDK] 로드 완료");
      } catch (error: any) {
        console.error("❌ [위치 초기화] Kakao SDK 로드 실패:", error);
        setIsLoadingLocation(false);
        setCurrentLocation("위치 불러올 수 없음");
        localStorage.removeItem("selectedLocation");
        localStorage.removeItem("currentCoordinates");
        toast({
          title: "위치 기반 검색 불가",
          description: error.message || "카카오 SDK 설정 오류입니다. 배포 환경에 VITE_KAKAO_APP_KEY 환경 변수를 설정해주세요.",
          variant: "destructive",
        });
        setIsLoadingStores(false);
        setStores([]);
        return;
      }

      // Main 페이지 최초 접근 시 위치 정보 확인
      setIsLoadingLocation(true);

      // localStorage에 저장된 좌표 확인
      let savedCoordinates = localStorage.getItem("currentCoordinates");
      const savedLocation = localStorage.getItem("selectedLocation");
      const isManualLocationValue = localStorage.getItem("isManualLocation") === "true";
      setIsManualLocation(isManualLocationValue);

      // 사용자가 직접 설정한 위치가 있으면 그것을 사용 (현재 위치를 불러오지 않음)
      if (isManualLocationValue) {
        // savedLocation이 없는 경우 처리
        if (!savedLocation) {
          console.warn("⚠️ [위치 정보] 사용자 위치 설정 플래그는 있지만 저장된 위치가 없음");
          setCurrentLocation("위치 불러올 수 없음");
          setIsLoadingLocation(false);
          return; // 사용자 위치 설정이므로 현재 위치 가져오기 건너뛰기
        }
        // 좌표가 있으면 바로 사용
        if (savedCoordinates) {
          try {
            const coords = JSON.parse(savedCoordinates);
            const { latitude, longitude } = coords;
            
            // 좌표 유효성 검사
            if (typeof latitude === 'number' && typeof longitude === 'number' && 
                !isNaN(latitude) && !isNaN(longitude) &&
                latitude >= -90 && latitude <= 90 &&
                longitude >= -180 && longitude <= 180) {
              
              console.log("✅ [위치 정보] 직접 설정한 위치 사용:", { latitude, longitude, location: savedLocation });
              
              // 저장된 위치를 ~시 ~동 형식으로 변환하여 표시
              try {
                const formattedAddress = await getAddressFromCoords(latitude, longitude);
                setCurrentLocation(formattedAddress);
                localStorage.setItem("selectedLocation", formattedAddress);
              } catch (error) {
                console.error("주소 변환 오류:", error);
                setCurrentLocation(savedLocation);
              }
              setIsManualLocation(true);
              setCurrentCoords({ latitude, longitude });
              setIsLoadingLocation(false);
              
              // 매장 정보 가져오기
              console.log("🏪 [매장 검색] fetchNearbyStores 호출 시작");
              await fetchNearbyStores(latitude, longitude);
              return; // 직접 설정한 위치를 사용했으므로 현재 위치 가져오기 건너뛰기
            } else {
              console.warn("⚠️ [위치 정보] 저장된 좌표가 유효하지 않음:", { latitude, longitude });
              // 유효하지 않은 좌표는 제거하고 주소 검색으로 좌표 가져오기
              localStorage.removeItem("currentCoordinates");
              savedCoordinates = null; // 변수 업데이트하여 fallback 로직이 실행되도록 함
            }
          } catch (error) {
            console.error("❌ [위치 초기화] 저장된 좌표 파싱 오류:", error);
            // 저장된 좌표가 잘못되었으면 제거하고 주소 검색으로 좌표 가져오기
            localStorage.removeItem("currentCoordinates");
            savedCoordinates = null; // 변수 업데이트하여 fallback 로직이 실행되도록 함
          }
        }
        
        // 좌표가 없으면 주소 검색으로 좌표 가져오기 (최근 위치 선택 시)
        if (!savedCoordinates) {
          try {
            console.log("🔍 [위치 정보] 주소 검색으로 좌표 가져오기:", savedLocation);
            const { searchAddress } = await import("@/lib/kakao");
            const searchResult = await searchAddress(savedLocation);
            
            if (searchResult.documents && searchResult.documents.length > 0) {
              const firstResult = searchResult.documents[0];
              const latitude = parseFloat(firstResult.y);
              const longitude = parseFloat(firstResult.x);
              
              // 좌표 저장
              localStorage.setItem("currentCoordinates", JSON.stringify({ latitude, longitude }));
              
              console.log("✅ [위치 정보] 주소 검색으로 좌표 획득:", { latitude, longitude });
              
              // 저장된 위치를 ~시 ~동 형식으로 변환하여 표시
              try {
                const formattedAddress = await getAddressFromCoords(latitude, longitude);
                setCurrentLocation(formattedAddress);
                localStorage.setItem("selectedLocation", formattedAddress);
              } catch (error) {
                console.error("주소 변환 오류:", error);
                setCurrentLocation(savedLocation);
              }
              setIsManualLocation(true);
              setCurrentCoords({ latitude, longitude });
              setIsLoadingLocation(false);
              
              // 매장 정보 가져오기
              console.log("🏪 [매장 검색] fetchNearbyStores 호출 시작");
              await fetchNearbyStores(latitude, longitude);
              return; // 직접 설정한 위치를 사용했으므로 현재 위치 가져오기 건너뛰기
            } else {
              console.warn("⚠️ [위치 정보] 주소 검색 결과 없음:", savedLocation);
              // 이전 사용자 위치값 표시
              setCurrentLocation(savedLocation || "위치 불러올 수 없음");
              setIsLoadingLocation(false);
              return; // 수동 위치 설정이므로 브라우저 위치 가져오기 건너뛰기
            }
          } catch (error) {
            console.error("❌ [위치 초기화] 주소 검색 오류:", error);
            // 이전 사용자 위치값 표시
            setCurrentLocation(savedLocation || "위치 불러올 수 없음");
            setIsLoadingLocation(false);
            return; // 수동 위치 설정이므로 브라우저 위치 가져오기 건너뛰기
          }
        }
      }
      
      // 직접 설정한 위치가 없으면 기본적으로 현재 위치 가져오기
      console.log("🌍 [위치 정보] 현재 위치 가져오기 시작");
      await fetchBrowserLocation();
    };

    const fetchBrowserLocation = async () => {
      // 위치 권한 확인 및 현재 위치 가져오기
      if (navigator.geolocation) {
        console.log("🌍 [위치 정보] 브라우저 위치 정보 요청 시작");
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const { latitude, longitude } = position.coords;
              console.log("✅ [위치 정보] 좌표 획득 성공:", { latitude, longitude });
              
              // 좌표를 주소로 변환
              console.log("🏠 [주소 변환] 시작");
              const address = await getAddressFromCoords(latitude, longitude);
              console.log("✅ [주소 변환] 완료:", address);
              
              // 저장 및 표시 (현재 위치는 자동으로 가져온 것이므로 isManualLocation 플래그 없음)
              localStorage.setItem("selectedLocation", address);
              localStorage.setItem("currentCoordinates", JSON.stringify({ latitude, longitude }));
              localStorage.removeItem("isManualLocation"); // 현재 위치는 수동 설정이 아님
              setIsManualLocation(false);
              setCurrentLocation(address);
              setCurrentCoords({ latitude, longitude });
              setIsLoadingLocation(false);
              
              // 매장 정보 가져오기
              console.log("🏪 [매장 검색] fetchNearbyStores 호출 시작");
              await fetchNearbyStores(latitude, longitude);
            } catch (error) {
              console.error("❌ [위치 초기화] 주소 변환 중 오류:", error);
              // 이전 사용자 위치값 표시
              const previousLocation = localStorage.getItem("selectedLocation");
              setCurrentLocation(previousLocation || "위치 불러올 수 없음");
              // localStorage는 유지 (이전 위치값을 보여주기 위해)
              setIsLoadingLocation(false);
              setIsLoadingStores(false);
            }
          },
          (error) => {
            console.error("❌ [위치 정보] 획득 실패:", error);
            console.log("에러 코드:", error.code);
            console.log("에러 메시지:", error.message);
            
            // 이전 사용자 위치값 표시
            const previousLocation = localStorage.getItem("selectedLocation");
            setCurrentLocation(previousLocation || "위치 불러올 수 없음");
            // localStorage는 유지 (이전 위치값을 보여주기 위해)
            setIsLoadingLocation(false);
            setIsLoadingStores(false);
            
            // 에러 메시지 표시 (권한 거부시)
            if (error.code === error.PERMISSION_DENIED) {
              console.warn("⚠️ [위치 권한] 사용자가 위치 권한을 거부했습니다");
              toast({
                title: "위치 권한 필요",
                description: "위치 권한을 허용하면 자동으로 현재 위치가 설정됩니다.",
              });
            }
          },
          {
            // 고정밀은 실내/일부 환경에서 타임아웃이 잦아 일반 정확도 우선
            enableHighAccuracy: false,
            timeout: 20000,
            maximumAge: 60000,
          }
        );
      } else {
        // Geolocation 미지원
        // 이전 사용자 위치값 표시
        const previousLocation = localStorage.getItem("selectedLocation");
        setCurrentLocation(previousLocation || "위치 불러올 수 없음");
        // localStorage는 유지 (이전 위치값을 보여주기 위해)
        setIsLoadingLocation(false);
        setIsLoadingStores(false);
      }
    };

    checkAuthAndInitLocation();

    return () => {};
  }, [toast, navigate]);

  const handleResearch = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;
    const center = map.getCenter();
    void fetchNearbyStores(center.getLat(), center.getLng());
  };

  const handleRefreshLocation = async () => {
    console.log("🔄🔄🔄 [수동 새로고침] 위치 재조회 시작 🔄🔄🔄");

    console.log("🔄 [수동 새로고침 전] localStorage 상태:", Object.keys(localStorage).filter(key => key.includes('location') || key.includes('Location')).reduce((obj, key) => {
      obj[key] = localStorage.getItem(key);
      return obj;
    }, {} as Record<string, string | null>));
    
    // 수동 새로고침 시 타임스탬프 업데이트하여 위치를 새로 조회
    const refreshTimestamp = Date.now();
    const refreshTimestampString = refreshTimestamp.toString();
    localStorage.setItem("lastLocationFetchTime", refreshTimestampString);
    console.log("✅ [수동 새로고침] 타임스탬프 업데이트:", refreshTimestamp, "(문자열:", refreshTimestampString, ")");

    const refreshedValue = localStorage.getItem("lastLocationFetchTime");
    console.log("✅ [수동 새로고침 후] localStorage에서 읽은 값:", refreshedValue, "(일치:", refreshedValue === refreshTimestampString ? "✅" : "❌", ")");
    
    setIsLoadingLocation(true);
    setCurrentLocation("위치 확인 중...");
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const address = await getAddressFromCoords(latitude, longitude);
            
            localStorage.setItem("selectedLocation", address);
            localStorage.setItem("currentCoordinates", JSON.stringify({ latitude, longitude }));
            localStorage.removeItem("isManualLocation"); // 새로고침으로 현재 위치를 가져왔으므로 수동 설정 아님
            setIsManualLocation(false);
            setCurrentLocation(address);
            setCurrentCoords({ latitude, longitude });
            setIsLoadingLocation(false);
            
            await fetchNearbyStores(latitude, longitude);
            
            toast({
              title: "위치 업데이트 완료",
              description: "현재 위치가 업데이트되었습니다.",
            });
          } catch (error) {
            console.error("❌ [위치 새로고침] 주소 변환 중 오류:", error);
            // 이전 사용자 위치값 표시
            const previousLocation = localStorage.getItem("selectedLocation");
            setCurrentLocation(previousLocation || "위치 불러올 수 없음");
            // localStorage는 유지 (이전 위치값을 보여주기 위해)
            setIsLoadingLocation(false);
            setIsLoadingStores(false);
            
            toast({
              title: "위치 업데이트 실패",
              description: "주소 변환에 실패했습니다.",
              variant: "destructive",
            });
          }
        },
        (error) => {
          console.error("위치 가져오기 실패:", error);
          // 이전 사용자 위치값 표시
          const previousLocation = localStorage.getItem("selectedLocation");
          setCurrentLocation(previousLocation || "위치 불러올 수 없음");
          // localStorage는 유지 (이전 위치값을 보여주기 위해)
          setIsLoadingLocation(false);
          setIsLoadingStores(false);
          
          toast({
            title: "위치 업데이트 실패",
            description: "위치를 가져올 수 없습니다.",
            variant: "destructive",
          });
        },
        {
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 60000,
        }
      );
    } else {
      setIsLoadingLocation(false);
      setIsLoadingStores(false);
      toast({
        title: "위치 서비스 미지원",
        description: "이 환경에서는 위치를 가져올 수 없습니다.",
        variant: "destructive",
      });
    }
  };


  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // 지구 반경 (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance;
  };

  const fetchNearbyStores = async (latitude: number, longitude: number) => {
    try {
      setIsLoadingStores(true);
      setShowResearchButton(false);
      console.log("🏪 [매장 검색] 시작:", { latitude, longitude });

      // Kakao SDK 로드 보장
      try {
        const { loadKakaoMaps } = await import("@/lib/kakao");
        await loadKakaoMaps();
      } catch (error: any) {
        console.error("❌ [매장 검색] Kakao SDK 로드 실패:", error);
        throw new Error(error.message || "Kakao SDK를 로드할 수 없습니다. VITE_KAKAO_APP_KEY 환경 변수를 확인해주세요.");
      }
      
      const kakao = (window as any).kakao;
      if (!kakao?.maps) {
        console.error("❌ [매장 검색] Kakao SDK를 찾을 수 없습니다");
        throw new Error("Kakao SDK가 로드되지 않았습니다");
      }
      
      // services 라이브러리 확인
      if (!kakao.maps.services) {
        console.error("❌ [매장 검색] Kakao Maps services를 찾을 수 없습니다");
        throw new Error("Kakao Maps services 라이브러리가 로드되지 않았습니다");
      }
      
      console.log("✅ [매장 검색] Kakao SDK 확인 완료");

      const radius = 10000; // 10km (미터 단위)
      console.log("📏 [매장 검색] 검색 반경:", radius, "미터");

      // 검색할 브랜드 목록
      const brands = [
        { keyword: "스타벅스", image: "starbucks" },
        { keyword: "베스킨라빈스", image: "baskin" },
        { keyword: "메가커피", image: "mega" },
        { keyword: "파스쿠찌", image: "pascucci" },
        { keyword: "투썸플레이스", image: "twosome" },
      ];
      console.log("🔍 [매장 검색] 검색할 브랜드:", brands.map(b => b.keyword));

      // Places 서비스 객체 생성 (SDK 로드 이후 안전)
      console.log("🗺️ [매장 검색] Places 서비스 객체 생성");
      const ps = new kakao.maps.services.Places();
      console.log("✅ [매장 검색] Places 서비스 준비 완료");

      const mapKakaoPlaceToStore = (place: any, image: string) => {
        const distanceNum =
          calculateDistance(
            latitude,
            longitude,
            parseFloat(place.y),
            parseFloat(place.x)
          ) * 1000;
        const { isOpen, todayHours, photos, closedDayNote } = getStoreOpenStatus(image);
        return {
          id: place.id,
          name: place.place_name,
          distance:
            distanceNum < 1000
              ? `${Math.round(distanceNum)}m`
              : `${(distanceNum / 1000).toFixed(1)}km`,
          distanceNum: Math.round(distanceNum),
          image,
          maxDiscount: null,
          discountNum: 0,
          maxDiscountPercent: null,
          lat: parseFloat(place.y),
          lon: parseFloat(place.x),
          address: place.road_address_name || place.address_name,
          categoryGroupCode: place.category_group_code || "",
          categoryName: place.category_name || "",
          isOpen,
          todayHours,
          photos,
          closedDayNote,
        };
      };

      // 모든 브랜드를 병렬로 검색
      console.log("🔄 [매장 검색] 병렬 검색 시작");
      const searchPromises = brands.map((brand) => {
        return new Promise<any[]>((resolve) => {
          console.log(`🔍 [${brand.keyword}] 검색 시작`);
          const options = {
            location: new kakao.maps.LatLng(latitude, longitude),
            radius: radius,
            size: 15,
          };
          console.log(`⚙️ [${brand.keyword}] 검색 옵션:`, options);

          ps.keywordSearch(
            brand.keyword,
            (data: any[], status: any) => {
              console.log(`📊 [${brand.keyword}] 응답 상태:`, status);
              if (status === kakao.maps.services.Status.OK) {
                console.log(`✅ [${brand.keyword}] 검색 성공 - 결과 ${data.length}개:`, data);

                const stores = data.map((place: any) =>
                  mapKakaoPlaceToStore(place, brand.image)
                );

                console.log(`📍 [${brand.keyword}] 처리된 매장 데이터:`, stores);
                resolve(stores);
              } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
                console.log(`⚠️ [${brand.keyword}] 검색 결과 없음`);
                resolve([]);
              } else {
                console.error(`❌ [${brand.keyword}] 검색 실패 - 상태:`, status);
                resolve([]);
              }
            },
            options
          );
        });
      });

      const categoryGroupCodes = ["FD6", "MT1", "CE7"] as const;
      const categorySearchPromises = categoryGroupCodes.map(
        (code) =>
          new Promise<any[]>((resolve) => {
            ps.categorySearch(
              code,
              (data: any[], status: any) => {
                if (status === kakao.maps.services.Status.OK) {
                  const stores = data.map((place: any) =>
                    mapKakaoPlaceToStore(place, categoryDefaultImage(place))
                  );
                  resolve(stores);
                } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
                  resolve([]);
                } else {
                  console.error(`❌ [카테고리 ${code}] 검색 실패:`, status);
                  resolve([]);
                }
              },
              {
                location: new kakao.maps.LatLng(latitude, longitude),
                radius,
                size: 12,
              }
            );
          })
      );

      console.log("⏳ [매장 검색] 키워드·카테고리 검색 대기 중...");

      const [keywordResults, categoryResults] = await Promise.all([
        Promise.all(searchPromises),
        Promise.all(categorySearchPromises),
      ]);

      console.log("✅ [매장 검색] 키워드 검색 완료");
      console.log(
        "📊 [매장 검색] 브랜드별 결과:",
        keywordResults.map((r, i) => `${brands[i].keyword}: ${r.length}개`)
      );
      console.log(
        "📊 [매장 검색] 카테고리별 결과:",
        categoryGroupCodes.map((code, i) => `${code}: ${categoryResults[i].length}개`)
      );

      const mergedRaw = [...keywordResults.flat(), ...categoryResults.flat()];
      mergedRaw.sort((a, b) => a.distanceNum - b.distanceNum);
      const seenIds = new Set<string>();
      const allStores: any[] = [];
      for (const s of mergedRaw) {
        if (seenIds.has(s.id)) continue;
        seenIds.add(s.id);
        allStores.push(s);
      }

      console.log("🏪 [매장 검색] 총 매장 수 (중복 제거 후):", allStores.length);
      console.log("📋 [매장 검색] 최종 매장 목록:", allStores);

      // 거리순으로 정렬하여 초기 8개 선택
      const initialStores = allStores.slice(0, 8);
      const remainingStores = allStores.slice(8);
      
      console.log("🚀 [초기 로딩] 처음 8개 매장만 빠르게 표시");
      
      // 각 매장의 할인 정보 조회 (초기 8개만 먼저 처리)
      console.log("🔄 [할인 정보 조회] 초기 8개 매장 처리 시작");
      const initialStoresWithDiscount = await Promise.all(initialStores.map(async (store) => {
        try {
          // 파스쿠찌와 투썸플레이스만 할인율 조회
          if (store.image !== 'pascucci' && store.image !== 'twosome') {
            return {
              ...store,
              maxDiscount: null,
              discountNum: 0,
              maxDiscountPercent: null,
              hasGifticonDiscount: false,
            };
          }

          // 파스쿠찌와 투썸플레이스 할인 정보 조회
          // 1. 프랜차이즈 정보 조회
          const brandNameMap: Record<string, string> = {
            starbucks: "스타벅스",
            baskin: "베스킨라빈스",
            mega: "메가커피",
            pascucci: "파스쿠찌",
            twosome: "투썸플레이스",
            compose: "컴포즈커피",
            ediya: "이디야",
            paik: "빽다방",
          };
          const brandName = brandNameMap[store.image] || store.image;

          // 프랜차이즈 정보 조회
          let franchiseData: any = null;
          try {
            const franchise = await storesApi.getFranchiseByName(brandName);
            if (franchise) {
              franchiseData = franchise;
            }
          } catch (e) {
            console.log(`⚠️ [할인 정보] ${store.name}: 프랜차이즈 정보 조회 실패`);
          }

          // 2. 프랜차이즈별 결제 방식 적립/할인 정보 조회
          let franchiseDiscountRate = 0;
          if (franchiseData) {
            try {
              const paymentMethods = await storesApi.getPaymentMethods(franchiseData.id);
              const paymentMethodsError = null;
              if (!paymentMethodsError && paymentMethods && paymentMethods.length > 0) {
                // 파스쿠찌: 해피포인트 적립 (5%)
                if (store.image === 'pascucci') {
                  const happyPoint = paymentMethods.find((pm: any) => 
                    pm.method_name === '해피포인트' && (pm.method_type === '적립' || pm.method_type === 'accumulation')
                  );
                  if (happyPoint && (happyPoint as any).rate) {
                    franchiseDiscountRate = (happyPoint as any).rate;
                  }
                }
                // 투썸플레이스: 투썸하트는 스탬프 타입이므로 할인율에 포함하지 않음 (할인율 없음)
                // 투썸플레이스는 지역화폐 할인율과 기프티콘 할인율만 고려
              }
            } catch (e) {
              console.log(`⚠️ [할인 정보] ${store.name}: 프랜차이즈 결제 방식 정보 조회 실패`);
            }
          }

          // 3. 매장 정보 조회 (kakao_place_id로, 실패 시 무시)
          let localCurrencyDiscount = 0;
          let maxGifticonDiscount = 0;
          let storeData: any = null;
          
          try {
            // storeId가 숫자인지 확인 (카카오 플레이스 ID)
            const isNumeric = /^\d+$/.test(store.id);
            let storeError: any = null;

            if (isNumeric && franchiseData) {
              // kakao_place_id로 조회 시도
              const data = await storesApi.getStoreByKakaoPlaceId(store.id);
              storeData = data;
              storeError = data ? null : new Error("not found");
            }

            // kakao_place_id 조회 실패 시 franchise_id로 조회 시도
            if (storeError && franchiseData) {
              const data = await storesApi.getStoreByFranchiseId(franchiseData.id);
              if (data) {
                storeData = data;
              }
            }

            if (storeData) {
              // 지역화폐 할인율
              localCurrencyDiscount = (storeData as any).local_currency_discount_rate || 0;

              // 기프티콘 할인율 조회 (추천 기프티콘 로직과 동일: 천원대별로 하나씩, 할인효율 순)
              if ((storeData as any).gifticon_available) {
                try {
                  // 천원대별로 그룹화하는 헬퍼 함수
                  const getPriceRange = (price: number): number => {
                    return Math.floor(price / 1000) * 1000;
                  };

                  // 할인효율 계산 함수: (원가-할인가)/할인가
                  const getDiscountEfficiency = (originalPrice: number, salePrice: number): number => {
                    if (salePrice === 0) return 0;
                    return (originalPrice - salePrice) / salePrice;
                  };

                  // 정렬 함수 (마감일 임박순 최우선, 그 다음 할인효율 내림차순, 같은 효율일 땐 판매가 오름차순)
                  const sortByDiscountEfficiency = (a: any, b: any): number => {
                    // 1순위: 마감일 임박순 (expiry_date 오름차순)
                    const expiryA = new Date(a.expiry_date).getTime();
                    const expiryB = new Date(b.expiry_date).getTime();
                    if (expiryA !== expiryB) {
                      return expiryA - expiryB; // 마감일 임박순 (오름차순)
                    }
                    
                    // 2순위: 할인효율 내림차순
                    const efficiencyA = getDiscountEfficiency(a.original_price, a.sale_price);
                    const efficiencyB = getDiscountEfficiency(b.original_price, b.sale_price);
                    if (efficiencyA !== efficiencyB) {
                      return efficiencyB - efficiencyA; // 할인효율 내림차순
                    }
                    
                    // 3순위: 같은 효율일 경우 판매가 오름차순
                    return a.sale_price - b.sale_price;
                  };

                  // 모든 판매중 기프티콘 조회
                  const gifticonsData = await gifticonsApi.getUsedGifticons(brandName);
                  const gifticonsError = null;

                  if (!gifticonsError && gifticonsData && gifticonsData.length > 0) {
                    // 할인효율 기준으로 정렬
                    const sortedData = [...gifticonsData].sort(sortByDiscountEfficiency);

                    // 천원대별로 그룹화하면서 할인효율이 높은 순으로 이미 정렬된 데이터를 사용
                    const groupedByThousand = new Map<number, any>();
                    sortedData.forEach((item: any) => {
                      const priceRange = getPriceRange(item.original_price);
                      // 같은 천원대에 아직 항목이 없으면 추가 (이미 할인효율 순으로 정렬되어 있으므로 첫 번째가 최고 효율)
                      if (!groupedByThousand.has(priceRange)) {
                        groupedByThousand.set(priceRange, item);
                      }
                    });

                    // 그룹화된 항목들의 할인율 계산 (추천 기프티콘에서 처음 가져오는 기프티콘들)
                    const selectedGifticons = Array.from(groupedByThousand.values());
                    if (selectedGifticons.length > 0) {
                      const discounts = selectedGifticons.map((g: any) => {
                        const discountAmount = g.original_price - g.sale_price;
                        return Math.round((discountAmount / g.original_price) * 100);
                      });
                      maxGifticonDiscount = Math.max(...discounts);
                    }
                  }
                } catch (e) {
                  console.log(`⚠️ [할인 정보] ${store.name}: 기프티콘 정보 조회 실패`);
                }
              }
            }
          } catch (e) {
            console.log(`⚠️ [할인 정보] ${store.name}: 매장 정보 조회 실패`);
          }

          // 4. 최대 할인율 계산 (프랜차이즈 적립/할인, 지역화폐 할인율, 기프티콘 할인율 중 최대값)
          const maxDiscountPercent = Math.max(franchiseDiscountRate, localCurrencyDiscount, maxGifticonDiscount);
          
          if (maxDiscountPercent > 0) {
            const discountDetails = [];
            if (franchiseDiscountRate > 0) {
              discountDetails.push(`프랜차이즈: ${franchiseDiscountRate}%`);
            }
            if (localCurrencyDiscount > 0) {
              discountDetails.push(`지역화폐: ${localCurrencyDiscount}%`);
            }
            if (maxGifticonDiscount > 0) {
              discountDetails.push(`기프티콘: ${maxGifticonDiscount}%`);
            }
            console.log(`✅ [할인 정보] ${store.name} (${store.id}): 최대 ${maxDiscountPercent}% 할인 (${discountDetails.join(', ')})`);
          }

          return {
            ...store,
            maxDiscount: maxDiscountPercent > 0 ? `최대 ${maxDiscountPercent}% 할인` : null,
            discountNum: maxDiscountPercent,
            maxDiscountPercent: maxDiscountPercent > 0 ? maxDiscountPercent : null,
            local_currency_available: storeData?.local_currency_available || false,
            local_currency_discount_rate: storeData?.local_currency_discount_rate || null,
            parking_available: storeData?.parking_available || false,
            free_parking: storeData?.free_parking || false,
            parking_size: storeData?.parking_size || null,
            hasGifticonDiscount: maxGifticonDiscount > 0,
          };
        } catch (error) {
          console.error(`❌ [할인 정보] ${store.name} 조회 오류:`, error);
          return {
            ...store,
            maxDiscount: null,
            discountNum: 0,
            maxDiscountPercent: null,
            local_currency_available: false,
            local_currency_discount_rate: null,
            parking_available: false,
            free_parking: false,
            parking_size: null,
            hasGifticonDiscount: false,
          };
        }
      }));

      console.log("✅ [할인 정보 조회] 초기 8개 완료");
      
      // 초기 8개 먼저 표시
      setStores(initialStoresWithDiscount);
      setIsLoadingStores(false);
      
      // localStorage에 초기 매장 정보 저장 (Payment 페이지에서 사용)
      try {
        localStorage.setItem('nearbyStores', JSON.stringify(initialStoresWithDiscount));
      } catch (e) {
        console.error("localStorage 저장 오류:", e);
      }
      
      console.log("✅ [초기 로딩] 완료 - 초기 8개 매장 표시");
      
      // 나머지 매장 데이터 백그라운드 로딩
      if (remainingStores.length > 0) {
        setIsLoadingMoreStores(true);
        console.log("🔄 [추가 로딩] 나머지 매장 데이터 로딩 시작");
        
        // 나머지 매장의 할인 정보 조회
        const remainingStoresWithDiscount = await Promise.all(remainingStores.map(async (store) => {
          try {
            // 파스쿠찌와 투썸플레이스만 할인율 조회
            if (store.image !== 'pascucci' && store.image !== 'twosome') {
              return {
                ...store,
                maxDiscount: null,
                discountNum: 0,
                maxDiscountPercent: null,
                hasGifticonDiscount: false,
              };
            }

            // 파스쿠찌와 투썸플레이스 할인 정보 조회
            // 1. 프랜차이즈 정보 조회
            const brandNameMap: Record<string, string> = {
              starbucks: "스타벅스",
              baskin: "베스킨라빈스",
              mega: "메가커피",
              pascucci: "파스쿠찌",
              twosome: "투썸플레이스",
              compose: "컴포즈커피",
              ediya: "이디야",
              paik: "빽다방",
            };
            const brandName = brandNameMap[store.image] || store.image;

            // 프랜차이즈 정보 조회
            let franchiseData: any = null;
            try {
              const franchise = await storesApi.getFranchiseByName(brandName);
              if (franchise) {
                franchiseData = franchise;
              }
            } catch (e) {
              console.log(`⚠️ [할인 정보] ${store.name}: 프랜차이즈 정보 조회 실패`);
            }

            // 2. 프랜차이즈별 결제 방식 적립/할인 정보 조회
            let franchiseDiscountRate = 0;
            if (franchiseData) {
              try {
                const paymentMethods = await storesApi.getPaymentMethods(franchiseData.id);
                const paymentMethodsError = null;
                if (!paymentMethodsError && paymentMethods && paymentMethods.length > 0) {
                  // 파스쿠찌: 해피포인트 적립 (5%)
                  if (store.image === 'pascucci') {
                    const happyPoint = paymentMethods.find((pm: any) =>
                      pm.method_name === '해피포인트' && (pm.method_type === '적립' || pm.method_type === 'accumulation')
                    );
                    if (happyPoint && (happyPoint as any).rate) {
                      franchiseDiscountRate = (happyPoint as any).rate;
                    }
                  }
                }
              } catch (e) {
                console.log(`⚠️ [할인 정보] ${store.name}: 프랜차이즈 결제 방식 정보 조회 실패`);
              }
            }

            // 3. 매장 정보 조회 (kakao_place_id로, 실패 시 무시)
            let localCurrencyDiscount = 0;
            let maxGifticonDiscount = 0;
            let storeData: any = null;

            try {
              // storeId가 숫자인지 확인 (카카오 플레이스 ID)
              const isNumeric = /^\d+$/.test(store.id);
              let storeError: any = null;

              if (isNumeric && franchiseData) {
                // kakao_place_id로 조회 시도
                const data = await storesApi.getStoreByKakaoPlaceId(store.id);
                storeData = data;
                storeError = data ? null : new Error("not found");
              }

              // kakao_place_id 조회 실패 시 franchise_id로 조회 시도
              if (storeError && franchiseData) {
                const data = await storesApi.getStoreByFranchiseId(franchiseData.id);
                if (data) {
                  storeData = data;
                }
              }

              if (storeData) {
                // 지역화폐 할인율
                localCurrencyDiscount = (storeData as any).local_currency_discount_rate || 0;

                // 기프티콘 할인율 조회 (추천 기프티콘 로직과 동일: 천원대별로 하나씩, 할인효율 순)
                if ((storeData as any).gifticon_available) {
                  try {
                    // 천원대별로 그룹화하는 헬퍼 함수
                    const getPriceRange = (price: number): number => {
                      return Math.floor(price / 1000) * 1000;
                    };

                    // 할인효율 계산 함수: (원가-할인가)/할인가
                    const getDiscountEfficiency = (originalPrice: number, salePrice: number): number => {
                      if (salePrice === 0) return 0;
                      return (originalPrice - salePrice) / salePrice;
                    };

                    // 정렬 함수 (마감일 임박순 최우선, 그 다음 할인효율 내림차순, 같은 효율일 땐 판매가 오름차순)
                    const sortByDiscountEfficiency = (a: any, b: any): number => {
                      // 1순위: 마감일 임박순 (expiry_date 오름차순)
                      const expiryA = new Date(a.expiry_date).getTime();
                      const expiryB = new Date(b.expiry_date).getTime();
                      if (expiryA !== expiryB) {
                        return expiryA - expiryB; // 마감일 임박순 (오름차순)
                      }
                      
                      // 2순위: 할인효율 내림차순
                      const efficiencyA = getDiscountEfficiency(a.original_price, a.sale_price);
                      const efficiencyB = getDiscountEfficiency(b.original_price, b.sale_price);
                      if (efficiencyA !== efficiencyB) {
                        return efficiencyB - efficiencyA; // 할인효율 내림차순
                      }
                      
                      // 3순위: 같은 효율일 경우 판매가 오름차순
                      return a.sale_price - b.sale_price;
                    };

                    // 모든 판매중 기프티콘 조회
                    const gifticonsData = await gifticonsApi.getUsedGifticons(brandName);
                    const gifticonsError = null;

                    if (!gifticonsError && gifticonsData && gifticonsData.length > 0) {
                      // 할인효율 기준으로 정렬
                      const sortedData = [...gifticonsData].sort(sortByDiscountEfficiency);

                      // 천원대별로 그룹화하면서 할인효율이 높은 순으로 이미 정렬된 데이터를 사용
                      const groupedByThousand = new Map<number, any>();
                      sortedData.forEach((item: any) => {
                        const priceRange = getPriceRange(item.original_price);
                        // 같은 천원대에 아직 항목이 없으면 추가 (이미 할인효율 순으로 정렬되어 있으므로 첫 번째가 최고 효율)
                        if (!groupedByThousand.has(priceRange)) {
                          groupedByThousand.set(priceRange, item);
                        }
                      });

                      // 그룹화된 항목들의 할인율 계산 (추천 기프티콘에서 처음 가져오는 기프티콘들)
                      const selectedGifticons = Array.from(groupedByThousand.values());
                      if (selectedGifticons.length > 0) {
                        const discounts = selectedGifticons.map((g: any) => {
                          const discountAmount = g.original_price - g.sale_price;
                          return Math.round((discountAmount / g.original_price) * 100);
                        });
                        maxGifticonDiscount = Math.max(...discounts);
                      }
                    }
                  } catch (e) {
                    console.log(`⚠️ [할인 정보] ${store.name}: 기프티콘 정보 조회 실패`);
                  }
                }
              }
            } catch (e) {
              console.log(`⚠️ [할인 정보] ${store.name}: 매장 정보 조회 실패`);
            }

            // 4. 최대 할인율 계산 (프랜차이즈 적립/할인, 지역화폐 할인율, 기프티콘 할인율 중 최대값)
            const maxDiscountPercent = Math.max(franchiseDiscountRate, localCurrencyDiscount, maxGifticonDiscount);
            
            if (maxDiscountPercent > 0) {
              const discountDetails = [];
              if (franchiseDiscountRate > 0) {
                discountDetails.push(`프랜차이즈: ${franchiseDiscountRate}%`);
              }
              if (localCurrencyDiscount > 0) {
                discountDetails.push(`지역화폐: ${localCurrencyDiscount}%`);
              }
              if (maxGifticonDiscount > 0) {
                discountDetails.push(`기프티콘: ${maxGifticonDiscount}%`);
              }
              console.log(`✅ [할인 정보] ${store.name} (${store.id}): 최대 ${maxDiscountPercent}% 할인 (${discountDetails.join(', ')})`);
            }

            return {
              ...store,
              maxDiscount: maxDiscountPercent > 0 ? `최대 ${maxDiscountPercent}% 할인` : null,
              discountNum: maxDiscountPercent,
              maxDiscountPercent: maxDiscountPercent > 0 ? maxDiscountPercent : null,
              local_currency_available: storeData?.local_currency_available || false,
              local_currency_discount_rate: storeData?.local_currency_discount_rate || null,
              parking_available: storeData?.parking_available || false,
              free_parking: storeData?.free_parking || false,
              parking_size: storeData?.parking_size || null,
              hasGifticonDiscount: maxGifticonDiscount > 0,
            };
          } catch (error) {
            console.error(`❌ [할인 정보] ${store.name} 조회 오류:`, error);
            return {
              ...store,
              maxDiscount: null,
              discountNum: 0,
              maxDiscountPercent: null,
              local_currency_available: false,
              local_currency_discount_rate: null,
              parking_available: false,
              free_parking: false,
              parking_size: null,
              hasGifticonDiscount: false,
            };
          }
        }));

        // 전체 매장 데이터 합치기
        const allStoresWithDiscount = [...initialStoresWithDiscount, ...remainingStoresWithDiscount];
        
        // localStorage에 전체 매장 정보 저장
        try {
          localStorage.setItem('nearbyStores', JSON.stringify(allStoresWithDiscount));
        } catch (e) {
          console.error("localStorage 저장 오류:", e);
        }
        
        setStores(allStoresWithDiscount);
        setIsLoadingMoreStores(false);
        console.log("✅ [추가 로딩] 완료 - 전체 매장 데이터 표시");
      }
    } catch (error) {
      console.error("❌ [매장 검색] 실패:", error);
      console.error("에러 스택:", (error as Error).stack);
      setIsLoadingStores(false);
      toast({
        title: "매장 정보 로딩 실패",
        description: "매장 정보를 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  mapPinLabelsRef.current = mapPinLabels;

  const t = mainStrings(locale);
  const h = headerStrings(locale);
  const headerLocationLine = useTranslatedAddressLine(currentLocation, locale);

  const chipLabelMap: Record<StoreFilterChipId, string> = {
    all: t.chipAll,
    chilsungro: t.chipChilsungro,
    localCurrency: t.chipLocalCurrency,
    restaurant: t.chipRestaurant,
    cafe: t.chipCafe,
    other: t.chipOther,
  };

  const toggleStoreFilterChip = (id: StoreFilterChipId) => {
    setStoreFilterChips((prev) => {
      const next = new Set(prev);
      if (id === "all") {
        return new Set<StoreFilterChipId>(["all"]);
      }
      next.delete("all");
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (next.size === 0) {
        return new Set<StoreFilterChipId>(["all"]);
      }
      return next;
    });
  };

  const renderFilterChipRow = (className: string) => (
    <div className={className} role="toolbar" aria-label={t.storeFilterToolbarAria}>
      {STORE_FILTER_CHIP_ORDER.map((id) => {
        const active = storeFilterChips.has(id);
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => toggleStoreFilterChip(id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-foreground hover:bg-muted/80"
            )}
          >
            {chipLabelMap[id]}
          </button>
        );
      })}
    </div>
  );

  // 검색어로 필터링
  const filteredStores = useMemo(() =>
    searchQuery.trim()
      ? stores.filter(store =>
          store.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : stores,
    [stores, searchQuery]
  );

  const chipFilteredStores = useMemo(() =>
    filteredStores.filter((store) => storeMatchesChipFilters(store, storeFilterChips)),
    [filteredStores, storeFilterChips]
  );

  // 영업 종료 매장 자동 필터 (isOpen이 명시적으로 false인 경우만 제외)
  const openStores = useMemo(() =>
    chipFilteredStores.filter((store) => store.isOpen !== false),
    [chipFilteredStores]
  );

  const storesWithLogoImage = useMemo(() =>
    openStores.filter((store) => STORE_CARD_LOGO_IMAGE_KEYS.has(store.image)),
    [openStores]
  );

  const sortedStores = useMemo(() =>
    [...storesWithLogoImage].sort((a, b) =>
      sortBy === "distance" ? a.distanceNum - b.distanceNum : b.discountNum - a.discountNum
    ),
    [storesWithLogoImage, sortBy]
  );

  const storesWithCoords = useMemo(() =>
    [...chipFilteredStores]
      .filter((store) => typeof store.lat === "number" && typeof store.lon === "number")
      .sort((a, b) =>
        sortBy === "distance" ? a.distanceNum - b.distanceNum : b.discountNum - a.discountNum
      ),
    [chipFilteredStores, sortBy]
  );

  useEffect(() => {
    if (!isMapView || !mapContainerRef.current) return;

    let isCancelled = false;
    const overlays: any[] = [];
    let mapReady = false;
    let readyTimer: ReturnType<typeof setTimeout> | null = null;

    const buildStorePin = (store: StoreData, kakao: any) => {
      const root = document.createElement("div");
      root.style.cssText =
        "display:flex;flex-direction:column;align-items:center;width:max-content;cursor:pointer;user-select:none;";
      root.dataset.storeId = store.id;

      const dot = document.createElement("div");
      dot.dataset.pinDot = "1";
      dot.style.cssText =
        "width:11px;height:11px;margin-top:-5.5px;border-radius:9999px;background:#2D8CFF;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.28);flex-shrink:0;transition:transform .15s ease,background .15s ease,box-shadow .15s ease;";

      const label = document.createElement("div");
      label.setAttribute("data-store-label", "1");
      label.style.cssText =
        "margin-top:3px;max-width:118px;padding:2px 6px;font-size:11px;font-weight:600;color:#111827;background:rgba(255,255,255,.96);border-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,.12);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.25;";
      label.textContent = mapPinLabelsRef.current[store.id] ?? store.name;

      root.appendChild(dot);
      root.appendChild(label);

      root.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (typeof kakao.maps.event?.preventMap === "function") {
          kakao.maps.event.preventMap();
        }
        selectStoreOnMapRef.current(store.id);
      });

      return root;
    };

    const buildMyLocationPin = (kakao: any, title: string) => {
      const root = document.createElement("div");
      root.style.cssText =
        "display:flex;flex-direction:column;align-items:center;width:max-content;pointer-events:none;";
      root.title = title;
      const dot = document.createElement("div");
      dot.style.cssText =
        "width:13px;height:13px;margin-top:-6.5px;border-radius:9999px;background:#22c55e;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);";
      root.appendChild(dot);
      return root;
    };

    const buildClusterPin = (count: number) => {
      const el = document.createElement("div");
      el.style.cssText =
        "display:flex;align-items:center;justify-content:center;" +
        "width:36px;height:36px;border-radius:9999px;" +
        "background:#2D8CFF;border:2.5px solid #fff;" +
        "box-shadow:0 2px 8px rgba(0,0,0,.32);" +
        "font-size:13px;font-weight:700;color:#fff;" +
        "cursor:pointer;user-select:none;";
      el.textContent = String(count);
      return el;
    };

    const initializeMap = async () => {
      try {
        const { loadKakaoMaps } = await import("@/lib/kakao");
        await loadKakaoMaps();

        if (isCancelled || !mapContainerRef.current) return;

        const kakao = (window as any).kakao;
        if (!kakao?.maps) return;

        const defaultCenter = currentCoords
          ? new kakao.maps.LatLng(currentCoords.latitude, currentCoords.longitude)
          : storesWithCoords.length > 0
            ? new kakao.maps.LatLng(storesWithCoords[0].lat!, storesWithCoords[0].lon!)
            : new kakao.maps.LatLng(37.5665, 126.978);

        const map = new kakao.maps.Map(mapContainerRef.current, {
          center: defaultCenter,
          level: 5,
        });
        mapInstanceRef.current = map;

        const bounds = new kakao.maps.LatLngBounds();
        storeOverlaysRef.current = [];

        if (currentCoords) {
          const pos = new kakao.maps.LatLng(currentCoords.latitude, currentCoords.longitude);
          const el = buildMyLocationPin(kakao, headerStrings(locale).mapCurrentLocationTitle);
          const curOverlay = new kakao.maps.CustomOverlay({
            map,
            position: pos,
            content: el,
            xAnchor: 0.5,
            yAnchor: 0,
            zIndex: 50,
            clickable: false,
          });
          overlays.push(curOverlay);
          bounds.extend(pos);
        }

        storesWithCoords.forEach((store) => {
          const position = new kakao.maps.LatLng(store.lat!, store.lon!);
          const content = buildStorePin(store, kakao);
          const overlay = new kakao.maps.CustomOverlay({
            map,
            position,
            content,
            xAnchor: 0.5,
            yAnchor: 0,
            zIndex: 10,
            clickable: true,
          });
          overlays.push(overlay);
          storeOverlaysRef.current.push({ id: store.id, overlay });
          bounds.extend(position);
        });

        if (!bounds.isEmpty()) {
          map.setBounds(bounds, 48, 48, 48, 120);
        }

        storeOverlaysRef.current.forEach(({ id, overlay }) => {
          const root = overlay.getContent() as HTMLElement | undefined;
          const el = root?.querySelector("[data-store-label]") as HTMLElement | null;
          if (!el) return;
          el.textContent =
            mapPinLabelsRef.current[id] ?? storesWithCoords.find((s) => s.id === id)?.name ?? "";
        });

        if (typeof map.relayout === "function") {
          requestAnimationFrame(() => {
            try {
              map.relayout();
            } catch {
              /* ignore */
            }
          });
        }

        const updateClusters = () => {
          if (isCancelled) return;

          clusterOverlaysRef.current.forEach((o) => {
            try { o.setMap(null); } catch {}
          });
          clusterOverlaysRef.current = [];

          const allPins = storeOverlaysRef.current;
          if (!allPins.length) return;

          const proj = map.getProjection();
          const CLUSTER_DISTANCE_PX = 45;

          const pins = allPins.map(({ id, overlay }) => {
            const pos = overlay.getPosition();
            let px = 0, py = 0;
            try {
              const pt = proj.containerPointFromCoords(pos);
              px = pt.x;
              py = pt.y;
            } catch {}
            return { id, overlay, pos, px, py };
          });

          // projection이 아직 준비 안 된 경우(모두 0,0) 클러스터링 스킵
          const projectionReady = pins.some((p) => p.px !== 0 || p.py !== 0);
          if (!projectionReady) {
            allPins.forEach(({ overlay }) => { try { overlay.setMap(map); } catch {} });
            return;
          }

          const assigned = new Set<string>();
          const clusters: (typeof pins)[] = [];

          for (const pin of pins) {
            if (assigned.has(pin.id)) continue;
            const cluster = [pin];
            assigned.add(pin.id);
            for (const other of pins) {
              if (assigned.has(other.id)) continue;
              const dx = pin.px - other.px;
              const dy = pin.py - other.py;
              if (Math.sqrt(dx * dx + dy * dy) < CLUSTER_DISTANCE_PX) {
                cluster.push(other);
                assigned.add(other.id);
              }
            }
            clusters.push(cluster);
          }

          clusters.forEach((cluster) => {
            if (cluster.length === 1) {
              cluster[0].overlay.setMap(map);
            } else {
              cluster.forEach(({ overlay }) => overlay.setMap(null));
              const avgLat = cluster.reduce((s, p) => s + p.pos.getLat(), 0) / cluster.length;
              const avgLng = cluster.reduce((s, p) => s + p.pos.getLng(), 0) / cluster.length;
              const centroid = new kakao.maps.LatLng(avgLat, avgLng);
              const el = buildClusterPin(cluster.length);
              const clusterOverlay = new kakao.maps.CustomOverlay({
                map,
                position: centroid,
                content: el,
                xAnchor: 0.5,
                yAnchor: 0.5,
                zIndex: 20,
                clickable: true,
              });
              clusterOverlaysRef.current.push(clusterOverlay);
              el.addEventListener("click", (ev) => {
                ev.stopPropagation();
                if (typeof kakao.maps.event?.preventMap === "function") {
                  kakao.maps.event.preventMap();
                }
                const currentLevel = map.getLevel();
                if (currentLevel > 1) {
                  map.setLevel(Math.max(1, currentLevel - 2), { anchor: centroid });
                }
              });
            }
          });
        };

        kakao.maps.event.addListener(map, "idle", updateClusters);
        setTimeout(() => { if (!isCancelled) updateClusters(); }, 400);

        // 초기 setBounds 완료 후 600ms 지나면 사용자 이동 감지 시작
        readyTimer = setTimeout(() => { mapReady = true; }, 600);
        kakao.maps.event.addListener(map, "idle", () => {
          if (!mapReady || isCancelled) return;
          setShowResearchButton(true);
        });
      } catch (error) {
        console.error("❌ [지도뷰] 초기화 실패:", error);
      }
    };

    initializeMap();

    return () => {
      isCancelled = true;
      if (readyTimer !== null) clearTimeout(readyTimer);
      mapInstanceRef.current = null;
      storeOverlaysRef.current = [];
      clusterOverlaysRef.current.forEach((o) => { try { o.setMap(null); } catch {} });
      clusterOverlaysRef.current = [];
      overlays.forEach((o) => o.setMap(null));
      if (mapContainerRef.current) {
        mapContainerRef.current.innerHTML = "";
      }
    };
  }, [isMapView, storesWithCoords, currentCoords]);

  useEffect(() => {
    if (!isMapView) return;
    storeOverlaysRef.current.forEach(({ id, overlay }) => {
      const root = overlay.getContent() as HTMLElement | undefined;
      const el = root?.querySelector("[data-store-label]") as HTMLElement | null;
      if (!el) return;
      const translated = mapPinLabels[id];
      const fallback = stores.find((s) => s.id === id)?.name ?? "";
      el.textContent = translated !== undefined && translated !== "" ? translated : fallback;
    });
  }, [isMapView, mapPinLabels, stores]);

  useEffect(() => {
    storeOverlaysRef.current.forEach(({ id, overlay }) => {
      overlay.setZIndex(id === selectedMapStoreId ? 45 : 10);
      const el = overlay.getContent() as HTMLElement | undefined;
      if (!el) return;
      const dot = el.querySelector("[data-pin-dot]") as HTMLElement | null;
      if (!dot) return;
      if (id === selectedMapStoreId) {
        dot.style.background = "#ea580c";
        dot.style.transform = "scale(1.2)";
        dot.style.boxShadow = "0 0 0 3px rgba(234,88,12,.35)";
      } else {
        dot.style.background = "#2D8CFF";
        dot.style.transform = "scale(1)";
        dot.style.boxShadow = "0 1px 3px rgba(0,0,0,.28)";
      }
    });
  }, [selectedMapStoreId]);

  useEffect(() => {
    if (!isMapView || !selectedMapStoreId || !mapInstanceRef.current) return;
    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;
    const store = storesWithCoords.find((s) => s.id === selectedMapStoreId);
    if (!store || typeof store.lat !== "number" || typeof store.lon !== "number") return;
    try {
      mapInstanceRef.current.panTo(new kakao.maps.LatLng(store.lat, store.lon));
    } catch {
      /* ignore */
    }
  }, [selectedMapStoreId, isMapView, storesWithCoords]);

  const showMapFillLayer = isMapView && !isLoadingStores;

  useEffect(() => {
    if (!isMapView) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [isMapView]);

  return (
    <div
      className={cn(
        "bg-background",
        isMapView
          ? "flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden overscroll-none"
          : "min-h-screen pb-20"
      )}
    >
      <TutorialModal 
        open={showTutorialModal} 
        onClose={() => setShowTutorialModal(false)}
      />
      {/* Header — 지도뷰에서는 숨기고 지도 위 FAB로 위치만 조정 */}
      {!isMapView && (
        <header className="sticky top-0 z-40 bg-card border-b border-border/50 backdrop-blur-sm bg-opacity-95">
          <div className="max-w-md mx-auto px-4 py-3">
            <div className="flex items-center gap-2 w-full">
              <Button 
                variant="outline" 
                className="group flex-1 justify-start h-12 rounded-xl border-border/50 hover:border-primary/50 transition-colors"
                disabled={isLoadingLocation}
                onClick={() => navigate('/location')}
              >
                <div className="flex min-w-0 items-center overflow-hidden">
                  {isLoadingLocation ? (
                    <Loader2 className="w-5 h-5 mr-2 shrink-0 text-primary animate-spin" />
                  ) : (
                    <MapPin className="w-5 h-5 mr-2 shrink-0 text-primary group-hover:text-white transition-colors" />
                  )}
                  <span className="truncate font-medium">
                    {isLoadingLocation
                      ? h.checkingLocation
                      : `${isManualLocation ? h.manualLocationLabel : h.currentLocationLabel}: ${headerLocationLine}`}
                  </span>
                </div>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-xl border-border/50 hover:border-primary/50 transition-colors"
                disabled={isLoadingLocation}
                onClick={handleRefreshLocation}
                aria-label={h.refreshLocationAria}
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingLocation ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </header>
      )}

      {/* Store Grid — 지도뷰: 지도는 뷰포트에서 하단 네비(4rem) 제외 전체 */}
      <main
        className={cn(
          "mx-auto max-w-md w-full",
          isMapView
            ? "relative flex min-h-0 flex-1 flex-col overflow-hidden overscroll-none px-0 pb-0 pt-[max(0.5rem,env(safe-area-inset-top))]"
            : "px-4 pt-3 pb-6"
        )}
      >
        {showMapFillLayer && (
          <div className="fixed inset-x-0 top-0 z-[5] h-[calc(100dvh-4rem)] w-full bg-card">
            <div ref={mapContainerRef} className="h-full w-full overflow-hidden" />
          </div>
        )}
        {!isMapView && <MainPromoBanner locale={locale} />}
        <div className={cn("mb-4 flex items-center gap-2", isMapView && "relative z-20 px-4")}>
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-[8rem] shrink-0 gap-1.5 rounded-xl border-border/50 px-3 hover:border-primary/50 transition-colors"
                aria-label={t.languageMenuAria}
                title={LOCALE_MENU_LABELS[locale]}
              >
                <Languages className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-left">
                  {LOCALE_MENU_LABELS[locale]}
                </span>
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
        <div className={cn("mb-6 space-y-3", isMapView && "relative z-20 px-4")}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold">{t.storesHeading}</h2>
            </div>
            {!isMapView && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortBy(sortBy === "distance" ? "discount" : "distance")}
                className="flex shrink-0 items-center gap-2"
              >
                <ArrowUpDown className="w-4 h-4" />
                {sortBy === "distance" ? t.sortDistance : t.sortDiscount}
              </Button>
            )}
          </div>
          {!isMapView &&
            renderFilterChipRow(
              "flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            )}
          {isMapView &&
            renderFilterChipRow(
              "flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            )}
          {isMapView && showResearchButton && (
            <div className="flex justify-center pt-0.5">
              <button
                type="button"
                onClick={handleResearch}
                disabled={isLoadingStores}
                className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/95 px-4 py-2 text-sm font-medium shadow-md backdrop-blur-sm transition-all hover:bg-muted active:scale-95 disabled:opacity-50 animate-in fade-in zoom-in-95 duration-200"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                이 위치에서 재검색
              </button>
            </div>
          )}
        </div>

        {isLoadingStores ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">{t.loadingStores}</p>
          </div>
        ) : isMapView ? (
          <div className="animate-fade-in relative z-30">
            <div
              className="pointer-events-none fixed left-1/2 z-[25] flex w-full max-w-md -translate-x-1/2 justify-end px-4"
              style={{ bottom: "calc(4rem + 4.5rem)" }}
            >
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="pointer-events-auto h-12 w-12 rounded-full border border-border bg-card/95 text-foreground shadow-lg backdrop-blur-sm hover:bg-muted"
                disabled={isLoadingLocation}
                onClick={() => void handleRefreshLocation()}
                aria-label={t.mapFabChangeLocationAria}
              >
                {isLoadingLocation ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <LocateFixed className="h-5 w-5 text-primary" strokeWidth={2.25} aria-hidden />
                )}
              </Button>
            </div>
            <MapViewBottomSheet
              stores={storesWithCoords}
              selectedStoreId={selectedMapStoreId}
              onSelectStore={setSelectedMapStoreId}
              title={t.mapSheetTitle}
              dragHint={t.mapSheetDragHint}
              sortBy={sortBy}
              onSortChange={setSortBy}
              sortDistanceLabel={t.sortDistance}
              sortDiscountLabel={t.sortDiscount}
            />
          </div>
        ) : sortedStores.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-4 animate-fade-in">
              {sortedStores.map((store) => (
                <StoreCard 
                  key={store.id} 
                  {...store}
                />
              ))}
            </div>
            {isLoadingMoreStores && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                {[...Array(4)].map((_, index) => (
                  <div key={`skeleton-${index}`} className="animate-fade-in">
                    <div className="overflow-hidden rounded-lg border border-border/50 bg-card">
                      <div className="flex flex-col">
                        <div className="flex-1 bg-primary/10 flex items-center justify-center p-4 relative">
                          <Skeleton className="w-20 h-20 rounded-md" />
                        </div>
                        <div className="p-3 bg-card">
                          <Skeleton className="h-4 w-24 mb-2" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">{t.noStores}</p>
          </div>
        )}
      </main>

      <BottomNav
        mapViewControl={{
          active: isMapView,
          onToggle: toggleMapView,
          // 매장 0건·검색 결과 없음에서도 지도는 열 수 있음(현재 위치/기본 중심). 로딩 중만 막음.
          disabled: isLoadingStores,
        }}
      />
    </div>
  );
};

export default Main;

import {
  MapPin,
  ArrowUpDown,
  Search,
  Loader2,
  RefreshCw,
  Languages,
  ChevronDown,
  LocateFixed,
  X,
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
import StoreCardSkeleton from "@/components/StoreCardSkeleton";
import MapViewBottomSheet from "@/components/MapViewBottomSheet";
import MainPromoBanner from "@/components/MainPromoBanner";
import { AutoFitMarquee } from "@/components/AutoFitMarquee";
import BottomNav from "@/components/BottomNav";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect, useRef, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { paymentHistoryApi } from "@/api/paymentHistory";
import { storesApi, type NearbyStore } from "@/api/stores";
import { gifticonsApi } from "@/api/gifticons";
import { getStoreOpenStatus, type DayHours } from "@/api/storeDetails";
import { getAddressFromCoords } from "@/lib/geocoding";
import { getBrowserPosition } from "@/lib/geolocation";
import TutorialModal from "@/components/TutorialModal";
import LocationPermissionModal from "@/components/LocationPermissionModal";
import { shouldShowTutorial } from "@/lib/tutorial";
import {
  mainStrings,
  LOCALE_MENU_LABELS,
  APP_LOCALES,
  isAppLocale,
  headerStrings,
  isLocationFetchFailed,
  LOCATION_FETCH_FAILED_KO,
  type AppLocale,
} from "@/lib/locale";
import { useAppLocale } from "@/contexts/AppLocaleContext";
import { useTranslatedAddressLine } from "@/hooks/useKoreanDisplayText";
import { cn } from "@/lib/utils";
import { translateKoText } from "@/lib/koTranslate";

type StoreFilterChipId =
  | "all"
  | "chilsungro"
  | "localCurrency"
  | "highOilSupport"
  | "restaurant"
  | "cafe"
  | "shopping"
  | "other"
  | "openNow";

const BENEFIT_FILTER_CHIP_ORDER: StoreFilterChipId[] = [
  "all",
  "chilsungro",
  "localCurrency",
  "highOilSupport",
  "openNow",
];

const STORE_CATEGORY_CHIP_ORDER: StoreFilterChipId[] = [
  "all",
  "restaurant",
  "cafe",
  "shopping",
  "other",
];

/** 위치를 알 수 없을 때 매장 목록을 불러오는 기본 좌표 (제주 원도심) */
const JEJU_DOWNTOWN_COORDS = { latitude: 33.5098, longitude: 126.5219 };
const MAP_MAX_ZOOM = 21;
/** 지도 축척 ~100m 이상(가까이)에서는 클러스터링하지 않음 */
const MAP_CLUSTER_CUTOFF_ZOOM = 17;
const MAP_SPIDERFY_RADIUS_PX = 32;
const MAP_SPIDERFY_MAX_RADIUS_PX = 96;
const MAP_VIEW_PADDING = { top: 100, right: 48, bottom: 220, left: 48 };
const PIN_LABEL_GAP_PX = 4;
const PIN_TAIL_HEIGHT_PX = 8;
const PIN_BALLOON_PADDING_X = 16;
const PIN_BALLOON_PADDING_Y = 8;
const PIN_LABEL_FONT = "700 11px system-ui, -apple-system, sans-serif";
const PIN_LABEL_LINE_HEIGHT = 1.35;

type PinLabelRect = { left: number; top: number; right: number; bottom: number };

let pinLabelMeasureCtx: CanvasRenderingContext2D | null = null;

function measurePinLabelTextWidth(text: string): number {
  if (!pinLabelMeasureCtx) {
    const canvas = document.createElement("canvas");
    pinLabelMeasureCtx = canvas.getContext("2d")!;
    pinLabelMeasureCtx.font = PIN_LABEL_FONT;
  }
  return Math.ceil(pinLabelMeasureCtx.measureText(text).width);
}

function getPinLabelText(markerContent: HTMLElement | null): string {
  return markerContent?.querySelector("[data-store-label]")?.textContent ?? "";
}

function measurePinLabelRect(
  anchorX: number,
  anchorY: number,
  labelText: string,
  spiderfyOffset = { x: 0, y: 0 }
): PinLabelRect {
  const width = Math.max(measurePinLabelTextWidth(labelText) + PIN_BALLOON_PADDING_X, 24);
  const height = Math.ceil(11 * PIN_LABEL_LINE_HEIGHT) + PIN_BALLOON_PADDING_Y;
  const x = anchorX + spiderfyOffset.x;
  const y = anchorY + spiderfyOffset.y;
  return {
    left: x - width / 2,
    top: y - PIN_TAIL_HEIGHT_PX - height,
    right: x + width / 2,
    bottom: y,
  };
}

function labelRectsOverlap(a: PinLabelRect, b: PinLabelRect, gap = PIN_LABEL_GAP_PX): boolean {
  return !(
    a.right + gap < b.left ||
    a.left - gap > b.right ||
    a.bottom + gap < b.top ||
    a.top - gap > b.bottom
  );
}

function labelRectsOverlapForCluster(a: PinLabelRect, b: PinLabelRect, zoom: number): boolean {
  if (!labelRectsOverlap(a, b, 0)) return false;
  const overlapW = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const overlapH = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  const minW = zoom >= 16 ? 18 : 12;
  const minH = zoom >= 16 ? 12 : 8;
  return overlapW >= minW && overlapH >= minH;
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getMaxClusterDistanceM(zoom: number): number {
  if (zoom >= 16) return 45;
  if (zoom >= 15) return 90;
  if (zoom >= 13) return 180;
  return 320;
}

type ClusterPinItem = {
  bounds: PinLabelRect;
  pos: { lat: () => number; lng: () => number };
};

function groupPinsForClustering(items: ClusterPinItem[], zoom: number): ClusterPinItem[][] {
  const n = items.length;
  if (n === 0) return [];
  const maxDistM = getMaxClusterDistanceM(zoom);
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!labelRectsOverlapForCluster(items[i].bounds, items[j].bounds, zoom)) continue;
      const distM = distanceMeters(
        items[i].pos.lat(),
        items[i].pos.lng(),
        items[j].pos.lat(),
        items[j].pos.lng()
      );
      if (distM <= maxDistM) union(i, j);
    }
  }

  const groups = new Map<number, ClusterPinItem[]>();
  items.forEach((item, index) => {
    const root = find(index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(item);
  });
  return [...groups.values()];
}

function pinLabelRectsOverlap(rects: PinLabelRect[]): boolean {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (labelRectsOverlap(rects[i], rects[j])) return true;
    }
  }
  return false;
}

function pinLabelRectsFitInView(
  rects: PinLabelRect[],
  viewWidth: number,
  viewHeight: number,
  padding = MAP_VIEW_PADDING
): boolean {
  if (rects.length === 0) return true;
  const minX = padding.left;
  const minY = padding.top;
  const maxX = viewWidth - padding.right;
  const maxY = viewHeight - padding.bottom;
  return rects.every(
    (rect) => rect.left >= minX && rect.top >= minY && rect.right <= maxX && rect.bottom <= maxY
  );
}

function sortStoresByName<T extends { name: string }>(stores: T[]): T[] {
  return [...stores].sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

function buildMyLocationPinElement(title: string): HTMLDivElement {
  const root = document.createElement("div");
  root.style.cssText = "position:absolute;width:0;height:0;pointer-events:none;";
  root.title = title;
  const dot = document.createElement("div");
  dot.style.cssText =
    "position:absolute;width:13px;height:13px;transform:translate(-50%,-50%);border-radius:9999px;background:#22c55e;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);";
  root.appendChild(dot);
  return root;
}

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
  return "other";
}

type StoreLikeForChip = {
  image: string;
  categoryGroupCode?: string;
  categoryName?: string;
  local_currency_available?: boolean;
  high_oil_support_available?: boolean;
  hasGifticonDiscount?: boolean;
};

function storeHasHighOilSupport(store: StoreLikeForChip): boolean {
  return store.high_oil_support_available === true;
}

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

function imageFromStoreCategory(category?: string | null): string {
  if (!category) return "other";
  if (category.includes("카페") || category.includes("디저트")) return "cafe";
  if (category.includes("쇼핑")) return "shopping";
  if (category.includes("음식")) return "restaurant";
  return "other";
}

function categoryGroupCodeFromStoreCategory(category?: string | null): string {
  if (!category) return "";
  if (category.includes("카페") || category.includes("디저트")) return "CE7";
  if (category.includes("쇼핑")) return "MT1";
  if (category.includes("음식")) return "FD6";
  return "";
}

function storeChipIsOther(store: StoreLikeForChip): boolean {
  return (
    !storeChipIsRestaurant(store) &&
    !storeChipIsCafe(store) &&
    !storeChipIsShopping(store)
  );
}

function storeMatchesBenefitChipFilters(
  store: StoreLikeForChip,
  chips: ReadonlySet<StoreFilterChipId>,
  locale: AppLocale
): boolean {
  // openNow는 영업 여부 필터에서 따로 처리하므로 여기서는 제외
  if (chips.has("all")) return true;

  const parts: boolean[] = [];
  if (chips.has("chilsungro")) parts.push(storeHasChilsungroCoupon(store));
  if (chips.has("localCurrency")) parts.push(!!store.local_currency_available);
  if (locale === "ko" && chips.has("highOilSupport")) {
    parts.push(storeHasHighOilSupport(store));
  }

  return parts.length > 0 && parts.some(Boolean);
}

function storeMatchesCategoryChipFilters(
  store: StoreLikeForChip,
  chips: ReadonlySet<StoreFilterChipId>
): boolean {
  if (chips.has("all")) return true;

  const parts: boolean[] = [];
  if (chips.has("restaurant")) parts.push(storeChipIsRestaurant(store));
  if (chips.has("cafe")) parts.push(storeChipIsCafe(store));
  if (chips.has("shopping")) parts.push(storeChipIsShopping(store));
  if (chips.has("other")) parts.push(storeChipIsOther(store));

  return parts.length > 0 && parts.some(Boolean);
}

function ChipButton({
  id,
  active,
  label,
  onToggle,
}: {
  id: string;
  active: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        "flex shrink-0 items-center justify-center gap-1 rounded-full border px-3 py-1.5 font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-card text-foreground hover:bg-muted/80"
      )}
    >
      {id === "openNow" && (
        <span
          className={cn(
            "shrink-0 inline-block h-1.5 w-1.5 rounded-full",
            active ? "bg-green-300" : "bg-green-500"
          )}
        />
      )}
      <span className="whitespace-nowrap text-xs">{label}</span>
    </button>
  );
}

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
  maxDiscount: string | null;
  discountNum: number;
  maxDiscountPercent: number | null;
  lat?: number;
  lon?: number;
  address?: string;
  local_currency_available?: boolean;
  local_currency_discount_rate?: number | null;
  high_oil_support_available?: boolean;
  parking_available?: boolean;
  free_parking?: boolean;
  parking_size?: string | null;
  categoryGroupCode?: string;
  categoryName?: string;
  hasGifticonDiscount?: boolean;
  isOpen?: boolean;
  todayHours?: DayHours | null;
  photos?: string[];
  closedDayNote?: string;
  detailUrl?: string;
}

  const [stores, setStores] = useState<StoreData[]>([]);
  const [isLoadingStores, setIsLoadingStores] = useState(true);
  const [isLoadingMoreStores, setIsLoadingMoreStores] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{latitude: number, longitude: number} | null>(null);

  /** 사용자가 /location에서 직접 고른 위치만 유지. 자동 GPS 캐시는 실패 시 제거 */
  const clearAutoSavedLocation = () => {
    localStorage.removeItem("currentCoordinates");
    localStorage.removeItem("selectedLocation");
    setCurrentCoords(null);
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [benefitFilterChips, setBenefitFilterChips] = useState<Set<StoreFilterChipId>>(
    () => new Set<StoreFilterChipId>(["all", "openNow"])
  );
  const [categoryFilterChips, setCategoryFilterChips] = useState<Set<StoreFilterChipId>>(
    () => new Set<StoreFilterChipId>(["all"])
  );
  const { locale, setLocale } = useAppLocale();

  useEffect(() => {
    if (locale === "ko") return;
    setBenefitFilterChips((prev) => {
      if (!prev.has("highOilSupport")) return prev;
      const next = new Set(prev);
      next.delete("highOilSupport");
      return next;
    });
  }, [locale]);

  const benefitFilterChipOrder = useMemo(
    () =>
      locale === "ko"
        ? BENEFIT_FILTER_CHIP_ORDER
        : BENEFIT_FILTER_CHIP_ORDER.filter((id) => id !== "highOilSupport"),
    [locale]
  );
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [showLocationPermModal, setShowLocationPermModal] = useState(false);
  const isMapView = searchParams.get("map") === "1";
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const storeMarkersRef = useRef<{ id: string; marker: any }[]>([]);
  const clusterMarkersRef = useRef<any[]>([]);
  const selectStoreOnMapRef = useRef<(id: string) => void>(() => {});
  const [selectedMapStoreId, setSelectedMapStoreId] = useState<string | null>(null);
  const [showResearchButton, setShowResearchButton] = useState(false);
  const [mapFilteredStores, setMapFilteredStores] = useState<any[] | null>(null);
  const allFetchedStoresRef = useRef<any[]>([]);
  const fetchNearbyStoresRef = useRef<
    ((latitude: number, longitude: number, options?: { sortAlphabetically?: boolean }) => Promise<void>) | null
  >(null);
  const fallbackStoresLoadStartedRef = useRef(false);

  const loadFallbackStores = () => {
    if (fallbackStoresLoadStartedRef.current) return;
    fallbackStoresLoadStartedRef.current = true;
    void fetchNearbyStoresRef.current?.(
      JEJU_DOWNTOWN_COORDS.latitude,
      JEJU_DOWNTOWN_COORDS.longitude,
      { sortAlphabetically: true }
    );
  };
  const [mapPinLabels, setMapPinLabels] = useState<Record<string, string>>({});
  const mapPinLabelsRef = useRef<Record<string, string>>({});
  const storesWithCoordsRef = useRef<any[]>([]);
  const rebuildStoreOverlaysRef = useRef<(() => void) | null>(null);
  const fitMapToStoresRef = useRef<(() => void) | null>(null);
  const mapOverlaysReadyRef = useRef(false);
  const mapClusteringEnabledRef = useRef(false);
  const mapBootstrapFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rebuildStoreOverlaysTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myLocationMarkerRef = useRef<any>(null);
  const currentCoordsRef = useRef(currentCoords);
  const skipNextFitMapRef = useRef(false);

  const getMarkerPinContent = (marker: any): HTMLElement | null => {
    const icon = marker?.getIcon?.();
    return (icon?.content as HTMLElement) ?? null;
  };

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
      setMapFilteredStores(null);
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

      // Naver Maps SDK 로드 (실패해도 GPS 위치 조회는 계속 진행)
      try {
        const { loadNaverMaps } = await import("@/lib/naver");
        await loadNaverMaps(locale);
      } catch (error: any) {
        console.error("❌ [위치 초기화] Naver Maps SDK 로드 실패:", error);
        toast({
          title: "지도 서비스 경고",
          description:
            error.message ||
            "네이버 지도 SDK를 불러오지 못했습니다. 네이버 클라우드 콘솔에서 Dynamic Map·Geocoding 및 Web 서비스 URL(http://localhost)을 확인해주세요.",
          variant: "destructive",
        });
      }

      // Main 페이지 최초 접근 시 위치 정보 확인
      setIsLoadingLocation(true);

      // localStorage에 저장된 좌표 확인
      let savedCoordinates = localStorage.getItem("currentCoordinates");
      const savedLocation = localStorage.getItem("selectedLocation");
      const isManualLocationValue = localStorage.getItem("isManualLocation") === "true";
      setIsManualLocation(isManualLocationValue);

      // 사용자가 직접 설정한 위치가 있으면 그것을 사용 (현재 위치를 불러오지 않음)
      if (isManualLocationValue && savedLocation) {
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
                const formattedAddress = await getAddressFromCoords(latitude, longitude, locale);
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
              await fetchNearbyStoresRef.current?.(latitude, longitude);
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
            const { searchAddress } = await import("@/lib/naver");
            const searchResult = await searchAddress(savedLocation, locale);
            
            if (searchResult.documents && searchResult.documents.length > 0) {
              const firstResult = searchResult.documents[0];
              const latitude = parseFloat(firstResult.y);
              const longitude = parseFloat(firstResult.x);

              if (searchResult.usedFallbackCoords) {
                toast({
                  title: "대략 위치로 설정",
                  description:
                    "Geocoding API가 꺼져 있어 제주 원도심 기준 좌표를 사용합니다. 콘솔에서 Geocoding을 활성화하면 정확해집니다.",
                });
              }
              
              // 좌표 저장
              localStorage.setItem("currentCoordinates", JSON.stringify({ latitude, longitude }));
              
              console.log("✅ [위치 정보] 주소 검색으로 좌표 획득:", { latitude, longitude });
              
              // 저장된 위치를 ~시 ~동 형식으로 변환하여 표시
              try {
                const formattedAddress = await getAddressFromCoords(latitude, longitude, locale);
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
              await fetchNearbyStoresRef.current?.(latitude, longitude);
              return; // 직접 설정한 위치를 사용했으므로 현재 위치 가져오기 건너뛰기
            } else {
              console.warn("⚠️ [위치 정보] 주소 검색 결과 없음:", savedLocation);
              toast({
                title: "주소 검색 실패",
                description: searchResult.geocodingForbidden
                  ? "네이버 콘솔에서 Geocoding을 켜고 저장해주세요. (Reverse Geocoding만으로는 주소 검색 불가) GPS로 재시도합니다."
                  : "주소를 찾지 못했습니다. 현재 위치(GPS)로 다시 시도합니다.",
                variant: "destructive",
              });
              localStorage.removeItem("isManualLocation");
              setIsManualLocation(false);
              setCurrentLocation(savedLocation);
              // Geocoding 실패 시 GPS로 폴백
            }
          } catch (error) {
            console.error("❌ [위치 초기화] 주소 검색 오류:", error);
            toast({
              title: "주소 검색 오류",
              description: "현재 위치(GPS)로 다시 시도합니다.",
              variant: "destructive",
            });
            localStorage.removeItem("isManualLocation");
            setIsManualLocation(false);
            setCurrentLocation(LOCATION_FETCH_FAILED_KO);
            loadFallbackStores();
          }
        }
      } else if (isManualLocationValue && !savedLocation) {
        console.warn(
          "⚠️ [위치 정보] 수동 위치 플래그만 남아 있음 — 플래그 제거 후 현재 위치 재조회"
        );
        localStorage.removeItem("isManualLocation");
        localStorage.removeItem("currentCoordinates");
        setIsManualLocation(false);
      }
      
      // 직접 설정한 위치가 없으면 기본적으로 현재 위치 가져오기
      console.log("🌍 [위치 정보] 현재 위치 가져오기 시작");

      // 권한 상태 확인 — prompt 상태면 모달로 먼저 안내
      if (navigator.permissions) {
        try {
          const perm = await navigator.permissions.query({ name: "geolocation" as PermissionName });
          if (perm.state === "prompt") {
            setShowLocationPermModal(true);
            setIsLoadingLocation(false);
            setCurrentLocation(LOCATION_FETCH_FAILED_KO);
            loadFallbackStores();
            return; // 모달에서 허용 후 onGranted 콜백으로 이어짐
          }
        } catch {
          // permissions API 미지원 브라우저는 바로 요청
        }
      }

      await fetchBrowserLocation();
    };

    const applyDetectedLocation = async (latitude: number, longitude: number) => {
      console.log("✅ [위치 정보] 좌표 적용:", { latitude, longitude });
      console.log("🏠 [주소 변환] 시작");
      const address = await getAddressFromCoords(latitude, longitude, locale);
      console.log("✅ [주소 변환] 완료:", address);
      const displayAddress =
        address === "위치를 확인할 수 없음"
          ? headerStrings(locale).locationUnknownGeo
          : address;

      localStorage.setItem("selectedLocation", displayAddress);
      localStorage.setItem("currentCoordinates", JSON.stringify({ latitude, longitude }));
      localStorage.removeItem("isManualLocation");
      setIsManualLocation(false);
      setCurrentLocation(displayAddress);
      setCurrentCoords({ latitude, longitude });
      setIsLoadingLocation(false);

      console.log("🏪 [매장 검색] fetchNearbyStores 호출 시작");
      await fetchNearbyStoresRef.current?.(latitude, longitude);
    };

    const fetchBrowserLocation = async () => {
      if (!navigator.geolocation) {
        clearAutoSavedLocation();
        setCurrentLocation(LOCATION_FETCH_FAILED_KO);
        setIsLoadingLocation(false);
        loadFallbackStores();
        return;
      }

      console.log("🌍 [위치 정보] 브라우저 위치 정보 요청 시작");
      try {
        const { latitude, longitude } = await getBrowserPosition();
        await applyDetectedLocation(latitude, longitude);
      } catch (error) {
        const geoError = error as GeolocationPositionError;
        console.error("❌ [위치 정보] 획득 실패:", geoError);
        if (geoError?.code != null) console.log("에러 코드:", geoError.code);
        if (geoError?.message) console.log("에러 메시지:", geoError.message);

        clearAutoSavedLocation();

        if (geoError?.code === 1) {
          console.warn("⚠️ [위치 권한] 사용자가 위치 권한을 거부했습니다");
          setCurrentLocation(LOCATION_FETCH_FAILED_KO);
          setIsLoadingLocation(false);
          loadFallbackStores();
          toast({
            title: "위치 권한 필요",
            description: "위치 권한을 허용하면 자동으로 현재 위치가 설정됩니다.",
            duration: 2000,
          });
          return;
        }

        setCurrentLocation(LOCATION_FETCH_FAILED_KO);
        setIsLoadingLocation(false);
        loadFallbackStores();
        toast({
          title: "위치를 불러올 수 없습니다",
          description: "현재 위치를 확인하지 못했습니다. 상단에서 위치를 직접 설정해 주세요.",
          duration: 2000,
        });
      }
    };

    checkAuthAndInitLocation();

    return () => {};
  }, [toast, navigate, locale]);

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
      try {
        const { latitude, longitude } = await getBrowserPosition();
        const address = await getAddressFromCoords(latitude, longitude, locale);

        localStorage.setItem("selectedLocation", address);
        localStorage.setItem("currentCoordinates", JSON.stringify({ latitude, longitude }));
        localStorage.removeItem("isManualLocation");
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
        console.error("❌ [위치 새로고침] 실패:", error);
        clearAutoSavedLocation();
        setCurrentLocation(LOCATION_FETCH_FAILED_KO);
        setIsLoadingLocation(false);
        loadFallbackStores();

        toast({
          title: "위치 업데이트 실패",
          description: "위치를 가져올 수 없습니다. 위치 설정에서 직접 선택해 주세요.",
          variant: "destructive",
          duration: 2000,
        });
      }
    } else {
      setIsLoadingLocation(false);
      loadFallbackStores();
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

  const handleLocationGranted = async ({ latitude, longitude }: { latitude: number; longitude: number }) => {
    setShowLocationPermModal(false);
    setIsLoadingLocation(true);
    try {
      const address = await getAddressFromCoords(latitude, longitude, locale);
      const displayAddress =
        address === "위치를 확인할 수 없음"
          ? headerStrings(locale).locationUnknownGeo
          : address;
      localStorage.setItem("selectedLocation", displayAddress);
      localStorage.setItem("currentCoordinates", JSON.stringify({ latitude, longitude }));
      localStorage.removeItem("isManualLocation");
      setIsManualLocation(false);
      setCurrentLocation(displayAddress);
      setCurrentCoords({ latitude, longitude });
      setIsLoadingLocation(false);
      await fetchNearbyStores(latitude, longitude);
    } catch (error) {
      console.error("위치 처리 오류:", error);
      clearAutoSavedLocation();
      setCurrentLocation(LOCATION_FETCH_FAILED_KO);
      setIsLoadingLocation(false);
      loadFallbackStores();
    }
  };

  const fetchNearbyStores = async (
    latitude: number,
    longitude: number,
    options?: { sortAlphabetically?: boolean }
  ) => {
    try {
      setIsLoadingStores(true);
      setShowResearchButton(false);
      console.log("🏪 [매장 검색] 시작:", { latitude, longitude });

      // 초기 1회 fetch로 전체 매장 확보 (이후 재검색은 캐시 필터링)
      const radius = 100000; // 100km — 전체 매장 로드
      console.log("📏 [매장 검색] 검색 반경:", radius, "미터");

      const mapNearbyStoreToStore = (store: NearbyStore) => {
        const distanceNum =
          typeof store.distance_m === "number"
            ? store.distance_m
            : calculateDistance(latitude, longitude, store.latitude, store.longitude) * 1000;
        const image = imageFromStoreCategory(store.category);
        const { isOpen, todayHours, photos, closedDayNote } = getStoreOpenStatus(image);
        return {
          id: String(store.id),
          name: store.name,
          distance:
            distanceNum < 1000
              ? `${Math.round(distanceNum)}m`
              : `${(distanceNum / 1000).toFixed(1)}km`,
          distanceNum: Math.round(distanceNum),
          image,
          maxDiscount: null,
          discountNum: 0,
          maxDiscountPercent: null,
          lat: store.latitude,
          lon: store.longitude,
          address: "",
          categoryGroupCode: categoryGroupCodeFromStoreCategory(store.category),
          categoryName: store.category || "",
          isOpen: store.business_hours_today ? !store.business_hours_today.includes("정기휴무") : isOpen,
          todayHours,
          photos: store.image_url ? [store.image_url] : photos,
          closedDayNote: store.business_hours_today || closedDayNote,
          local_currency_available: store.localpay,
          local_currency_discount_rate: null,
          high_oil_support_available: store.oil_subsidy,
          parking_available: false,
          free_parking: false,
          parking_size: null,
          hasGifticonDiscount: store.downtown_coupon,
          detailUrl: storesApi.getStoreRedirectUrl(store.id),
          apiStoreData: {
            local_currency_available: store.localpay,
            local_currency_discount_rate: null,
            gifticon_available: store.downtown_coupon,
            parking_available: false,
            free_parking: false,
            parking_size: null,
            high_oil_support_available: store.oil_subsidy,
          },
        };
      };

      console.log("⏳ [매장 검색] 실제 주변 매장 API 요청 중...");
      const nearbyStores = await storesApi.getNearbyStores(latitude, longitude, radius);
      console.log("✅ [매장 검색] 실제 API 응답:", nearbyStores.length, "개");

      const mergedRaw = nearbyStores.map(mapNearbyStoreToStore);
      if (options?.sortAlphabetically) {
        mergedRaw.sort((a, b) => a.name.localeCompare(b.name, "ko"));
      } else {
        mergedRaw.sort((a, b) => a.distanceNum - b.distanceNum);
      }
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

      const getStoreDataByPlaceId = async (store: any): Promise<any | null> => {
        try {
          if (store.apiStoreData) return store.apiStoreData;
          const isNumeric = /^\d+$/.test(store.id);
          if (!isNumeric) return null;
          return await storesApi.getStoreByKakaoPlaceId(store.id);
        } catch (e) {
          console.log(`⚠️ [매장 정보] ${store.name}: kakao_place_id 매장 정보 조회 실패`);
          return null;
        }
      };
      
      console.log("🚀 [초기 로딩] 처음 8개 매장만 빠르게 표시");
      
      // 각 매장의 할인 정보 조회 (초기 8개만 먼저 처리)
      console.log("🔄 [할인 정보 조회] 초기 8개 매장 처리 시작");
      const initialStoresWithDiscount = await Promise.all(initialStores.map(async (store) => {
        let preloadedStoreData: any = null;

        try {
          preloadedStoreData = await getStoreDataByPlaceId(store);
          // 파스쿠찌와 투썸플레이스가 아니어도 DB 기반 칩(지역화폐/고유가 지원금)은 반영
          if (store.image !== 'pascucci' && store.image !== 'twosome') {
            return {
              ...store,
              maxDiscount: null,
              discountNum: 0,
              maxDiscountPercent: null,
              local_currency_discount_rate: preloadedStoreData?.local_currency_discount_rate || null,
              parking_available: preloadedStoreData?.parking_available || false,
              free_parking: preloadedStoreData?.free_parking || false,
              parking_size: preloadedStoreData?.parking_size || null,
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
          let storeData: any = preloadedStoreData;
          
          try {
            // storeId가 숫자인지 확인 (카카오 플레이스 ID)
            const isNumeric = /^\d+$/.test(store.id);

            if (!storeData && isNumeric) {
              // kakao_place_id로 조회 시도
              const data = await storesApi.getStoreByKakaoPlaceId(store.id);
              storeData = data || null;
            }

            // kakao_place_id 조회 실패 시 franchise_id로 조회 시도
            if (!storeData && franchiseData) {
              const data = await storesApi.getStoreByFranchiseId(franchiseData.id);
              if (data) {
                storeData = data;
              }
            }

            if (storeData) {
              // 지역화폐 할인율
              localCurrencyDiscount = (storeData as any).local_currency_discount_rate || 0;
            }

            // 기프티콘 할인율 조회 (실제 API의 downtown_coupon 기준)
            if (store.hasGifticonDiscount) {
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
            local_currency_discount_rate: storeData?.local_currency_discount_rate || null,
            parking_available: storeData?.parking_available || false,
            free_parking: storeData?.free_parking || false,
            parking_size: storeData?.parking_size || null,
          };
        } catch (error) {
          console.error(`❌ [할인 정보] ${store.name} 조회 오류:`, error);
          return {
            ...store,
            maxDiscount: null,
            discountNum: 0,
            maxDiscountPercent: null,
            local_currency_discount_rate: null,
            parking_available: false,
            free_parking: false,
            parking_size: null,
          };
        }
      }));

      console.log("✅ [할인 정보 조회] 초기 8개 완료");
      
      // 초기 8개 먼저 표시
      setStores(initialStoresWithDiscount);
      allFetchedStoresRef.current = initialStoresWithDiscount;
      setIsLoadingStores(false);
      console.log("✅ [초기 로딩] 완료 - 초기 8개 매장 표시");
      
      // 나머지 매장 데이터 백그라운드 로딩
      if (remainingStores.length > 0) {
        setIsLoadingMoreStores(true);
        console.log("🔄 [추가 로딩] 나머지 매장 데이터 로딩 시작");
        
        // 나머지 매장의 할인 정보 조회
        const remainingStoresWithDiscount = await Promise.all(remainingStores.map(async (store) => {
          let preloadedStoreData: any = null;

          try {
            preloadedStoreData = await getStoreDataByPlaceId(store);
            // 파스쿠찌와 투썸플레이스가 아니어도 DB 기반 칩(지역화폐/고유가 지원금)은 반영
            if (store.image !== 'pascucci' && store.image !== 'twosome') {
              return {
                ...store,
                maxDiscount: null,
                discountNum: 0,
                maxDiscountPercent: null,
                local_currency_discount_rate: preloadedStoreData?.local_currency_discount_rate || null,
                parking_available: preloadedStoreData?.parking_available || false,
                free_parking: preloadedStoreData?.free_parking || false,
                parking_size: preloadedStoreData?.parking_size || null,
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
            let storeData: any = preloadedStoreData;

            try {
              // storeId가 숫자인지 확인 (카카오 플레이스 ID)
              const isNumeric = /^\d+$/.test(store.id);

              if (!storeData && isNumeric) {
                // kakao_place_id로 조회 시도
                const data = await storesApi.getStoreByKakaoPlaceId(store.id);
                storeData = data || null;
              }

              // kakao_place_id 조회 실패 시 franchise_id로 조회 시도
              if (!storeData && franchiseData) {
                const data = await storesApi.getStoreByFranchiseId(franchiseData.id);
                if (data) {
                  storeData = data;
                }
              }

              if (storeData) {
                // 지역화폐 할인율
                localCurrencyDiscount = (storeData as any).local_currency_discount_rate || 0;
              }

              // 기프티콘 할인율 조회 (실제 API의 downtown_coupon 기준)
              if (store.hasGifticonDiscount) {
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
              local_currency_discount_rate: storeData?.local_currency_discount_rate || null,
              parking_available: storeData?.parking_available || false,
              free_parking: storeData?.free_parking || false,
              parking_size: storeData?.parking_size || null,
            };
          } catch (error) {
            console.error(`❌ [할인 정보] ${store.name} 조회 오류:`, error);
            return {
              ...store,
              maxDiscount: null,
              discountNum: 0,
              maxDiscountPercent: null,
              local_currency_discount_rate: null,
              parking_available: false,
              free_parking: false,
              parking_size: null,
            };
          }
        }));

        // 전체 매장 데이터 합치기
        const allStoresWithDiscount = [...initialStoresWithDiscount, ...remainingStoresWithDiscount];

        setStores(allStoresWithDiscount);
        allFetchedStoresRef.current = allStoresWithDiscount;
        setIsLoadingMoreStores(false);
        console.log("✅ [추가 로딩] 완료 - 전체 매장 데이터 표시");
      }
    } catch (error) {
      console.error("❌ [매장 검색] 실패:", error);
      console.error("에러 스택:", (error as Error).stack);
      if (options?.sortAlphabetically) {
        fallbackStoresLoadStartedRef.current = false;
      }
      setIsLoadingStores(false);
      toast({
        title: "매장 정보 로딩 실패",
        description: "매장 정보를 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  fetchNearbyStoresRef.current = fetchNearbyStores;

  // 위치 조회와 무관하게, 위치 없이 화면에 남았을 때 매장 목록 보장
  useEffect(() => {
    if (isLoadingLocation || currentCoords || stores.length > 0) return;
    loadFallbackStores();
  }, [isLoadingLocation, currentCoords, stores.length]);

  mapPinLabelsRef.current = mapPinLabels;

  const t = mainStrings(locale);
  const h = headerStrings(locale);
  const headerLocationLine = useTranslatedAddressLine(currentLocation, locale);
  const headerLocationText = isLoadingLocation
    ? h.checkingLocation
    : isLocationFetchFailed(currentLocation)
      ? h.locationFetchFailed
      : `${isManualLocation ? h.manualLocationLabel : h.currentLocationLabel}: ${headerLocationLine}`;
const chipLabelMap: Record<StoreFilterChipId, string> = {
  all: t.chipAll,
  chilsungro: t.chipChilsungro,
  localCurrency: t.chipLocalCurrency,
  highOilSupport: t.chipHighOilSupport,
  restaurant: t.chipRestaurant,
  cafe: t.chipCafe,
  shopping: t.chipShopping,
  other: t.chipOther,
  openNow: t.chipOpenNow,
};

  const toggleBenefitFilterChip = (id: StoreFilterChipId) => {
    setBenefitFilterChips((prev) => {
      const next = new Set(prev);

      // 영업중은 혜택 칩들과 별도로 토글한다.
      if (id === "openNow") {
        if (next.has("openNow")) next.delete("openNow");
        else next.add("openNow");
        return next;
      }

      if (id === "all") {
        const hasOpenNow = next.has("openNow");
        next.clear();
        next.add("all");
        if (hasOpenNow) next.add("openNow");
        return next;
      }

      next.delete("all");
      if (next.has(id)) next.delete(id);
      else next.add(id);

      // openNow를 제외한 혜택 칩이 하나도 없으면 전체로 복귀한다.
      const selectedBenefitChips = new Set([...next].filter((c) => c !== "openNow"));
      if (selectedBenefitChips.size === 0) next.add("all");

      return next;
    });
  };

  const toggleCategoryFilterChip = (id: StoreFilterChipId) => {
    setCategoryFilterChips((prev) => {
      if (id === "all") return new Set<StoreFilterChipId>(["all"]);

      const next = new Set(prev);
      next.delete("all");
      if (next.has(id)) next.delete(id);
      else next.add(id);

      if (next.size === 0) next.add("all");
      return next;
    });
  };

  const renderFilterChipRow = (
    className: string,
    order: StoreFilterChipId[],
    activeChips: ReadonlySet<StoreFilterChipId>,
    onToggle: (id: StoreFilterChipId) => void,
    ariaLabel: string
  ) => (
    <div className={className} role="toolbar" aria-label={ariaLabel}>
      {order.map((id) => (
        <ChipButton
          key={id}
          id={id}
          active={activeChips.has(id)}
          label={chipLabelMap[id]}
          onToggle={() => onToggle(id)}
        />
      ))}
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

  const benefitFilteredStores = useMemo(() =>
    filteredStores.filter((store) =>
      storeMatchesBenefitChipFilters(store, benefitFilterChips, locale)
    ),
    [filteredStores, benefitFilterChips, locale]
  );

  const categoryFilteredStores = useMemo(() =>
    benefitFilteredStores.filter((store) => storeMatchesCategoryChipFilters(store, categoryFilterChips)),
    [benefitFilteredStores, categoryFilterChips]
  );

  // 혜택 필터 줄의 openNow 칩이 켜진 경우에만 영업중 필터 적용
  const openStores = useMemo(() =>
    benefitFilterChips.has("openNow")
      ? categoryFilteredStores.filter((store) => store.isOpen !== false)
      : categoryFilteredStores,
    [categoryFilteredStores, benefitFilterChips]
  );

  const hasStoreCoords = (store: StoreData) =>
    Number.isFinite(store.lat) && Number.isFinite(store.lon);

  const handleResearch = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const naver = (window as any).naver;
    const bounds = map.getBounds?.();
    if (!bounds) return;

    const center = map.getCenter();
    const centerLat = center.lat();
    const centerLng = center.lng();

    const isInViewport = (lat: number, lon: number): boolean => {
      if (typeof bounds.hasLatLng === "function" && naver?.maps?.LatLng) {
        return bounds.hasLatLng(new naver.maps.LatLng(lat, lon));
      }
      const sw = bounds.getSW?.();
      const ne = bounds.getNE?.();
      if (!sw || !ne) return false;
      const minLat = Math.min(sw.lat(), ne.lat());
      const maxLat = Math.max(sw.lat(), ne.lat());
      const minLng = Math.min(sw.lng(), ne.lng());
      const maxLng = Math.max(sw.lng(), ne.lng());
      return lat >= minLat && lat <= maxLat && lon >= minLng && lon <= maxLng;
    };

    // 칩 필터가 적용된 목록 중 현재 지도 화면(뷰포트) 안에 있는 매장만 표시
    const filtered = categoryFilteredStores.flatMap((s) => {
      if (!hasStoreCoords(s)) return [];
      if (!isInViewport(s.lat!, s.lon!)) return [];
      const distM = calculateDistance(centerLat, centerLng, s.lat!, s.lon!) * 1000;
      return [
        {
          ...s,
          distance:
            distM < 1000 ? `${Math.round(distM)}m` : `${(distM / 1000).toFixed(1)}km`,
          distanceNum: Math.round(distM),
        },
      ];
    });

    console.log(`🔍 [재검색] 지도 화면 영역 내 매장: ${filtered.length}개`);
    skipNextFitMapRef.current = true;
    setMapFilteredStores(filtered);
    setShowResearchButton(false);
  };

  const sortedStores = useMemo(() => {
    const list = [...openStores];
    if (!currentCoords) {
      if (sortBy === "discount") {
        return list.sort(
          (a, b) => b.discountNum - a.discountNum || a.name.localeCompare(b.name, "ko")
        );
      }
      return sortStoresByName(list);
    }
    return list.sort((a, b) =>
      sortBy === "distance" ? a.distanceNum - b.distanceNum : b.discountNum - a.discountNum
    );
  }, [openStores, sortBy, currentCoords]);

  const storesWithCoords = useMemo(() => {
    // 지도뷰: 재검색 결과 또는 불러온 매장 중 좌표 있는 것 (영업중 필터는 시트에서만 적용 가능)
    const base = mapFilteredStores
      ? mapFilteredStores.filter(hasStoreCoords)
      : categoryFilteredStores.filter(hasStoreCoords);
    if (!currentCoords) {
      if (sortBy === "discount") {
        return [...base].sort(
          (a, b) => b.discountNum - a.discountNum || a.name.localeCompare(b.name, "ko")
        );
      }
      return sortStoresByName(base);
    }
    return [...base].sort((a, b) =>
      sortBy === "distance" ? a.distanceNum - b.distanceNum : b.discountNum - a.discountNum
    );
  }, [mapFilteredStores, categoryFilteredStores, sortBy, currentCoords]);

  useEffect(() => {
    if (!isMapView || !mapContainerRef.current) return;

    let isCancelled = false;
    let mapReady = false;
    let readyTimer: ReturnType<typeof setTimeout> | null = null;

    // 핀 요소: zero-size anchor div + inner wrapper (CSS로 tip=anchor 구현)
    const buildStorePin = (store: StoreData) => {
      const root = document.createElement("div");
      root.style.cssText = "position:absolute;width:0;height:0;user-select:none;";
      root.dataset.storeId = store.id;

      const wrapper = document.createElement("div");
      wrapper.setAttribute("data-pin-wrapper", "1");
      wrapper.style.cssText =
        "position:absolute;bottom:0;left:0;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;cursor:pointer;";

      const balloon = document.createElement("div");
      balloon.dataset.pinDot = "1";
      balloon.style.cssText =
        "background:#2D8CFF;border-radius:8px;padding:4px 8px;box-shadow:0 2px 6px rgba(0,0,0,.3);white-space:nowrap;transition:background .15s ease,transform .15s ease,box-shadow .15s ease;";

      const label = document.createElement("span");
      label.setAttribute("data-store-label", "1");
      label.style.cssText = "font-size:11px;font-weight:700;color:#fff;line-height:1.35;";
      label.textContent = mapPinLabelsRef.current[store.id] ?? store.name;

      balloon.appendChild(label);

      const tail = document.createElement("div");
      tail.dataset.pinTail = "1";
      tail.style.cssText =
        "width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #2D8CFF;transition:border-top-color .15s ease;";

      wrapper.appendChild(balloon);
      wrapper.appendChild(tail);
      root.appendChild(wrapper);

      wrapper.addEventListener("click", (ev) => {
        ev.stopPropagation();
        selectStoreOnMapRef.current(store.id);
      });

      return root;
    };

    const buildClusterPin = (count: number) => {
      const root = document.createElement("div");
      root.style.cssText = "position:absolute;width:0;height:0;user-select:none;";
      const el = document.createElement("div");
      el.style.cssText =
        "position:absolute;display:flex;align-items:center;justify-content:center;" +
        "width:36px;height:36px;transform:translate(-50%,-50%);border-radius:9999px;" +
        "background:#2D8CFF;border:2.5px solid #fff;" +
        "box-shadow:0 2px 8px rgba(0,0,0,.32);" +
        "font-size:13px;font-weight:700;color:#fff;cursor:pointer;";
      el.textContent = String(count);
      root.appendChild(el);
      return { root, el };
    };

    const initializeMap = async () => {
      try {
        const { loadNaverMaps } = await import("@/lib/naver");
        await loadNaverMaps(locale);

        if (isCancelled || !mapContainerRef.current) return;

        const naver = (window as any).naver;
        if (!naver?.maps) return;

        const createStoreMarker = (store: StoreData) => {
          const content = buildStorePin(store);
          const marker = new naver.maps.Marker({
            position: new naver.maps.LatLng(store.lat!, store.lon!),
            map: null,
            zIndex: 10,
            clickable: true,
            icon: {
              content,
              anchor: new naver.maps.Point(0, 0),
            },
          });
          naver.maps.Event.addListener(marker, "click", () => {
            selectStoreOnMapRef.current(store.id);
          });
          return marker;
        };

        const clearClusterMarkers = () => {
          clusterMarkersRef.current.forEach((marker) => {
            try {
              marker.setMap(null);
            } catch {}
          });
          clusterMarkersRef.current = [];
        };

        const showAllStoreMarkers = () => {
          clearClusterMarkers();
          storeMarkersRef.current.forEach(({ marker }) => {
            try {
              marker.setMap(map);
            } catch {}
          });
        };

        const hideAllStoreMarkers = () => {
          storeMarkersRef.current.forEach(({ marker }) => {
            try {
              marker.setMap(null);
            } catch {}
          });
        };

        const applyClustering = () => {
          clusterRetryCount = 0;
          mapClusteringEnabledRef.current = true;
          updateClusters();
        };

        let clusterRetryCount = 0;

        const jejuDowntownCenter = new naver.maps.LatLng(
          JEJU_DOWNTOWN_COORDS.latitude,
          JEJU_DOWNTOWN_COORDS.longitude
        );
        const coords = currentCoordsRef.current;
        const initialCenter = coords
          ? new naver.maps.LatLng(coords.latitude, coords.longitude)
          : jejuDowntownCenter;

        const map = new naver.maps.Map(mapContainerRef.current, {
          center: initialCenter,
          zoom: coords ? 14 : 13,
          maxZoom: MAP_MAX_ZOOM,
          minZoom: 9,
        });
        mapInstanceRef.current = map;

        const fitMapToStores = () => {
          const list = storesWithCoordsRef.current.filter(
            (s: StoreData) => Number.isFinite(s.lat) && Number.isFinite(s.lon)
          );
          const latLngs: any[] = list.map(
            (s: StoreData) => new naver.maps.LatLng(s.lat!, s.lon!)
          );
          if (currentCoordsRef.current) {
            latLngs.push(
              new naver.maps.LatLng(
                currentCoordsRef.current.latitude,
                currentCoordsRef.current.longitude
              )
            );
          }
          if (latLngs.length === 0) {
            map.setCenter(jejuDowntownCenter);
            map.setZoom(13);
            return;
          }
          if (latLngs.length === 1) {
            map.setCenter(latLngs[0]);
            map.setZoom(15);
            return;
          }
          const bounds = new naver.maps.LatLngBounds(latLngs[0], latLngs[0]);
          for (let i = 1; i < latLngs.length; i++) bounds.extend(latLngs[i]);
          map.fitBounds(bounds, {
            top: 100,
            right: 48,
            bottom: 220,
            left: 48,
          });
        };
        fitMapToStoresRef.current = fitMapToStores;

        window.setTimeout(() => {
          if (isCancelled || !mapContainerRef.current) return;
          const authFailed = mapContainerRef.current.innerHTML.includes("auth_fail");
          if (authFailed) {
            toast({
              title: "네이버 지도 인증 실패",
              description:
                "네이버 클라우드 콘솔 > Maps > Application에서 Dynamic Map을 켜고, Web 서비스 URL에 http://localhost 를 등록하세요(포트/경로 제외). 저장 후 Ctrl+F5로 새로고침하세요.",
              variant: "destructive",
            });
          }
        }, 800);

        storeMarkersRef.current = [];

        const syncStorePinsToMap = () => {
          if (isCancelled) return;

          storeMarkersRef.current.forEach(({ marker }) => {
            try {
              marker.setMap(null);
            } catch {}
          });
          storeMarkersRef.current = [];
          clearClusterMarkers();

          storesWithCoordsRef.current.forEach((store: StoreData) => {
            if (!Number.isFinite(store.lat) || !Number.isFinite(store.lon)) return;
            const marker = createStoreMarker(store);
            storeMarkersRef.current.push({ id: store.id, marker });
          });
        };

        const updateStoreLabels = () => {
          storeMarkersRef.current.forEach(({ id, marker }) => {
            const root = getMarkerPinContent(marker);
            const el = root?.querySelector("[data-store-label]") as HTMLElement | null;
            if (!el) return;
            el.textContent =
              mapPinLabelsRef.current[id] ?? storesWithCoordsRef.current.find((s: any) => s.id === id)?.name ?? "";
          });
        };

        const resetMarkerSpiderfy = (marker: any) => {
          const root = getMarkerPinContent(marker);
          const wrapper = root?.querySelector("[data-pin-wrapper]") as HTMLElement | null;
          if (wrapper) {
            wrapper.style.transform = "translateX(-50%)";
            delete wrapper.dataset.spiderfyX;
            delete wrapper.dataset.spiderfyY;
          }
        };

        const getMarkerSpiderfyOffset = (marker: any) => {
          const root = getMarkerPinContent(marker);
          const wrapper = root?.querySelector("[data-pin-wrapper]") as HTMLElement | null;
          return {
            x: Number(wrapper?.dataset.spiderfyX ?? 0),
            y: Number(wrapper?.dataset.spiderfyY ?? 0),
          };
        };

        const buildMarkerLabelRect = (marker: any, proj: any) => {
          const pos = marker.getPosition();
          const pt = proj.fromCoordToOffset(pos);
          const root = getMarkerPinContent(marker);
          const text = getPinLabelText(root);
          const offset = getMarkerSpiderfyOffset(marker);
          return measurePinLabelRect(pt.x, pt.y, text, offset);
        };

        const buildMemberLabelRects = (memberIds: string[]) => {
          const proj = map.getProjection();
          if (!proj) return [] as PinLabelRect[];
          const idSet = new Set(memberIds);
          return storeMarkersRef.current
            .filter(({ id }) => idSet.has(id))
            .map(({ marker }) => buildMarkerLabelRect(marker, proj));
        };

        const memberLabelsOverlap = (memberIds: string[]) =>
          pinLabelRectsOverlap(buildMemberLabelRects(memberIds));

        const allMemberLabelsInView = (memberIds: string[]) => {
          const rects = buildMemberLabelRects(memberIds);
          const mapEl = mapContainerRef.current;
          if (!mapEl) return true;
          return pinLabelRectsFitInView(rects, mapEl.clientWidth, mapEl.clientHeight);
        };

        const fitClusterMembersInView = (memberIds: string[], extraPadding = 0) => {
          const idSet = new Set(memberIds);
          const bounds = new naver.maps.LatLngBounds();
          let hasAny = false;
          storeMarkersRef.current.forEach(({ id, marker }) => {
            if (!idSet.has(id)) return;
            bounds.extend(marker.getPosition());
            hasAny = true;
          });
          if (!hasAny) return;
          map.fitBounds(bounds, {
            top: MAP_VIEW_PADDING.top + extraPadding,
            right: MAP_VIEW_PADDING.right + extraPadding,
            bottom: MAP_VIEW_PADDING.bottom + extraPadding,
            left: MAP_VIEW_PADDING.left + extraPadding,
          });
        };

        const spreadClusterMarkers = (cluster: { id: string; marker: any }[]) => {
          const count = cluster.length;
          if (count <= 1) {
            resetMarkerSpiderfy(cluster[0]?.marker);
            cluster[0]?.marker.setMap(map);
            return;
          }

          const applyPositions = (radiusPx: number) => {
            cluster.forEach(({ marker }, index) => {
              resetMarkerSpiderfy(marker);
              marker.setMap(map);
              const root = getMarkerPinContent(marker);
              const wrapper = root?.querySelector("[data-pin-wrapper]") as HTMLElement | null;
              if (!wrapper) return;
              const angle = (2 * Math.PI * index) / count - Math.PI / 2;
              const offsetX = Math.round(Math.cos(angle) * radiusPx);
              const offsetY = Math.round(Math.sin(angle) * radiusPx);
              wrapper.style.transform = `translate(calc(-50% + ${offsetX}px), ${offsetY}px)`;
              wrapper.dataset.spiderfyX = String(offsetX);
              wrapper.dataset.spiderfyY = String(offsetY);
            });
          };

          const clusterLabelsOverlapAtRadius = (radiusPx: number) => {
            applyPositions(radiusPx);
            const proj = map.getProjection();
            if (!proj) return true;
            const rects = cluster.map(({ marker }) => buildMarkerLabelRect(marker, proj));
            return pinLabelRectsOverlap(rects);
          };

          let radius = MAP_SPIDERFY_RADIUS_PX;
          while (radius <= MAP_SPIDERFY_MAX_RADIUS_PX) {
            if (!clusterLabelsOverlapAtRadius(radius)) return;
            radius += 16;
          }
          applyPositions(MAP_SPIDERFY_MAX_RADIUS_PX);
        };

        const expandClusterUntilSeparated = (memberIds: string[], centroid: any) => {
          clearClusterMarkers();
          const idSet = new Set(memberIds);
          storeMarkersRef.current.forEach(({ id, marker }) => {
            if (!idSet.has(id)) return;
            resetMarkerSpiderfy(marker);
            marker.setMap(map);
          });

          let expandStepCount = 0;
          const MAX_EXPAND_STEPS = 16;

          const finishOrContinue = () => {
            if (isCancelled) return;
            if (expandStepCount >= MAX_EXPAND_STEPS) {
              updateClusters();
              return;
            }
            expandStepCount += 1;

            const separated = !memberLabelsOverlap(memberIds);
            const inView = allMemberLabelsInView(memberIds);
            if (separated && inView) {
              updateClusters();
              return;
            }

            if (separated && !inView) {
              fitClusterMembersInView(memberIds, 32);
              naver.maps.Event.once(map, "idle", finishOrContinue);
              return;
            }

            if (map.getZoom() >= MAP_MAX_ZOOM) {
              const idSet = new Set(memberIds);
              const members = storeMarkersRef.current.filter(({ id }) => idSet.has(id));
              spreadClusterMarkers(members);
              fitClusterMembersInView(memberIds, MAP_SPIDERFY_MAX_RADIUS_PX + 24);
              naver.maps.Event.once(map, "idle", () => {
                if (!isCancelled) updateClusters();
              });
              return;
            }

            map.setZoom(Math.min(MAP_MAX_ZOOM, map.getZoom() + 1));
            map.setCenter(centroid);
            naver.maps.Event.once(map, "idle", finishOrContinue);
          };

          map.setCenter(centroid);
          fitClusterMembersInView(memberIds);
          naver.maps.Event.once(map, "idle", finishOrContinue);
        };

        const updateClusters = () => {
          if (isCancelled) return;

          const allPins = storeMarkersRef.current;
          if (!allPins.length) return;

          if (!mapClusteringEnabledRef.current) {
            showAllStoreMarkers();
            return;
          }

          clearClusterMarkers();

          const proj = map.getProjection();
          if (!proj) {
            hideAllStoreMarkers();
            clearClusterMarkers();
            if (clusterRetryCount < 12) {
              clusterRetryCount += 1;
              setTimeout(() => {
                if (!isCancelled) updateClusters();
              }, 80);
            } else {
              showAllStoreMarkers();
            }
            return;
          }

          const currentZoom = map.getZoom();

          const pins = allPins.map(({ id, marker }) => {
            const pos = marker.getPosition();
            let px = 0;
            let py = 0;
            try {
              const pt = proj.fromCoordToOffset(pos);
              px = pt.x;
              py = pt.y;
            } catch {}
            const bounds = buildMarkerLabelRect(marker, proj);
            return { id, marker, pos, px, py, bounds };
          });

          const allStackedAtOrigin =
            pins.length > 1 && pins.every((p) => p.px === 0 && p.py === 0);
          const projectionReady = pins.length > 0 && !allStackedAtOrigin;
          if (!projectionReady) {
            hideAllStoreMarkers();
            clearClusterMarkers();
            if (clusterRetryCount < 12) {
              clusterRetryCount += 1;
              setTimeout(() => {
                if (!isCancelled) updateClusters();
              }, 80);
            } else {
              showAllStoreMarkers();
            }
            return;
          }
          clusterRetryCount = 0;
          storeMarkersRef.current.forEach(({ marker }) => resetMarkerSpiderfy(marker));

          if (currentZoom >= MAP_CLUSTER_CUTOFF_ZOOM) {
            storeMarkersRef.current.forEach(({ marker }) => {
              marker.setMap(map);
            });
            return;
          }

          const clusters = groupPinsForClustering(pins, currentZoom);

          clusters.forEach((cluster) => {
            if (cluster.length === 1) {
              resetMarkerSpiderfy(cluster[0].marker);
              cluster[0].marker.setMap(map);
            } else if (currentZoom >= MAP_MAX_ZOOM) {
              spreadClusterMarkers(cluster);
            } else {
              cluster.forEach(({ marker }) => marker.setMap(null));
              const avgLat = cluster.reduce((s, p) => s + p.pos.lat(), 0) / cluster.length;
              const avgLng = cluster.reduce((s, p) => s + p.pos.lng(), 0) / cluster.length;
              const centroid = new naver.maps.LatLng(avgLat, avgLng);
              const { root: clusterRoot, el: clusterEl } = buildClusterPin(cluster.length);
              const clusterMarker = new naver.maps.Marker({
                position: centroid,
                map,
                zIndex: 20,
                clickable: true,
                icon: {
                  content: clusterRoot,
                  anchor: new naver.maps.Point(0, 0),
                },
              });
              clusterMarkersRef.current.push(clusterMarker);
              clusterEl.addEventListener("click", (ev) => {
                ev.stopPropagation();
                expandClusterUntilSeparated(
                  cluster.map((member) => member.id),
                  centroid
                );
              });
            }
          });
        };

        const applyPinsToMap = () => {
          if (isCancelled) return;
          clusterRetryCount = 0;
          mapClusteringEnabledRef.current = false;

          syncStorePinsToMap();
          updateStoreLabels();
          hideAllStoreMarkers();
          naver.maps.Event.once(map, "idle", () => {
            if (!isCancelled) applyClustering();
          });
        };

        rebuildStoreOverlaysRef.current = () => {
          if (isCancelled || !mapOverlaysReadyRef.current) return;

          if (rebuildStoreOverlaysTimerRef.current) {
            clearTimeout(rebuildStoreOverlaysTimerRef.current);
          }

          rebuildStoreOverlaysTimerRef.current = setTimeout(() => {
            rebuildStoreOverlaysTimerRef.current = null;
            if (isCancelled || !mapOverlaysReadyRef.current) return;

            clusterRetryCount = 0;
            mapClusteringEnabledRef.current = false;
            syncStorePinsToMap();
            updateStoreLabels();
            hideAllStoreMarkers();
            if (!skipNextFitMapRef.current) {
              fitMapToStores();
            }
            naver.maps.Event.once(map, "idle", () => {
              if (!isCancelled) applyClustering();
            });
          }, 100);
        };

        let mapBootstrapped = false;
        const bootstrapMapOverlays = () => {
          if (isCancelled || mapBootstrapped) return;
          mapBootstrapped = true;
          mapOverlaysReadyRef.current = true;
          applyPinsToMap();
          fitMapToStores();
        };

        const onMapIdle = () => {
          if (!mapBootstrapped) {
            bootstrapMapOverlays();
            return;
          }
          if (mapClusteringEnabledRef.current) {
            updateClusters();
          }
        };

        naver.maps.Event.addListener(map, "idle", onMapIdle);
        naver.maps.Event.once(map, "init", bootstrapMapOverlays);
        if (mapBootstrapFallbackTimerRef.current !== null) {
          clearTimeout(mapBootstrapFallbackTimerRef.current);
        }
        mapBootstrapFallbackTimerRef.current = setTimeout(() => {
          mapBootstrapFallbackTimerRef.current = null;
          bootstrapMapOverlays();
        }, 400);

        // 초기 로드 후 600ms 지나면 사용자 이동 감지 시작
        readyTimer = setTimeout(() => { mapReady = true; }, 600);
        naver.maps.Event.addListener(map, "idle", () => {
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
      mapOverlaysReadyRef.current = false;
      mapClusteringEnabledRef.current = false;
      rebuildStoreOverlaysRef.current = null;
      fitMapToStoresRef.current = null;
      if (readyTimer !== null) clearTimeout(readyTimer);
      if (mapBootstrapFallbackTimerRef.current !== null) {
        clearTimeout(mapBootstrapFallbackTimerRef.current);
        mapBootstrapFallbackTimerRef.current = null;
      }
      if (rebuildStoreOverlaysTimerRef.current !== null) {
        clearTimeout(rebuildStoreOverlaysTimerRef.current);
        rebuildStoreOverlaysTimerRef.current = null;
      }
      if (myLocationMarkerRef.current) {
        try {
          myLocationMarkerRef.current.setMap(null);
        } catch {}
        myLocationMarkerRef.current = null;
      }
      mapInstanceRef.current = null;
      storeMarkersRef.current.forEach(({ marker }) => { try { marker.setMap(null); } catch {} });
      storeMarkersRef.current = [];
      clusterMarkersRef.current.forEach((m) => { try { m.setMap(null); } catch {} });
      clusterMarkersRef.current = [];
      if (mapContainerRef.current) {
        mapContainerRef.current.innerHTML = "";
      }
    };
  }, [isMapView, locale]);

  useEffect(() => {
    currentCoordsRef.current = currentCoords;
  }, [currentCoords]);

  useEffect(() => {
    if (!isMapView || !mapInstanceRef.current) return;

    const naver = (window as any).naver;
    if (!naver?.maps) return;
    const map = mapInstanceRef.current;

    const syncMyLocationMarker = () => {
      if (myLocationMarkerRef.current) {
        try {
          myLocationMarkerRef.current.setMap(null);
        } catch {}
        myLocationMarkerRef.current = null;
      }

      if (!currentCoords) return;

      const pos = new naver.maps.LatLng(currentCoords.latitude, currentCoords.longitude);
      const el = buildMyLocationPinElement(headerStrings(locale).mapCurrentLocationTitle);
      myLocationMarkerRef.current = new naver.maps.Marker({
        position: pos,
        map,
        zIndex: 50,
        clickable: false,
        icon: {
          content: el,
          anchor: new naver.maps.Point(0, 0),
        },
      });
    };

    if (mapOverlaysReadyRef.current) {
      syncMyLocationMarker();
      return;
    }

    naver.maps.Event.once(map, "idle", syncMyLocationMarker);
  }, [isMapView, currentCoords, locale]);

  // storesWithCoords 변경 시 ref 업데이트 + 지도 핀 교체 (지도 재생성 없음)
  useEffect(() => {
    storesWithCoordsRef.current = storesWithCoords;
    if (!isMapView || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const naver = (window as any).naver;

    const run = () => {
      rebuildStoreOverlaysRef.current?.();
      if (skipNextFitMapRef.current) {
        skipNextFitMapRef.current = false;
      }
    };

    if (mapOverlaysReadyRef.current) {
      run();
      return;
    }

    if (naver?.maps?.Event) {
      naver.maps.Event.once(map, "idle", run);
    }
  }, [isMapView, storesWithCoords]);

  // 핀 선택 시 해당 매장으로 지도 이동
  useEffect(() => {
    if (!isMapView || !selectedMapStoreId || !mapInstanceRef.current) return;
    const naver = (window as any).naver;
    if (!naver?.maps) return;
    const store = storesWithCoords.find((s) => s.id === selectedMapStoreId);
    if (!store || !hasStoreCoords(store)) return;
    const map = mapInstanceRef.current;
    map.setCenter(new naver.maps.LatLng(store.lat!, store.lon!));
    const zoom = map.getZoom();
    if (zoom < 15) map.setZoom(15);
  }, [isMapView, selectedMapStoreId, storesWithCoords]);

  useEffect(() => {
    if (!isMapView) return;
    storeMarkersRef.current.forEach(({ id, marker }) => {
      const root = getMarkerPinContent(marker);
      const el = root?.querySelector("[data-store-label]") as HTMLElement | null;
      if (!el) return;
      const translated = mapPinLabels[id];
      const fallback = stores.find((s) => s.id === id)?.name ?? "";
      el.textContent = translated !== undefined && translated !== "" ? translated : fallback;
    });
  }, [isMapView, mapPinLabels, stores]);

  useEffect(() => {
    storeMarkersRef.current.forEach(({ id, marker }) => {
      try {
        marker.setZIndex(id === selectedMapStoreId ? 45 : 10);
      } catch {}
      const el = getMarkerPinContent(marker);
      if (!el) return;
      const balloon = el.querySelector("[data-pin-dot]") as HTMLElement | null;
      const tail = el.querySelector("[data-pin-tail]") as HTMLElement | null;
      if (!balloon) return;
      if (id === selectedMapStoreId) {
        balloon.style.background = "#ea580c";
        balloon.style.transform = "scale(1.1)";
        balloon.style.boxShadow = "0 2px 8px rgba(234,88,12,.45)";
        if (tail) tail.style.borderTopColor = "#ea580c";
      } else {
        balloon.style.background = "#2D8CFF";
        balloon.style.transform = "scale(1)";
        balloon.style.boxShadow = "0 2px 6px rgba(0,0,0,.3)";
        if (tail) tail.style.borderTopColor = "#2D8CFF";
      }
    });
  }, [selectedMapStoreId]);


  const showMapFillLayer = isMapView;

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
      <LocationPermissionModal
        open={showLocationPermModal}
        onGranted={handleLocationGranted}
        onDenied={() => {
          setShowLocationPermModal(false);
          setCurrentLocation(LOCATION_FETCH_FAILED_KO);
        }}
      />
      {/* Header — 지도뷰에서는 숨기고 지도 위 FAB로 위치만 조정 */}
      {!isMapView && (
        <header className="sticky top-0 z-40 bg-card border-b border-border/50 backdrop-blur-sm bg-opacity-95">
          <div className="max-w-md mx-auto px-4 py-3">
            <div className="flex items-center gap-2 w-full">
              <Button 
                variant="outline" 
                className="group h-12 min-w-0 flex-1 justify-start overflow-hidden rounded-xl border-border/50 transition-colors hover:border-primary/50"
                disabled={isLoadingLocation}
                onClick={() => navigate('/location')}
              >
                <div className="flex w-full min-w-0 items-center overflow-hidden">
                  {isLoadingLocation ? (
                    <Loader2 className="w-5 h-5 mr-2 shrink-0 text-primary animate-spin" />
                  ) : (
                    <MapPin className="w-5 h-5 mr-2 shrink-0 text-primary group-hover:text-white transition-colors" />
                  )}
                  <AutoFitMarquee
                    text={headerLocationText}
                    className="flex-1"
                    textClassName="text-left font-medium !leading-6"
                    fontSizeClasses={["text-sm", "text-xs"]}
                  />
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
            <div ref={mapContainerRef} className="map-container h-full w-full overflow-hidden" />
          </div>
        )}
        {!isMapView && <MainPromoBanner locale={locale} />}
        <div className={cn("mb-4 flex items-center gap-2", isMapView && "relative z-20 px-4")}>
          <div className="relative min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setSearchQuery(searchInput)}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t.searchPlaceholder}
            >
              <Search className="w-5 h-5" />
            </button>
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setSearchQuery(searchInput);
              }}
              className={cn(
                "w-full h-12 pl-10 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all",
                searchInput || searchQuery ? "pr-10" : "pr-3"
              )}
            />
            {(searchInput || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setSearchQuery("");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="검색어 지우기"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <DropdownMenu open={isLanguageMenuOpen} onOpenChange={setIsLanguageMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-[8rem] shrink-0 gap-1.5 rounded-xl border-border/50 bg-card px-3 text-foreground transition-colors hover:bg-card hover:text-foreground focus:bg-card focus:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 active:bg-card active:text-foreground data-[state=open]:bg-card data-[state=open]:text-foreground"
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
                style={{backgroundColor:"white", color:"#26222A"}}
              >
                <ArrowUpDown className="w-4 h-4" />
                {sortBy === "distance"
                  ? currentCoords
                    ? t.sortDistance
                    : t.sortName
                  : t.sortDiscount}
              </Button>
            )}
          </div>
          <div className="space-y-2 -mr-4">
            {renderFilterChipRow(
              "flex w-full gap-2 overflow-x-auto py-1 pr-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              benefitFilterChipOrder,
              benefitFilterChips,
              toggleBenefitFilterChip,
              (t as any).benefitFilterToolbarAria ?? t.storeFilterToolbarAria
            )}
            {renderFilterChipRow(
              "flex w-full gap-2 overflow-x-auto py-1 pr-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              STORE_CATEGORY_CHIP_ORDER,
              categoryFilterChips,
              toggleCategoryFilterChip,
              (t as any).categoryFilterToolbarAria ?? t.storeFilterToolbarAria
            )}
          </div>
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

        {isMapView ? (
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
              sortDistanceLabel={currentCoords ? t.sortDistance : t.sortName}
              sortDiscountLabel={t.sortDiscount}
            />
          </div>
        ) : isLoadingStores ? (
          <div
            className="grid grid-cols-2 gap-4 animate-fade-in"
            aria-busy="true"
            aria-label={t.loadingStores}
          >
            {Array.from({ length: 8 }, (_, index) => (
              <StoreCardSkeleton key={`store-skeleton-${index}`} />
            ))}
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
              <div className="mt-4 grid grid-cols-2 gap-4 animate-fade-in">
                {Array.from({ length: 4 }, (_, index) => (
                  <StoreCardSkeleton key={`store-skeleton-more-${index}`} />
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

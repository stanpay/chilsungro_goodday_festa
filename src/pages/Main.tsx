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
import MapViewBottomSheet, {
  MAP_VIEW_SHEET_BOTTOM_NAV_PX,
  MAP_VIEW_SHEET_PEEK_HEIGHT,
} from "@/components/MapViewBottomSheet";
import { updateChatwootBubblePosition } from "@/lib/chatwoot";
import MainPromoBanner from "@/components/MainPromoBanner";
import { AutoFitMarquee } from "@/components/AutoFitMarquee";
import BottomNav from "@/components/BottomNav";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { storesApi, type NearbyStore } from "@/api/stores";
import { getStoreOpenStatus, type DayHours } from "@/api/storeDetails";
import { getAddressFromCoords } from "@/lib/geocoding";
import { JEJU_DOWNTOWN_COORDS } from "@/lib/naverGeocodeFallback";
import { getBrowserPosition } from "@/lib/geolocation";
import { openStoreRedirect, prefetchStoreRedirects } from "@/lib/storeRedirect";
import LocationPermissionModal from "@/components/LocationPermissionModal";
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

const MAP_MAX_ZOOM = 21;
/** 지도뷰 첫 화면 기본 줌 */
const MAP_INITIAL_ZOOM = 16;
/** 클러스터 확대 시 한 단계 줌 애니메이션 길이(ms) */
const MAP_CLUSTER_ZOOM_ANIM_MS = 420;
/** zoomend 미발생 시 다음 줌 단계로 넘기는 폴백 여유(ms) */
const MAP_CLUSTER_ZOOM_FALLBACK_PAD_MS = 80;

function getMapMaxZoom(map: { getMaxZoom?: () => number }): number {
  const max = map.getMaxZoom?.();
  if (typeof max === "number" && Number.isFinite(max)) return max;
  return MAP_MAX_ZOOM;
}

function isMapAtMaxZoom(map: { getMaxZoom?: () => number; getZoom: () => number }): boolean {
  return map.getZoom() >= getMapMaxZoom(map) - 1e-6;
}
const MAP_SPIDERFY_RADIUS_PX = 32;
const MAP_SPIDERFY_MAX_RADIUS_PX = 96;
const MAP_VIEW_PADDING = { top: 100, right: 48, bottom: 220, left: 48 };
/** 선택 매장 핀 — UI 경계(재검색 버튼·시트 핸들)와의 여백 */
const MAP_PIN_FOCUS_BAND_GAP_PX = 8;
/** 0=밴드 상단, 1=밴드 하단 — 핀 시각 중심 목표 (시트 쪽으로 치우침) */
const MAP_PIN_FOCUS_BAND_POSITION = 0.72;
const PIN_ANCHOR_BELOW_VISUAL_CENTER_FALLBACK_PX = 16;

type MapPinFocusBand = {
  top: number;
  bottom: number;
  targetY: number;
};

function measureMapPinFocusBand(
  mapEl: HTMLElement | null,
  researchButtonEl: HTMLElement | null,
  sheetHeightPx: number
): MapPinFocusBand {
  const mapRect = mapEl?.getBoundingClientRect();
  const viewportH = window.visualViewport?.height ?? window.innerHeight;

  if (!mapRect?.height) {
    const mapHeight = mapEl?.clientHeight ?? 600;
    const fallbackBottom =
      mapHeight -
      (MAP_VIEW_SHEET_BOTTOM_NAV_PX + sheetHeightPx + MAP_PIN_FOCUS_BAND_GAP_PX);
    const fallbackTop = MAP_VIEW_PADDING.top;
    const fallbackBandBottom = Math.max(fallbackTop, fallbackBottom);
    return {
      top: fallbackTop,
      bottom: fallbackBandBottom,
      targetY:
        fallbackTop +
        (fallbackBandBottom - fallbackTop) * MAP_PIN_FOCUS_BAND_POSITION,
    };
  }

  const mapTop = mapRect.top;
  const mapHeight = mapRect.height;

  let bandTop = MAP_VIEW_PADDING.top;
  if (researchButtonEl) {
    const boundaryRect = researchButtonEl.getBoundingClientRect();
    bandTop = Math.max(
      bandTop,
      boundaryRect.bottom - mapTop + MAP_PIN_FOCUS_BAND_GAP_PX
    );
  }

  const sheetTopInViewport =
    viewportH - MAP_VIEW_SHEET_BOTTOM_NAV_PX - sheetHeightPx;
  const bandBottom = Math.min(
    mapHeight - MAP_PIN_FOCUS_BAND_GAP_PX,
    sheetTopInViewport - mapTop - MAP_PIN_FOCUS_BAND_GAP_PX
  );

  const clampedBottom = Math.max(bandTop + 20, bandBottom);
  const targetY =
    bandTop + (clampedBottom - bandTop) * MAP_PIN_FOCUS_BAND_POSITION;

  return {
    top: bandTop,
    bottom: clampedBottom,
    targetY: Math.max(bandTop, Math.min(clampedBottom, targetY)),
  };
}

function panMapPinToTargetY(
  map: { getSize?: () => { height: number }; panBy: (offset: unknown) => void },
  naver: { maps: { Point: new (x: number, y: number) => unknown } },
  targetVisualCenterY: number,
  anchorOffsetBelowVisualCenterPx = PIN_ANCHOR_BELOW_VISUAL_CENTER_FALLBACK_PX
) {
  const mapSize = map.getSize?.();
  if (!mapSize) return;
  const anchorTargetY = targetVisualCenterY + anchorOffsetBelowVisualCenterPx;
  const deltaY = mapSize.height / 2 - anchorTargetY;
  if (Math.abs(deltaY) > 0.5) {
    map.panBy(new naver.maps.Point(0, deltaY));
  }
}
const PIN_LABEL_GAP_PX = 4;
const PIN_TAIL_HEIGHT_PX = 8;
const PIN_BALLOON_PADDING_X = 16;
const PIN_BALLOON_PADDING_Y = 8;
const PIN_LABEL_FONT_SIZE_PX = 11;
const PIN_LABEL_FONT = `700 ${PIN_LABEL_FONT_SIZE_PX}px system-ui, -apple-system, sans-serif`;
const PIN_LABEL_LINE_HEIGHT = 1.35;
const PIN_CLUSTER_SIZE_PX = 30;
const PIN_CLUSTER_FONT_SIZE_PX = 11;
const PIN_CLUSTER_BORDER_PX = 2;

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
  const width = Math.max(measurePinLabelTextWidth(labelText) + PIN_BALLOON_PADDING_X, 22);
  const height = Math.ceil(PIN_LABEL_FONT_SIZE_PX * PIN_LABEL_LINE_HEIGHT) + PIN_BALLOON_PADDING_Y;
  const x = anchorX + spiderfyOffset.x;
  const y = anchorY + spiderfyOffset.y;
  return {
    left: x - width / 2,
    top: y - PIN_TAIL_HEIGHT_PX - height,
    right: x + width / 2,
    bottom: y,
  };
}

function computePinAnchorOffsetBelowVisualCenter(
  marker: any,
  proj: any,
  spiderfyOffset = { x: 0, y: 0 }
): number {
  try {
    const pos = marker.getPosition();
    const pt = proj.fromCoordToOffset(pos);
    const icon = marker?.getIcon?.();
    const root = (icon?.content as HTMLElement) ?? null;
    const text = getPinLabelText(root);
    const bounds = measurePinLabelRect(pt.x, pt.y, text, spiderfyOffset);
    return (bounds.bottom - bounds.top) / 2;
  } catch {
    return PIN_ANCHOR_BELOW_VISUAL_CENTER_FALLBACK_PX;
  }
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
  // minW/minH = "이만큼 이상 겹쳐야 같은 클러스터" → 값이 클수록 묶임이 어려워져 클러스터 개수↑
  // v5 타일 기준: 줌 16≈100m, 줌 15≈300m 확대비율. 줌 15도 일반 구간과 동일 기준으로 묶는다.
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
  // v5 타일 확대비율: 줌 16≈100m, 줌 15≈300m, 줌 13~14≈500m~1km.
  // 줌이 커질수록(확대) 화면상 같은 픽셀이 더 작은 실거리를 덮으므로 묶는 최대 거리도 단조 감소.
  if (zoom >= 18) return 20;
  if (zoom >= 16) return 40;
  if (zoom >= 15) return 100; // 300m 확대비율 구간
  if (zoom >= 13) return 160;
  return 280;
}

type ClusterPinItem = {
  id: string;
  marker: any;
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

function panMapPinAboveSheet(
  map: { getSize?: () => { height: number }; panBy: (offset: unknown) => void; getProjection?: () => any },
  naver: { maps: { Point: new (x: number, y: number) => unknown } },
  mapEl: HTMLElement | null,
  researchButtonEl: HTMLElement | null,
  sheetHeightPx: number,
  selectedMarker?: any
) {
  const band = measureMapPinFocusBand(
    mapEl,
    researchButtonEl,
    sheetHeightPx
  );
  let anchorOffset = PIN_ANCHOR_BELOW_VISUAL_CENTER_FALLBACK_PX;
  const proj = map.getProjection?.();
  if (proj && selectedMarker) {
    anchorOffset = computePinAnchorOffsetBelowVisualCenter(selectedMarker, proj);
  }
  panMapPinToTargetY(map, naver, band.targetY, anchorOffset);
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
  hasTravelConsumerCoupon?: boolean;
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
  return store.hasTravelConsumerCoupon === true;
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
  hasTravelConsumerCoupon?: boolean;
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
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pendingSearchSubmitRef = useRef(false);
  const mapSearchMatchRef = useRef<(query: string) => boolean>(() => false);
  const isLoadingStoresRef = useRef(true);
  const mapSearchEmptyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapSearchEmptyNotice, setMapSearchEmptyNotice] = useState(false);
  const showMapSearchEmptyNoticeRef = useRef<() => void>(() => {});

  const submitSearch = (input: HTMLInputElement) => {
    const value = input.value;
    const trimmed = value.trim();

    if (
      isMapViewRef.current &&
      trimmed &&
      !isLoadingStoresRef.current &&
      !mapSearchMatchRef.current(value)
    ) {
      input.blur();
      preserveMapViewportRef.current = true;
      skipNextFitMapRef.current = true;
      setSearchInput(value);
      setSearchQuery("");
      setMapFilteredStores(null);
      setSelectedMapStoreId(null);
      setHighlightMapSheetCard(false);
      showMapSearchEmptyNoticeRef.current();
      return;
    }

    setSearchInput(value);
    setSearchQuery(value);
    input.blur();
  };
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
  const [showLocationPermModal, setShowLocationPermModal] = useState(false);
  const isMapView = searchParams.get("map") === "1";
  const isMapViewRef = useRef(isMapView);
  isMapViewRef.current = isMapView;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapResearchButtonRef = useRef<HTMLButtonElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const storeMarkersRef = useRef<{ id: string; marker: any }[]>([]);
  const clusterMarkersRef = useRef<any[]>([]);
  const selectStoreOnMapRef = useRef<(id: string) => void>(() => {});
  const [selectedMapStoreId, setSelectedMapStoreId] = useState<string | null>(null);
  /** 바텀시트 카드 테두리 강조 — 지도 핀 클릭 시에만 true */
  const [highlightMapSheetCard, setHighlightMapSheetCard] = useState(false);
  const [showResearchButton, setShowResearchButton] = useState(false);
  const [mapFilteredStores, setMapFilteredStores] = useState<any[] | null>(null);
  const allFetchedStoresRef = useRef<any[]>([]);
  const fetchNearbyStoresRef = useRef<
    ((
      latitude: number,
      longitude: number,
      options?: { sortAlphabetically?: boolean; bootstrap?: boolean }
    ) => Promise<void>) | null
  >(null);
  const storesFetchGenerationRef = useRef(0);
  const jejuPreloadStartedRef = useRef(false);

  const preloadJejuStores = () => {
    if (jejuPreloadStartedRef.current) return;
    jejuPreloadStartedRef.current = true;
    void fetchNearbyStoresRef.current?.(
      JEJU_DOWNTOWN_COORDS.latitude,
      JEJU_DOWNTOWN_COORDS.longitude,
      { sortAlphabetically: true, bootstrap: true }
    );
  };

  const ensureJejuStores = () => {
    if (allFetchedStoresRef.current.length > 0) return;
    preloadJejuStores();
  };
  const [mapPinLabels, setMapPinLabels] = useState<Record<string, string>>({});
  const mapPinLabelsRef = useRef<Record<string, string>>({});
  const storesWithCoordsRef = useRef<any[]>([]);
  const rebuildStoreOverlaysRef = useRef<(() => void) | null>(null);
  const fitMapToStoresRef = useRef<(() => void) | null>(null);
  const focusStoreOnMapRef = useRef<(storeId: string) => void>(() => {});
  const mapStoreFocusSessionRef = useRef(0);
  const [mapFocusGeneration, setMapFocusGeneration] = useState(0);
  const bumpMapFocusRef = useRef<() => void>(() => {});
  const mapOverlaysReadyRef = useRef(false);
  const mapClusteringEnabledRef = useRef(false);
  /** 클러스터/spiderfy 레이아웃이 적용된 zoom — 같은 zoom에서는 pan만으로 재계산하지 않음 */
  const lastClusterLayoutZoomRef = useRef<number | null>(null);
  const activeClusterExpansionRef = useRef<{ memberIds: string[]; centroid: any } | null>(null);
  const clusterExpansionSessionRef = useRef(0);
  const mapBootstrapFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rebuildStoreOverlaysTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myLocationMarkerRef = useRef<any>(null);
  const currentCoordsRef = useRef(currentCoords);
  const skipNextFitMapRef = useRef(false);
  /** true면 center/fit/pan으로 뷰포트 변경 금지 (검색 지우기·재검색 등, rebuild마다 리셋되지 않음) */
  const preserveMapViewportRef = useRef(false);
  /** 첫 지도 세팅: fitMapToStores 생략, applyInitialMapView로 center+zoom만 적용 */
  const skipInitialMapFitRef = useRef(true);
  /** 현재 위치로 지도 center/fitBounds — 첫 접속·위치 새로고침 때만 true */
  const alignMapToCurrentLocationRef = useRef(true);
  /** 지도뷰 진입 직후 검색 fit 오동작 방지 — null이면 아직 동기화 전 */
  const prevSearchForMapFitRef = useRef<string | null>(null);
  const applyInitialMapViewRef = useRef<(() => void) | null>(null);
  const cardScrollYRef = useRef(0);
  const mapSheetPanelHeightRef = useRef(MAP_VIEW_SHEET_PEEK_HEIGHT);

  const bumpMapFocus = useCallback(() => {
    setMapFocusGeneration((n) => n + 1);
  }, []);
  bumpMapFocusRef.current = bumpMapFocus;

  const getMarkerPinContent = (marker: any): HTMLElement | null => {
    const icon = marker?.getIcon?.();
    return (icon?.content as HTMLElement) ?? null;
  };

  const handleMapSheetPanelHeightChange = useCallback((height: number) => {
    if (mapSheetPanelHeightRef.current === height) return;
    mapSheetPanelHeightRef.current = height;
    updateChatwootBubblePosition({
      isMapView: isMapViewRef.current,
      mapSheetPanelHeight: height,
    });
  }, []);

  const handleMapSheetDraggingChange = useCallback((dragging: boolean) => {
    const map = mapInstanceRef.current;
    if (!map?.setOptions) return;
    try {
      map.setOptions({
        draggable: !dragging,
        pinchZoom: !dragging,
        scrollWheel: !dragging,
        keyboardShortcuts: !dragging,
        disableDoubleTapZoom: dragging,
        disableDoubleClickZoom: dragging,
        disableTwoFingerTapZoom: dragging,
      });
    } catch {
      /* ignore */
    }
  }, []);

  const selectedMapStoreIdRef = useRef<string | null>(null);
  selectedMapStoreIdRef.current = selectedMapStoreId;

  const applySelectedPinStylesRef = useRef<() => void>(() => {});

  const applySelectedPinStyles = useCallback(() => {
    const selectedId = selectedMapStoreIdRef.current;
    storeMarkersRef.current.forEach(({ id, marker }) => {
      const isSelected =
        selectedId != null && String(id) === String(selectedId);
      try {
        marker.setZIndex(isSelected ? 45 : 10);
      } catch {}
      const el = getMarkerPinContent(marker);
      if (!el) return;
      const balloon = el.querySelector("[data-pin-dot]") as HTMLElement | null;
      const tail = el.querySelector("[data-pin-tail]") as HTMLElement | null;
      if (!balloon) return;
      if (isSelected) {
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
  }, []);

  applySelectedPinStylesRef.current = applySelectedPinStyles;

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
    if (!isMapView) {
      cardScrollYRef.current = window.scrollY;
    }
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

  /** 핀 선택: 시트 1행 + 카드 강조 + 지도 포커스 */
  selectStoreOnMapRef.current = (id: string) => {
    mapStoreFocusSessionRef.current += 1;
    setSelectedMapStoreId(String(id));
    setHighlightMapSheetCard(true);
    bumpMapFocusRef.current();
  };

  useEffect(() => {
    if (isMapView) return;
    const y = cardScrollYRef.current;
    requestAnimationFrame(() => {
      window.scrollTo(0, y);
    });
  }, [isMapView]);

  useEffect(() => {
    updateChatwootBubblePosition({
      isMapView,
      mapSheetPanelHeight: mapSheetPanelHeightRef.current,
    });
  }, [isMapView]);

  useEffect(() => {
    if (!isMapView || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const naver = (window as any).naver;
    skipNextFitMapRef.current = true;
    requestAnimationFrame(() => {
      try {
        naver?.maps?.Event?.trigger(map, "resize");
      } catch {}
      requestAnimationFrame(() => {
        if (mapOverlaysReadyRef.current) {
          rebuildStoreOverlaysRef.current?.();
        } else {
          applyInitialMapViewRef.current?.();
        }
      });
    });
  }, [isMapView]);

  useEffect(() => {
    // 이전 로그인 상태를 추적하기 위한 ref 사용
    const prevSessionRef = { current: null as any };
    
    const checkAuthAndInitLocation = async () => {
      
      // 로그인 상태 확인 (AuthContext에서 관리)

      // 초기 세션 상태를 ref에 저장 (onAuthStateChange에서 사용)
      prevSessionRef.current = isLoggedIn ? { user: { id: "user-001" } } : null;

      // Naver Maps SDK 로드 (실패해도 GPS 위치 조회는 계속 진행)
      try {
        const { loadNaverMaps } = await import("@/lib/naver");
        await loadNaverMaps(locale);
      } catch (error: any) {
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
              
              
              // 저장된 위치를 ~시 ~동 형식으로 변환하여 표시
              try {
                const formattedAddress = await getAddressFromCoords(latitude, longitude, locale);
                setCurrentLocation(formattedAddress);
                localStorage.setItem("selectedLocation", formattedAddress);
              } catch (error) {
                setCurrentLocation(savedLocation);
              }
              setIsManualLocation(true);
              setCurrentCoords({ latitude, longitude });
              setIsLoadingLocation(false);
              
              // 매장 정보 가져오기
              await fetchNearbyStoresRef.current?.(latitude, longitude);
              return; // 직접 설정한 위치를 사용했으므로 현재 위치 가져오기 건너뛰기
            } else {
              // 유효하지 않은 좌표는 제거하고 주소 검색으로 좌표 가져오기
              localStorage.removeItem("currentCoordinates");
              savedCoordinates = null; // 변수 업데이트하여 fallback 로직이 실행되도록 함
            }
          } catch (error) {
            // 저장된 좌표가 잘못되었으면 제거하고 주소 검색으로 좌표 가져오기
            localStorage.removeItem("currentCoordinates");
            savedCoordinates = null; // 변수 업데이트하여 fallback 로직이 실행되도록 함
          }
        }
        
        // 좌표가 없으면 주소 검색으로 좌표 가져오기 (최근 위치 선택 시)
        if (!savedCoordinates) {
          try {
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
              
              
              // 저장된 위치를 ~시 ~동 형식으로 변환하여 표시
              try {
                const formattedAddress = await getAddressFromCoords(latitude, longitude, locale);
                setCurrentLocation(formattedAddress);
                localStorage.setItem("selectedLocation", formattedAddress);
              } catch (error) {
                setCurrentLocation(savedLocation);
              }
              setIsManualLocation(true);
              setCurrentCoords({ latitude, longitude });
              setIsLoadingLocation(false);
              
              // 매장 정보 가져오기
              await fetchNearbyStoresRef.current?.(latitude, longitude);
              return; // 직접 설정한 위치를 사용했으므로 현재 위치 가져오기 건너뛰기
            } else {
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
            toast({
              title: "주소 검색 오류",
              description: "현재 위치(GPS)로 다시 시도합니다.",
              variant: "destructive",
            });
            localStorage.removeItem("isManualLocation");
            setIsManualLocation(false);
            setCurrentLocation(LOCATION_FETCH_FAILED_KO);
            ensureJejuStores();
          }
        }
      } else if (isManualLocationValue && !savedLocation) {
        localStorage.removeItem("isManualLocation");
        localStorage.removeItem("currentCoordinates");
        setIsManualLocation(false);
      }
      
      // 직접 설정한 위치가 없으면 GPS 시도
      await fetchBrowserLocation();
    };

    const applyDetectedLocation = async (latitude: number, longitude: number) => {
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
      alignMapToCurrentLocationRef.current = true;
      setCurrentCoords({ latitude, longitude });
      setIsLoadingLocation(false);

      await fetchNearbyStoresRef.current?.(latitude, longitude);
    };

    const fetchBrowserLocation = async () => {
      if (!navigator.geolocation) {
        clearAutoSavedLocation();
        setCurrentLocation(LOCATION_FETCH_FAILED_KO);
        setIsLoadingLocation(false);
        ensureJejuStores();
        return;
      }

      try {
        const { latitude, longitude } = await getBrowserPosition();
        await applyDetectedLocation(latitude, longitude);
      } catch (error) {
        const geoError = error as GeolocationPositionError;

        clearAutoSavedLocation();
        setCurrentLocation(LOCATION_FETCH_FAILED_KO);
        setIsLoadingLocation(false);
        ensureJejuStores();

        if (geoError?.code === 1) {
          toast({
            title: "위치 권한 필요",
            description: "위치 권한을 허용하면 자동으로 현재 위치가 설정됩니다.",
            duration: 2000,
          });
          return;
        }

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

  const applyCoordinatesAsLocation = async (
    latitude: number,
    longitude: number,
    options?: { fetchStores?: boolean; skipMapFit?: boolean; toastMessage?: string }
  ) => {
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
    skipNextFitMapRef.current = options?.skipMapFit === true;
    if (options?.skipMapFit !== true) {
      alignMapToCurrentLocationRef.current = true;
      preserveMapViewportRef.current = false;
    }
    setCurrentCoords({ latitude, longitude });
    setMapFilteredStores(null);

    if (options?.fetchStores !== false) {
      await fetchNearbyStoresRef.current?.(latitude, longitude);
    }

    if (options?.toastMessage) {
      toast({
        title: "위치 업데이트 완료",
        description: options.toastMessage,
      });
    }
  };

  const handleRefreshLocation = async () => {

    localStorage.setItem("lastLocationFetchTime", Date.now().toString());

    setIsLoadingLocation(true);
    setCurrentLocation("위치 확인 중...");

    try {
      if (!navigator.geolocation) {
        clearAutoSavedLocation();
        setCurrentLocation(LOCATION_FETCH_FAILED_KO);
        ensureJejuStores();
        toast({
          title: "위치 서비스 미지원",
          description: "이 환경에서는 위치를 가져올 수 없습니다.",
          variant: "destructive",
        });
        return;
      }

      const { latitude, longitude } = await getBrowserPosition();
      await applyCoordinatesAsLocation(latitude, longitude, {
        toastMessage: "현재 위치가 업데이트되었습니다.",
      });
    } catch (error) {
      clearAutoSavedLocation();
      setCurrentLocation(LOCATION_FETCH_FAILED_KO);
      ensureJejuStores();
      toast({
        title: "위치 업데이트 실패",
        description: "위치를 가져올 수 없습니다. 위치 설정에서 직접 선택해 주세요.",
        variant: "destructive",
        duration: 2000,
      });
    } finally {
      setIsLoadingLocation(false);
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
      alignMapToCurrentLocationRef.current = true;
      setCurrentCoords({ latitude, longitude });
      setIsLoadingLocation(false);
      await fetchNearbyStores(latitude, longitude);
    } catch (error) {
      clearAutoSavedLocation();
      setCurrentLocation(LOCATION_FETCH_FAILED_KO);
      setIsLoadingLocation(false);
      ensureJejuStores();
    }
  };

  const fetchNearbyStores = async (
    latitude: number,
    longitude: number,
    options?: { sortAlphabetically?: boolean; bootstrap?: boolean }
  ) => {
    const generation = ++storesFetchGenerationRef.current;
    const isStale = () => generation !== storesFetchGenerationRef.current;

    try {
      setIsLoadingStores(true);
      setShowResearchButton(false);

      // 초기 1회 fetch로 전체 매장 확보 (이후 재검색은 캐시 필터링)
      const radius = 100000; // 100km — 전체 매장 로드

      const mapNearbyStoreToStore = (store: NearbyStore) => {
        const distanceNum =
          typeof store.distance_m === "number"
            ? store.distance_m
            : calculateDistance(latitude, longitude, store.latitude, store.longitude) * 1000;
        const image = imageFromStoreCategory(store.category);
        const { isOpen, todayHours, closedDayNote } = getStoreOpenStatus(image);
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
          photos: store.image_url ? [store.image_url] : [],
          closedDayNote: store.business_hours_today || closedDayNote,
          local_currency_available: store.localpay,
          local_currency_discount_rate: null,
          high_oil_support_available: store.oil_subsidy,
          parking_available: false,
          free_parking: false,
          parking_size: null,
          hasTravelConsumerCoupon: store.downtown_coupon,
          detailUrl: storesApi.getStoreRedirectUrl(store.id),
          apiStoreData: {
            local_currency_available: store.localpay,
            local_currency_discount_rate: null,
            parking_available: false,
            free_parking: false,
            parking_size: null,
            high_oil_support_available: store.oil_subsidy,
          },
        };
      };

      const nearbyStores = await storesApi.getNearbyStores(latitude, longitude, radius);

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


      // 지도 재검색용: 할인 정보 조회 전에도 전체 매장 좌표를 즉시 캐시
      allFetchedStoresRef.current = allStores;

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
          return null;
        }
      };
      
      
      // 각 매장의 할인 정보 조회 (초기 8개만 먼저 처리)
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
          }

          // 2. 매장 정보 조회 (kakao_place_id로, 실패 시 무시)
          let localCurrencyDiscount = 0;
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
          } catch (e) {
          }

          // 3. 최대 할인율 계산 (지역화폐 할인율)
          const maxDiscountPercent = localCurrencyDiscount;

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

      
      // 초기 8개 먼저 표시 (캐시에는 할인 정보가 반영된 항목만 병합)
      if (isStale()) return;
      setStores(initialStoresWithDiscount);
      const enrichedById = new Map(initialStoresWithDiscount.map((s) => [s.id, s]));
      allFetchedStoresRef.current = allFetchedStoresRef.current.map(
        (s) => enrichedById.get(s.id) ?? s
      );
      setIsLoadingStores(false);
      
      // 나머지 매장 데이터 백그라운드 로딩
      if (remainingStores.length > 0) {
        setIsLoadingMoreStores(true);
        
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
            }

            // 2. 매장 정보 조회 (kakao_place_id로, 실패 시 무시)
            let localCurrencyDiscount = 0;
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
            } catch (e) {
            }

            // 3. 최대 할인율 계산 (지역화폐 할인율)
            const maxDiscountPercent = localCurrencyDiscount;

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

        if (isStale()) return;
        setStores(allStoresWithDiscount);
        allFetchedStoresRef.current = allStoresWithDiscount;
        setIsLoadingMoreStores(false);
      }
    } catch (error) {
      if (options?.bootstrap) {
        jejuPreloadStartedRef.current = false;
      }
      if (!isStale()) {
        setIsLoadingStores(false);
      }
      toast({
        title: "매장 정보 로딩 실패",
        description: "매장 정보를 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  fetchNearbyStoresRef.current = fetchNearbyStores;

  // /main 진입 즉시 제주 시내 기준 매장·핀 선로딩 (수동 좌표 저장 시는 제외)
  useEffect(() => {
    const isManual = localStorage.getItem("isManualLocation") === "true";
    const savedCoordsRaw = localStorage.getItem("currentCoordinates");
    if (isManual && savedCoordsRaw) {
      try {
        const { latitude, longitude } = JSON.parse(savedCoordsRaw);
        if (
          typeof latitude === "number" &&
          typeof longitude === "number" &&
          !isNaN(latitude) &&
          !isNaN(longitude)
        ) {
          return;
        }
      } catch {
        /* 주소 검색 등으로 이어짐 — 제주 선로딩 유지 */
      }
    }
    preloadJejuStores();
  }, []);

  useEffect(() => {
    return () => {
      if (mapSearchEmptyTimerRef.current) clearTimeout(mapSearchEmptyTimerRef.current);
    };
  }, []);

  mapPinLabelsRef.current = mapPinLabels;

  const t = mainStrings(locale);
  const h = headerStrings(locale);

  showMapSearchEmptyNoticeRef.current = () => {
    setMapSearchEmptyNotice(true);
    if (mapSearchEmptyTimerRef.current) clearTimeout(mapSearchEmptyTimerRef.current);
    mapSearchEmptyTimerRef.current = setTimeout(() => {
      setMapSearchEmptyNotice(false);
      mapSearchEmptyTimerRef.current = null;
    }, 2500);
  };

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
    order: StoreFilterChipId[],
    activeChips: ReadonlySet<StoreFilterChipId>,
    onToggle: (id: StoreFilterChipId) => void,
    ariaLabel: string
  ) => {
    const chips = order.map((id) => (
      <ChipButton
        key={id}
        id={id}
        active={activeChips.has(id)}
        label={chipLabelMap[id]}
        onToggle={() => onToggle(id)}
      />
    ));

    const chipScrollClassName =
      "gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

    if (isMapView) {
      return (
        <div
          className="-mx-4 w-[calc(100%+2rem)] py-1 pointer-events-none"
          role="toolbar"
          aria-label={ariaLabel}
        >
          <div
            className={cn(
              "w-full overflow-x-auto pointer-events-auto pl-4 pr-4",
              chipScrollClassName
            )}
          >
            <div className="flex w-max flex-nowrap gap-2">{chips}</div>
          </div>
        </div>
      );
    }

    return (
      <div
        className="-mx-4 w-[calc(100%+2rem)] py-1"
        role="toolbar"
        aria-label={ariaLabel}
      >
        <div
          className={cn(
            "w-full overflow-x-auto pl-4 pr-4",
            chipScrollClassName
          )}
        >
          <div className="flex w-max flex-nowrap gap-2">{chips}</div>
        </div>
      </div>
    );
  };

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
  // TODO: 영업중 필터 임시 비활성화 (UI는 유지, 기능만 off)
  const openStores = useMemo(() =>
    categoryFilteredStores,
    [categoryFilteredStores]
  );

  const hasStoreCoords = (store: StoreData) =>
    Number.isFinite(store.lat) && Number.isFinite(store.lon);

  mapSearchMatchRef.current = (query: string) => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return true;
    return categoryFilteredStores.some(
      (store) =>
        hasStoreCoords(store) && store.name.toLowerCase().includes(trimmed)
    );
  };
  isLoadingStoresRef.current = isLoadingStores;

  const handleResearch = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const naver = (window as any).naver;
    const bounds = map.getBounds?.();
    if (!bounds) return;

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
    // 할인 정보 로딩 전에도 API 캐시(allFetchedStoresRef)로 즉시 필터링
    const cachedStores =
      allFetchedStoresRef.current.length > 0 ? allFetchedStoresRef.current : stores;
    const searchFiltered = searchQuery.trim()
      ? cachedStores.filter((store) =>
          store.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : cachedStores;
    const chipFiltered = searchFiltered.filter(
      (store) =>
        storeMatchesBenefitChipFilters(store, benefitFilterChips, locale) &&
        storeMatchesCategoryChipFilters(store, categoryFilterChips)
    );

    // 재검색은 뷰포트 필터만 일시 적용 — currentCoords(현재 위치)는 변경하지 않음
    const filtered = chipFiltered.flatMap((s) => {
      if (!hasStoreCoords(s)) return [];
      if (!isInViewport(s.lat!, s.lon!)) return [];
      return [s];
    });

    skipNextFitMapRef.current = true;
    preserveMapViewportRef.current = true;
    setSelectedMapStoreId(null);
    setHighlightMapSheetCard(false);
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

  useEffect(() => {
    prefetchStoreRedirects(
      sortedStores
        .map((store) => store.detailUrl)
        .filter((url): url is string => Boolean(url)),
    );
  }, [sortedStores]);

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

  storesWithCoordsRef.current = storesWithCoords;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    let isCancelled = false;
    let mapReady = false;
    let readyTimer: ReturnType<typeof setTimeout> | null = null;

    // 핀 요소: zero-size anchor div + inner wrapper (CSS로 tip=anchor 구현)
    const buildStorePin = (store: StoreData) => {
      const isSelected =
        selectedMapStoreIdRef.current != null &&
        String(store.id) === String(selectedMapStoreIdRef.current);

      const root = document.createElement("div");
      root.style.cssText = "position:absolute;width:0;height:0;user-select:none;";
      root.dataset.storeId = store.id;

      const wrapper = document.createElement("div");
      wrapper.setAttribute("data-pin-wrapper", "1");
      wrapper.style.cssText =
        "position:absolute;bottom:0;left:0;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;cursor:pointer;";

      const balloon = document.createElement("div");
      balloon.dataset.pinDot = "1";
      balloon.style.cssText = isSelected
        ? "display:flex;align-items:center;background:#ea580c;border-radius:8px;padding:4px 8px;box-shadow:0 2px 8px rgba(234,88,12,.45);white-space:nowrap;transform:scale(1.1);transition:background .15s ease,transform .15s ease,box-shadow .15s ease;"
        : "display:flex;align-items:center;background:#2D8CFF;border-radius:8px;padding:4px 8px;box-shadow:0 2px 6px rgba(0,0,0,.3);white-space:nowrap;transition:background .15s ease,transform .15s ease,box-shadow .15s ease;";

      const label = document.createElement("span");
      label.setAttribute("data-store-label", "1");
      label.style.cssText = `font-size:${PIN_LABEL_FONT_SIZE_PX}px;font-weight:700;color:#fff;line-height:${PIN_LABEL_LINE_HEIGHT};`;
      label.textContent = mapPinLabelsRef.current[store.id] ?? store.name;

      balloon.appendChild(label);

      const tail = document.createElement("div");
      tail.dataset.pinTail = "1";
      tail.style.cssText = isSelected
        ? "width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #ea580c;transition:border-top-color .15s ease;"
        : "width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #2D8CFF;transition:border-top-color .15s ease;";

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
        `width:${PIN_CLUSTER_SIZE_PX}px;height:${PIN_CLUSTER_SIZE_PX}px;transform:translate(-50%,-50%);border-radius:9999px;` +
        `background:#2D8CFF;border:${PIN_CLUSTER_BORDER_PX}px solid #fff;` +
        "box-shadow:0 2px 8px rgba(0,0,0,.32);" +
        `font-size:${PIN_CLUSTER_FONT_SIZE_PX}px;font-weight:700;color:#fff;cursor:pointer;`;
      el.textContent = String(count);
      root.appendChild(el);
      return { root, el };
    };

    const initializeMap = async () => {
      skipInitialMapFitRef.current = true;
      try {
        const { loadNaverMaps } = await import("@/lib/naver");
        await loadNaverMaps(locale);

        if (isCancelled || !mapContainerRef.current) return;

        const naver = (window as any).naver;
        if (!naver?.maps) return;

        const createStoreMarker = (store: StoreData) => {
          const content = buildStorePin(store);
          const isSelected =
            selectedMapStoreIdRef.current != null &&
            String(store.id) === String(selectedMapStoreIdRef.current);
          const marker = new naver.maps.Marker({
            position: new naver.maps.LatLng(store.lat!, store.lon!),
            map: null,
            zIndex: isSelected ? 45 : 10,
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
          applySelectedPinStylesRef.current();
        };

        /** hidden 지도에서는 idle이 안 올 수 있어 timeout fallback 포함 */
        const scheduleApplyClustering = (fallbackMs = 200) => {
          let applied = false;
          const run = () => {
            if (applied || isCancelled) return;
            applied = true;
            applyClustering();
          };
          naver.maps.Event.once(map, "idle", run);
          window.setTimeout(run, fallbackMs);
        };

        let clusterRetryCount = 0;

        const jejuDowntownCenter = new naver.maps.LatLng(
          JEJU_DOWNTOWN_COORDS.latitude,
          JEJU_DOWNTOWN_COORDS.longitude
        );
        const coords = currentCoordsRef.current;
        const initialCenter =
          alignMapToCurrentLocationRef.current && coords
            ? new naver.maps.LatLng(coords.latitude, coords.longitude)
            : jejuDowntownCenter;

        const map = new naver.maps.Map(mapContainerRef.current, {
          center: initialCenter,
          zoom: MAP_INITIAL_ZOOM,
          maxZoom: MAP_MAX_ZOOM,
          minZoom: 9,
          tileTransition: true,
          tileDuration: MAP_CLUSTER_ZOOM_ANIM_MS,
        });
        mapInstanceRef.current = map;

        const applyInitialMapView = () => {
          if (isCancelled || !isMapViewRef.current || !skipInitialMapFitRef.current) return;
          if (preserveMapViewportRef.current) return;
          const coords = currentCoordsRef.current;
          const alignToCurrent = alignMapToCurrentLocationRef.current && coords;
          const center = alignToCurrent
            ? new naver.maps.LatLng(coords.latitude, coords.longitude)
            : jejuDowntownCenter;
          try {
            map.setCenter(center);
            map.setZoom(MAP_INITIAL_ZOOM);
          } catch {}
          if (alignToCurrent) {
            alignMapToCurrentLocationRef.current = false;
          }
        };
        applyInitialMapViewRef.current = applyInitialMapView;

        const fitMapToStores = () => {
          if (skipInitialMapFitRef.current || preserveMapViewportRef.current) return;
          const list = storesWithCoordsRef.current.filter(
            (s: StoreData) => Number.isFinite(s.lat) && Number.isFinite(s.lon)
          );
          const latLngs: any[] = list.map(
            (s: StoreData) => new naver.maps.LatLng(s.lat!, s.lon!)
          );
          // 검색·칩 필터 등: 현재 위치는 첫 접속·위치 새로고침 때만 bounds에 포함
          const fitSearchResultsOnly = searchQueryRef.current.trim().length > 0;
          const includeCurrentInFit =
            alignMapToCurrentLocationRef.current &&
            !fitSearchResultsOnly &&
            currentCoordsRef.current;
          if (includeCurrentInFit) {
            latLngs.push(
              new naver.maps.LatLng(
                currentCoordsRef.current.latitude,
                currentCoordsRef.current.longitude
              )
            );
          }
          if (latLngs.length === 0) {
            map.setCenter(jejuDowntownCenter);
            map.setZoom(MAP_INITIAL_ZOOM);
            return;
          }
          if (latLngs.length === 1) {
            map.setCenter(latLngs[0]);
            map.setZoom(MAP_INITIAL_ZOOM);
            if (includeCurrentInFit) {
              alignMapToCurrentLocationRef.current = false;
            }
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
          if (includeCurrentInFit) {
            alignMapToCurrentLocationRef.current = false;
          }
        };
        fitMapToStoresRef.current = fitMapToStores;

        naver.maps.Event.addListener(map, "dragend", () => {
          skipInitialMapFitRef.current = false;
          preserveMapViewportRef.current = false;
        });

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

        const morphMapView = (coord: any, zoom: number, onComplete?: () => void) => {
          const prevZoom = map.getZoom();
          if (typeof map.morph === "function") {
            map.morph(coord, zoom);
          } else {
            map.setCenter(coord);
            map.setZoom(zoom, true);
          }

          if (!onComplete) return;

          if (Math.abs(zoom - prevZoom) < 1e-6) {
            onComplete();
            return;
          }

          let finished = false;
          const finish = () => {
            if (finished) return;
            finished = true;
            onComplete();
          };

          const fallbackTimer = window.setTimeout(
            finish,
            MAP_CLUSTER_ZOOM_ANIM_MS + MAP_CLUSTER_ZOOM_FALLBACK_PAD_MS
          );

          naver.maps.Event.once(map, "zoomend", () => {
            window.clearTimeout(fallbackTimer);
            finish();
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

        const getMemberClusterGroups = (memberIds: string[]) => {
          const proj = map.getProjection();
          if (!proj) return null;
          const idSet = new Set(memberIds);
          const memberPins = storeMarkersRef.current
            .filter(({ id }) => idSet.has(id))
            .map(({ id, marker }) => {
              const pos = marker.getPosition();
              const pt = proj.fromCoordToOffset(pos);
              return {
                id,
                marker,
                pos,
                px: pt.x,
                py: pt.y,
                bounds: buildMarkerLabelRect(marker, proj),
              };
            });
          return groupPinsForClustering(memberPins, map.getZoom());
        };

        const isTargetClusterFullySplit = (memberIds: string[]) => {
          const groups = getMemberClusterGroups(memberIds);
          if (!groups?.length) return false;
          if (groups.length === 1 && groups[0].length === memberIds.length) return false;
          const represented = new Set<string>();
          groups.forEach((group) => group.forEach((pin) => represented.add(pin.id)));
          return represented.size === memberIds.length;
        };

        const renderExternalClustersWhileExpanding = (
          externalPins: ClusterPinItem[],
          zoom: number
        ) => {
          groupPinsForClustering(externalPins, zoom).forEach((cluster) => {
            if (cluster.length === 1) {
              cluster[0].marker.setMap(null);
              return;
            }
            addClusterBubble(cluster);
          });
        };

        const renderMemberClustersWhileExpanding = (
          memberPins: ClusterPinItem[],
          memberIds: string[]
        ) => {
          const memberGroups = groupPinsForClustering(memberPins, map.getZoom());
          const stillUnified =
            memberGroups.length === 1 && memberGroups[0].length === memberIds.length;

          memberGroups.forEach((cluster) => {
            if (stillUnified) {
              addClusterBubble(cluster);
              return;
            }
            if (cluster.length === 1) {
              resetMarkerSpiderfy(cluster[0].marker);
              cluster[0].marker.setMap(map);
              return;
            }
            addClusterBubble(cluster);
          });
        };

        const focusStoreOnMap = (storeId: string) => {
          const store = storesWithCoordsRef.current.find(
            (s: StoreData) => String(s.id) === String(storeId)
          );
          if (!store || !hasStoreCoords(store)) return;

          const sessionId = ++mapStoreFocusSessionRef.current;
          clusterExpansionSessionRef.current += 1;
          activeClusterExpansionRef.current = null;

          const coord = new naver.maps.LatLng(store.lat!, store.lon!);
          const isActive = () =>
            !isCancelled && mapStoreFocusSessionRef.current === sessionId;

          const finish = () => {
            if (!isActive()) return;
            const selectedMarker = storeMarkersRef.current.find(
              ({ id }) => String(id) === String(storeId)
            )?.marker;
            requestAnimationFrame(() => {
              if (!isActive()) return;
              panMapPinAboveSheet(
                map,
                naver,
                mapContainerRef.current,
                mapResearchButtonRef.current,
                mapSheetPanelHeightRef.current,
                selectedMarker
              );
              applySelectedPinStylesRef.current();
            });
          };

          const zoomStep = () => {
            if (!isActive()) return;

            const selected = storeMarkersRef.current.find(
              ({ id }) => String(id) === String(storeId)
            );
            // 개별 핀이 이미 노출되면 zoom 유지 + pan만
            if (selected?.marker.getMap()) {
              finish();
              return;
            }

            if (isMapAtMaxZoom(map)) {
              finish();
              return;
            }

            const prevZoom = map.getZoom();
            const nextZoom = Math.min(getMapMaxZoom(map), prevZoom + 1);
            morphMapView(coord, nextZoom, () => {
              if (!isActive()) return;
              if (mapClusteringEnabledRef.current) updateClusters();
              if (map.getZoom() <= prevZoom) {
                finish();
                return;
              }
              zoomStep();
            });
          };

          map.setCenter(coord);
          applySelectedPinStylesRef.current();

          if (map.getZoom() < 15) {
            morphMapView(coord, 15, () => {
              if (!isActive()) return;
              if (!mapClusteringEnabledRef.current) applyClustering();
              zoomStep();
            });
            return;
          }

          if (!mapClusteringEnabledRef.current) applyClustering();
          zoomStep();
        };

        focusStoreOnMapRef.current = focusStoreOnMap;

        const expandCluster = (memberIds: string[], centroid: any) => {
          const sessionId = ++clusterExpansionSessionRef.current;
          activeClusterExpansionRef.current = { memberIds, centroid };

          const isActive = () =>
            !isCancelled && clusterExpansionSessionRef.current === sessionId;

          const finishExpansion = () => {
            if (!isActive()) return;
            activeClusterExpansionRef.current = null;
            updateClusters();
          };

          const renderExpanding = () => {
            if (!isActive()) return;
            updateClusters();
          };

          const zoomStep = () => {
            if (!isActive()) return;

            if (isTargetClusterFullySplit(memberIds)) {
              finishExpansion();
              return;
            }

            if (isMapAtMaxZoom(map)) {
              finishExpansion();
              return;
            }

            const prevZoom = map.getZoom();
            const nextZoom = Math.min(getMapMaxZoom(map), prevZoom + 1);
            morphMapView(centroid, nextZoom, () => {
              if (!isActive()) return;
              renderExpanding();
              if (map.getZoom() <= prevZoom) {
                finishExpansion();
                return;
              }
              zoomStep();
            });
          };

          renderExpanding();
          zoomStep();
        };

        const addClusterBubble = (cluster: ClusterPinItem[]) => {
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
            expandCluster(
              cluster.map((member) => member.id),
              centroid
            );
          });
        };

        const updateClusters = () => {
          if (isCancelled) return;

          const allPins = storeMarkersRef.current;
          if (!allPins.length) return;

          const commitClusterLayout = () => {
            lastClusterLayoutZoomRef.current = map.getZoom();
          };

          if (!mapClusteringEnabledRef.current) {
            showAllStoreMarkers();
            commitClusterLayout();
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
              commitClusterLayout();
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
              commitClusterLayout();
            }
            return;
          }
          clusterRetryCount = 0;

          const activeExpansion = activeClusterExpansionRef.current;
          if (activeExpansion) {
            hideAllStoreMarkers();
            clearClusterMarkers();

            const expandingIdSet = new Set(activeExpansion.memberIds);
            const externalPins = pins.filter((pin) => !expandingIdSet.has(pin.id));
            const memberPins = pins.filter((pin) => expandingIdSet.has(pin.id));

            renderExternalClustersWhileExpanding(externalPins, currentZoom);
            renderMemberClustersWhileExpanding(memberPins, activeExpansion.memberIds);
            return;
          }

          storeMarkersRef.current.forEach(({ marker }) => resetMarkerSpiderfy(marker));

          if (isMapAtMaxZoom(map)) {
            clearClusterMarkers();
            const maxZoomClusters = groupPinsForClustering(pins, currentZoom);
            maxZoomClusters.forEach((cluster) => {
              if (cluster.length === 1) {
                resetMarkerSpiderfy(cluster[0].marker);
                cluster[0].marker.setMap(map);
              } else {
                spreadClusterMarkers(cluster);
              }
            });
            commitClusterLayout();
            return;
          }

          const clusters = groupPinsForClustering(pins, currentZoom);

          clusters.forEach((cluster) => {
            if (cluster.length === 1) {
              resetMarkerSpiderfy(cluster[0].marker);
              cluster[0].marker.setMap(map);
            } else {
              addClusterBubble(cluster);
            }
          });
          commitClusterLayout();
        };

        const applyPinsToMap = () => {
          if (isCancelled) return;
          clusterRetryCount = 0;
          mapClusteringEnabledRef.current = false;
          activeClusterExpansionRef.current = null;
          lastClusterLayoutZoomRef.current = null;

          syncStorePinsToMap();
          updateStoreLabels();
          hideAllStoreMarkers();
          scheduleApplyClustering();
        };

        rebuildStoreOverlaysRef.current = () => {
          if (isCancelled || !mapOverlaysReadyRef.current) return;
          if (!isMapViewRef.current) return;

          if (rebuildStoreOverlaysTimerRef.current) {
            clearTimeout(rebuildStoreOverlaysTimerRef.current);
          }

          rebuildStoreOverlaysTimerRef.current = setTimeout(() => {
            rebuildStoreOverlaysTimerRef.current = null;
            if (isCancelled || !mapOverlaysReadyRef.current) return;

            const skipDueToNext = skipNextFitMapRef.current;
            const skipDueToInitial = skipInitialMapFitRef.current;
            const skipDueToPreserve = preserveMapViewportRef.current;
            const skipFit = skipDueToNext || skipDueToInitial || skipDueToPreserve;
            if (skipDueToNext) {
              skipNextFitMapRef.current = false;
            }
            clusterRetryCount = 0;
            mapClusteringEnabledRef.current = false;
            activeClusterExpansionRef.current = null;
            lastClusterLayoutZoomRef.current = null;
            syncStorePinsToMap();
            updateStoreLabels();
            applySelectedPinStylesRef.current();
            hideAllStoreMarkers();
            if (!skipFit) {
              fitMapToStores();
              scheduleApplyClustering();
            } else {
              // 재검색·검색 지우기·뷰포트 고정 등: 핀만 갱신, 지도 위치는 유지
              applyClustering();
              if (skipDueToInitial && !skipDueToNext && !skipDueToPreserve) {
                applyInitialMapView();
              }
            }
          }, 100);
        };

        let mapBootstrapped = false;
        const bootstrapMapOverlays = () => {
          if (isCancelled || mapBootstrapped) return;
          mapBootstrapped = true;
          mapOverlaysReadyRef.current = true;
          if (!isMapViewRef.current) return;
          applyPinsToMap();
          applyInitialMapView();
        };

        const onMapIdle = () => {
          if (!mapBootstrapped) {
            bootstrapMapOverlays();
            return;
          }
          if (activeClusterExpansionRef.current) return;
          if (!mapClusteringEnabledRef.current) return;
          const zoom = map.getZoom();
          if (
            lastClusterLayoutZoomRef.current !== null &&
            Math.abs(zoom - lastClusterLayoutZoomRef.current) < 1e-6
          ) {
            return;
          }
          updateClusters();
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
        readyTimer = setTimeout(() => {
          mapReady = true;
        }, 600);
        naver.maps.Event.addListener(map, "idle", () => {
          if (!mapReady || isCancelled) return;
          setShowResearchButton(true);
        });
      } catch (error) {
      }
    };

    initializeMap();

    return () => {
      isCancelled = true;
      mapOverlaysReadyRef.current = false;
      mapClusteringEnabledRef.current = false;
      activeClusterExpansionRef.current = null;
      lastClusterLayoutZoomRef.current = null;
      rebuildStoreOverlaysRef.current = null;
      fitMapToStoresRef.current = null;
      applyInitialMapViewRef.current = null;
      skipInitialMapFitRef.current = true;
      focusStoreOnMapRef.current = () => {};
      mapStoreFocusSessionRef.current += 1;
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
  }, [locale]);

  useEffect(() => {
    currentCoordsRef.current = currentCoords;
  }, [currentCoords]);

  // 위치 확보 후: 첫 접속·위치 새로고침 때만 현재 위치로 지도 정렬
  useEffect(() => {
    if (!currentCoords || !isMapView || !mapInstanceRef.current) return;
    if (preserveMapViewportRef.current) return;
    if (!alignMapToCurrentLocationRef.current) return;
    if (skipInitialMapFitRef.current) {
      applyInitialMapViewRef.current?.();
      return;
    }
    const naver = (window as any).naver;
    if (!naver?.maps) return;
    const map = mapInstanceRef.current;
    map.setCenter(
      new naver.maps.LatLng(currentCoords.latitude, currentCoords.longitude)
    );
    if (mapOverlaysReadyRef.current && !skipNextFitMapRef.current) {
      fitMapToStoresRef.current?.();
    }
  }, [currentCoords, isMapView]);

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

  // 검색어·지도뷰 전환 시 bounds 맞춤 (검색 지우기는 지도 위치 유지)
  useEffect(() => {
    if (!isMapView) {
      prevSearchForMapFitRef.current = null;
      return;
    }

    const prev = prevSearchForMapFitRef.current;
    const trimmed = searchQuery.trim();

    // 카드뷰에서 검색 후 지도뷰 진입 등
    if (prev === null) {
      prevSearchForMapFitRef.current = searchQuery;
      if (trimmed) {
        setMapFilteredStores(null);
        setSelectedMapStoreId(null);
        setHighlightMapSheetCard(false);
        preserveMapViewportRef.current = false;
        skipInitialMapFitRef.current = false;
        skipNextFitMapRef.current = false;
      }
      return;
    }

    if (prev === searchQuery) return;
    prevSearchForMapFitRef.current = searchQuery;

    setMapFilteredStores(null);
    setSelectedMapStoreId(null);
    setHighlightMapSheetCard(false);

    if (!trimmed) {
      preserveMapViewportRef.current = true;
      skipNextFitMapRef.current = true;
      return;
    }

    preserveMapViewportRef.current = false;
    skipInitialMapFitRef.current = false;
    skipNextFitMapRef.current = false;
  }, [searchQuery, isMapView]);

  // storesWithCoords 변경 시 ref 업데이트 + 지도 핀 교체 (지도 재생성 없음)
  useEffect(() => {
    storesWithCoordsRef.current = storesWithCoords;
    if (!mapInstanceRef.current || !isMapView) return;

    const map = mapInstanceRef.current;
    const naver = (window as any).naver;

    const run = () => {
      rebuildStoreOverlaysRef.current?.();
    };

    if (mapOverlaysReadyRef.current) {
      run();
      return;
    }

    if (naver?.maps?.Event) {
      naver.maps.Event.once(map, "idle", run);
    }
  }, [isMapView, storesWithCoords]);

  // 핀·카드 선택 공통: 개별 매장 핀으로 보일 때까지 확대 + 시트 위 가운데 정렬
  useLayoutEffect(() => {
    if (!isMapView || !selectedMapStoreId || !mapInstanceRef.current) return;
    if (!mapOverlaysReadyRef.current) return;
    if (mapFocusGeneration === 0) return;

    const selectedId = String(selectedMapStoreId);
    const store = storesWithCoordsRef.current.find(
      (s: StoreData) => String(s.id) === selectedId
    );
    if (!store || !hasStoreCoords(store)) return;

    focusStoreOnMapRef.current(selectedId);
  }, [isMapView, selectedMapStoreId, mapFocusGeneration]);

  useEffect(() => {
    storeMarkersRef.current.forEach(({ id, marker }) => {
      const root = getMarkerPinContent(marker);
      const el = root?.querySelector("[data-store-label]") as HTMLElement | null;
      if (!el) return;
      const translated = mapPinLabels[id];
      const fallback = stores.find((s) => s.id === id)?.name ?? "";
      el.textContent = translated !== undefined && translated !== "" ? translated : fallback;
    });
  }, [mapPinLabels, stores]);

  useEffect(() => {
    applySelectedPinStyles();
  }, [selectedMapStoreId, applySelectedPinStyles]);


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
        <div
          className={cn(
            "fixed inset-x-0 top-0 z-[5] h-[calc(100dvh-4rem)] w-full bg-card",
            !isMapView && "invisible pointer-events-none"
          )}
          aria-hidden={!isMapView}
        >
          <div ref={mapContainerRef} className="map-container h-full w-full overflow-hidden" />
        </div>
        {!isMapView && <MainPromoBanner locale={locale} />}
        <div className={cn("mb-4 flex items-center gap-2", isMapView && "relative z-20 px-4")}>
          <div className="relative min-w-0 flex-1">
            <button
              type="button"
              onClick={() => {
                const input = searchInputRef.current;
                if (input) submitSearch(input);
                else setSearchQuery(searchInput);
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t.searchPlaceholder}
            >
              <Search className="w-5 h-5" />
            </button>
            <input
              ref={searchInputRef}
              type="text"
              inputMode="search"
              enterKeyHint="search"
              placeholder={t.searchPlaceholder}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onCompositionEnd={(e) => {
                const value = e.currentTarget.value;
                setSearchInput(value);
                if (pendingSearchSubmitRef.current) {
                  pendingSearchSubmitRef.current = false;
                  setSearchQuery(value);
                  e.currentTarget.blur();
                }
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (e.nativeEvent.isComposing) {
                  pendingSearchSubmitRef.current = true;
                  return;
                }
                submitSearch(e.currentTarget);
              }}
              className={cn(
                "w-full h-12 pl-10 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all",
                searchInput || searchQuery ? "pr-12" : "pr-3"
              )}
            />
            {(searchInput || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  preserveMapViewportRef.current = true;
                  skipNextFitMapRef.current = true;
                  setSearchInput("");
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-1 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
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
        <div
          className={cn("mb-6 space-y-3", isMapView && "relative z-20 px-4 pointer-events-none")}
        >
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
          <div className="space-y-2">
            {renderFilterChipRow(
              benefitFilterChipOrder,
              benefitFilterChips,
              toggleBenefitFilterChip,
              (t as any).benefitFilterToolbarAria ?? t.storeFilterToolbarAria
            )}
            {renderFilterChipRow(
              STORE_CATEGORY_CHIP_ORDER,
              categoryFilterChips,
              toggleCategoryFilterChip,
              (t as any).categoryFilterToolbarAria ?? t.storeFilterToolbarAria
            )}
          </div>
          {isMapView && showResearchButton && (
            <div className="pointer-events-none flex justify-center pt-0.5">
              <button
                ref={mapResearchButtonRef}
                type="button"
                onClick={handleResearch}
                disabled={isLoadingStores}
                className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-border/60 bg-card/95 px-4 py-2 text-sm font-medium shadow-md backdrop-blur-sm transition-all hover:bg-muted active:scale-95 disabled:opacity-50 animate-in fade-in zoom-in-95 duration-200"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                이 위치에서 재검색
              </button>
            </div>
          )}
        </div>

        {isMapView && mapSearchEmptyNotice && (
          <div
            className="pointer-events-none fixed inset-0 z-[35] flex items-center justify-center px-6"
            role="status"
            aria-live="polite"
          >
            <div className="rounded-xl border border-border bg-card/95 px-5 py-3 text-sm font-medium text-foreground shadow-lg backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
              {t.noSearchResults}
            </div>
          </div>
        )}

        {isMapView && (
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
        )}

        <div className={cn(isMapView && "hidden")} aria-hidden={isMapView}>
          {isLoadingStores ? (
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
            <div className="flex flex-col items-center justify-center gap-1 py-12 text-center">
              <p className="text-muted-foreground">{t.noStores}</p>
              <p className="text-sm text-muted-foreground/70">{t.noStoresHint}</p>
            </div>
          )}
        </div>
      </main>

      <BottomNav
        mapViewControl={{
          active: isMapView,
          onToggle: toggleMapView,
          disabled: false,
        }}
      />

      <MapViewBottomSheet
        className={cn(!isMapView && "invisible pointer-events-none")}
        aria-hidden={!isMapView}
        stores={storesWithCoords}
        selectedStoreId={selectedMapStoreId}
        highlightSelectedCard={highlightMapSheetCard}
        onSelectStoreFromCard={(store) => {
          if (store.detailUrl) {
            openStoreRedirect(store.detailUrl, {
              lat: store.lat,
              lon: store.lon,
              name: store.name,
            });
          }
          mapStoreFocusSessionRef.current += 1;
          setSelectedMapStoreId(String(store.id));
          setHighlightMapSheetCard(false);
          bumpMapFocus();
        }}
        onPanelHeightChange={handleMapSheetPanelHeightChange}
        onDraggingChange={handleMapSheetDraggingChange}
        title={t.mapSheetTitle}
        dragHint={t.mapSheetDragHint}
        sortBy={sortBy}
        onSortChange={setSortBy}
        sortDistanceLabel={currentCoords ? t.sortDistance : t.sortName}
        sortDiscountLabel={t.sortDiscount}
      />
    </div>
  );
};

export default Main;

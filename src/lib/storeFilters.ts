/**
 * 매장 필터 칩 분류와 매칭 판정.
 *
 * Main.tsx가 4,000줄 규모라 필터 판정 로직을 분리했다. 칩 ID 타입도 함께 옮겨
 * Main.tsx가 이 모듈을 단방향으로 참조하도록 했다(반대로 두면 순환 참조가 된다).
 */
import type { AppLocale } from "@/lib/locale";

export type StoreFilterChipId =
  | "all"
  | "chilsungro"
  | "localCurrency"
  | "highOilSupport"
  | "restaurant"
  | "cafe"
  | "shopping"
  | "other";

export const BENEFIT_FILTER_CHIP_ORDER: StoreFilterChipId[] = [
  "all",
  "chilsungro",
  "localCurrency",
  "highOilSupport",
];

export const STORE_CATEGORY_CHIP_ORDER: StoreFilterChipId[] = [
  "all",
  "restaurant",
  "cafe",
  "shopping",
  "other",
];

export type StoreAreaFilterChipId =
  | "all"
  | "areaChilsungro"
  | "areaJungangro"
  | "areaUndergroundMall";

export const STORE_AREA_FILTER_CHIP_ORDER: StoreAreaFilterChipId[] = [
  "all",
  "areaChilsungro",
  "areaJungangro",
  "areaUndergroundMall",
];

export type LegacyBenefitFilterChipId = StoreFilterChipId | "openNow";

export const LEGACY_BENEFIT_FILTER_CHIP_ORDER: LegacyBenefitFilterChipId[] = [
  "all",
  "chilsungro",
  "localCurrency",
  "highOilSupport",
  "openNow",
];

export type StoreLikeForChip = {
  image: string;
  categoryGroupCode?: string;
  categoryName?: string;
  area?: string | null;
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

export function imageFromStoreCategory(category?: string | null): string {
  if (!category) return "other";
  if (category.includes("카페") || category.includes("디저트")) return "cafe";
  if (category.includes("쇼핑")) return "shopping";
  if (category.includes("음식")) return "restaurant";
  return "other";
}

export function categoryGroupCodeFromStoreCategory(category?: string | null): string {
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

export function storeMatchesBenefitChipFilters(
  store: StoreLikeForChip,
  chips: ReadonlySet<LegacyBenefitFilterChipId>,
  locale: AppLocale
): boolean {
  // openNow는 제거됨 — 혜택 칩만 매칭
  if (chips.has("all")) return true;

  const parts: boolean[] = [];
  if (chips.has("chilsungro")) parts.push(storeHasChilsungroCoupon(store));
  if (chips.has("localCurrency")) parts.push(!!store.local_currency_available);
  if (locale === "ko" && chips.has("highOilSupport")) {
    parts.push(storeHasHighOilSupport(store));
  }

  return parts.length > 0 && parts.some(Boolean);
}

export function storeMatchesAreaChipFilters(
  store: StoreLikeForChip,
  chips: ReadonlySet<StoreAreaFilterChipId>
): boolean {
  if (chips.has("all")) return true;

  const parts: boolean[] = [];
  if (chips.has("areaChilsungro")) parts.push(store.area === "칠성로");
  if (chips.has("areaJungangro")) parts.push(store.area === "중앙로");
  if (chips.has("areaUndergroundMall")) parts.push(store.area === "지하상가");

  return parts.length > 0 && parts.some(Boolean);
}

export function storeMatchesCategoryChipFilters(
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

/** 현재 선택된 칩 3종 */
export type StoreChipSelection = {
  area: ReadonlySet<StoreAreaFilterChipId>;
  benefit: ReadonlySet<LegacyBenefitFilterChipId>;
  category: ReadonlySet<StoreFilterChipId>;
};

/**
 * 구역·혜택·카테고리 칩을 모두 만족하는가.
 * 같은 조합이 목록 memo와 지도 재검색에 각각 구현돼 있어 하나로 모았다.
 */
export function storeMatchesAllChipFilters(
  store: StoreLikeForChip,
  chips: StoreChipSelection,
  locale: AppLocale,
): boolean {
  return (
    storeMatchesAreaChipFilters(store, chips.area) &&
    storeMatchesBenefitChipFilters(store, chips.benefit, locale) &&
    storeMatchesCategoryChipFilters(store, chips.category)
  );
}

/** 매장명 부분 일치 검색. 빈 질의면 원본을 그대로 돌려준다. */
export function filterStoresByName<T extends { name: string }>(
  stores: T[],
  query: string,
): T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return stores;
  return stores.filter((store) => store.name.toLowerCase().includes(normalized));
}

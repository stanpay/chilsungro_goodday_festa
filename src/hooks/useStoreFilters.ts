/**
 * 매장 필터 칩 상태.
 *
 * Main.tsx 분해 4단계. 칩 3종(구역·혜택·카테고리)의 선택 상태와 토글 규칙,
 * 로케일에 따른 노출 순서를 한곳에 모았다. 파생 목록 계산은 호출부에 남겨
 * 이 훅은 "무엇이 선택됐는가"만 책임진다.
 */
import { useEffect, useMemo, useState } from "react";
import type { AppLocale } from "@/lib/locale";
import {
  BENEFIT_FILTER_CHIP_ORDER,
  LEGACY_BENEFIT_FILTER_CHIP_ORDER,
  type LegacyBenefitFilterChipId,
  type StoreAreaFilterChipId,
  type StoreFilterChipId,
} from "@/lib/storeFilters";

/**
 * 칩 선택 토글 규칙.
 * "all"은 단독 선택이고, 나머지는 다중 선택이며, 모두 해제되면 "all"로 돌아간다.
 * 구역·카테고리·(레거시가 아닌) 혜택 칩이 같은 규칙을 쓴다.
 */
function toggleChipSelection<T extends string>(
  prev: ReadonlySet<T>,
  id: T,
  allId: T,
): Set<T> {
  if (id === allId) return new Set<T>([allId]);

  const next = new Set(prev);
  next.delete(allId);
  if (next.has(id)) next.delete(id);
  else next.add(id);

  if (next.size === 0) next.add(allId);
  return next;
}

type UseStoreFiltersOptions = {
  locale: AppLocale;
  /** 3단 가로 칩 행(레거시 데모) — openNow 칩이 추가된다 */
  legacyFilterUI: boolean;
};

export function useStoreFilters({ locale, legacyFilterUI }: UseStoreFiltersOptions) {
  const [benefitFilterChips, setBenefitFilterChips] = useState<Set<LegacyBenefitFilterChipId>>(
    () =>
      new Set<LegacyBenefitFilterChipId>(
        legacyFilterUI ? ["all", "openNow"] : ["all"]
      )
  );
  const [areaFilterChips, setAreaFilterChips] = useState<Set<StoreAreaFilterChipId>>(
    () => new Set<StoreAreaFilterChipId>(["all"])
  );
  const [categoryFilterChips, setCategoryFilterChips] = useState<Set<StoreFilterChipId>>(
    () => new Set<StoreFilterChipId>(["all"])
  );

  useEffect(() => {
    if (locale === "ko") return;
    setBenefitFilterChips((prev) => {
      if (!prev.has("highOilSupport")) return prev;
      const next = new Set(prev);
      next.delete("highOilSupport");
      return next;
    });
  }, [locale]);

  const benefitFilterChipOrder = useMemo((): readonly LegacyBenefitFilterChipId[] => {
    if (legacyFilterUI) {
      return locale === "ko"
        ? LEGACY_BENEFIT_FILTER_CHIP_ORDER
        : LEGACY_BENEFIT_FILTER_CHIP_ORDER.filter((id) => id !== "highOilSupport");
    }
    return locale === "ko"
      ? BENEFIT_FILTER_CHIP_ORDER
      : BENEFIT_FILTER_CHIP_ORDER.filter((id) => id !== "highOilSupport");
  }, [locale, legacyFilterUI]);

  const toggleAreaFilter = (id: StoreAreaFilterChipId) => {
    setAreaFilterChips((prev) => toggleChipSelection(prev, id, "all"));
  };

  const toggleBenefitFilter = (id: LegacyBenefitFilterChipId) => {
    setBenefitFilterChips((prev) => {
      if (legacyFilterUI) {
        const next = new Set(prev);

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

        const selectedBenefitChips = new Set([...next].filter((c) => c !== "openNow"));
        if (selectedBenefitChips.size === 0) next.add("all");

        return next;
      }

      // 레거시 UI가 아니면 openNow 칩 자체가 없다
      if (id === "openNow") return prev;
      return toggleChipSelection(prev, id, "all");
    });
  };

  const toggleCategoryFilter = (id: StoreFilterChipId) => {
    setCategoryFilterChips((prev) => toggleChipSelection(prev, id, "all"));
  };

  return {
    benefitFilterChips,
    setBenefitFilterChips,
    areaFilterChips,
    setAreaFilterChips,
    categoryFilterChips,
    setCategoryFilterChips,
    benefitFilterChipOrder,
    toggleAreaFilter,
    toggleBenefitFilter,
    toggleCategoryFilter,
  };
}

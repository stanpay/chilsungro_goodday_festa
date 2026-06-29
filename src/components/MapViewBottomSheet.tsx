import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { GripHorizontal, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import StoreCard from "@/components/StoreCard";
import StoreCardSkeleton from "@/components/StoreCardSkeleton";
import { AutoFitMarquee } from "@/components/AutoFitMarquee";

export const MAP_VIEW_SHEET_BOTTOM_NAV_PX = 64;
export const MAP_VIEW_SHEET_PEEK_HEIGHT = 60;
const BOTTOM_NAV_PX = MAP_VIEW_SHEET_BOTTOM_NAV_PX;
/** 상단(노치·패딩) 최소 여백 — 시트를 최대로 올려도 이 정도는 남김 */
const TOP_RESERVE_PX = 16;
/** 당기기 전: 핸들(슬라이더) 줄만 노출 */
const PEEK_HEIGHT = MAP_VIEW_SHEET_PEEK_HEIGHT;
/** 펼침 후: 핸들 막대만 노출 (h-4 py-1) */
const EXPANDED_HANDLE_HEIGHT = 16;
const CONTENT_REVEAL_EXTRA = 36;
const MIN_EXPANDED = 280;
/** 피크에서 핸들을 살짝만 위로 당겨도 펼쳐지도록 낮은 스냅 기준(px) */
const SLIGHT_EXPAND_FROM_PEEK_PX = 10;
/** 1행 스냅에서 살짝만 위로 당겨도 전체 펼침으로 스냅 */
const SLIGHT_EXPAND_FROM_SINGLE_ROW_PX = 10;
/** 펼쳐진 상태에서 이만큼 내리면 바로 접힘 (핸들 드래그) */
const COLLAPSE_FROM_EXPANDED_PX = 30;
/** StoreCard 고정 높이: h-28(112) + 본문 그리드·패딩(128) */
const STORE_CARD_HEIGHT_PX = 240;
/** 1행 스냅 시트 높이 = 핸들 + 헤더 + 카드 스크롤(240+pb-3) */
const MAP_VIEW_SHEET_HEADER_PX = 40;
/** 제거한 pb-3(0.75rem) 만큼 스크롤 뷰포트 확장 */
const MAP_VIEW_SHEET_SINGLE_ROW_SCROLL_EXTRA_PX = 12;
/** 카드 높이 + 하단 여유(구 pb-3) */
const MAP_VIEW_SHEET_SINGLE_ROW_SCROLL_PX =
  STORE_CARD_HEIGHT_PX + MAP_VIEW_SHEET_SINGLE_ROW_SCROLL_EXTRA_PX;
/** 별도 스크롤바 트랙 너비 */
const MAP_VIEW_SHEET_SCROLLBAR_PX = 4;
/** 카드 1행만 보이도록 고정 (동적 측정 없음) */
export const MAP_VIEW_SHEET_SINGLE_ROW_HEIGHT =
  EXPANDED_HANDLE_HEIGHT + MAP_VIEW_SHEET_HEADER_PX + MAP_VIEW_SHEET_SINGLE_ROW_SCROLL_PX;

export type MapSheetStore = {
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
  detailUrl?: string;
};

type MapViewBottomSheetProps = {
  stores: MapSheetStore[];
  selectedStoreId: string | null;
  /** true일 때만 선택 매장 카드에 보라색 테두리 (핀 클릭 시) */
  highlightSelectedCard?: boolean;
  /** 카드 클릭 시 매장 선택/지도 이동/리다이렉트 처리 */
  onSelectStoreFromCard?: (store: MapSheetStore) => void;
  title: string;
  dragHint: string;
  sortBy: "distance" | "discount";
  onSortChange: (sort: "distance" | "discount") => void;
  sortDistanceLabel: string;
  sortDiscountLabel: string;
  /** 시트 높이 변경 시 (지도 핀 위치 보정용) — 드래그 중에는 호출되지 않음 */
  onPanelHeightChange?: (height: number) => void;
  /** 시트 드래그 시작/종료 (지도 제스처 차단용) */
  onDraggingChange?: (dragging: boolean) => void;
  /** 모바일 지도뷰 검색 중 바텀시트 숨김 (내부 높이·스크롤은 유지) */
  hideForMapSearch?: boolean;
  /** 전체 매장 수 (목록에는 stores만 렌더, 헤더 카운트용) */
  totalStoreCount?: number;
  hasMoreStores?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  className?: string;
  "aria-hidden"?: boolean;
};

const MapViewBottomSheet = ({
  stores,
  selectedStoreId,
  highlightSelectedCard = false,
  onSelectStoreFromCard,
  title,
  dragHint,
  sortBy,
  onSortChange,
  sortDistanceLabel,
  sortDiscountLabel,
  onPanelHeightChange,
  onDraggingChange,
  hideForMapSearch = false,
  totalStoreCount,
  hasMoreStores = false,
  onLoadMore,
  isLoadingMore = false,
  className,
  "aria-hidden": ariaHidden,
}: MapViewBottomSheetProps) => {
  const expandedCap = useCallback(() => {
    if (typeof window === "undefined") return 800;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    return Math.round(vh - BOTTOM_NAV_PX - TOP_RESERVE_PX);
  }, []);

  const [panelHeight, setPanelHeight] = useState(PEEK_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);
  const [heightTransitionEnabled, setHeightTransitionEnabled] = useState(false);
  const panelHeightRef = useRef(PEEK_HEIGHT);
  const dragRef = useRef<{
    startY: number;
    startH: number;
    dragging: boolean;
    hitMaxY?: number;
  } | null>(null);
  const cardWrapRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const scrollTrackRef = useRef<HTMLDivElement>(null);
  const scrollThumbRef = useRef<HTMLDivElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  /** 선택 매장으로 스크롤은 매장당 최초 1회만 */
  const scrollSyncedStoreIdRef = useRef<string | null>(null);
  const prevSelectedStoreIdRef = useRef<string | null>(null);
  const reportedPanelHeightRef = useRef(panelHeight);
  const maxHeightRef = useRef(0);
  const bodyGestureRef = useRef<{
    startY: number;
    lastY: number;
    startH: number;
    mode: "pending" | "sheet" | "scroll";
  } | null>(null);
  const hideForMapSearchRef = useRef(hideForMapSearch);
  hideForMapSearchRef.current = hideForMapSearch;

  panelHeightRef.current = panelHeight;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setHeightTransitionEnabled(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const contentRevealThreshold = PEEK_HEIGHT + CONTENT_REVEAL_EXTRA;
  const showContent = panelHeight > contentRevealThreshold;
  const isSingleRowPanel =
    showContent && panelHeight <= MAP_VIEW_SHEET_SINGLE_ROW_HEIGHT + 8;

  /** 1행 스냅 상태에서도 목록 스크롤 우선 (맨 위에서 아래로 당길 때만 시트 드래그) */
  const shouldPreferCardScroll = useCallback(
    (sb: HTMLDivElement, currentH: number) => {
      const atSingleRowSnap = currentH <= MAP_VIEW_SHEET_SINGLE_ROW_HEIGHT + 8;
      return atSingleRowSnap && sb.scrollHeight > sb.clientHeight + 2;
    },
    []
  );

  const snapToSingleRow = useCallback(() => {
    const target = Math.min(MAP_VIEW_SHEET_SINGLE_ROW_HEIGHT, expandedCap());
    panelHeightRef.current = target;
    setPanelHeight(target);
  }, [expandedCap]);

  const updateScrollThumb = useCallback(() => {
    const sb = scrollBodyRef.current;
    const track = scrollTrackRef.current;
    const thumb = scrollThumbRef.current;
    if (!sb || !track || !thumb) return;

    const { scrollTop, scrollHeight, clientHeight } = sb;
    const canScroll = scrollHeight > clientHeight + 1;

    track.style.opacity = canScroll ? "1" : "0";
    if (!canScroll) return;

    const trackHeight = clientHeight;
    const thumbHeight = Math.max(32, (clientHeight / scrollHeight) * trackHeight);
    const maxTop = trackHeight - thumbHeight;
    const scrollRange = scrollHeight - clientHeight;
    const top = scrollRange > 0 ? (scrollTop / scrollRange) * maxTop : 0;

    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translateY(${top}px)`;
  }, []);

  useEffect(() => {
    if (!showContent) {
      if (scrollBodyRef.current) scrollBodyRef.current.scrollTop = 0;
    }
  }, [showContent]);

  useEffect(() => {
    const onResize = () => {
      if (hideForMapSearchRef.current) return;
      const cap = expandedCap();
      setPanelHeight((h) => Math.min(h, cap));
      if (Math.abs(panelHeightRef.current - MAP_VIEW_SHEET_SINGLE_ROW_HEIGHT) <= 8) {
        const target = Math.min(MAP_VIEW_SHEET_SINGLE_ROW_HEIGHT, cap);
        panelHeightRef.current = target;
        setPanelHeight(target);
      }
    };
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, [expandedCap]);

  const scrollSelectedStoreRowIntoView = useCallback(() => {
    if (!selectedStoreId || !showContent) return;
    const sb = scrollBodyRef.current;
    if (!sb) return;

    const index = stores.findIndex((s) => s.id === selectedStoreId);
    if (index < 0) return;

    const rowIndex = Math.floor(index / 2);
    const rowLeadId = stores[rowIndex * 2]?.id ?? selectedStoreId;
    const rowEl = cardWrapRefs.current.get(rowLeadId) ?? cardWrapRefs.current.get(selectedStoreId);
    if (!rowEl) return;

    const sbRect = sb.getBoundingClientRect();
    const rowRect = rowEl.getBoundingClientRect();
    const rowRelTop = rowRect.top - sbRect.top + sb.scrollTop;
    const maxScroll = Math.max(0, sb.scrollHeight - sb.clientHeight);
    sb.scrollTo({
      top: Math.max(0, Math.min(maxScroll, rowRelTop)),
      behavior: "smooth",
    });
  }, [selectedStoreId, showContent, stores]);

  // 핀 선택 시에만 시트 높이를 카드 1행 분량으로 스냅
  useLayoutEffect(() => {
    if (!selectedStoreId || !highlightSelectedCard) {
      if (!selectedStoreId) prevSelectedStoreIdRef.current = null;
      return;
    }

    if (prevSelectedStoreIdRef.current === selectedStoreId) return;
    prevSelectedStoreIdRef.current = selectedStoreId;
    scrollSyncedStoreIdRef.current = null;

    snapToSingleRow();
  }, [selectedStoreId, highlightSelectedCard, snapToSingleRow]);

  // 핀 선택 시에만 해당 행으로 스크롤 (최초 1회)
  useEffect(() => {
    if (!selectedStoreId || !highlightSelectedCard) {
      if (!selectedStoreId) scrollSyncedStoreIdRef.current = null;
      return;
    }
    if (!showContent || scrollSyncedStoreIdRef.current === selectedStoreId) return;
    if (stores.findIndex((s) => s.id === selectedStoreId) < 0) return;

    const frame = requestAnimationFrame(() => {
      scrollSyncedStoreIdRef.current = selectedStoreId;
      scrollSelectedStoreRowIntoView();
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedStoreId, highlightSelectedCard, showContent, stores, scrollSelectedStoreRowIntoView]);

  useLayoutEffect(() => {
    if (isDragging || hideForMapSearch) return;
    if (reportedPanelHeightRef.current === panelHeight) return;
    reportedPanelHeightRef.current = panelHeight;
    onPanelHeightChange?.(panelHeight);
  }, [panelHeight, isDragging, hideForMapSearch, onPanelHeightChange]);

  useEffect(() => {
    onDraggingChange?.(isDragging);
  }, [isDragging, onDraggingChange]);

  useEffect(() => {
    return () => onDraggingChange?.(false);
  }, [onDraggingChange]);

  useEffect(() => {
    if (!hasMoreStores || !onLoadMore) return;
    const sentinel = loadMoreSentinelRef.current;
    const root = scrollBodyRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { root, rootMargin: "120px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreStores, onLoadMore, stores.length]);

  const maxHeight = Math.max(MIN_EXPANDED, expandedCap());
  maxHeightRef.current = maxHeight;

  const collapseToPeek = useCallback(() => {
    panelHeightRef.current = PEEK_HEIGHT;
    setPanelHeight(PEEK_HEIGHT);
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  useLayoutEffect(() => {
    if (hideForMapSearch) {
      reportedPanelHeightRef.current = PEEK_HEIGHT;
      onPanelHeightChange?.(PEEK_HEIGHT);
      return;
    }
    if (reportedPanelHeightRef.current === panelHeightRef.current) return;
    reportedPanelHeightRef.current = panelHeightRef.current;
    onPanelHeightChange?.(panelHeightRef.current);
  }, [hideForMapSearch, onPanelHeightChange]);

  const displayHeight = hideForMapSearch ? 0 : panelHeight;

  const startDrag = (clientY: number) => {
    dragRef.current = {
      startY: clientY,
      startH: panelHeightRef.current,
      dragging: true,
    };
    setIsDragging(true);
  };

  const moveDrag = (clientY: number) => {
    const d = dragRef.current;
    if (!d?.dragging) return;

    const max = maxHeightRef.current || maxHeight;

    const delta = d.startY - clientY;
    const rawNext = d.startH + delta;
    const next = Math.round(Math.min(max, Math.max(PEEK_HEIGHT, rawNext)));

    panelHeightRef.current = next;
    setPanelHeight(next);

    if (next >= max - 1) {
      if (d.hitMaxY === undefined) d.hitMaxY = clientY;

      const overshoot = Math.max(0, d.hitMaxY - clientY);
      const sb = scrollBodyRef.current;

      if (sb) {
        const maxScroll = Math.max(0, sb.scrollHeight - sb.clientHeight);
        sb.scrollTop = Math.min(maxScroll, overshoot);
      }
    } else {
      d.hitMaxY = undefined;
    }
  };

  const onBodyTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;

    bodyGestureRef.current = {
      startY: e.touches[0].clientY,
      lastY: e.touches[0].clientY,
      startH: panelHeightRef.current,
      mode: "pending",
    };
  };

  const onBodyTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const g = bodyGestureRef.current;
    const sb = scrollBodyRef.current;

    if (!g || !sb || e.touches.length !== 1) return;

    const y = e.touches[0].clientY;
    const dyFromStart = y - g.startY;
    const dyFromLast = y - g.lastY;

    const maxH = maxHeightRef.current;
    const currentH = panelHeightRef.current;

    const isSheetNotFull = currentH < maxH - 2;
    const isAtTop = sb.scrollTop <= 1;
    const draggingDown = dyFromStart > 0;
    const preferCardScroll = shouldPreferCardScroll(sb, currentH);

    if (g.mode === "pending") {
      if (preferCardScroll) {
        if (isAtTop && draggingDown) {
          g.mode = "sheet";
          startDrag(g.startY);
        } else {
          g.mode = "scroll";
        }
      } else if (isSheetNotFull) {
        g.mode = "sheet";
        dragRef.current = {
          startY: g.startY,
          startH: g.startH,
          dragging: true,
        };
        setIsDragging(true);
      } else if (isAtTop && draggingDown) {
        g.mode = "sheet";
        startDrag(g.startY);
      } else {
        g.mode = "scroll";
      }
    }

    if (g.mode === "scroll") {
      if (sb.scrollTop <= 1 && dyFromLast > 0) {
        g.mode = "sheet";
        startDrag(y);
      } else {
        g.lastY = y;
        return;
      }
    }

    if (g.mode === "sheet") {
      e.preventDefault();
      moveDrag(y);
    }

    g.lastY = y;
  };

  const endDrag = () => {
    const d = dragRef.current;
    const was = d?.dragging;
    const startH = d?.startH ?? panelHeightRef.current;

    dragRef.current = null;
    setIsDragging(false);

    if (!was) return;

    const max = maxHeightRef.current || maxHeight;
    const h = panelHeightRef.current;

    const startedPeek = startH <= PEEK_HEIGHT + 2;

    if (startedPeek && h >= startH + SLIGHT_EXPAND_FROM_PEEK_PX) {
      snapToSingleRow();
      return;
    }

    const startedSingleRow = startH <= MAP_VIEW_SHEET_SINGLE_ROW_HEIGHT + 8;

    if (startedSingleRow && h >= startH + SLIGHT_EXPAND_FROM_SINGLE_ROW_PX) {
      panelHeightRef.current = max;
      setPanelHeight(max);
      return;
    }

    const startedExpanded = startH >= max - 2;

    if (startedExpanded && startH - h >= COLLAPSE_FROM_EXPANDED_PX) {
      collapseToPeek();
      return;
    }

    const singleRow = Math.min(MAP_VIEW_SHEET_SINGLE_ROW_HEIGHT, max);
    const peekMid = (PEEK_HEIGHT + singleRow) / 2;
    const expandMid = (singleRow + max) / 2;

    let snapped = PEEK_HEIGHT;
    if (h >= expandMid) snapped = max;
    else if (h >= peekMid) snapped = singleRow;

    panelHeightRef.current = snapped;
    setPanelHeight(snapped);
  };

  const onBodyTouchEnd = () => {
    const mode = bodyGestureRef.current?.mode;
    bodyGestureRef.current = null;

    if (mode === "sheet") {
      endDrag();
    }
  };

  const onPointerDownHandle = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startDrag(e.clientY);
  };

  const onPointerMoveHandle = (e: React.PointerEvent) => {
    if (!dragRef.current?.dragging) return;
    e.preventDefault();
    e.stopPropagation();
    moveDrag(e.clientY);
  };

  const onPointerUpHandle = (e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    endDrag();
  };

  useEffect(() => {
    if (!showContent) return;

    const sb = scrollBodyRef.current;
    if (!sb) return;

    updateScrollThumb();
    sb.addEventListener("scroll", updateScrollThumb, { passive: true });

    const ro = new ResizeObserver(updateScrollThumb);
    ro.observe(sb);

    return () => {
      sb.removeEventListener("scroll", updateScrollThumb);
      ro.disconnect();
    };
  }, [showContent, stores.length, updateScrollThumb]);

  useEffect(() => {
    if (!showContent) return;

    const sb = scrollBodyRef.current;
    if (!sb) return;

    let lastScrollTop = sb.scrollTop;

    const onScroll = () => {
      const top = sb.scrollTop;
      const max = maxHeightRef.current;
      const isExpanded = panelHeightRef.current >= max - 2;

      if (isExpanded && lastScrollTop > 1 && top <= 1 && !dragRef.current?.dragging) {
        collapseToPeek();
      }

      lastScrollTop = top;
    };

    sb.addEventListener("scroll", onScroll, { passive: true });
    return () => sb.removeEventListener("scroll", onScroll);
  }, [showContent, collapseToPeek]);

  useEffect(() => {
    if (!showContent) return;

    const sb = scrollBodyRef.current;
    if (!sb) return;

    let startY = 0;
    let lastY = 0;
    let startH = 0;
    let mode: "idle" | "sheet" | "scroll" = "idle";

    const THRESHOLD = 4;

    const startSheetDrag = (anchorY: number, anchorH: number) => {
      mode = "sheet";
      dragRef.current = {
        startY: anchorY,
        startH: anchorH,
        dragging: true,
      };
      setIsDragging(true);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;

      const y = e.touches[0].clientY;

      startY = y;
      lastY = y;
      startH = panelHeightRef.current;
      mode = "idle";
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;

      const y = e.touches[0].clientY;
      const totalDy = y - startY;
      const stepDy = y - lastY;

      if (Math.abs(totalDy) < THRESHOLD) {
        lastY = y;
        return;
      }

      const max = maxHeightRef.current;
      const currentH = panelHeightRef.current;

      const isSheetNotFull = currentH < max - 2;
      const isAtTop = sb.scrollTop <= 1;
      const draggingDown = totalDy > 0;
      const preferCardScroll = shouldPreferCardScroll(sb, currentH);

      if (mode === "idle") {
        if (preferCardScroll) {
          if (isAtTop && draggingDown) {
            startSheetDrag(startY, startH);
          } else {
            mode = "scroll";
          }
        } else if (isSheetNotFull) {
          startSheetDrag(startY, startH);
        } else if (isAtTop && draggingDown) {
          startSheetDrag(startY, startH);
        } else {
          mode = "scroll";
        }
      }

      if (mode === "scroll") {
        if (sb.scrollTop <= 1 && stepDy > 0) {
          startY = y;
          startH = panelHeightRef.current;
          startSheetDrag(startY, startH);

          e.preventDefault();
          lastY = y;
          return;
        }

        lastY = y;
        return;
      }

      if (mode === "sheet") {
        e.preventDefault();
        moveDrag(y);
      }

      lastY = y;
    };

    const onTouchEnd = () => {
      if (mode === "sheet") {
        endDrag();
      }

      mode = "idle";
    };

    sb.addEventListener("touchstart", onTouchStart, { passive: true });
    sb.addEventListener("touchmove", onTouchMove, { passive: false });
    sb.addEventListener("touchend", onTouchEnd, { passive: true });
    sb.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      sb.removeEventListener("touchstart", onTouchStart);
      sb.removeEventListener("touchmove", onTouchMove);
      sb.removeEventListener("touchend", onTouchEnd);
      sb.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [showContent, shouldPreferCardScroll]);

  return (
    <div
      aria-hidden={ariaHidden}
      className={cn(
        "fixed left-0 right-0 z-[45] mx-auto flex max-w-md flex-col overflow-hidden rounded-t-2xl border border-border/80 bg-card/98 shadow-[0_-8px_32px_rgba(0,0,0,0.12)] backdrop-blur-md",
        isDragging && "touch-none",
        hideForMapSearch && "pointer-events-none border-transparent shadow-none",
        className
      )}
      style={{
        bottom: BOTTOM_NAV_PX,
        height: displayHeight,
        opacity: hideForMapSearch ? 0 : 1,
        maxHeight: hideForMapSearch
          ? 0
          : `min(${maxHeight}px, calc(100dvh - ${BOTTOM_NAV_PX}px - max(0.5rem, env(safe-area-inset-top, 0px)) - 8px))`,
        transition:
          isDragging || !heightTransitionEnabled
            ? "none"
            : "height 0.22s ease-out, opacity 0.18s ease-out",
      }}
    >
      <div
        role="slider"
        aria-valuemin={PEEK_HEIGHT}
        aria-valuemax={maxHeight}
        aria-valuenow={Math.round(panelHeight)}
        aria-label={dragHint}
        className={cn(
          "flex shrink-0 cursor-grab touch-none flex-col items-center justify-center px-2 active:cursor-grabbing",
          showContent
            ? "h-4 py-1"
            : "h-[60px] py-1.5"
        )}
        onPointerDown={onPointerDownHandle}
        onPointerMove={onPointerMoveHandle}
        onPointerUp={onPointerUpHandle}
        onPointerCancel={onPointerUpHandle}
      >
        <div
          className={cn(
            "h-1 w-10 shrink-0 rounded-full bg-muted-foreground/35",
            !showContent && "mb-0.5"
          )}
        />
        {!showContent && (
          <>
            <GripHorizontal
              className="h-4 w-4 shrink-0 text-muted-foreground/70"
              aria-hidden
            />
            <AutoFitMarquee
              as="p"
              text={dragHint}
              className="mt-0.5 w-full"
              textClassName="text-center text-muted-foreground"
              fontSizeClasses={["text-[10px]"]}
            />
          </>
        )}
      </div>

      {showContent && (
        <>
          <div
            className="flex h-10 shrink-0 cursor-grab touch-none items-center justify-between px-3 active:cursor-grabbing"
            onPointerDown={onPointerDownHandle}
            onPointerMove={onPointerMoveHandle}
            onPointerUp={onPointerUpHandle}
            onPointerCancel={onPointerUpHandle}
          >
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSortChange(sortBy === "distance" ? "discount" : "distance")}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerLeave={(event) => event.currentTarget.blur()}
                onPointerCancel={(event) => event.currentTarget.blur()}
                onPointerUp={(event) => event.currentTarget.blur()}
                className="flex cursor-pointer items-center gap-1 rounded-full border border-border/60 bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus:bg-muted/60 focus:text-foreground focus:outline-none active:bg-muted/60 active:text-foreground"
              >
                <ArrowUpDown className="h-3 w-3" />
                {sortBy === "distance" ? sortDistanceLabel : sortDiscountLabel}
              </button>
              <span className="text-xs text-muted-foreground">
                {totalStoreCount ?? stores.length}
              </span>
            </div>
          </div>

          <div
            className={cn(
              "relative min-h-0 overscroll-contain",
              isSingleRowPanel ? "shrink-0" : "flex-1"
            )}
            style={
              isSingleRowPanel
                ? { height: MAP_VIEW_SHEET_SINGLE_ROW_SCROLL_PX }
                : undefined
            }
          >
            <div
              ref={scrollBodyRef}
              className={cn(
                "scrollbar-hide min-h-0 overflow-y-auto overscroll-contain px-3",
                !isSingleRowPanel && "h-full"
              )}
              style={{
                WebkitOverflowScrolling: "touch",
                overscrollBehaviorY: "contain",
                ...(isSingleRowPanel
                  ? { height: MAP_VIEW_SHEET_SINGLE_ROW_SCROLL_PX }
                  : {}),
              }}
            >
              <div
                className={cn(
                  "grid grid-cols-2 gap-3",
                  isSingleRowPanel ? "pb-0" : "pb-1"
                )}
                style={{ gridAutoRows: isSingleRowPanel ? `${STORE_CARD_HEIGHT_PX}px` : "1fr" }}
              >
                {stores.map((store) => (
                  <div
                    key={store.id}
                    ref={(node) => {
                      if (node) cardWrapRefs.current.set(store.id, node);
                      else cardWrapRefs.current.delete(store.id);
                    }}
                    className={cn(
                      "rounded-lg transition-[box-shadow,transform]",
                      isSingleRowPanel ? "h-[240px]" : "h-full"
                    )}
                  >
                    <StoreCard
                      {...store}
                      isHighlighted={highlightSelectedCard && selectedStoreId === store.id}
                      onActivate={() => onSelectStoreFromCard?.(store)}
                    />
                  </div>
                ))}
                {hasMoreStores && (
                  <div ref={loadMoreSentinelRef} className="col-span-2 h-1" aria-hidden />
                )}
                {isLoadingMore && hasMoreStores && (
                  <>
                    {Array.from({ length: 2 }, (_, index) => (
                      <StoreCardSkeleton key={`map-sheet-skeleton-${index}`} />
                    ))}
                  </>
                )}
              </div>
            </div>

            <div
              ref={scrollTrackRef}
              className="pointer-events-none absolute bottom-0 right-0 top-0 opacity-0 transition-opacity duration-150"
              style={{ width: MAP_VIEW_SHEET_SCROLLBAR_PX }}
              aria-hidden
            >
              <div
                ref={scrollThumbRef}
                className="absolute left-0 top-0 w-full rounded-full bg-muted-foreground/45 will-change-transform"
                style={{ height: 32 }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};


export default MapViewBottomSheet;

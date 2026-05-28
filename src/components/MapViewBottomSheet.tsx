import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { GripHorizontal, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import StoreCard from "@/components/StoreCard";
import { AutoFitMarquee } from "@/components/AutoFitMarquee";

const BOTTOM_NAV_PX = 64;
/** 상단(노치·패딩) 최소 여백 — 시트를 최대로 올려도 이 정도는 남김 */
const TOP_RESERVE_PX = 16;
/** 당기기 전: 핸들(슬라이더) 줄만 노출 */
const PEEK_HEIGHT = 60;
const CONTENT_REVEAL_EXTRA = 36;
const CARD_ROW_FALLBACK_PX = 240;
const MIN_EXPANDED = 280;
/** 피크에서 핸들을 살짝만 위로 당겨도 펼쳐지도록 낮은 스냅 기준(px) */
const SLIGHT_EXPAND_FROM_PEEK_PX = 10;
/** 펼쳐진 상태에서 이만큼 내리면 바로 접힘 (핸들 드래그) */
const COLLAPSE_FROM_EXPANDED_PX = 30;
/** 매장 선택 시 한 줄 스냅 — 카드 위·아래 여백 (py-2) */
const SINGLE_ROW_VERTICAL_PAD_PX = 16;

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
  const headerSectionRef = useRef<HTMLDivElement>(null);
  const singleRowHeightRef = useRef(PEEK_HEIGHT + CONTENT_REVEAL_EXTRA + CARD_ROW_FALLBACK_PX);
  /** 선택 매장으로 스크롤은 매장당 최초 1회만 */
  const scrollSyncedStoreIdRef = useRef<string | null>(null);
  const prevSelectedStoreIdRef = useRef<string | null>(null);
  const maxHeightRef = useRef(0);
  const bodyGestureRef = useRef<{
    startY: number;
    lastY: number;
    startH: number;
    mode: "pending" | "sheet" | "scroll";
  } | null>(null);

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
    Boolean(selectedStoreId) &&
    showContent &&
    panelHeight <= singleRowHeightRef.current + 8;

  const measureRowHeightPx = useCallback(
    (rowIndex: number) => {
      const lead = rowIndex * 2;
      const ids = [stores[lead]?.id, stores[lead + 1]?.id].filter(Boolean) as string[];
      let rowH = 0;
      for (const id of ids) {
        const node = cardWrapRefs.current.get(id);
        if (node && node.offsetHeight > 0) {
          rowH = Math.max(rowH, node.offsetHeight);
        }
      }
      return rowH > 0 ? rowH : CARD_ROW_FALLBACK_PX;
    },
    [stores]
  );

  /**
   * 단일행 스냅 높이는 "행마다 다른 카드 높이" 영향이 없도록
   * 모든 행 중 최대 높이를 기준으로 고정한다.
   */
  const measureRepresentativeRowHeightPx = useCallback(() => {
    const rowCount = Math.ceil(stores.length / 2);
    if (rowCount <= 0) return CARD_ROW_FALLBACK_PX;

    let maxRowH = 0;
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      maxRowH = Math.max(maxRowH, measureRowHeightPx(rowIndex));
    }

    return maxRowH > 0 ? maxRowH : CARD_ROW_FALLBACK_PX;
  }, [measureRowHeightPx, stores.length]);

  /** 시트가 올라올 높이 = 핸들 + 헤더 + 카드 1행 (목록은 그대로, 잘려 보일 뿐) */
  const measureSingleRowPanelHeight = useCallback(() => {
    const headerH = headerSectionRef.current?.offsetHeight ?? 36;
    const rowH = measureRepresentativeRowHeightPx();
    const measured = Math.round(PEEK_HEIGHT + headerH + rowH + SINGLE_ROW_VERTICAL_PAD_PX);
    const capped = Math.min(measured, expandedCap());
    singleRowHeightRef.current = capped;
    return capped;
  }, [expandedCap, measureRepresentativeRowHeightPx]);

  const snapToSingleRow = useCallback(() => {
    const target = measureSingleRowPanelHeight();
    panelHeightRef.current = target;
    setPanelHeight(target);
  }, [measureSingleRowPanelHeight]);

  const expandThenSnapToSingleRow = useCallback(() => {
    const cap = expandedCap();
    panelHeightRef.current = cap;
    setPanelHeight(cap);
    requestAnimationFrame(() => {
      snapToSingleRow();
    });
  }, [expandedCap, snapToSingleRow]);

  useEffect(() => {
    if (!showContent) {
      if (scrollBodyRef.current) scrollBodyRef.current.scrollTop = 0;
    }
  }, [showContent]);

  useEffect(() => {
    if (!showContent || stores.length === 0) return;
    measureSingleRowPanelHeight();
  }, [showContent, stores, measureSingleRowPanelHeight]);

  useEffect(() => {
    const onResize = () => {
      const cap = expandedCap();
      setPanelHeight((h) => Math.min(h, cap));
      if (Math.abs(panelHeightRef.current - singleRowHeightRef.current) <= 8) {
        const target = Math.min(measureSingleRowPanelHeight(), cap);
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
  }, [expandedCap, measureSingleRowPanelHeight]);

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

    if (panelHeightRef.current <= contentRevealThreshold) {
      expandThenSnapToSingleRow();
      return;
    }

    snapToSingleRow();
  }, [
    selectedStoreId,
    highlightSelectedCard,
    contentRevealThreshold,
    snapToSingleRow,
    expandThenSnapToSingleRow,
  ]);

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

  const maxHeight = Math.max(MIN_EXPANDED, expandedCap());
  maxHeightRef.current = maxHeight;

  const collapseToPeek = useCallback(() => {
    panelHeightRef.current = PEEK_HEIGHT;
    setPanelHeight(PEEK_HEIGHT);
    dragRef.current = null;
    setIsDragging(false);
  }, []);

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

    if (g.mode === "pending") {
      if (isSheetNotFull) {
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
      expandThenSnapToSingleRow();
      return;
    }

    const startedExpanded = startH >= max - 2;

    if (startedExpanded && startH - h >= COLLAPSE_FROM_EXPANDED_PX) {
      collapseToPeek();
      return;
    }

    const singleRow = singleRowHeightRef.current;
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
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startDrag(e.clientY);
  };

  const onPointerMoveHandle = (e: React.PointerEvent) => {
    if (!dragRef.current?.dragging) return;
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

      if (mode === "idle") {
        if (isSheetNotFull) {
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
  }, [showContent]);

  return (
    <div
      aria-hidden={ariaHidden}
      className={cn(
        "fixed left-0 right-0 z-[45] mx-auto flex max-w-md flex-col overflow-hidden rounded-t-2xl border border-border/80 bg-card/98 shadow-[0_-8px_32px_rgba(0,0,0,0.12)] backdrop-blur-md",
        className
      )}
      style={{
        bottom: BOTTOM_NAV_PX,
        height: panelHeight,
        maxHeight: `min(${maxHeight}px, calc(100dvh - ${BOTTOM_NAV_PX}px - max(0.5rem, env(safe-area-inset-top, 0px)) - 8px))`,
        transition:
          isDragging || !heightTransitionEnabled ? "none" : "height 0.22s ease-out",
      }}
    >
      <div
        role="slider"
        aria-valuemin={PEEK_HEIGHT}
        aria-valuemax={maxHeight}
        aria-valuenow={Math.round(panelHeight)}
        aria-label={dragHint}
        className={cn(
          "flex h-[60px] shrink-0 cursor-grab touch-none flex-col items-center justify-center px-2 py-1.5 active:cursor-grabbing",
          showContent && "border-b border-border/50"
        )}
        onPointerDown={onPointerDownHandle}
        onPointerMove={onPointerMoveHandle}
        onPointerUp={onPointerUpHandle}
        onPointerCancel={onPointerUpHandle}
      >
        <div className="mb-0.5 h-1 w-10 rounded-full bg-muted-foreground/35" />
        <GripHorizontal className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
        <AutoFitMarquee
          as="p"
          text={dragHint}
          className="mt-0.5 w-full"
          textClassName="text-center text-muted-foreground"
          fontSizeClasses={["text-[10px]"]}
        />
      </div>

      {showContent && (
        <>
          <div
            ref={headerSectionRef}
            className="flex shrink-0 items-center justify-between px-3 pb-1 pt-1"
          >
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSortChange(sortBy === "distance" ? "discount" : "distance")}
                onPointerLeave={(event) => event.currentTarget.blur()}
                onPointerCancel={(event) => event.currentTarget.blur()}
                onPointerUp={(event) => event.currentTarget.blur()}
                className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus:bg-muted/60 focus:text-foreground focus:outline-none active:bg-muted/60 active:text-foreground"
              >
                <ArrowUpDown className="h-3 w-3" />
                {sortBy === "distance" ? sortDistanceLabel : sortDiscountLabel}
              </button>
              <span className="text-xs text-muted-foreground">{stores.length}</span>
            </div>
          </div>

          <div
            ref={scrollBodyRef}
            className={cn(
              "scrollbar-show min-h-0 flex-1 overflow-y-auto overscroll-contain px-3",
              isSingleRowPanel ? "py-2 pb-2" : "pb-3"
            )}
            style={{
              WebkitOverflowScrolling: "touch",
              overscrollBehaviorY: "contain",
            }}
          >
            <div>
              <div className="grid grid-cols-2 gap-3 pb-1" style={{ gridAutoRows: "1fr" }}>
                {stores.map((store) => (
                  <div
                    key={store.id}
                    ref={(node) => {
                      if (node) cardWrapRefs.current.set(store.id, node);
                      else cardWrapRefs.current.delete(store.id);
                    }}
                    className="h-full rounded-lg transition-[box-shadow,transform]"
                  >
                    <StoreCard
                      {...store}
                      isHighlighted={highlightSelectedCard && selectedStoreId === store.id}
                      onActivate={() => onSelectStoreFromCard?.(store)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MapViewBottomSheet;

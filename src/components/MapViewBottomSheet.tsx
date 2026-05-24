import { useCallback, useEffect, useRef, useState, useLayoutEffect } from "react";
import { GripHorizontal, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import StoreCard from "@/components/StoreCard";

const BOTTOM_NAV_PX = 64;
/** 상단(노치·패딩) 최소 여백 — 시트를 최대로 올려도 이 정도는 남김 */
const TOP_RESERVE_PX = 16;
/** 당기기 전: 핸들(슬라이더) 줄만 노출 */
const PEEK_HEIGHT = 60;
const CONTENT_REVEAL_EXTRA = 36;
const MIN_EXPANDED = 280;

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
};

type MapViewBottomSheetProps = {
  stores: MapSheetStore[];
  selectedStoreId: string | null;
  onSelectStore: (id: string | null) => void;
  title: string;
  dragHint: string;
  sortBy: "distance" | "discount";
  onSortChange: (sort: "distance" | "discount") => void;
  sortDistanceLabel: string;
  sortDiscountLabel: string;
  className?: string;
};

const MapViewBottomSheet = ({
  stores,
  selectedStoreId,
  onSelectStore,
  title,
  dragHint,
  sortBy,
  onSortChange,
  sortDistanceLabel,
  sortDiscountLabel,
  className,
}: MapViewBottomSheetProps) => {
  const expandedCap = useCallback(() => {
    if (typeof window === "undefined") return 800;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    return Math.round(vh - BOTTOM_NAV_PX - TOP_RESERVE_PX);
  }, []);

  const [panelHeight, setPanelHeight] = useState(PEEK_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);
  const panelHeightRef = useRef(PEEK_HEIGHT);
  const dragRef = useRef<{
    startY: number;
    startH: number;
    dragging: boolean;
  } | null>(null);
  const cardWrapRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const maxHeightRef = useRef(0);
  const clearSelectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  panelHeightRef.current = panelHeight;

  useEffect(() => {
    const onResize = () => {
      setPanelHeight((h) => Math.min(h, expandedCap()));
    };
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, [expandedCap]);

  const showContent = panelHeight > PEEK_HEIGHT + CONTENT_REVEAL_EXTRA;

  useEffect(() => {
    if (!selectedStoreId) return;
    // 핀 클릭 시 바텀시트가 접혀 있으면 자동으로 펼치기
    const cap = expandedCap();
    if (panelHeightRef.current < PEEK_HEIGHT + CONTENT_REVEAL_EXTRA) {
      panelHeightRef.current = cap;
      setPanelHeight(cap);
    }
  }, [selectedStoreId, expandedCap]);

  useEffect(() => {
    if (!selectedStoreId || !showContent) return;
    const el = cardWrapRefs.current.get(selectedStoreId);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedStoreId, showContent]);

  const maxHeight = Math.max(MIN_EXPANDED, expandedCap());
  maxHeightRef.current = maxHeight;

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!el.contains(e.target as Node)) return;
      if (dragRef.current?.dragging) return;

      const cap = maxHeightRef.current;
      const h = panelHeightRef.current;
      const inner = scrollBodyRef.current;
      const expandedContent = h > PEEK_HEIGHT + CONTENT_REVEAL_EXTRA;

      if (expandedContent && inner && inner.scrollHeight > inner.clientHeight + 2) {
        const { scrollTop, scrollHeight, clientHeight } = inner;
        const atTop = scrollTop <= 1;
        const atBottom = scrollTop + clientHeight >= scrollHeight - 2;

        if (e.deltaY > 0 && !atTop) {
          e.stopPropagation();
          return;
        }
        if (e.deltaY < 0 && !atBottom) {
          e.stopPropagation();
          return;
        }
      }

      e.preventDefault();
      e.stopPropagation();

      if (e.deltaY === 0) return;

      /** 휠 한 번(방향)당 완전 펼침 / 완전 접힘 — 미세 떨림만 무시 */
      if (Math.abs(e.deltaY) < 0.5) return;

      const next = e.deltaY < 0 ? cap : PEEK_HEIGHT;
      if (next === h) return;

      panelHeightRef.current = next;
      setPanelHeight(next);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  /** 리스트가 맨 위일 때 아래로 당기면 시트 높이를 줄여 접기 (모바일 터치) */
  const touchPullLastYRef = useRef<number | null>(null);

  useEffect(() => {
    const inner = scrollBodyRef.current;
    if (!inner || !showContent) return;

    const onTouchStart = (e: TouchEvent) => {
      touchPullLastYRef.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (touchPullLastYRef.current == null) return;
      const y = e.touches[0].clientY;
      const innerEl = scrollBodyRef.current;
      if (!innerEl) return;
      const atTop = innerEl.scrollTop <= 1;
      const lastY = touchPullLastYRef.current;
      const movingDown = y > lastY;
      const expanded = panelHeightRef.current > PEEK_HEIGHT + CONTENT_REVEAL_EXTRA;

      if (atTop && movingDown && expanded) {
        const dy = y - lastY;
        e.preventDefault();
        const next = Math.round(Math.max(PEEK_HEIGHT, panelHeightRef.current - dy));
        panelHeightRef.current = next;
        setPanelHeight(next);
      }
      touchPullLastYRef.current = y;
    };

    const onTouchEnd = () => {
      touchPullLastYRef.current = null;
      const h = panelHeightRef.current;
      const mid = (PEEK_HEIGHT + maxHeight) / 2;
      if (h > PEEK_HEIGHT + CONTENT_REVEAL_EXTRA && h < maxHeight) {
        const snapped = h >= mid ? maxHeight : PEEK_HEIGHT;
        panelHeightRef.current = snapped;
        setPanelHeight(snapped);
      }
    };

    inner.addEventListener("touchstart", onTouchStart, { passive: true });
    inner.addEventListener("touchmove", onTouchMove, { passive: false });
    inner.addEventListener("touchend", onTouchEnd);
    inner.addEventListener("touchcancel", onTouchEnd);
    return () => {
      inner.removeEventListener("touchstart", onTouchStart);
      inner.removeEventListener("touchmove", onTouchMove);
      inner.removeEventListener("touchend", onTouchEnd);
      inner.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [showContent, maxHeight]);

  const startDrag = (clientY: number) => {
    dragRef.current = { startY: clientY, startH: panelHeightRef.current, dragging: true };
    setIsDragging(true);
  };

  const moveDrag = (clientY: number) => {
    const d = dragRef.current;
    if (!d?.dragging) return;
    const delta = d.startY - clientY;
    const next = Math.round(
      Math.min(maxHeight, Math.max(PEEK_HEIGHT, d.startH + delta))
    );
    panelHeightRef.current = next;
    setPanelHeight(next);
  };

  /** 피크에서 핸들을 살짝만 위로 당겨도 펼쳐지도록 낮은 스냅 기준(px) */
  const SLIGHT_EXPAND_FROM_PEEK_PX = 10;
  /** 펼쳐진 상태에서 이만큼 내리면 바로 접힘 */
  const COLLAPSE_FROM_EXPANDED_PX = 80;

  const endDrag = () => {
    const d = dragRef.current;
    const was = d?.dragging;
    const startH = d?.startH ?? panelHeightRef.current;
    dragRef.current = null;
    setIsDragging(false);
    if (!was) return;
    const h = panelHeightRef.current;
    const startedPeek = startH <= PEEK_HEIGHT + 2;
    if (startedPeek && h >= startH + SLIGHT_EXPAND_FROM_PEEK_PX) {
      panelHeightRef.current = maxHeight;
      setPanelHeight(maxHeight);
      return;
    }
    // 펼쳐진 상태에서 80px 이상 내렸으면 바로 접기
    const startedExpanded = startH >= maxHeight - 2;
    if (startedExpanded && startH - h >= COLLAPSE_FROM_EXPANDED_PX) {
      panelHeightRef.current = PEEK_HEIGHT;
      setPanelHeight(PEEK_HEIGHT);
      return;
    }
    const mid = (PEEK_HEIGHT + maxHeight) / 2;
    const snapped = h >= mid ? maxHeight : PEEK_HEIGHT;
    panelHeightRef.current = snapped;
    setPanelHeight(snapped);
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

  return (
    <div
      ref={sheetRef}
      className={cn(
        "fixed left-0 right-0 z-[45] mx-auto flex max-w-md flex-col overflow-hidden overscroll-y-contain overscroll-x-none rounded-t-2xl border border-border/80 bg-card/98 shadow-[0_-8px_32px_rgba(0,0,0,0.12)] backdrop-blur-md touch-pan-y",
        className
      )}
      style={{
        bottom: BOTTOM_NAV_PX,
        height: panelHeight,
        maxHeight: `min(${maxHeight}px, calc(100dvh - ${BOTTOM_NAV_PX}px - max(0.5rem, env(safe-area-inset-top, 0px)) - 8px))`,
        transition: isDragging ? "none" : "height 0.22s ease-out",
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
        <p className="mt-0.5 line-clamp-2 max-h-8 text-center text-[10px] leading-tight text-muted-foreground">
          {dragHint}
        </p>
      </div>

      {showContent && (
        <>
          <div className="flex shrink-0 items-center justify-between px-3 pb-1 pt-1">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSortChange(sortBy === "distance" ? "discount" : "distance")}
                className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted active:scale-95"
              >
                <ArrowUpDown className="h-3 w-3" />
                {sortBy === "distance" ? sortDistanceLabel : sortDiscountLabel}
              </button>
              <span className="text-xs text-muted-foreground">{stores.length}</span>
            </div>
          </div>

          <div
            ref={scrollBodyRef}
            className="touch-pan-y flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain overscroll-x-none px-3 pb-3"
          >
            <div className="grid grid-cols-2 gap-3 pb-1" style={{ gridAutoRows: "1fr" }}>
              {stores.map((store) => (
                <div
                  key={store.id}
                  ref={(node) => {
                    if (node) cardWrapRefs.current.set(store.id, node);
                    else cardWrapRefs.current.delete(store.id);
                  }}
                  onClick={() => {
                    onSelectStore(store.id);
                    if (clearSelectTimerRef.current) clearTimeout(clearSelectTimerRef.current);
                    clearSelectTimerRef.current = setTimeout(() => onSelectStore(null), 1200);
                  }}
                  className={cn(
                    "h-full rounded-lg transition-[box-shadow,transform]",
                    selectedStoreId === store.id && "ring-2 ring-primary ring-offset-2 ring-offset-card"
                  )}
                >
                  <StoreCard {...store} isHighlighted={selectedStoreId === store.id} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MapViewBottomSheet;

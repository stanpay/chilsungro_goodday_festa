import { useCallback, useEffect, useRef, useState } from "react";
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
const MIN_EXPANDED = 280;
/** 피크에서 핸들을 살짝만 위로 당겨도 펼쳐지도록 낮은 스냅 기준(px) */
const SLIGHT_EXPAND_FROM_PEEK_PX = 10;
/** 펼쳐진 상태에서 이만큼 내리면 바로 접힘 */
const COLLAPSE_FROM_EXPANDED_PX = 30;

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
    hitMaxY?: number;
  } | null>(null);
  const cardWrapRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const maxHeightRef = useRef(0);
  const clearSelectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyGestureRef = useRef<{
  startY: number;
  lastY: number;
  startH: number;
  mode: "pending" | "sheet" | "scroll";
} | null>(null);

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
    if (!showContent) {
      if (scrollBodyRef.current) scrollBodyRef.current.scrollTop = 0;
    }
  }, [showContent]);

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
    const sb = scrollBodyRef.current;
    if (!el || !sb) return;
    const sbRect = sb.getBoundingClientRect();
    const cardRect = el.getBoundingClientRect();
    const cardRelTop = cardRect.top - sbRect.top + sb.scrollTop;
    const target = cardRelTop + cardRect.height / 2 - sbRect.height / 2;
    const maxScroll = Math.max(0, sb.scrollHeight - sb.clientHeight);
    sb.scrollTo({ top: Math.max(0, Math.min(maxScroll, target)), behavior: "smooth" });
  }, [selectedStoreId, showContent]);

  useEffect(() => {
    return () => {
      if (clearSelectTimerRef.current) clearTimeout(clearSelectTimerRef.current);
    };
  }, []);

  const maxHeight = Math.max(MIN_EXPANDED, expandedCap());
  maxHeightRef.current = maxHeight;

  const startDrag = (clientY: number) => {
    dragRef.current = { startY: clientY, startH: panelHeightRef.current, dragging: true };
    setIsDragging(true);
  };

const moveDrag = (clientY: number) => {
  const d = dragRef.current;
  if (!d?.dragging) return;

  const max = maxHeightRef.current || maxHeight;

  const delta = d.startY - clientY; // 양수 = 위로
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
  const isAtTop = sb.scrollTop <= 0;
  const draggingUp = dyFromStart < 0;
  const draggingDown = dyFromStart > 0;

  if (g.mode === "pending") {
    // 시트가 아직 최대 높이가 아니면 내부 스크롤보다 시트 이동을 우선
    if (isSheetNotFull) {
      g.mode = "sheet";
      dragRef.current = {
        startY: g.startY,
        startH: g.startH,
        dragging: true,
      };
      setIsDragging(true);
    }
    // 시트가 최대 높이이고, 리스트 최상단에서 아래로 당기면 시트 닫기
    else if (isAtTop && draggingDown) {
      g.mode = "sheet";
      dragRef.current = {
        startY: g.startY,
        startH: g.startH,
        dragging: true,
      };
      setIsDragging(true);
    }
    // 그 외에는 일반 리스트 스크롤
    else {
      g.mode = "scroll";
    }
  }

  // 이미 리스트 스크롤 중이더라도,
  // 리스트가 최상단에 도달한 상태에서 계속 아래로 당기면 시트 제어로 전환
  if (g.mode === "scroll") {
    if (sb.scrollTop <= 0 && dyFromLast > 0) {
      g.mode = "sheet";
      dragRef.current = {
        startY: y,
        startH: panelHeightRef.current,
        dragging: true,
      };
      setIsDragging(true);
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

const onBodyTouchEnd = () => {
  const mode = bodyGestureRef.current?.mode;
  bodyGestureRef.current = null;

  if (mode === "sheet") {
    endDrag();
  }
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
    panelHeightRef.current = max;
    setPanelHeight(max);
    return;
  }

  const startedExpanded = startH >= max - 2;

  if (startedExpanded && startH - h >= COLLAPSE_FROM_EXPANDED_PX) {
    panelHeightRef.current = PEEK_HEIGHT;
    setPanelHeight(PEEK_HEIGHT);
    return;
  }

  const mid = (PEEK_HEIGHT + max) / 2;
  const snapped = h >= mid ? max : PEEK_HEIGHT;

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
    const isAtTop = sb.scrollTop <= 0;

    const draggingDown = totalDy > 0;

    if (mode === "idle") {
      // 1. 시트가 아직 최대 높이가 아니면 리스트 스크롤보다 시트 확장 우선
      if (isSheetNotFull) {
        startSheetDrag(startY, startH);
      }
      // 2. 시트가 최대 높이이고, 리스트 최상단에서 아래로 당기면 시트 닫기
      else if (isAtTop && draggingDown) {
        startSheetDrag(startY, startH);
      }
      // 3. 그 외에는 일반 리스트 스크롤
      else {
        mode = "scroll";
      }
    }

    if (mode === "scroll") {
      // 리스트 스크롤 중 최상단에서 아래로 더 당기면 시트 제어로 전환
      if (sb.scrollTop <= 0 && stepDy > 0) {
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
      className={cn(
        "fixed left-0 right-0 z-[45] mx-auto flex max-w-md flex-col overflow-hidden rounded-t-2xl border border-border/80 bg-card/98 shadow-[0_-8px_32px_rgba(0,0,0,0.12)] backdrop-blur-md",
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
        <AutoFitMarquee
          as="p"
          text={dragHint}
          className="mt-0.5 w-full"
          textClassName="text-center text-muted-foreground"
          fontSizeClasses={["text-[10px]", "text-[9px]", "text-[8px]"]}
        />
      </div>

      {showContent && (
        <>
          <div className="flex shrink-0 items-center justify-between px-3 pb-1 pt-1">
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
  className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3"
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
          </div>
        </>
      )}
    </div>
  );
};

export default MapViewBottomSheet;

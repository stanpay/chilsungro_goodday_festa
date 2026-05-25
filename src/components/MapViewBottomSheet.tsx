import { useCallback, useEffect, useRef, useState } from "react";
import { useDrag } from "@use-gesture/react";
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
  const [scrollOffset, setScrollOffset] = useState(0);
  const panelHeightRef = useRef(PEEK_HEIGHT);
  const scrollOffsetRef = useRef(0);
  const dragRef = useRef<{
    startY: number;
    startH: number;
    dragging: boolean;
    hitMaxY?: number;
  } | null>(null);
  const scrollDragRef = useRef({
    startScroll: 0,
    startH: 0,
    controlling: false,
    lockedMy: 0,
  });
  const cardWrapRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const contentInnerRef = useRef<HTMLDivElement>(null);
  const maxHeightRef = useRef(0);
  const momentumRafRef = useRef(0);
  const clearSelectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  panelHeightRef.current = panelHeight;
  scrollOffsetRef.current = scrollOffset;

  const updateScroll = useCallback((next: number) => {
    scrollOffsetRef.current = next;
    setScrollOffset(next);
  }, []);

  const stopMomentum = useCallback(() => {
    if (momentumRafRef.current) {
      cancelAnimationFrame(momentumRafRef.current);
      momentumRafRef.current = 0;
    }
  }, []);

  useEffect(() => () => stopMomentum(), [stopMomentum]);

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
      scrollOffsetRef.current = 0;
      setScrollOffset(0);
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
    const inner = contentInnerRef.current;
    if (!el || !sb || !inner) return;
    const innerRect = inner.getBoundingClientRect();
    const cardRect = el.getBoundingClientRect();
    const sbRect = sb.getBoundingClientRect();
    const cardRelTop = cardRect.top - innerRect.top + scrollOffsetRef.current;
    const target = cardRelTop + cardRect.height / 2 - sbRect.height / 2;
    const maxScroll = Math.max(0, inner.offsetHeight - sb.offsetHeight);
    updateScroll(Math.max(0, Math.min(maxScroll, target)));
  }, [selectedStoreId, showContent, updateScroll]);

  const maxHeight = Math.max(MIN_EXPANDED, expandedCap());
  maxHeightRef.current = maxHeight;

  // 스크롤바디 제스처: transform 기반 스크롤 + 천장 충돌 시 패널 collapse 핸드오프
  useDrag(
    ({ first, last, movement: [, my], delta: [, dy], velocity: [, vy], event }) => {
      const sb = scrollBodyRef.current;
      const inner = contentInnerRef.current;
      if (!sb || !inner) return;

      if (first) {
        stopMomentum();
        scrollDragRef.current = {
          startScroll: scrollOffsetRef.current,
          startH: panelHeightRef.current,
          controlling: false,
          lockedMy: 0,
        };
      }

      const ds = scrollDragRef.current;
      const maxScroll = Math.max(0, inner.offsetHeight - sb.offsetHeight);

      if (!ds.controlling) {
        // 손가락 아래로 = my>0 → 컨텐츠 위로 보임 = scrollOffset 감소
        const targetScroll = ds.startScroll - my;
        const newScroll = Math.max(0, Math.min(maxScroll, targetScroll));

        if (newScroll !== scrollOffsetRef.current) {
          updateScroll(newScroll);
        }

        // 천장 넘어 더 당기려는 시도 → 패널 제어로 전환
        if (targetScroll < 0 && dy > 0) {
          ds.controlling = true;
          ds.lockedMy = ds.startScroll;
          setIsDragging(true);
        }
      }

      if (ds.controlling) {
        const ev = event as Event | undefined;
        if (ev && ev.cancelable) ev.preventDefault();
        const panelDelta = my - ds.lockedMy;
        const newH = Math.round(
          Math.min(maxHeightRef.current, Math.max(PEEK_HEIGHT, ds.startH - panelDelta))
        );
        panelHeightRef.current = newH;
        setPanelHeight(newH);
      }

      if (last) {
        if (ds.controlling) {
          ds.controlling = false;
          setIsDragging(false);
          const h = panelHeightRef.current;
          if (ds.startH - h >= COLLAPSE_FROM_EXPANDED_PX) {
            panelHeightRef.current = PEEK_HEIGHT;
            setPanelHeight(PEEK_HEIGHT);
          } else {
            const mid = (PEEK_HEIGHT + maxHeightRef.current) / 2;
            const snapped = h >= mid ? maxHeightRef.current : PEEK_HEIGHT;
            panelHeightRef.current = snapped;
            setPanelHeight(snapped);
          }
        } else if (Math.abs(vy) > 0.1) {
          // 모멘텀 스크롤
          let v = -vy * 16;
          const decay = 0.94;
          const animate = () => {
            if (Math.abs(v) < 0.3) {
              momentumRafRef.current = 0;
              return;
            }
            const sb2 = scrollBodyRef.current;
            const inner2 = contentInnerRef.current;
            const max = Math.max(0, (inner2?.offsetHeight ?? 0) - (sb2?.offsetHeight ?? 0));
            const next = scrollOffsetRef.current + v;
            if (next <= 0 || next >= max) {
              updateScroll(Math.max(0, Math.min(max, next)));
              momentumRafRef.current = 0;
              return;
            }
            updateScroll(next);
            v *= decay;
            momentumRafRef.current = requestAnimationFrame(animate);
          };
          momentumRafRef.current = requestAnimationFrame(animate);
        }
      }
    },
    {
      target: scrollBodyRef,
      eventOptions: { passive: false },
      filterTaps: true,
    }
  );

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!el.contains(e.target as Node)) return;
      if (dragRef.current?.dragging) return;

      const cap = maxHeightRef.current;
      const h = panelHeightRef.current;
      const sb = scrollBodyRef.current;
      const inner = contentInnerRef.current;
      const expandedContent = h > PEEK_HEIGHT + CONTENT_REVEAL_EXTRA;

      if (expandedContent && sb && inner) {
        const maxScroll = Math.max(0, inner.offsetHeight - sb.offsetHeight);
        const atTop = scrollOffsetRef.current <= 1;
        const atBottom = scrollOffsetRef.current >= maxScroll - 1;

        if (maxScroll > 0) {
          if (e.deltaY > 0 && !atBottom) {
            e.preventDefault();
            e.stopPropagation();
            updateScroll(Math.min(maxScroll, scrollOffsetRef.current + e.deltaY));
            return;
          }
          if (e.deltaY < 0 && !atTop) {
            e.preventDefault();
            e.stopPropagation();
            updateScroll(Math.max(0, scrollOffsetRef.current + e.deltaY));
            return;
          }
        }
      }

      e.preventDefault();
      e.stopPropagation();

      if (e.deltaY === 0) return;
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
  }, [updateScroll]);

  const startDrag = (clientY: number) => {
    dragRef.current = { startY: clientY, startH: panelHeightRef.current, dragging: true };
    setIsDragging(true);
  };

  const moveDrag = (clientY: number) => {
    const d = dragRef.current;
    if (!d?.dragging) return;
    const delta = d.startY - clientY; // 양수 = 위로
    const rawNext = d.startH + delta;
    const next = Math.round(Math.min(maxHeight, Math.max(PEEK_HEIGHT, rawNext)));
    panelHeightRef.current = next;
    setPanelHeight(next);

    if (next >= maxHeight) {
      if (d.hitMaxY === undefined) d.hitMaxY = clientY;
      const overshoot = Math.max(0, d.hitMaxY - clientY);
      const inner = contentInnerRef.current;
      const sb = scrollBodyRef.current;
      const max = Math.max(0, (inner?.offsetHeight ?? 0) - (sb?.offsetHeight ?? 0));
      updateScroll(Math.min(max, overshoot));
    } else {
      d.hitMaxY = undefined;
    }
  };

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
            className="touch-none flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3"
          >
            <div
              ref={contentInnerRef}
              style={{
                transform: `translate3d(0, ${-scrollOffset}px, 0)`,
                willChange: "transform",
              }}
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
          </div>
        </>
      )}
    </div>
  );
};

export default MapViewBottomSheet;

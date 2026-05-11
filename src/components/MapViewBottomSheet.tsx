import { useCallback, useEffect, useRef, useState } from "react";
import { GripHorizontal } from "lucide-react";
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
};

type MapViewBottomSheetProps = {
  stores: MapSheetStore[];
  selectedStoreId: string | null;
  onSelectStore: (id: string) => void;
  title: string;
  dragHint: string;
  className?: string;
};

const MapViewBottomSheet = ({
  stores,
  selectedStoreId,
  onSelectStore,
  title,
  dragHint,
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

  const endDrag = () => {
    const d = dragRef.current;
    const was = d?.dragging;
    dragRef.current = null;
    setIsDragging(false);
    if (!was) return;
    const h = panelHeightRef.current;
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
            <span className="text-xs text-muted-foreground">{stores.length}</span>
          </div>

          <div
            ref={scrollBodyRef}
            className="touch-pan-y flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain overscroll-x-none px-3 pb-3"
          >
            <div className="grid grid-cols-2 gap-3 pb-1">
              {stores.map((store) => (
                <div
                  key={store.id}
                  ref={(node) => {
                    if (node) cardWrapRefs.current.set(store.id, node);
                    else cardWrapRefs.current.delete(store.id);
                  }}
                  onClick={() => onSelectStore(store.id)}
                  className={cn(
                    "rounded-lg transition-[box-shadow,transform]",
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

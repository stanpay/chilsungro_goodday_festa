import { useCallback, useEffect, useRef, useState } from "react";
import { useGesture } from "@use-gesture/react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2;

type BaseSize = { width: number; height: number };

type ZoomablePosterImageProps = {
  src: string;
  alt: string;
  ready: boolean;
  className?: string;
};

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function adjustScrollForZoom(
  scrollEl: HTMLDivElement,
  clientX: number,
  clientY: number,
  oldScale: number,
  newScale: number,
) {
  const rect = scrollEl.getBoundingClientRect();
  const focalX = clientX - rect.left;
  const focalY = clientY - rect.top;
  const contentX = scrollEl.scrollLeft + focalX;
  const contentY = scrollEl.scrollTop + focalY;
  const ratio = newScale / oldScale;
  scrollEl.scrollLeft = Math.max(0, contentX * ratio - focalX);
  scrollEl.scrollTop = Math.max(0, contentY * ratio - focalY);
}

export default function ZoomablePosterImage({
  src,
  alt,
  ready,
  className,
}: ZoomablePosterImageProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [baseSize, setBaseSize] = useState<BaseSize | null>(null);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const dragScrollStart = useRef({ left: 0, top: 0 });

  const resetView = useCallback(() => {
    setScale(1);
    const scroll = scrollRef.current;
    if (scroll) {
      scroll.scrollLeft = 0;
      scroll.scrollTop = 0;
    }
  }, []);

  const measureBaseSize = useCallback(() => {
    const scroll = scrollRef.current;
    const img = imgRef.current;
    if (!scroll || !img || !img.naturalWidth || !img.naturalHeight) return;

    const containerWidth = scroll.clientWidth;
    if (containerWidth <= 0) return;

    const aspect = img.naturalWidth / img.naturalHeight;
    setBaseSize({
      width: containerWidth,
      height: containerWidth / aspect,
    });
  }, []);

  useEffect(() => {
    resetView();
    setBaseSize(null);
  }, [src, resetView]);

  useEffect(() => {
    if (!ready) return;
    const scroll = scrollRef.current;
    if (!scroll) return;

    measureBaseSize();
    const observer = new ResizeObserver(() => measureBaseSize());
    observer.observe(scroll);
    return () => observer.disconnect();
  }, [ready, measureBaseSize]);

  const applyScaleAt = useCallback(
    (clientX: number, clientY: number, nextScale: number) => {
      const scroll = scrollRef.current;
      if (!scroll) return;

      const clamped = clampScale(nextScale);
      const prev = scaleRef.current;

      if (clamped <= MIN_SCALE) {
        resetView();
        return;
      }

      adjustScrollForZoom(scroll, clientX, clientY, prev, clamped);
      setScale(clamped);
    },
    [resetView],
  );

  const bind = useGesture(
    {
      onDrag: ({ down, movement: [mx, my], pinching, event }) => {
        if (scaleRef.current <= MIN_SCALE || pinching) return;
        const scroll = scrollRef.current;
        if (!scroll) return;
        event.preventDefault();
        if (down) {
          scroll.scrollLeft = dragScrollStart.current.left - mx;
          scroll.scrollTop = dragScrollStart.current.top - my;
        }
      },
      onDragStart: () => {
        const scroll = scrollRef.current;
        if (!scroll) return;
        dragScrollStart.current = {
          left: scroll.scrollLeft,
          top: scroll.scrollTop,
        };
      },
      onPinch: ({ offset: [nextScale], origin, event }) => {
        event.preventDefault();
        applyScaleAt(origin[0], origin[1], nextScale);
      },
      onWheel: ({ event, delta: [, dy] }) => {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        applyScaleAt(
          event.clientX,
          event.clientY,
          scaleRef.current - dy * 0.002,
        );
      },
      onDoubleClick: ({ event }) => {
        event.preventDefault();
        if (scaleRef.current > 1) {
          resetView();
          return;
        }
        applyScaleAt(event.clientX, event.clientY, DOUBLE_TAP_SCALE);
      },
    },
    {
      drag: {
        filterTaps: true,
        from: () => [0, 0],
        enabled: () => scaleRef.current > MIN_SCALE,
      },
      pinch: {
        scaleBounds: { min: MIN_SCALE, max: MAX_SCALE },
        rubberband: true,
        from: () => [scaleRef.current, 0],
      },
      wheel: { eventOptions: { passive: false } },
    },
  );

  const contentWidth = baseSize ? baseSize.width * scale : undefined;
  const contentHeight = baseSize ? baseSize.height * scale : undefined;
  const isZoomed = scale > MIN_SCALE;
  const viewportHeight = baseSize
    ? `min(${baseSize.height}px, 80dvh)`
    : undefined;

  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-lg", className)}
      role="group"
      aria-label={`${alt} — 핀치·스크롤·더블탭으로 확대·축소`}
    >
      {!ready ? (
        <div
          className="flex min-h-[8rem] w-full items-center justify-center bg-muted"
          aria-hidden="true"
        >
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div
          ref={scrollRef}
          {...bind()}
          className={cn(
            "w-full overscroll-contain [-webkit-overflow-scrolling:touch]",
            isZoomed ? "overflow-auto" : "overflow-hidden",
          )}
          style={{
            touchAction: isZoomed ? "none" : "pan-x pan-y pinch-zoom",
            height: viewportHeight,
          }}
        >
          <div
            className="block"
            style={{
              width: contentWidth,
              height: contentHeight,
            }}
          >
            <img
              ref={imgRef}
              src={src}
              alt={alt}
              decoding="async"
              draggable={false}
              onLoad={measureBaseSize}
              className="block select-none"
              style={{
                width: contentWidth,
                height: contentHeight,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

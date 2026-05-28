import { useEffect, useRef, useState } from "react";
import { useGesture } from "@use-gesture/react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

type ZoomablePosterImageProps = {
  src: string;
  alt: string;
  ready: boolean;
  className?: string;
};

export default function ZoomablePosterImage({
  src,
  alt,
  ready,
  className,
}: ZoomablePosterImageProps) {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  useEffect(() => {
    setTransform({ scale: 1, x: 0, y: 0 });
  }, [src]);

  const bind = useGesture(
    {
      onPinch: ({ offset: [scale], event }) => {
        event.preventDefault();
        const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
        setTransform((t) => ({
          scale: clamped,
          x: clamped <= 1 ? 0 : t.x,
          y: clamped <= 1 ? 0 : t.y,
        }));
      },
      onDrag: ({ offset: [x, y], pinching, cancel }) => {
        if (pinching || transformRef.current.scale <= 1) {
          cancel();
          return;
        }
        setTransform((t) => ({ ...t, x, y }));
      },
      onWheel: ({ event, delta: [, dy] }) => {
        event.preventDefault();
        setTransform((t) => {
          const nextScale = Math.min(
            MAX_SCALE,
            Math.max(MIN_SCALE, t.scale - dy * 0.002),
          );
          return {
            scale: nextScale,
            x: nextScale <= 1 ? 0 : t.x,
            y: nextScale <= 1 ? 0 : t.y,
          };
        });
      },
      onDoubleClick: ({ event }) => {
        event.preventDefault();
        setTransform((t) =>
          t.scale > 1
            ? { scale: 1, x: 0, y: 0 }
            : { scale: 2, x: 0, y: 0 },
        );
      },
    },
    {
      pinch: {
        scaleBounds: { min: MIN_SCALE, max: MAX_SCALE },
        rubberband: true,
        from: () => [transformRef.current.scale, 0],
      },
      drag: {
        from: () => [transformRef.current.x, transformRef.current.y],
        filterTaps: true,
      },
      wheel: { eventOptions: { passive: false } },
    },
  );

  return (
    <div
      {...bind()}
      className={cn(
        "relative w-full touch-none overflow-hidden rounded-lg",
        className,
      )}
      style={{ touchAction: "none" }}
      role="group"
      aria-label={`${alt} — 핀치·드래그·더블탭으로 확대·축소`}
    >
      {!ready ? (
        <div
          className="flex min-h-[12rem] w-full items-center justify-center bg-muted"
          aria-hidden="true"
        >
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex min-h-[12rem] w-full items-center justify-center">
          <img
            src={src}
            alt={alt}
            decoding="async"
            draggable={false}
            className="max-w-full select-none object-contain"
            style={{
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
              transformOrigin: "center center",
              willChange: "transform",
            }}
          />
        </div>
      )}
    </div>
  );
}

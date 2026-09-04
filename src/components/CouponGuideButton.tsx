import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { SquareArrowOutUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { measureTextWidth } from "@/lib/measureTextWidth";

const FONT_SIZE_CLASSES = ["text-2xl", "text-xl", "text-lg", "text-base", "text-sm"];
const OVERFLOW_TOLERANCE_PX = 1;
const SAFE_RIGHT_PADDING_PX = 6;

type CouponGuideButtonProps = {
  label: string;
  onClick: () => void;
};

export function CouponGuideButton({ label, onClick }: CouponGuideButtonProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const leadingRef = useRef<HTMLSpanElement>(null);
  const [fontSizeClass, setFontSizeClass] = useState(FONT_SIZE_CLASSES[0]);
  const [marqueeDistance, setMarqueeDistance] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measureCandidate = (candidateFontSizeClass: string) =>
      measureTextWidth(
        label,
        cn("whitespace-nowrap font-semibold !leading-none", candidateFontSizeClass)
      );

    const updateLayout = () => {
      const leadingWidth = leadingRef.current?.getBoundingClientRect().width ?? 0;
      const containerWidth = container.clientWidth - SAFE_RIGHT_PADDING_PX - leadingWidth;
      if (containerWidth <= 0) return;

      const measured = FONT_SIZE_CLASSES.map((candidateFontSizeClass) => ({
        fontSizeClass: candidateFontSizeClass,
        width: measureCandidate(candidateFontSizeClass),
      }));
      const fitting = measured.find(({ width }) => width <= containerWidth + OVERFLOW_TOLERANCE_PX);
      const selected = fitting ?? measured[measured.length - 1];
      const overflowDistance = selected.width - containerWidth;

      setFontSizeClass(selected.fontSizeClass);
      setMarqueeDistance(
        fitting || overflowDistance <= OVERFLOW_TOLERANCE_PX ? 0 : overflowDistance
      );
    };

    updateLayout();
    document.fonts?.ready.then(updateLayout);

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateLayout);
      return () => window.removeEventListener("resize", updateLayout);
    }

    const observer = new ResizeObserver(updateLayout);
    observer.observe(container);

    return () => observer.disconnect();
  }, [label]);

  return (
    <Button
      className="mt-2 aspect-[1200/123] h-auto w-full max-h-16 items-center rounded-md px-2 py-0 sm:rounded-lg [&_svg]:size-5 sm:[&_svg]:size-6"
      onClick={onClick}
    >
      <span ref={containerRef} className="flex h-full min-w-0 w-full items-center">
        <span className="flex h-full min-h-0 min-w-0 w-full items-center justify-center overflow-hidden">
          <span
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap font-semibold !leading-none",
              fontSizeClass,
              marqueeDistance > 0 && "marquee-on-overflow"
            )}
            style={
              marqueeDistance > 0
                ? ({
                    "--marquee-distance": `${marqueeDistance}px`,
                  } as CSSProperties)
                : undefined
            }
          >
            <span ref={leadingRef} className="inline-flex shrink-0 items-center">
              <SquareArrowOutUpRight className="size-5 shrink-0 sm:size-6" />
            </span>
            <span className="min-w-0">{label}</span>
          </span>
        </span>
      </span>
    </Button>
  );
}

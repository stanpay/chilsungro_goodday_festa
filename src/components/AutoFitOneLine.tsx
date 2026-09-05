import { useLayoutEffect, useRef, useState } from "react";
import type { ElementType } from "react";
import { cn } from "@/lib/utils";

type AutoFitOneLineProps = {
  as?: ElementType;
  text: string;
  className?: string;
  minFontSizePx?: number;
};

const BASE_FONT_SIZE_PX = 14;
const MIN_FONT_SIZE_PX = 8;
const SIZE_EPSILON_PX = 0.1;

export function AutoFitOneLine({
  as: Tag = "p",
  text,
  className,
  minFontSizePx = MIN_FONT_SIZE_PX,
}: AutoFitOneLineProps) {
  const containerRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [fontSizePx, setFontSizePx] = useState(BASE_FONT_SIZE_PX);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const inner = textRef.current;
    if (!container || !inner) return;

    const update = () => {
      const available = container.clientWidth;
      if (available <= 0) return;

      inner.style.fontSize = `${BASE_FONT_SIZE_PX}px`;
      const needed = inner.scrollWidth;
      if (needed <= 0) return;

      const next = Math.max(
        minFontSizePx,
        Math.min(BASE_FONT_SIZE_PX, (available / needed) * BASE_FONT_SIZE_PX)
      );

      setFontSizePx((prev) => (Math.abs(prev - next) < SIZE_EPSILON_PX ? prev : next));
      inner.style.fontSize = `${next}px`;
    };

    update();
    document.fonts?.ready.then(update);

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [text, minFontSizePx]);

  return (
    <Tag ref={containerRef} className={cn("min-w-0 overflow-hidden", className)}>
      <span
        ref={textRef}
        className="block whitespace-nowrap text-center"
        style={{ fontSize: `${fontSizePx}px` }}
      >
        {text}
      </span>
    </Tag>
  );
}

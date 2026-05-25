import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ElementType } from "react";
import { cn } from "@/lib/utils";

type AutoFitMarqueeProps = {
  as?: ElementType;
  text: string;
  className?: string;
  textClassName?: string;
  fontSizeClasses?: string[];
};

const DEFAULT_FONT_SIZE_CLASSES = ["text-sm", "text-xs"];
const OVERFLOW_TOLERANCE_PX = 2;

export function AutoFitMarquee({
  as: Tag = "span",
  text,
  className,
  textClassName,
  fontSizeClasses = DEFAULT_FONT_SIZE_CLASSES,
}: AutoFitMarqueeProps) {
  const containerRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const fontSizeKey = fontSizeClasses.join("|");
  const [fontSizeIndex, setFontSizeIndex] = useState(0);
  const [marqueeDistance, setMarqueeDistance] = useState(0);

  useEffect(() => {
    setFontSizeIndex(0);
    setMarqueeDistance(0);
  }, [fontSizeKey, text, textClassName]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    const updateLayout = () => {
      const containerWidth = container.clientWidth;
      if (containerWidth <= 0) return;

      const overflowDistance = textEl.scrollWidth - containerWidth;
      if (overflowDistance <= OVERFLOW_TOLERANCE_PX) {
        setMarqueeDistance(0);
        return;
      }

      if (fontSizeIndex < fontSizeClasses.length - 1) {
        setMarqueeDistance(0);
        setFontSizeIndex((index) => Math.min(index + 1, fontSizeClasses.length - 1));
        return;
      }

      setMarqueeDistance(overflowDistance);
    };

    updateLayout();
    document.fonts?.ready.then(updateLayout);

    if (!("ResizeObserver" in window)) {
      window.addEventListener("resize", updateLayout);
      return () => window.removeEventListener("resize", updateLayout);
    }

    const observer = new ResizeObserver(updateLayout);
    observer.observe(container);

    return () => observer.disconnect();
  }, [fontSizeIndex, fontSizeKey, text, textClassName]);

  const fontSizeClass = fontSizeClasses[fontSizeIndex] ?? fontSizeClasses[0];

  return (
    <Tag ref={containerRef} className={cn("block min-w-0 overflow-hidden", className)}>
      <span
        ref={textRef}
        className={cn(
          "block whitespace-nowrap text-left",
          textClassName,
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
        {text}
      </span>
    </Tag>
  );
}

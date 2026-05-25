import { useLayoutEffect, useRef, useState } from "react";
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
const OVERFLOW_TOLERANCE_PX = 1;
const SAFE_RIGHT_PADDING_PX = 6;

export function AutoFitMarquee({
  as: Tag = "span",
  text,
  className,
  textClassName,
  fontSizeClasses = DEFAULT_FONT_SIZE_CLASSES,
}: AutoFitMarqueeProps) {
  const containerRef = useRef<HTMLElement>(null);
  const fontSizeKey = fontSizeClasses.join("|");
  const [fontSizeClass, setFontSizeClass] = useState(fontSizeClasses[0]);
  const [marqueeDistance, setMarqueeDistance] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measureTextWidth = (candidateFontSizeClass: string) => {
      const probe = document.createElement("span");
      probe.className = cn("whitespace-nowrap text-left", textClassName, candidateFontSizeClass);
      probe.textContent = text;
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      probe.style.pointerEvents = "none";
      probe.style.left = "-9999px";
      probe.style.top = "-9999px";
      document.body.appendChild(probe);
      const width = probe.scrollWidth;
      probe.remove();
      return width;
    };

    const updateLayout = () => {
      const containerWidth = container.clientWidth - SAFE_RIGHT_PADDING_PX;
      if (containerWidth <= 0) return;

      const measured = fontSizeClasses.map((candidateFontSizeClass) => ({
        fontSizeClass: candidateFontSizeClass,
        width: measureTextWidth(candidateFontSizeClass),
      }));
      const fitting = measured.find(({ width }) => width <= containerWidth + OVERFLOW_TOLERANCE_PX);
      const selected = fitting ?? measured[measured.length - 1];
      const overflowDistance = selected.width - containerWidth;

      setFontSizeClass(selected.fontSizeClass);
      setMarqueeDistance(
        fitting || overflowDistance <= OVERFLOW_TOLERANCE_PX
          ? 0
          : overflowDistance + SAFE_RIGHT_PADDING_PX
      );
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
  }, [fontSizeKey, text, textClassName]);

  return (
    <Tag ref={containerRef} className={cn("block min-w-0 overflow-hidden pr-1.5", className)}>
      <span
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

"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, PanInfo } from "motion/react";

export type CardStackItem<T = unknown> = {
  id: number;
  content: React.ReactNode;
  data?: T;
};

type CardStackProps<T = unknown> = {
  items: CardStackItem<T>[];
  offset?: number;
  scaleFactor?: number;
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  className?: string;
  cardClassName?: string;
};

export function CardStack<T = unknown>({
  items,
  offset = 10,
  scaleFactor = 0.06,
  initialIndex = 0,
  onIndexChange,
  className,
  cardClassName,
}: CardStackProps<T>) {
  const [cards, setCards] = useState<CardStackItem<T>[]>(() => {
    const arr = [...items];
    for (let i = 0; i < initialIndex; i++) {
      arr.push(arr.shift()!);
    }
    return arr;
  });

  const currentIndex = items.findIndex((i) => i.id === cards[0]?.id);
  useEffect(() => {
    if (currentIndex >= 0) {
      onIndexChange?.(currentIndex);
    }
  }, [currentIndex, onIndexChange]);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const threshold = 30;
      const topCardId = cards[0]?.id;
      const currentIndex = items.findIndex((i) => i.id === topCardId);

      if (info.offset.y < -threshold) {
        // 위로 드래그: 다음 카드로 (마지막 카드에서는 튕김)
        if (currentIndex < items.length - 1) {
          setCards((prev) => {
            const next = [...prev];
            next.push(next.shift()!);
            return next;
          });
        }
      } else if (info.offset.y > threshold) {
        // 아래로 드래그: 이전 카드로 (첫 카드에서는 튕김)
        if (currentIndex > 0) {
          setCards((prev) => {
            const next = [...prev];
            next.unshift(next.pop()!);
            return next;
          });
        }
      }
    },
    [cards, items]
  );

  return (
    <div className={className ?? "relative h-60 w-60 md:h-60 md:w-96"}>
      {cards.map((card, index) => (
        <motion.div
          key={card.id}
          className={
            cardClassName ??
            "absolute inset-x-0 top-0 rounded-2xl border border-border/50 bg-card shadow-lg overflow-hidden flex flex-col dark:bg-black dark:border-white/[0.1]"
          }
          style={{
            transformOrigin: "top center",
            touchAction: "none",
          }}
          animate={{
            top: index * offset,
            scale: 1 - index * scaleFactor,
            zIndex: cards.length - index,
          }}
          drag={index === 0 ? "y" : false}
          dragConstraints={{ top: -200, bottom: 200 }}
          dragElastic={0.3}
          onDragEnd={index === 0 ? handleDragEnd : undefined}
        >
          {card.content}
        </motion.div>
      ))}
    </div>
  );
}

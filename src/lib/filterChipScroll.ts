/**
 * 필터 칩 행의 스크롤·드래그 처리와 드롭다운 라벨 조립.
 *
 * 컴포넌트가 아닌 값·함수라 별도 모듈로 둔다(같은 파일에 두면 fast refresh가 깨진다).
 */
import type { MutableRefObject, PointerEvent } from "react";

export function getFilterDropdownLabel<T extends string>(
  filterLabel: string,
  order: readonly T[],
  activeChips: ReadonlySet<T>,
  labelMap: Record<T, string>
): string {
  const allLabel = labelMap["all" as T];

  if (activeChips.has("all" as T)) {
    return `${filterLabel} - ${allLabel}`;
  }

  const selected = order
    .filter((id) => id !== "all" && activeChips.has(id))
    .map((id) => labelMap[id]);

  if (selected.length === 0) {
    return `${filterLabel} - ${allLabel}`;
  }

  return `${filterLabel} - ${selected.join(", ")}`;
}


export const FILTER_CHIP_ROW_VIEWPORT_CLASS =
  "w-full min-w-0 overflow-x-scroll overscroll-x-contain pl-4 pr-4 pointer-events-none [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export const FILTER_CHIP_ROW_INNER_CLASS =
  "flex w-max flex-nowrap gap-2 pointer-events-auto touch-pan-x [&_button]:touch-pan-x";

const FILTER_CHIP_SCROLL_DRAG_THRESHOLD_PX = 8;

export type FilterChipScrollDragState = {
  tracking: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  dragged: boolean;
};

export const INITIAL_FILTER_CHIP_SCROLL_DRAG_STATE: FilterChipScrollDragState = {
  tracking: false,
  pointerId: -1,
  startX: 0,
  startY: 0,
  dragged: false,
};

export function createFilterChipScrollDragHandlers(
  dragRef: MutableRefObject<FilterChipScrollDragState>
) {
  const endPointer = (pointerId: number) => {
    const state = dragRef.current;
    if (pointerId !== state.pointerId) return;
    state.tracking = false;
    if (state.dragged) {
      requestAnimationFrame(() => {
        dragRef.current.dragged = false;
      });
    }
  };

  return {
    onPointerDownCapture: (event: PointerEvent<HTMLDivElement>) => {
      dragRef.current = {
        tracking: true,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        dragged: false,
      };
    },
    onPointerMoveCapture: (event: PointerEvent<HTMLDivElement>) => {
      const state = dragRef.current;
      if (!state.tracking || event.pointerId !== state.pointerId) return;

      const deltaX = Math.abs(event.clientX - state.startX);
      const deltaY = Math.abs(event.clientY - state.startY);
      if (deltaX > FILTER_CHIP_SCROLL_DRAG_THRESHOLD_PX && deltaX > deltaY) {
        state.dragged = true;
      }
    },
    onPointerUpCapture: (event: PointerEvent<HTMLDivElement>) => {
      endPointer(event.pointerId);
    },
    onPointerCancelCapture: (event: PointerEvent<HTMLDivElement>) => {
      endPointer(event.pointerId);
    },
  };
}

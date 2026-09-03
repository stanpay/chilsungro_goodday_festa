/**
 * 매장 필터 칩 UI — 가로 칩 행과 드롭다운 칩.
 *
 * Main.tsx 분해 3단계. 상태를 갖지 않는 프레젠테이션 컴포넌트라 그대로 옮겼다.
 * 칩 목록·선택값·적용 콜백은 모두 호출부에서 주입한다.
 */
import {
  forwardRef,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type MutableRefObject,
  type PointerEvent,
} from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppLocale } from "@/contexts/AppLocaleContext";
import { mainStrings } from "@/lib/locale";
import { cn } from "@/lib/utils";
import {
  getFilterDropdownLabel,
  type FilterChipScrollDragState,
} from "@/lib/filterChipScroll";


type FilterDropdownChipProps<T extends string> = {
  filterLabel: string;
  order: readonly T[];
  activeChips: ReadonlySet<T>;
  onApply: (next: Set<T>) => void;
  labelMap: Record<T, string>;
  ariaLabel: string;
  scrollDragRef: MutableRefObject<FilterChipScrollDragState>;
};

export const ChipButton = forwardRef<
  HTMLButtonElement,
  {
    id: string;
    active: boolean;
    label: string;
    onToggle?: () => void;
    showChevron?: boolean;
    primaryBorder?: boolean;
  } & ButtonHTMLAttributes<HTMLButtonElement>
>(function ChipButton(
  { id, active, label, onToggle, showChevron = false, primaryBorder = false, className, onClick, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={active}
      onClick={(event) => {
        onClick?.(event);
        onToggle?.();
      }}
      className={cn(
        "pointer-events-auto flex shrink-0 items-center justify-center gap-1 rounded-full border px-3 py-1.5 font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : primaryBorder
            ? "border-primary bg-card text-foreground hover:bg-muted/80 focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-primary/20"
            : "border-border bg-card text-foreground hover:bg-muted/80",
        className
      )}
      {...rest}
    >
      {id === "openNow" && (
        <span
          className={cn(
            "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
            active ? "bg-green-300" : "bg-green-500"
          )}
        />
      )}
      <span className="whitespace-nowrap text-xs">{label}</span>
      {showChevron && <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />}
    </button>
  );
});

export function FilterDropdownChip<T extends string>({
  filterLabel,
  order,
  activeChips,
  onApply,
  labelMap,
  ariaLabel,
  scrollDragRef,
}: FilterDropdownChipProps<T>) {
  const { locale } = useAppLocale();
  const t = mainStrings(locale);
  const [open, setOpen] = useState(false);
  const [draftChips, setDraftChips] = useState<Set<T>>(() => new Set(activeChips));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const triggerLabel = getFilterDropdownLabel(filterLabel, order, activeChips, labelMap);

  const closeMenu = () => {
    setOpen(false);
    triggerRef.current?.blur();
  };

  const toggleDraft = (id: T) => {
    setDraftChips((prev) => {
      if (id === "all") return new Set<T>(["all" as T]);

      const next = new Set(prev);
      next.delete("all" as T);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) next.add("all" as T);
      return next;
    });
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeMenu();
      }}
    >
      <DropdownMenuTrigger asChild>
        <ChipButton
          ref={triggerRef}
          id={`filter-${filterLabel}`}
          active={!(activeChips as ReadonlySet<string>).has("all")}
          label={triggerLabel}
          showChevron
          primaryBorder
          aria-label={ariaLabel}
          aria-expanded={open}
          className="pointer-events-auto"
          onPointerDown={(event) => {
            event.preventDefault();
          }}
          onPointerLeave={(event) => event.currentTarget.blur()}
          onPointerCancel={(event) => event.currentTarget.blur()}
          onPointerUp={(event) => event.currentTarget.blur()}
          onClick={(event) => {
            if (scrollDragRef.current.dragged) {
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            setOpen((prev) => {
              if (!prev) setDraftChips(new Set(activeChips));
              return !prev;
            });
          }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52 p-1.5">
        {order.map((id) => (
          <DropdownMenuItem
            key={id}
            onSelect={(event) => {
              event.preventDefault();
              toggleDraft(id);
            }}
            className="gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"
          >
            <Checkbox checked={draftChips.has(id)} className="pointer-events-none" tabIndex={-1} />
            {labelMap[id]}
          </DropdownMenuItem>
        ))}
        <div className="mt-1 border-t pt-1.5">
          <Button
            type="button"
            className="h-9 w-full rounded-lg text-sm"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={() => {
              onApply(new Set(draftChips));
              closeMenu();
            }}
          >
            {t.filterConfirm}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { LayoutGrid, Map } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { mainStrings } from "@/lib/locale";
import { useAppLocale } from "@/contexts/AppLocaleContext";

export type BottomNavMapViewControl = {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

type BottomNavProps = {
  mapViewControl?: BottomNavMapViewControl;
  /** 지도뷰 검색 키보드 등 — 레이아웃은 유지하고 화면에서만 숨김 */
  hidden?: boolean;
};

const BottomNav = ({ mapViewControl, hidden = false }: BottomNavProps) => {
  const location = useLocation();
  const { locale } = useAppLocale();
  const nav = mainStrings(locale);

  const mapOpenFromUrl =
    location.pathname === "/main" &&
    new URLSearchParams(location.search).get("map") === "1";
  const mapOpen = mapViewControl?.active ?? mapOpenFromUrl;

  const isHomeActive = location.pathname === "/main" && !mapOpen;
  const isMapNavActive = mapViewControl
    ? mapViewControl.active
    : mapOpenFromUrl;

  return (
    <nav
      aria-hidden={hidden}
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card pb-0",
        hidden
          ? "pointer-events-none invisible h-0 min-h-0 overflow-hidden border-0 bg-transparent"
          : "transition-[opacity,transform] duration-[180ms] ease-out"
      )}
    >
      <div className="max-w-md mx-auto flex justify-around items-center h-16">
        <Link
          to="/main"
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full transition-colors",
            isHomeActive ? "text-primary" : "text-muted-foreground"
          )}
        >
          <LayoutGrid className={cn("w-6 h-6 mb-1", isHomeActive && "fill-current")} />
          <span className="text-xs font-medium">{nav.bottomNavCardView}</span>
        </Link>

        {mapViewControl ? (
          <button
            type="button"
            disabled={mapViewControl.disabled}
            onClick={(e) => {
              e.preventDefault();
              if (mapViewControl.disabled) return;
              mapViewControl.onToggle();
            }}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full transition-colors",
              mapViewControl.active ? "text-primary" : "text-muted-foreground",
              mapViewControl.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:opacity-90"
            )}
          >
            <Map
              className={cn("w-6 h-6 mb-1", mapViewControl.active && "fill-current")}
            />
            <span className="text-xs font-medium">{nav.bottomNavMapView}</span>
          </button>
        ) : (
          <Link
            to="/main?map=1"
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full transition-colors",
              isMapNavActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Map className={cn("w-6 h-6 mb-1", isMapNavActive && "fill-current")} />
            <span className="text-xs font-medium">{nav.bottomNavMapView}</span>
          </Link>
        )}
      </div>
    </nav>
  );
};

export default BottomNav;

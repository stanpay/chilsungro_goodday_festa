import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { GA_MEASUREMENT_ID, isAnalyticsEnabled } from "@/lib/analytics";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const AnalyticsPageTracker = () => {
  const location = useLocation();

  useEffect(() => {
    if (!isAnalyticsEnabled()) return;

    window.gtag?.("config", GA_MEASUREMENT_ID, {
      page_path: location.pathname + location.search,
    });
  }, [location]);

  return null;
};

export default AnalyticsPageTracker;

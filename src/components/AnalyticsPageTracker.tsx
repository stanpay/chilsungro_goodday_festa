import { useEffect } from "react";
import { useLocation } from "react-router-dom";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_MEASUREMENT_ID = "G-65DN8J9G72";

const AnalyticsPageTracker = () => {
  const location = useLocation();

  useEffect(() => {
    window.gtag?.("config", GA_MEASUREMENT_ID, {
      page_path: location.pathname + location.search,
    });
  }, [location]);

  return null;
};

export default AnalyticsPageTracker;

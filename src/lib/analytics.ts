export const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
export const CLARITY_PROJECT_ID = import.meta.env.VITE_CLARITY_PROJECT_ID;

export const isAnalyticsEnabled = () => Boolean(GA_MEASUREMENT_ID);
export const isClarityEnabled = () => Boolean(CLARITY_PROJECT_ID);

export const initClarity = () => {
  if (!isClarityEnabled()) return;

  (function (c, l, a, r, i, t, y) {
    c[a] =
      c[a] ||
      function (...args: unknown[]) {
        (c[a].q = c[a].q || []).push(args);
      };
    t = l.createElement(r);
    t.async = 1;
    t.src = "https://www.clarity.ms/tag/" + i;
    y = l.getElementsByTagName(r)[0];
    y.parentNode?.insertBefore(t, y);
  })(window, document, "clarity", "script", CLARITY_PROJECT_ID);
};

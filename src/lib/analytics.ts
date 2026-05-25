export const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

export const isAnalyticsEnabled = () => Boolean(GA_MEASUREMENT_ID);

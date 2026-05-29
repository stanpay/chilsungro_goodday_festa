import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Main from "./pages/Main";
import Location from "./pages/Location";
import NotFound from "./pages/NotFound";

import PwaInstallPrompt from "./components/PwaInstallPrompt";
import LandingPage from "./pages/Landing/LandingPage";
import RedirectToJeju from "./pages/RedirectToJeju";
import DevTools from "./pages/DevTools";
import { AppLocaleProvider } from "@/contexts/AppLocaleContext";
import { AuthProvider } from "@/contexts/AuthContext";
import AnalyticsPageTracker from "@/components/AnalyticsPageTracker";
import NaverMapFallbackDialog from "@/components/NaverMapFallbackDialog";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppLocaleProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AnalyticsPageTracker />
        <Routes>
          <Route path="/" element={<Main />} />
          <Route path="/jeju" element={<Main />} />
          <Route path="/main" element={<Main />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/location" element={<Location />} />
          <Route path="/jejuqronedosim" element={<RedirectToJeju />} />
          <Route path="/dev-tools-9f3k" element={<DevTools />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <PwaInstallPrompt />
        <NaverMapFallbackDialog />
      </BrowserRouter>
      </AppLocaleProvider>
    </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

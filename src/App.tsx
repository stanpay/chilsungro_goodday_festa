import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Main은 "/"·"/jeju"·"/main"이 모두 가리키는 사실상의 진입 화면이다.
// 지연 로드하면 초기 진입에 오히려 요청 단계가 하나 늘어나 정적으로 유지한다.
import Main from "./pages/Main";
import PwaInstallPrompt from "./components/PwaInstallPrompt";

// 진입 직후에는 필요 없는 라우트는 별도 청크로 분리한다
const Location = lazy(() => import("./pages/Location"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LandingPage = lazy(() => import("./pages/Landing/LandingPage"));
const RedirectToJeju = lazy(() => import("./pages/RedirectToJeju"));
const NavigatePage = lazy(() => import("./pages/Navigate"));

// 개발 전용 페이지는 정적 import를 유지한다.
// lazy()로 바꾸면 동적 import가 프로덕션에서도 별도 청크로 방출되어
// import.meta.env.DEV 가드가 무달해진다.
import DevTools from "./pages/DevTools";
import FilterLegacyDemo from "./pages/FilterLegacyDemo";
import FilterDropdownLegacyDemo from "./pages/FilterDropdownLegacyDemo";
import { AppLocaleProvider } from "@/contexts/AppLocaleContext";
import AnalyticsPageTracker from "@/components/AnalyticsPageTracker";
import NaverMapFallbackDialog from "@/components/NaverMapFallbackDialog";
import ErrorBoundary from "@/components/ErrorBoundary";

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
    <ErrorBoundary>
    <TooltipProvider>
      <Toaster />
      <AppLocaleProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AnalyticsPageTracker />
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <Routes>
          <Route path="/" element={<Navigate to="/main" replace />} />
          <Route path="/jeju" element={<Main />} />
          <Route path="/main" element={<Main />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/location" element={<Location />} />
          <Route path="/navigate" element={<NavigatePage />} />
          <Route path="/jejuqronedosim" element={<RedirectToJeju />} />
          {/* 개발 전용 — import.meta.env.DEV가 프로덕션 빌드에서 false로 치환되어
              라우트와 해당 컴포넌트가 번들에서 제거된다 */}
          {import.meta.env.DEV && (
            <>
              <Route path="/dev-tools-9f3k" element={<DevTools />} />
              <Route path="/filter-legacy-demo" element={<FilterLegacyDemo />} />
              <Route path="/filter-dropdown-legacy-demo" element={<FilterDropdownLegacyDemo />} />
            </>
          )}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        <PwaInstallPrompt />
        <NaverMapFallbackDialog />
      </BrowserRouter>
      </AppLocaleProvider>
    </TooltipProvider>
    </ErrorBoundary>
  </QueryClientProvider>
);

export default App;

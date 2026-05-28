import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Main from "./pages/Main";
import TutorialMain from "./pages/TutorialMain";
import Location from "./pages/Location";
import Sell from "./pages/Sell";
import SellResult from "./pages/SellResult";
import SellResultDetail from "./pages/SellResultDetail";
import BarcodePrototype from "./pages/BarcodePrototype";
import MyPage from "./pages/MyPage";
import MyGifticons from "./pages/MyGifticons";
import History from "./pages/History";
import DiscountCoupon from "./pages/DiscountCoupon";
import NotFound from "./pages/NotFound";

const Payment = lazy(() => import("./pages/Payment"));
const TutorialPayment = lazy(() => import("./pages/TutorialPayment"));
const PaymentMethods = lazy(() => import("./pages/PaymentMethods"));
const OneTouchPayment = lazy(() => import("./pages/OneTouchPayment"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentFail = lazy(() => import("./pages/PaymentFail"));
import ChatSupport from "./components/ChatSupport";
import PwaInstallPrompt from "./components/PwaInstallPrompt";
import MembershipManagement from "./pages/MembershipManagement";
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
        <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Main />} />
          <Route path="/jeju" element={<Main />} />
          <Route path="/main" element={<Main />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/tutorial" element={<TutorialMain />} />
          <Route path="/location" element={<Location />} />
          <Route path="/jejuqronedosim" element={<RedirectToJeju />} />
          <Route path="/sell" element={<Sell />} />
          <Route path="/sell/result/:jobId" element={<SellResult />} />
          <Route path="/sell/result/:jobId/detail" element={<SellResultDetail />} />
          <Route path="/payment/:storeId" element={<Payment />} />
          <Route path="/tutorial/payment/:storeId" element={<TutorialPayment />} />
          {/* 프로토타입 라우트: 인증 없이 배포 환경에서 직접 접근 가능 */}
          <Route path="/prototype/barcode/:storeId" element={<BarcodePrototype />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/my-gifticons" element={<MyGifticons />} />
          <Route path="/history" element={<History />} />
          <Route path="/one-touch-payment" element={<OneTouchPayment />} />
          <Route path="/discount-coupon" element={<DiscountCoupon />} />
          <Route path="/payment-methods" element={<PaymentMethods />} />
          <Route path="/membership-management" element={<MembershipManagement />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/payment-fail" element={<PaymentFail />} />
          <Route path="/dev-tools-9f3k" element={<DevTools />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        <ChatSupport />
        <PwaInstallPrompt />
        <NaverMapFallbackDialog />
      </BrowserRouter>
      </AppLocaleProvider>
    </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

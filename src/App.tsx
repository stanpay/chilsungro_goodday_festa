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
import Payment from "./pages/Payment";
import TutorialPayment from "./pages/TutorialPayment";
import BarcodePrototype from "./pages/BarcodePrototype";
import MyPage from "./pages/MyPage";
import MyGifticons from "./pages/MyGifticons";
import History from "./pages/History";
import PaymentMethods from "./pages/PaymentMethods";
import OneTouchPayment from "./pages/OneTouchPayment";
import DiscountCoupon from "./pages/DiscountCoupon";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentFail from "./pages/PaymentFail";
import NotFound from "./pages/NotFound";
import ChatSupport from "./components/ChatSupport";
import PwaInstallPrompt from "./components/PwaInstallPrompt";
import MembershipManagement from "./pages/MembershipManagement";
import LandingPage from "./pages/Landing/LandingPage";
import RedirectToJeju from "./pages/RedirectToJeju";
import { AppLocaleProvider } from "@/contexts/AppLocaleContext";
import { AuthProvider } from "@/contexts/AuthContext";

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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <ChatSupport />
        <PwaInstallPrompt />
      </BrowserRouter>
      </AppLocaleProvider>
    </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

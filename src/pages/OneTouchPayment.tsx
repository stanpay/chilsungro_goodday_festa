import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Zap, Shield, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/hooks/use-toast";
import { initBrandPay } from "@/lib/tossPayments";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/use-user-settings";
import { useAuth } from "@/contexts/AuthContext";

const OneTouchPayment = () => {
  const { toast } = useToast();
  const { user, isLoggedIn, isLoading: authLoading } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const { data: settings, isLoading } = useUserSettings();
  const updateSettings = useUpdateUserSettings();

  const isEnabled = settings?.one_touch_payment_enabled ?? false;

  const handleToggle = async (enabled: boolean) => {
    if (!isLoggedIn) {
      toast({ title: "원터치 결제를 사용할 수 없습니다", variant: "destructive" });
      return;
    }
    if (enabled && !isEnabled) {
      await registerOneTouchPayment();
    } else {
      updateSettings.mutate({ one_touch_payment_enabled: false }, {
        onSuccess: () => {
          toast({ title: "원터치 결제 해제 완료", description: "원터치 결제가 해제되었습니다." });
        },
      });
    }
  };

  const registerOneTouchPayment = async () => {
    if (!user) return;
    try {
      setIsRegistering(true);
      const customerKey = `customer_${user.id.replace(/-/g, "").substring(0, 20)}`;
      const brandpay = await initBrandPay(customerKey);
      await brandpay.redirect({ redirectUrl: `${window.location.origin}/callback-auth`, eventType: "REGISTER" });
    } catch (error: any) {
      console.error("원터치 결제 등록 오류:", error);
      toast({ title: "등록 실패", description: error.message || "원터치 결제 등록 중 오류가 발생했습니다.", variant: "destructive" });
      setIsRegistering(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/mypage"><ChevronLeft className="w-6 h-6" /></Link>
          <h1 className="text-xl font-bold">원터치 결제</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">빠른 결제</h2>
              <p className="text-sm text-muted-foreground">한 번 등록하면 간편하게 결제하세요</p>
            </div>
          </div>
        </div>

        {!isLoggedIn && (
          <div className="text-center py-4 mb-4 text-muted-foreground bg-card rounded-xl border border-border">
            원터치 결제를 사용할 수 없습니다
          </div>
        )}

        <Card className="p-6 mb-6 rounded-xl border-border/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-medium">원터치 결제 활성화</h3>
                <p className="text-sm text-muted-foreground">
                  {isEnabled ? "현재 활성화되어 있습니다" : "등록 후 사용 가능합니다"}
                </p>
              </div>
            </div>
            <Switch checked={isEnabled} onCheckedChange={handleToggle} disabled={!isLoggedIn || isRegistering} />
          </div>
          {!isEnabled && (
            <Button onClick={() => handleToggle(true)} disabled={!isLoggedIn || isRegistering} className="w-full mt-4">
              {isRegistering ? "등록 중..." : "원터치 결제 등록하기"}
            </Button>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-4 rounded-xl border-border/50">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-medium mb-1">안전한 결제</h3>
                <p className="text-sm text-muted-foreground">토스페이먼츠의 보안 시스템으로 안전하게 결제 정보를 관리합니다.</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 rounded-xl border-border/50">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-medium mb-1">간편한 사용</h3>
                <p className="text-sm text-muted-foreground">등록한 결제 수단으로 빠르고 간편하게 결제할 수 있습니다.</p>
              </div>
            </div>
          </Card>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default OneTouchPayment;

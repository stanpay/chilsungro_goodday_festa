import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/use-user-settings";
import { useAuth } from "@/contexts/AuthContext";

const methods = [
  { id: "kakaopay" as const, label: "카카오페이" },
  { id: "samsungpay" as const, label: "삼성페이" },
  { id: "naverpay" as const, label: "네이버페이" },
  { id: "payco" as const, label: "페이코" },
  { id: "tosspay" as const, label: "토스페이" },
  { id: "kbpay" as const, label: "KB Pay" },
  { id: "shinhan" as const, label: "신한 SOL Pay" },
];

const PaymentMethods = () => {
  const { isLoggedIn, isLoading: authLoading } = useAuth();
  const { data: settings, isLoading } = useUserSettings();
  const updateSettings = useUpdateUserSettings();

  const handleToggle = (method: typeof methods[number]["id"]) => {
    if (!settings) return;
    updateSettings.mutate({ [method]: !settings[method] });
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
          <h1 className="text-xl font-bold">현장 결제 수단</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        <p className="text-sm text-muted-foreground mb-4">현장에서 사용할 결제수단을 선택해주세요</p>

        {!isLoggedIn && (
          <div className="text-center py-4 mb-4 text-muted-foreground bg-card rounded-xl border border-border">
            결제 수단 설정을 사용할 수 없습니다
          </div>
        )}

        <div className="space-y-2">
          {methods.map((method) => (
            <Card key={method.id} className="p-4 flex items-center justify-between rounded-xl border-border/50">
              <span className="font-medium">{method.label}</span>
              <Switch
                checked={settings?.[method.id] ?? false}
                onCheckedChange={() => handleToggle(method.id)}
                disabled={!isLoggedIn || updateSettings.isPending}
              />
            </Card>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default PaymentMethods;

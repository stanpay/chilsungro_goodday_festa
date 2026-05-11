import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PaymentMethods = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  const [paymentMethods, setPaymentMethods] = useState({
    kakaopay: false,
    samsungpay: false,
    naverpay: false,
    payco: false,
    tosspay: false,
    kbpay: false,
    shinhan: false,
  });

  const navigate = useNavigate();

  useEffect(() => {
    const checkUserAndLoadSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setIsLoggedIn(true);
        
        // Load user's settings from database
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', session.user.id)
          .single();

        if (data && !error) {
          setPaymentMethods({
            kakaopay: data.kakaopay,
            samsungpay: data.samsungpay,
            naverpay: data.naverpay,
            payco: data.payco,
            tosspay: data.tosspay,
            kbpay: data.kbpay,
            shinhan: data.shinhan,
          });
        }
      } else {
        setIsLoggedIn(false);
      }
      
      setLoading(false);
    };

    checkUserAndLoadSettings();
  }, [navigate]);

  const handleToggle = async (method: keyof typeof paymentMethods) => {
    if (!isLoggedIn) {
      toast({
        title: "설정을 변경할 수 없습니다",
        variant: "destructive",
      });
      return;
    }

    const newState = {
      ...paymentMethods,
      [method]: !paymentMethods[method],
    };
    setPaymentMethods(newState);

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase
        .from('user_settings')
        .update({ [method]: newState[method] })
        .eq('user_id', session.user.id);
    }
  };

  const methods = [
    { id: "kakaopay" as const, label: "카카오페이" },
    { id: "samsungpay" as const, label: "삼성페이" },
    { id: "naverpay" as const, label: "네이버페이" },
    { id: "payco" as const, label: "페이코" },
    { id: "tosspay" as const, label: "토스페이" },
    { id: "kbpay" as const, label: "KB Pay" },
    { id: "shinhan" as const, label: "신한 SOL Pay" },
  ];

  if (loading) {
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
          <Link to="/mypage">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold">현장 결제 수단</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        <p className="text-sm text-muted-foreground mb-4">
          현장에서 사용할 결제수단을 선택해주세요
        </p>

        {!isLoggedIn && (
          <div className="text-center py-4 mb-4 text-muted-foreground bg-card rounded-xl border border-border">
            결제 수단 설정을 사용할 수 없습니다
          </div>
        )}

        <div className="space-y-2">
          {methods.map((method) => (
            <Card
              key={method.id}
              className="p-4 flex items-center justify-between rounded-xl border-border/50"
            >
              <span className="font-medium">{method.label}</span>
              <Switch
                checked={paymentMethods[method.id]}
                onCheckedChange={() => handleToggle(method.id)}
                disabled={!isLoggedIn}
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

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ChevronRight, History, Settings, Package, Zap, Ticket, BookOpen } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { isOperator } from "@/lib/admin";

const MyPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userEmail, setUserEmail] = useState<string>("user@example.com");
  const [userName, setUserName] = useState<string>("사용자");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [totalDiscount, setTotalDiscount] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const email = session.user.email || "";
        setUserEmail(email);
        
        // 이메일 앞부분을 이름으로 사용
        const displayName = email.split("@")[0];
        setUserName(displayName);
        setIsLoggedIn(true);

        // 총 할인 금액 계산 (구매한 기프티콘들의 원가 합계)
        const { data: gifticons, error: gifticonsError } = await supabase
          .from('gifticons')
          .select('original_price')
          .eq('user_id', session.user.id);

        if (gifticons && !gifticonsError) {
          // 사용자가 구매한 기프티콘들의 원가 합계를 할인 금액으로 계산
          // 실제로는 원가 - 실제 결제 금액이지만, 여기서는 원가 합계를 표시
          const discount = gifticons.reduce((sum, g) => sum + (g.original_price || 0), 0);
          setTotalDiscount(discount);
        }

        // 운영자 확인
        const admin = await isOperator();
        setIsAdmin(admin);
      } else {
        setLoading(false);
        return;
      }
      
      setLoading(false);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUserEmail("user@example.com");
        setUserName("사용자");
        setIsLoggedIn(false);
        setTotalDiscount(0);
      } else if (session) {
        const email = session.user.email || "";
        setUserEmail(email);
        const displayName = email.split("@")[0];
        setUserName(displayName);
        setIsLoggedIn(true);
        
        // 총 할인 금액 계산
        supabase
          .from('gifticons')
          .select('original_price')
          .eq('user_id', session.user.id)
          .then(({ data: gifticons, error: gifticonsError }) => {
            if (gifticons && !gifticonsError) {
              const discount = gifticons.reduce((sum, g) => sum + (g.original_price || 0), 0);
              setTotalDiscount(discount);
            }
          });
      }
    });

    return () => subscription.unsubscribe();
  }, []);


  const handleTutorial = () => {
    navigate("/tutorial");
  };

  const menuItems = [
    { icon: History, label: "결제 내역", path: "/history" },
    { icon: Zap, label: "원터치 결제", path: "/one-touch-payment" },
    { icon: Ticket, label: "할인쿠폰", path: "/discount-coupon" },
    { icon: Settings, label: "현장 결제 수단", path: "/payment-methods" },
    { icon: Package, label: "멤버십 관리", path: "/membership-management" },
    { icon: Settings, label: "설정", path: "/settings" },
  ];

  const adminMenuItems: Array<{ icon: typeof Package; label: string; path: string }> = [];

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <main className="max-w-md mx-auto px-4 py-6">
        {/* Profile Section */}
        <Card className="p-6 mb-6 rounded-2xl border-border/50">
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-1">{userName}님</h2>
            <p className="text-sm text-muted-foreground">{userEmail}</p>
          </div>

          {/* Total Discount */}
          <div className="pt-4 text-center">
            <p className="text-2xl font-bold text-primary">
              총 {totalDiscount.toLocaleString()}원 할인받았어요!
            </p>
          </div>
        </Card>

        {/* 튜토리얼 해보기 버튼 */}
        <Card className="mb-6 rounded-xl border-border/50 overflow-hidden">
          <button
            onClick={handleTutorial}
            className="w-full group p-4 flex items-center justify-between hover:bg-primary transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
                <BookOpen className="w-5 h-5 text-primary group-hover:text-white transition-colors" />
              </div>
              <span className="font-medium group-hover:text-white transition-colors">튜토리얼 해보기</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-white transition-colors" />
          </button>
        </Card>

        {/* Menu Items */}
        <Card className="mb-6 rounded-xl border-border/50 overflow-hidden">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.path}>
                <Link to={item.path}>
                  <div className="group p-4 flex items-center justify-between hover:bg-primary transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
                        <Icon className="w-5 h-5 text-primary group-hover:text-white transition-colors" />
                      </div>
                      <span className="font-medium group-hover:text-white transition-colors">{item.label}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-white transition-colors" />
                  </div>
                </Link>
                {index < menuItems.length - 1 && <Separator />}
              </div>
            );
          })}
        </Card>

        {/* Admin Menu Items */}
        {isAdmin && (
          <div className="space-y-2 mb-6">
            {adminMenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.path} to={item.path}>
                  <Card className="p-4 flex items-center justify-between hover:bg-accent transition-colors cursor-pointer rounded-xl border-border/50 border-l-4 border-l-primary">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  );
};

export default MyPage;

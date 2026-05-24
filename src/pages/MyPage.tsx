import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ChevronRight, History, Settings, Package, Zap, Ticket, BookOpen } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useGifticons } from "@/hooks/use-gifticons";
import { useIsAdmin } from "@/hooks/use-admin";

const MyPage = () => {
  const navigate = useNavigate();
  const { user, isLoggedIn, isLoading } = useAuth();
  const { data: gifticons = [] } = useGifticons();
  const { data: isAdmin = false } = useIsAdmin();

  const userName = user?.email?.split("@")[0] ?? "사용자";
  const userEmail = user?.email ?? "";
  const totalDiscount = gifticons.reduce((sum, g) => sum + (g.original_price || 0), 0);

  const menuItems = [
    { icon: History, label: "결제 내역", path: "/history" },
    { icon: Zap, label: "원터치 결제", path: "/one-touch-payment" },
    { icon: Ticket, label: "할인쿠폰", path: "/discount-coupon" },
    { icon: Settings, label: "현장 결제 수단", path: "/payment-methods" },
    { icon: Package, label: "멤버십 관리", path: "/membership-management" },
    { icon: Settings, label: "설정", path: "/settings" },
  ];

  if (isLoading) {
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
          <div className="pt-4 text-center">
            <p className="text-2xl font-bold text-primary">
              총 {totalDiscount.toLocaleString()}원 할인받았어요!
            </p>
          </div>
        </Card>

        {/* 튜토리얼 해보기 버튼 */}
        <Card className="mb-6 rounded-xl border-border/50 overflow-hidden">
          <button
            onClick={() => navigate("/tutorial")}
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
      </main>

      <BottomNav />
    </div>
  );
};

export default MyPage;

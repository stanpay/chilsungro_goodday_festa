import { Card } from "@/components/ui/card";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { useGifticons } from "@/hooks/use-gifticons";

const MyPage = () => {
  const { user, isLoading } = useAuth();
  const { data: gifticons = [] } = useGifticons();

  const userName = user?.email?.split("@")[0] ?? "사용자";
  const userEmail = user?.email ?? "";
  const totalDiscount = gifticons.reduce((sum, g) => sum + (g.original_price || 0), 0);

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
        <Card className="p-6 rounded-2xl border-border/50">
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
      </main>

      <BottomNav />
    </div>
  );
};

export default MyPage;

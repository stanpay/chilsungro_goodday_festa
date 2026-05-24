import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Ticket, Calendar, CheckCircle2, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCoupons } from "@/hooks/use-coupons";
import type { Coupon } from "@/api/coupons";

const formatDiscount = (coupon: Coupon) =>
  coupon.discount_type === "percent"
    ? `${coupon.discount_value}%`
    : `${coupon.discount_value.toLocaleString()}원`;

const formatExpiryDate = (dateString: string) => {
  const date = new Date(dateString);
  const diffDays = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "만료됨";
  if (diffDays === 0) return "오늘까지";
  if (diffDays <= 7) return `${diffDays}일 남음`;
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
};

const DiscountCoupon = () => {
  const { data: coupons = [], isLoading } = useCoupons();
  const availableCoupons = coupons.filter((c) => c.status === "available");
  const usedCoupons = coupons.filter((c) => c.status === "used" || c.status === "expired");

  if (isLoading) {
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
          <h1 className="text-xl font-bold">할인쿠폰</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        <Tabs defaultValue="available" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="available">사용 가능 ({availableCoupons.length})</TabsTrigger>
            <TabsTrigger value="used">사용/만료 ({usedCoupons.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="space-y-4">
            {availableCoupons.length === 0 ? (
              <Card className="p-8 text-center rounded-xl border-border/50">
                <Ticket className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">사용 가능한 쿠폰이 없습니다</p>
              </Card>
            ) : (
              availableCoupons.map((coupon) => (
                <Card key={coupon.id} className="p-4 rounded-xl border-border/50 overflow-hidden relative">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Ticket className="w-5 h-5 text-primary" />
                        <h3 className="font-bold text-lg">{coupon.name}</h3>
                        <Badge variant="secondary" className="ml-auto">{formatDiscount(coupon)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{coupon.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {coupon.min_purchase_amount && (
                          <span>최소 {coupon.min_purchase_amount.toLocaleString()}원 이상 구매</span>
                        )}
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatExpiryDate(coupon.expiry_date)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="used" className="space-y-4">
            {usedCoupons.length === 0 ? (
              <Card className="p-8 text-center rounded-xl border-border/50">
                <Ticket className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">사용한 쿠폰이 없습니다</p>
              </Card>
            ) : (
              usedCoupons.map((coupon) => (
                <Card key={coupon.id} className="p-4 rounded-xl border-border/50 opacity-60">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {coupon.status === "used" ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-muted-foreground" />
                        )}
                        <h3 className="font-bold text-lg">{coupon.name}</h3>
                        <Badge variant="outline" className="ml-auto">{formatDiscount(coupon)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{coupon.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {coupon.used_at && (
                          <span>사용일: {new Date(coupon.used_at).toLocaleDateString("ko-KR")}</span>
                        )}
                        {coupon.status === "expired" && <span className="text-destructive">만료됨</span>}
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      <BottomNav />
    </div>
  );
};

export default DiscountCoupon;

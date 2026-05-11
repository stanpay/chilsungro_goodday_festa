import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Ticket, Calendar, CheckCircle2, XCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Coupon {
  id: string;
  name: string;
  description: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_purchase_amount: number | null;
  expiry_date: string;
  used_at: string | null;
  status: 'available' | 'used' | 'expired';
}

const DiscountCoupon = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [usedCoupons, setUsedCoupons] = useState<Coupon[]>([]);

  useEffect(() => {
    const checkUserAndLoadCoupons = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setIsLoggedIn(true);
        await loadCoupons(session.user.id);
      } else {
        setIsLoggedIn(false);
      }
      
      setLoading(false);
    };

    checkUserAndLoadCoupons();
  }, []);

  const loadCoupons = async (userId: string) => {
    try {
      // 사용 가능한 쿠폰 조회 (예시 - 실제 테이블 구조에 맞게 수정 필요)
      // 현재는 예시 데이터로 표시
      const now = new Date();
      
      // 예시 쿠폰 데이터 (실제로는 DB에서 조회)
      const exampleCoupons: Coupon[] = [
        {
          id: '1',
          name: '신규 가입 쿠폰',
          description: '3,000원 할인',
          discount_type: 'fixed',
          discount_value: 3000,
          min_purchase_amount: null,
          expiry_date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          used_at: null,
          status: 'available',
        },
        {
          id: '2',
          name: '생일 축하 쿠폰',
          description: '5,000원 할인',
          discount_type: 'fixed',
          discount_value: 5000,
          min_purchase_amount: 20000,
          expiry_date: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          used_at: null,
          status: 'available',
        },
        {
          id: '3',
          name: '이벤트 쿠폰',
          description: '15% 할인',
          discount_type: 'percent',
          discount_value: 15,
          min_purchase_amount: 30000,
          expiry_date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          used_at: null,
          status: 'expired',
        },
        {
          id: '4',
          name: '첫 구매 쿠폰',
          description: '3,000원 할인',
          discount_type: 'fixed',
          discount_value: 3000,
          min_purchase_amount: 15000,
          expiry_date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          used_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'used',
        },
      ];

      // 상태별로 분류
      const available = exampleCoupons.filter(c => c.status === 'available');
      const used = exampleCoupons.filter(c => c.status === 'used' || c.status === 'expired');

      setAvailableCoupons(available);
      setUsedCoupons(used);
    } catch (error: any) {
      console.error("쿠폰 로딩 오류:", error);
      toast({
        title: "쿠폰 로딩 실패",
        description: error.message || "쿠폰을 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const formatDiscount = (coupon: Coupon): string => {
    if (coupon.discount_type === 'percent') {
      return `${coupon.discount_value}%`;
    } else {
      return `${coupon.discount_value.toLocaleString()}원`;
    }
  };

  const formatExpiryDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return '만료됨';
    } else if (diffDays === 0) {
      return '오늘까지';
    } else if (diffDays <= 7) {
      return `${diffDays}일 남음`;
    } else {
      return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
    }
  };

  const handleUseCoupon = (coupon: Coupon) => {
    toast({
      title: "쿠폰 사용",
      description: `${coupon.name} 쿠폰을 사용하시겠습니까?`,
    });
    // 실제로는 결제 페이지로 이동하거나 쿠폰 적용 로직 실행
    navigate('/main');
  };

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
                <Card
                  key={coupon.id}
                  className="p-4 rounded-xl border-border/50 overflow-hidden relative"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Ticket className="w-5 h-5 text-primary" />
                        <h3 className="font-bold text-lg">{coupon.name}</h3>
                        <Badge variant="secondary" className="ml-auto">
                          {formatDiscount(coupon)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {coupon.description}
                      </p>
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
                <Card
                  key={coupon.id}
                  className="p-4 rounded-xl border-border/50 opacity-60"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {coupon.status === 'used' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-muted-foreground" />
                        )}
                        <h3 className="font-bold text-lg">{coupon.name}</h3>
                        <Badge variant="outline" className="ml-auto">
                          {formatDiscount(coupon)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {coupon.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {coupon.used_at && (
                          <span>
                            사용일: {new Date(coupon.used_at).toLocaleDateString('ko-KR')}
                          </span>
                        )}
                        {coupon.status === 'expired' && (
                          <span className="text-destructive">만료됨</span>
                        )}
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


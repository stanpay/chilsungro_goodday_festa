import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type MembershipKey =
  | "happyPoint"
  | "cjone"
  | "hPoint"
  | "lPoint"
  | "starbucks"
  | "ediya"
  | "twosome"
  | "composeCoffee"
  | "megaCoffee"
  | "paik";

const membershipKeyMap: Record<MembershipKey, string> = {
  happyPoint: "happy_point",
  cjone: "cjone",
  hPoint: "hpoint",
  lPoint: "lpoint",
  starbucks: "starbucks",
  ediya: "ediya",
  twosome: "twosome",
  composeCoffee: "compose_coffee",
  megaCoffee: "mega_coffee",
  paik: "paik",
};

const memberships: Array<{ id: MembershipKey; label: string; description?: string }> = [
  { id: "happyPoint", label: "해피포인트", description: "해피포인트 제휴 할인/적립 혜택" },
  { id: "cjone", label: "CJ ONE", description: "CJ ONE 적립/할인 카드" },
  { id: "hPoint", label: "H.Point", description: "H.Point 멤버십 결제 옵션" },
  { id: "lPoint", label: "L.POINT", description: "엘포인트 적립/사용" },
  { id: "starbucks", label: "스타벅스 리워드", description: "스타벅스 멤버십 등록 여부" },
  { id: "ediya", label: "이디야 멤버십", description: "이디야 멤버십 바코드 저장" },
  { id: "twosome", label: "투썸플레이스 멤버십", description: "투썸 멤버십 혜택 저장" },
  { id: "composeCoffee", label: "컴포즈커피 멤버십", description: "컴포즈커피 적립 정보" },
  { id: "megaCoffee", label: "메가커피 클럽", description: "메가커피 멤버십 등록" },
  { id: "paik", label: "빽다방 멤버십", description: "빽다방 멤버십 바코드 저장" },
];

const initialMembershipState: Record<MembershipKey, boolean> = {
  happyPoint: false,
  cjone: false,
  hPoint: false,
  lPoint: false,
  starbucks: false,
  ediya: false,
  twosome: false,
  composeCoffee: false,
  megaCoffee: false,
  paik: false,
};

const MembershipManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [membershipSettings, setMembershipSettings] = useState(initialMembershipState);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setLoading(false);
          return;
        }
        setIsLoggedIn(true);

        const { data, error } = await supabase
          .from("user_settings")
          .select(
            "happy_point, cjone, hpoint, lpoint, starbucks, ediya, twosome, compose_coffee, mega_coffee, paik"
          )
          .eq("user_id", session.user.id)
          .single();

        if (error && error.code !== "PGRST116") {
          console.error("멤버십 설정 로드 실패:", error);
          throw error;
        }

        if (data) {
          setMembershipSettings({
            happyPoint: !!data.happy_point,
            cjone: !!data.cjone,
            hPoint: !!data.hpoint,
            lPoint: !!data.lpoint,
            starbucks: !!data.starbucks,
            ediya: !!data.ediya,
            twosome: !!data.twosome,
            composeCoffee: !!data.compose_coffee,
            megaCoffee: !!data.mega_coffee,
            paik: !!data.paik,
          });
        }
      } catch (error: any) {
        console.error("멤버십 관리 로딩 오류:", error);
        toast({
          title: "멤버십 설정을 불러올 수 없습니다.",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [navigate, toast]);

  const handleToggle = async (key: MembershipKey) => {
    if (!isLoggedIn) {
      toast({
        title: "멤버십 설정을 변경할 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    const nextState = {
      ...membershipSettings,
      [key]: !membershipSettings[key],
    };
    setMembershipSettings(nextState);

    try {
      const snakeKey = membershipKeyMap[key];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("세션이 만료되었습니다.");
      }

      const { error } = await supabase
        .from("user_settings")
        .upsert(
          {
            user_id: session.user.id,
            [snakeKey]: nextState[key],
          },
          {
            onConflict: "user_id",
          }
        );

      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error("멤버십 설정 저장 오류:", error);
      toast({
        title: "변경 내용을 저장하지 못했습니다.",
        description: error.message || "다시 시도해주세요.",
        variant: "destructive",
      });
    }
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
          <h1 className="text-xl font-bold">멤버십 관리</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          멤버십 바코드/카드 등록 여부에 따라 할인 및 적립 혜택을 자동으로 적용합니다.
        </p>

        {!isLoggedIn && (
          <div className="text-center py-4 mb-4 text-muted-foreground bg-card rounded-xl border border-border">
            멤버십 관리를 사용할 수 없습니다.
          </div>
        )}

        <div className="space-y-2">
          {memberships.map((membership) => (
            <Card
              key={membership.id}
              className="p-4 flex items-center justify-between rounded-xl border-border/50"
            >
              <div>
                <p className="font-medium">{membership.label}</p>
                {membership.description && (
                  <p className="text-xs text-muted-foreground">{membership.description}</p>
                )}
              </div>
              <Switch
                checked={membershipSettings[membership.id]}
                onCheckedChange={() => handleToggle(membership.id)}
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

export default MembershipManagement;

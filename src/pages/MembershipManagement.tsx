import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/use-user-settings";
import { useAuth } from "@/contexts/AuthContext";
import type { UserSettings } from "@/api/userSettings";

type MembershipKey =
  | "happy_point" | "cjone" | "hpoint" | "lpoint"
  | "starbucks" | "ediya" | "twosome" | "compose_coffee"
  | "mega_coffee" | "paik";

const memberships: Array<{ id: MembershipKey; label: string; description?: string }> = [
  { id: "happy_point", label: "해피포인트", description: "해피포인트 제휴 할인/적립 혜택" },
  { id: "cjone", label: "CJ ONE", description: "CJ ONE 적립/할인 카드" },
  { id: "hpoint", label: "H.Point", description: "H.Point 멤버십 결제 옵션" },
  { id: "lpoint", label: "L.POINT", description: "엘포인트 적립/사용" },
  { id: "starbucks", label: "스타벅스 리워드", description: "스타벅스 멤버십 등록 여부" },
  { id: "ediya", label: "이디야 멤버십", description: "이디야 멤버십 바코드 저장" },
  { id: "twosome", label: "투썸플레이스 멤버십", description: "투썸 멤버십 혜택 저장" },
  { id: "compose_coffee", label: "컴포즈커피 멤버십", description: "컴포즈커피 적립 정보" },
  { id: "mega_coffee", label: "메가커피 클럽", description: "메가커피 멤버십 등록" },
  { id: "paik", label: "빽다방 멤버십", description: "빽다방 멤버십 바코드 저장" },
];

const MembershipManagement = () => {
  const { isLoggedIn, isLoading: authLoading } = useAuth();
  const { data: settings, isLoading } = useUserSettings();
  const updateSettings = useUpdateUserSettings();

  const handleToggle = (key: MembershipKey) => {
    if (!settings) return;
    updateSettings.mutate({ [key]: !settings[key as keyof UserSettings] });
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
            <Card key={membership.id} className="p-4 flex items-center justify-between rounded-xl border-border/50">
              <div>
                <p className="font-medium">{membership.label}</p>
                {membership.description && (
                  <p className="text-xs text-muted-foreground">{membership.description}</p>
                )}
              </div>
              <Switch
                checked={!!(settings?.[membership.id as keyof UserSettings])}
                onCheckedChange={() => handleToggle(membership.id)}
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

export default MembershipManagement;

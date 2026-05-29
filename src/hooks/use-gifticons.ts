import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { gifticonsApi } from "@/api/gifticons";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export const useGifticons = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["gifticons", user?.id],
    queryFn: () => gifticonsApi.getMyGifticons(user!.id),
    enabled: !!user,
  });
};

export const useRestoreGifticon = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (gifticonId: string) => gifticonsApi.restoreGifticon(gifticonId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gifticons", user?.id] });
      toast({ title: "복구 완료", description: "기프티콘이 사용가능 상태로 변경되었습니다." });
    },
    onError: (err: Error) => {
      toast({
        title: "복구 실패",
        description: err.message || "기프티콘 복구 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });
};

export const useUsedGifticons = (brand?: string) => {
  return useQuery({
    queryKey: ["used-gifticons", brand],
    queryFn: () => gifticonsApi.getUsedGifticons(brand),
  });
};

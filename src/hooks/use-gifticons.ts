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

export const useSellGifticon = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({
      gifticonId,
      salePrice,
    }: {
      gifticonId: string;
      salePrice: number;
    }) => gifticonsApi.sellGifticon(gifticonId, user!.id, salePrice),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gifticons", user?.id] });
      toast({ title: "판매 등록 완료", description: "기프티콘이 판매중 상태로 등록되었습니다." });
    },
    onError: (err: any) => {
      toast({
        title: "판매 등록 실패",
        description: err.message || "판매 등록 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });
};

export const useCancelSell = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (gifticonId: string) => gifticonsApi.cancelSell(gifticonId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gifticons", user?.id] });
      toast({ title: "판매 취소 완료", description: "판매가 취소되었습니다." });
    },
    onError: (err: any) => {
      toast({
        title: "판매 취소 실패",
        description: err.message || "판매 취소 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
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
    onError: (err: any) => {
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

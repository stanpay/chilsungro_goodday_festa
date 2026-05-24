import { useQuery } from "@tanstack/react-query";
import { couponsApi } from "@/api/coupons";
import { useAuth } from "@/contexts/AuthContext";

export const useCoupons = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["coupons", user?.id],
    queryFn: () => couponsApi.getMyCoupons(user!.id),
    enabled: !!user,
  });
};

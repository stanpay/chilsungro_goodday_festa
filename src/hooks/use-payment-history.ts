import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentHistoryApi, PaymentRecord } from "@/api/paymentHistory";
import { useAuth } from "@/contexts/AuthContext";

export const usePaymentHistory = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["payment-history", user?.id],
    queryFn: () => paymentHistoryApi.getHistory(user!.id),
    enabled: !!user,
  });
};

export const usePaymentCount = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["payment-count", user?.id],
    queryFn: () => paymentHistoryApi.getCount(user!.id),
    enabled: !!user,
  });
};

export const useAddPaymentRecord = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (record: Omit<PaymentRecord, "id" | "created_at">) =>
      paymentHistoryApi.addRecord(record),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-history", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["payment-count", user?.id] });
    },
  });
};

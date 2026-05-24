import { useMutation } from "@tanstack/react-query";
import { supportApi } from "@/api/support";
import { useAuth } from "@/contexts/AuthContext";

export const useSendSupportMessage = () => {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({
      message,
      pageName,
      pagePath,
    }: {
      message: string;
      pageName: string;
      pagePath: string;
    }) =>
      supportApi.sendMessage({
        userId: user?.id ?? "anonymous",
        message,
        pageName,
        pagePath,
      }),
  });
};

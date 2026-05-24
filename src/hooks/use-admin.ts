import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api/admin";
import { useAuth } from "@/contexts/AuthContext";

export const useIsAdmin = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-admin", user?.email],
    queryFn: () => adminApi.isAdmin(user!.email),
    enabled: !!user,
  });
};

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userSettingsApi, UserSettings } from "@/api/userSettings";
import { useAuth } from "@/contexts/AuthContext";

export const useUserSettings = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-settings", user?.id],
    queryFn: () => userSettingsApi.getSettings(user!.id),
    enabled: !!user,
  });
};

export const useUpdateUserSettings = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (patch: Partial<UserSettings>) =>
      userSettingsApi.updateSettings(user!.id, patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ["user-settings", user?.id] });
      const prev = queryClient.getQueryData<UserSettings>(["user-settings", user?.id]);
      queryClient.setQueryData(["user-settings", user?.id], (old: UserSettings | undefined) =>
        old ? { ...old, ...patch } : old
      );
      return { prev };
    },
    onError: (_err, _patch, ctx) => {
      queryClient.setQueryData(["user-settings", user?.id], ctx?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["user-settings", user?.id] });
    },
  });
};

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { recognitionJobsApi } from "@/api/recognitionJobs";
import { useAuth } from "@/contexts/AuthContext";

export const useRecognitionJob = (jobId: string | undefined) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["recognition-job", jobId],
    queryFn: () => recognitionJobsApi.getJob(jobId!, user!.id),
    enabled: !!jobId && !!user,
  });
};

export const useCreateRecognitionJob = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: () => recognitionJobsApi.createJob(user!.id),
    onSuccess: (job) => {
      queryClient.setQueryData(["recognition-job", job.id], job);
    },
  });
};

export const useUpdateRecognitionJob = (jobId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof recognitionJobsApi.updateJob>[1]) =>
      recognitionJobsApi.updateJob(jobId!, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(["recognition-job", jobId], updated);
    },
  });
};

export const useRegisterGifticonFromJob = () => {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({
      jobId,
      data,
    }: {
      jobId: string;
      data: Parameters<typeof recognitionJobsApi.addGifticonFromJob>[2];
    }) => recognitionJobsApi.addGifticonFromJob(jobId, user!.id, data),
  });
};

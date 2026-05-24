import { DUMMY_RECOGNITION_JOBS } from "./dummyData";
import { RecognitionResult } from "@/lib/gifticonRecognition";

export interface RecognitionJob {
  id: string;
  user_id: string;
  status: "processing" | "completed" | "failed";
  recognition_result: RecognitionResult | null;
  created_at: string;
  completed_at: string | null;
}

let jobStore: Record<string, RecognitionJob> = { ...DUMMY_RECOGNITION_JOBS };

export const recognitionJobsApi = {
  createJob: async (userId: string): Promise<RecognitionJob> => {
    // TODO: POST /api/recognition-jobs
    await delay(200);
    const job: RecognitionJob = {
      id: `job-${Date.now()}`,
      user_id: userId,
      status: "processing",
      recognition_result: null,
      created_at: new Date().toISOString(),
      completed_at: null,
    };
    jobStore[job.id] = job;
    return job;
  },

  getJob: async (jobId: string, userId: string): Promise<RecognitionJob | null> => {
    // TODO: GET /api/recognition-jobs/{jobId}
    await delay(200);
    const job = jobStore[jobId];
    if (!job || job.user_id !== userId) return null;
    return job;
  },

  updateJob: async (
    jobId: string,
    patch: Partial<RecognitionJob>
  ): Promise<RecognitionJob> => {
    // TODO: PATCH /api/recognition-jobs/{jobId}
    await delay(200);
    jobStore[jobId] = { ...jobStore[jobId], ...patch };
    return jobStore[jobId];
  },

  getRecentCompletedJob: async (
    userId: string
  ): Promise<RecognitionJob | null> => {
    // TODO: GET /api/recognition-jobs/recent?userId={userId}&status=completed,failed
    await delay(200);
    const jobs = Object.values(jobStore)
      .filter(
        (j) =>
          j.user_id === userId &&
          (j.status === "completed" || j.status === "failed")
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    return jobs[0] ?? null;
  },

  addGifticonFromJob: async (
    jobId: string,
    userId: string,
    data: {
      brand: string;
      name: string;
      originalPrice: number;
      expiryDate: string;
      barcode: string;
      isSelling: boolean;
      salePrice?: number;
    }
  ): Promise<string> => {
    // TODO: POST /api/recognition-jobs/{jobId}/register-gifticon
    await delay(300);
    const newId = `gift-${Date.now()}`;
    return newId;
  },
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

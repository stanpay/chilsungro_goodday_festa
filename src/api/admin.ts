export const adminApi = {
  isAdmin: async (email: string): Promise<boolean> => {
    // TODO: GET /api/admin/check?email={email}
    await delay(100);
    return false;
  },
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

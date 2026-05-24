export const supportApi = {
  sendMessage: async (data: {
    userId: string;
    message: string;
    pageName: string;
    pagePath: string;
  }): Promise<void> => {
    // TODO: POST /api/support/messages
    await delay(300);
    console.log("[Support] message sent:", data);
  },
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

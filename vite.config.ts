import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { naverDevApiPlugin } from "./vite/naverDevApi";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    define: {
      __APP_BUILD_ID__: JSON.stringify(
        process.env.VERCEL_GIT_COMMIT_SHA ?? Date.now().toString()
      ),
    },
    server: {
      host: true,
      port: 8080,
      strictPort: true,
      // 접속 URL 호스트와 동일하게 HMR 사용 (localhost 고정 시 LAN IP 접속 시 WS 실패)
      hmr: {
        clientPort: 8080,
      },
    },
    plugins: [react(), naverDevApiPlugin(env)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});

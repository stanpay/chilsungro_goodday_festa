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
      // HMR WebSocket: host:true 사용 시 localhost와 불일치하면 연결 실패
      hmr: {
        host: "localhost",
        port: 8080,
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

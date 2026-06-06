import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // 允许从任何 IP 访问（用于远程调试）
    host: '0.0.0.0',
    // 允许来自任何源的请求
    cors: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  // 使用相对路径，确保 Electron 打包后能正确加载资源
  base: './',
});

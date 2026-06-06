import { defineConfig } from 'drizzle-kit';
import * as path from 'path';

/**
 * Drizzle Kit 配置文件
 * 用于数据库迁移和代码生成
 */
export default defineConfig({
  schema: './src/services/database/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    // 开发时使用默认路径，实际路径由 AppPaths 动态决定
    url: './drizzle/dev.db',
  },
  // 生成迁移文件时使用
  verbose: true,
  strict: true,
});

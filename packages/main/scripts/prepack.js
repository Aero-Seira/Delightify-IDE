#!/usr/bin/env node
/**
 * 打包前的完整准备脚本
 * 确保所有依赖都正确配置
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('[prepack] Starting pre-packaging checks...');

const mainDir = path.resolve(__dirname, '..');
const mainDist = path.join(mainDir, 'dist');
const sharedDir = path.join(mainDir, '../shared');
const rendererDir = path.join(mainDir, '../renderer');

// 1. 检查 shared 包是否已构建
const sharedDist = path.join(sharedDir, 'dist');
if (!fs.existsSync(sharedDist)) {
  console.error('[prepack] Error: @delightify/shared is not built!');
  console.error('[prepack] Building shared package...');
  
  try {
    execSync('pnpm --filter @delightify/shared build', {
      cwd: path.resolve(mainDir, '../..'),
      stdio: 'inherit'
    });
  } catch (err) {
    console.error('[prepack] Failed to build shared package');
    process.exit(1);
  }
} else {
  console.log('[prepack] ✓ @delightify/shared is built');
}

// 2. 检查 renderer 是否已构建
const rendererDist = path.join(rendererDir, 'dist');
if (!fs.existsSync(rendererDist)) {
  console.error('[prepack] Error: @delightify/renderer is not built!');
  console.error('[prepack] Building renderer package...');
  
  try {
    execSync('pnpm --filter @delightify/renderer build', {
      cwd: path.resolve(mainDir, '../..'),
      stdio: 'inherit'
    });
  } catch (err) {
    console.error('[prepack] Failed to build renderer package');
    process.exit(1);
  }
} else {
  console.log('[prepack] ✓ @delightify/renderer is built');
}

// 3. 复制 renderer/dist 到 main/dist/renderer（用于打包）
console.log('[prepack] Copying renderer/dist to main/dist/renderer...');
const rendererDest = path.join(mainDist, 'renderer');
try {
  // 删除已存在的目录
  if (fs.existsSync(rendererDest)) {
    fs.rmSync(rendererDest, { recursive: true });
  }
  
  // 创建目标目录
  fs.mkdirSync(rendererDest, { recursive: true });
  
  // 复制文件
  const copyRecursive = (src, dest) => {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        copyRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  };
  
  copyRecursive(rendererDist, rendererDest);
  console.log('[prepack] ✓ Renderer copied to main/dist/renderer');
} catch (err) {
  console.error('[prepack] Failed to copy renderer:', err.message);
  process.exit(1);
}

// 4. 运行 copy-shared 脚本
console.log('[prepack] Copying shared package to node_modules...');
try {
  require('./copy-shared.js');
} catch (err) {
  console.error('[prepack] Failed to copy shared package:', err.message);
  process.exit(1);
}

// 5. 验证 copy-shared 结果
const copiedShared = path.join(mainDir, 'node_modules/@delightify/shared/dist');
if (!fs.existsSync(copiedShared)) {
  console.error('[prepack] Error: copy-shared did not complete successfully');
  process.exit(1);
}

// 6. 检查关键依赖是否存在
const keyDependencies = [
  '@libsql/client',
  'adm-zip',
  'drizzle-orm'
];

for (const dep of keyDependencies) {
  const depPath = path.join(mainDir, 'node_modules', dep);
  if (!fs.existsSync(depPath)) {
    console.error(`[prepack] Warning: ${dep} not found in node_modules`);
    console.error('[prepack] Please run "pnpm install" first');
    process.exit(1);
  }
}

console.log('[prepack] ✓ All checks passed');
console.log('[prepack] Ready for packaging!');

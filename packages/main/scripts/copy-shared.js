#!/usr/bin/env node
/**
 * 打包前将 @delightify/shared 复制到 main 的 node_modules 中
 * 解决 electron-builder 打包时找不到 workspace 依赖的问题
 */

const fs = require('fs');
const path = require('path');

// 路径配置
const mainDir = path.resolve(__dirname, '..');
const sharedDir = path.resolve(mainDir, '../shared');
const sharedSrc = path.join(sharedDir, 'dist');
const sharedPkg = path.join(sharedDir, 'package.json');
const sharedDestDir = path.resolve(mainDir, 'node_modules/@delightify/shared');
const sharedDest = path.join(sharedDestDir, 'dist');

console.log('[copy-shared] Starting...');
console.log(`[copy-shared] Main dir: ${mainDir}`);
console.log(`[copy-shared] Shared dir: ${sharedDir}`);
console.log(`[copy-shared] Shared src: ${sharedSrc}`);
console.log(`[copy-shared] Shared dest dir: ${sharedDestDir}`);

// 检查源目录是否存在
if (!fs.existsSync(sharedSrc)) {
  console.error(`[copy-shared] Error: Source directory not found: ${sharedSrc}`);
  console.error('[copy-shared] Please run "pnpm build" first to build the shared package.');
  process.exit(1);
}

// 检查 package.json 是否存在
if (!fs.existsSync(sharedPkg)) {
  console.error(`[copy-shared] Error: package.json not found: ${sharedPkg}`);
  process.exit(1);
}

// 确保目标目录的父目录存在
const parentDir = path.dirname(sharedDestDir);
if (!fs.existsSync(parentDir)) {
  try {
    fs.mkdirSync(parentDir, { recursive: true });
    console.log(`[copy-shared] Created parent directory: ${parentDir}`);
  } catch (err) {
    console.error(`[copy-shared] Error creating parent directory: ${err.message}`);
    process.exit(1);
  }
}

// 如果目标目录已存在，删除它
if (fs.existsSync(sharedDestDir)) {
  try {
    fs.rmSync(sharedDestDir, { recursive: true, force: true });
    console.log(`[copy-shared] Removed existing directory: ${sharedDestDir}`);
  } catch (err) {
    console.error(`[copy-shared] Error removing existing directory: ${err.message}`);
    // 继续尝试
  }
}

// 创建目标目录
try {
  fs.mkdirSync(sharedDestDir, { recursive: true });
  console.log(`[copy-shared] Created directory: ${sharedDestDir}`);
} catch (err) {
  console.error(`[copy-shared] Error creating directory: ${err.message}`);
  process.exit(1);
}

// 读取并修改 package.json，移除 workspace 引用
try {
  const pkgContent = fs.readFileSync(sharedPkg, 'utf-8');
  const pkg = JSON.parse(pkgContent);
  
  // 移除 workspace 相关的字段
  if (pkg.dependencies && pkg.dependencies['@delightify/shared'] === 'workspace:*') {
    delete pkg.dependencies['@delightify/shared'];
  }
  
  // 写入修改后的 package.json
  fs.writeFileSync(
    path.join(sharedDestDir, 'package.json'), 
    JSON.stringify(pkg, null, 2)
  );
  console.log(`[copy-shared] Copied and modified package.json`);
} catch (err) {
  console.error(`[copy-shared] Error copying package.json: ${err.message}`);
  process.exit(1);
}

// 复制文件函数
function copyDir(src, dest) {
  // 如果目标已存在，先删除
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }

  // 创建新目录
  fs.mkdirSync(dest, { recursive: true });

  // 读取源目录
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 复制 dist 目录
try {
  copyDir(sharedSrc, sharedDest);
  console.log(`[copy-shared] Copied ${sharedSrc} -> ${sharedDest}`);
} catch (err) {
  console.error(`[copy-shared] Error copying files: ${err.message}`);
  process.exit(1);
}

// 验证复制结果
if (!fs.existsSync(sharedDest)) {
  console.error('[copy-shared] Error: Copy verification failed, dist directory not found');
  process.exit(1);
}

// 列出复制的内容
const copiedFiles = fs.readdirSync(sharedDest);
console.log(`[copy-shared] Copied ${copiedFiles.length} items to dist`);
console.log('[copy-shared] Done!');

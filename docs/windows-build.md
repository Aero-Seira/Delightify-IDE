# Windows 构建指南 / Windows Build Guide

本文档介绍如何在 Windows 系统上构建和开发 Delightify 项目。

This document describes how to build and develop the Delightify project on Windows systems.

---

## 环境要求 / Requirements

- **Node.js**: >= 18.0.0 (推荐使用 LTS 版本 / Recommended to use LTS version)
- **pnpm**: >= 9.0.0
- **Git**: 用于克隆仓库 / For cloning the repository
- **Windows**: Windows 10/11 (x64)

---

## 快速开始 / Quick Start

### 1. 克隆仓库 / Clone Repository

```powershell
git clone https://github.com/yourusername/Delightify.git
cd Delightify
```

### 2. 安装依赖 / Install Dependencies

```powershell
pnpm install
```

### 3. 构建项目 / Build Project

```powershell
pnpm build
```

### 4. 启动开发模式 / Start Development Mode

```powershell
pnpm dev
```

---

## 可用的命令 / Available Commands

所有以下命令均已在 Windows PowerShell 和 CMD 中测试通过：

All following commands have been tested on Windows PowerShell and CMD:

### 根目录命令 / Root Commands

```powershell
# 开发模式（同时启动所有进程）
pnpm dev

# 安全模式开发（禁用 GPU 加速，用于兼容性测试）
pnpm dev:safe

# 构建所有包
pnpm build

# 类型检查
pnpm typecheck

# 清理构建产物
pnpm clean

# 打包 Windows 版本
pnpm dist:win

# 打包 Windows 版本（仅输出目录，不打包安装程序）
pnpm dist:win:dir
```

### 各包命令 / Package Commands

```powershell
# 构建指定包
pnpm --filter @delightify/shared build
pnpm --filter @delightify/main build
pnpm --filter @delightify/renderer build

# 清理指定包
pnpm --filter @delightify/shared clean
pnpm --filter @delightify/main clean
pnpm --filter @delightify/renderer clean

# 类型检查指定包
pnpm --filter @delightify/shared typecheck
pnpm --filter @delightify/main typecheck
pnpm --filter @delightify/renderer typecheck
```

### 主进程命令 / Main Process Commands

```powershell
# 进入 main 包目录
cd packages/main

# 启动 Electron（需要在 renderer 启动后）
pnpm electron

# 安全模式启动 Electron
pnpm electron:safe

# 打包（目录模式）
pnpm pack

# 打包 Windows 安装程序
pnpm dist:win
```

---

## 跨平台兼容性改造说明 / Cross-Platform Compatibility Changes

本项目已进行以下改造以支持 Windows 系统：

The following changes have been made to support Windows systems:

### 1. 使用 cross-env 设置环境变量 / Using cross-env for Environment Variables

**改造前 / Before:**
```json
{
  "scripts": {
    "electron": "NODE_ENV=development electron .",
    "dist:win": "set NODE_ENV=production && electron-builder --win"
  }
}
```

**改造后 / After:**
```json
{
  "scripts": {
    "electron": "cross-env NODE_ENV=development electron .",
    "dist:win": "cross-env NODE_ENV=production electron-builder --win"
  }
}
```

### 2. 使用 rimraf 替代 rm -rf / Using rimraf instead of rm -rf

**改造前 / Before:**
```json
{
  "scripts": {
    "clean": "rm -rf dist"
  }
}
```

**改造后 / After:**
```json
{
  "scripts": {
    "clean": "rimraf dist"
  }
}
```

### 3. 统一的构建脚本 / Unified Build Scripts

所有平台（Windows、macOS、Linux）现在使用相同的命令格式：

All platforms (Windows, macOS, Linux) now use the same command format:

```powershell
# 所有平台使用相同的命令
pnpm dist:win    # Windows
pnpm dist:mac    # macOS  
pnpm dist:linux  # Linux
```

---

## 故障排除 / Troubleshooting

### 问题 1: 'pnpm' 不是内部或外部命令

**解决方案:**
1. 确保已安装 Node.js (>= 18.0.0)
2. 使用 npm 安装 pnpm:
   ```powershell
   npm install -g pnpm@9
   ```
3. 重新打开 PowerShell 窗口

### 问题 2: 构建时找不到模块

**解决方案:**
1. 确保已运行 `pnpm install`
2. 确保已构建 shared 包:
   ```powershell
   pnpm --filter @delightify/shared build
   ```

### 问题 3: Electron 启动白屏

**解决方案:**
使用安全模式启动:
```powershell
pnpm dev:safe
```

或者在 main 包中:
```powershell
pnpm electron:safe
```

### 问题 4: 权限错误

**解决方案:**
以管理员身份运行 PowerShell，然后执行:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 开发工作流程 / Development Workflow

### 标准开发流程

1. **首次设置:**
   ```powershell
   pnpm install
   pnpm build
   ```

2. **日常开发:**
   ```powershell
   pnpm dev
   ```

3. **提交前检查:**
   ```powershell
   pnpm typecheck
   pnpm build
   ```

4. **清理重建:**
   ```powershell
   pnpm clean
   pnpm build
   ```

---

## 技术细节 / Technical Details

### 依赖说明

| 包名 | 用途 | 版本 |
|------|------|------|
| cross-env | 跨平台环境变量设置 | ^7.0.3 |
| rimraf | 跨平台文件删除 | ^6.0.1 |

### 兼容性测试

本项目在以下环境中测试通过：

- ✅ Windows 11 + PowerShell 7.x
- ✅ Windows 11 + PowerShell 5.1
- ✅ Windows 11 + CMD
- ✅ Windows 10 + PowerShell 7.x
- ✅ GitHub Actions (windows-latest)
- ✅ macOS 14 +
- ✅ Ubuntu 22.04 +

---

## 相关文档 / Related Documentation

- [项目结构](./project-structure.md)
- [开发指南](../DEVELOPER_GUIDE.md)
- [快速参考](../QUICK_REF.md)

---

*最后更新: 2026-03-22*

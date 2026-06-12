> **⚠️ 这是「规划 / 意图」文档，不是「已实现」的描述。**
> 本指南所述架构（`global.db`/`project.db`、`data`/`semantic` 关系系统、三重 `jar-parser`、配方类型元数据等）**大部分尚未落地**；"路线图已完成"等说法**未经核实**。
> 当前产品方向为 **ModPack IDE**——先读根目录 [`CLAUDE.md`](./CLAUDE.md)，完整规格在规划库 `…/MC-Workbench/Projects/ModPack IDE/`（`设计/01` 为真相源）。**实现以实际代码为准。**

---

# Delightify - AI Agent Guide

> 本文档供 AI 编程助手阅读，帮助快速理解项目结构、技术栈与开发约定。
> This document is intended for AI coding agents to quickly understand the project structure, technology stack, and development conventions.

---

## 项目概述 / Project Overview

**Delightify** 是一个面向 Minecraft 整合包开发者的可视化配方魔改工作台。它是一个 Electron 桌面应用，帮助用户：

1. **导入模组 JAR** → 自动解析并建立物品、配方、材质的本地知识数据库
2. **可视化浏览与编辑** → 拖拽式配方编辑器，实时预览生成的 KubeJS 脚本
3. **AI 辅助转换**（可选）→ 批量迁移场景下的智能建议，用户始终掌控最终决策
4. **多格式导出** → 导出为 KubeJS、Datapack 等主流格式

### 核心定位
- **本地优先**：数据与实例在本地闭环，不依赖云端
- **数据库驱动**：结构化数据支撑，LLM Prompt 可注入物品/配方上下文
- **可视化 IDE**：类 PCL2/HMCL 的桌面体验，非 Web 应用

---

## 技术栈 / Technology Stack

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 包管理 | pnpm + Turborepo | monorepo 管理，硬链接节省磁盘，幽灵依赖防护 |
| 语言 | TypeScript 5.4+ | 全栈 TypeScript，类型共享 |
| 桌面框架 | Electron 30+ | 主进程(Node.js) + 渲染进程(React) |
| 前端框架 | React 18 + Vite 5 | 函数组件 + Hooks，Vite 快速热重载 |
| 路由 | React Router 6 | 客户端路由 |
| 状态管理 | Zustand 4+ | 轻量级状态管理 |
| 数据库 | SQLite + Drizzle ORM | 零配置本地部署，类型安全 |
| 图像处理 | jimp | 纯 JS 实现，无 Native Addon |
| 进程通信 | Electron IPC | 安全沙箱，contextIsolation + preload |

### 运行时要求
- Node.js >= 18.0.0
- pnpm >= 9.0.0

### 跨平台兼容性 / Cross-Platform Compatibility

项目已配置支持 Windows、macOS、Linux 三大平台：

| 平台 | 支持的 Shell | 备注 |
|------|-------------|------|
| Windows | PowerShell 5.1+, PowerShell 7.x, CMD | 完整支持 |
| macOS | bash, zsh | 完整支持 |
| Linux | bash, zsh | 完整支持 |

**Windows 用户快速开始：**
```powershell
# 使用 PowerShell 设置脚本
.\scripts\setup-windows.ps1

# 或手动安装
pnpm install
pnpm build
pnpm dev
```

详见 [Windows 构建指南](./docs/windows-build.md)

---

## 项目结构 / Project Structure

```
Delightify/
├── packages/
│   ├── shared/              # 跨进程共享的类型与常量
│   │   └── src/
│   │       ├── types/       # TypeScript 接口定义 (Item, Recipe, Mod, etc.)
│   │       └── constants/   # IPC 通道名、Minecraft 版本常量
│   │
│   ├── main/                # Electron 主进程 (Node.js)
│   │   └── src/
│   │       ├── main.ts      # 应用入口，窗口创建
│   │       ├── preload.ts   # 安全 IPC 桥接
│   │       ├── ipc/         # IPC 处理器 (jar, items, recipes, llm...)
│   │       └── services/    # 业务服务层 (数据库、JAR 解析等)
│   │
│   └── renderer/            # Electron 渲染进程 (React UI)
│       └── src/
│           ├── main.tsx     # React 应用入口
│           ├── App.tsx      # 主布局与路由
│           ├── ipc/         # IPC 调用封装
│           └── pages/       # 页面组件
│               ├── ModManager/      # 模组管理
│               ├── ItemBrowser/     # 物品浏览器
│               ├── RecipeBrowser/   # 配方浏览器
│               ├── RecipeEditor/    # 配方编辑器
│               └── ConversionTool/  # AI 转换工具
│
├── config/                  # 用户可编辑的配置文件
│   ├── recipe_types/        # 配方类型元数据 (builtin + custom)
│   ├── llm_config.example.json   # LLM 配置示例
│   ├── mapping_rules.json   # 配方映射规则
│   └── item_categories.json # 物品分类定义
│
├── docs/                    # 文档
│   ├── project-structure.md # 数据库 Schema、路径体系
│   ├── tech-stack.md        # 技术选型决策记录 (ADR)
│   └── roadmap.md           # 开发路线图
│
├── pnpm-workspace.yaml      # pnpm 工作区定义
├── turbo.json               # Turborepo 任务编排
└── tsconfig.base.json       # 共享 TypeScript 配置
```

### Monorepo 依赖关系
```
@delightify/shared
        │
        ├──► @delightify/main (Electron 主进程)
        └──► @delightify/renderer (React 前端)
```

**重要**：`shared` 包必须先构建，其他包才能正确引用类型。

---

## 构建与开发命令 / Build & Development Commands

```bash
# 安装依赖 (所有平台)
pnpm install

# 启动 Electron（使用已构建的 renderer，启动最快）
pnpm dev

# 完整开发模式（Vite 热重载 + Electron，前端开发推荐）
pnpm dev:full

# 只启动 Vite 开发服务器（浏览器访问 http://localhost:5173）
pnpm dev:web

# 安全模式开发（禁用 GPU 加速，用于兼容性测试）
pnpm dev:safe

# 构建所有包
pnpm build

# 类型检查（CI 使用）
pnpm typecheck

# 清理构建产物
pnpm clean
```

**开发模式说明：**

| 命令 | 用途 | 适用场景 |
|------|------|----------|
| `pnpm dev` | 构建后启动 Electron | 快速预览、开发主进程功能 |
| `pnpm dev:watch` | 监听 main 变更 + 启动 Electron | 开发主进程（自动重启） |
| `pnpm dev:full` | Vite 热重载 + Electron | 开发前端界面（推荐） |
| `pnpm dev:web` | 只启动 Vite 服务器 | 纯浏览器调试前端 |
| `pnpm dev:safe` | 安全模式启动 Electron | GPU 兼容性测试 |

**智能加载机制：**

主进程启动时会自动检测 Vite dev server (http://localhost:5173)：
- 如果 Vite 正在运行 → 使用 Vite 的 URL（支持热重载）
- 如果 Vite 未运行 → 使用已构建的 renderer（生产模式）

这意味着你可以：
1. 先运行 `pnpm dev` 快速启动 Electron
2. 稍后运行 `pnpm dev:web` 启动 Vite
3. Electron 窗口会自动切换到热重载模式（无需重启）

**Windows 特定命令:**
```powershell
# Windows 打包
pnpm dist:win

# Windows 打包（仅目录，不生成安装程序）
pnpm dist:win:dir

# 安全模式开发（禁用 GPU 加速）
pnpm dev:safe
```

### Turborepo 任务依赖
- `build`: 依赖 `^build`（依赖包先构建）
- `dev`: 依赖 `^build`，持久模式，无缓存
- `typecheck`: 依赖 `^build`

---

## 代码组织约定 / Code Organization Conventions

### IPC 通信模式
项目使用 **Electron IPC** 而非 HTTP 进行主进程与渲染进程通信。

**定义通道**（`packages/shared/src/constants/ipc.ts`）：
```typescript
export const IPC_CHANNELS = {
  PROJECT_LIST: 'project:list',
  JAR_IMPORT: 'jar:import',
  ITEMS_QUERY: 'items:query',
  // ...
} as const;
```

**主进程注册**（`packages/main/src/ipc/*.ts`）：
```typescript
ipcMain.handle(IPC_CHANNELS.ITEMS_QUERY, async (event, query) => {
  // 处理逻辑
});
```

**预加载脚本暴露**（`packages/main/src/preload.ts`）：
```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  itemsQuery: (query) => ipcRenderer.invoke(IPC_CHANNELS.ITEMS_QUERY, query),
});
```

**渲染进程调用**（`packages/renderer/src/ipc/index.ts`）：
```typescript
export const electronAPI = (): ElectronAPI => window.electronAPI;
```

### 路径体系（AppPaths）
参考 PCL2CE 的多层路径分离设计：

| 路径键 | 实际位置 | 用途 |
|--------|----------|------|
| `userData` | `%AppData%/Delightify/` | 应用全局数据根目录 |
| `globalDb` | `userData/global.db` | 全局模组知识库（跨项目共享） |
| `textureCache` | `userData/cache/textures/` | 材质缓存目录 |
| `projectsJson` | `userData/projects.json` | 整合包项目注册表 |
| `projectDb(p)` | `<modpack>/.delightify/project.db` | 单个整合包的项目私有库 |

**原则**：
- 跨项目可复用的知识放 `global.db`
- 项目级裁决放 `project.db`
- 项目数据可随整合包目录一起备份、分享

### 数据库双层设计

**全局知识库（global.db）**：
- `mods` - 模组元信息
- `items` - 物品/方块条目
- `item_tags` - 物品与 tag 的多对多映射
- `recipes` - 配方原始数据
- `recipe_types` - 配方类型注册表
- `translations` - 翻译文本
- `textures` - 材质元数据

**图谱层扩展表**：
- `entities` - 统一实体注册表
- `relations` - 关系边表（数据层 + 语义层）
- `imports` - 导入批次记录
- `relation_evidence` - 关系证据溯源

**项目私有库（project.db）**：
- `conversion_history` - 配方转换历史
- `project_relations` - 项目级语义关系覆盖

### 关系系统分层
- **数据关系（Data）**：来自 JAR 的 JSON 文件，确定性强，可精确溯源
  - 例：`data:consumes_item`, `data:produces_item`, `data:has_tag`
- **语义关系（Semantic）**：来自 LLM 推断或启发式规则，可有多个候选
  - 例：`sem:equivalent_to`, `sem:substitute_for`

**合并规则**：project_relations（覆盖/屏蔽） > global.db relations（按置信度排序）

---

## 配方类型元数据系统 / Recipe Type Metadata System

配方类型定义位于 `config/recipe_types/`，支持热扩展：

```
config/recipe_types/
├── builtin/          # 内置配方类型（勿编辑）
│   ├── minecraft.json
│   ├── farmers_delight.json
│   └── create.json
└── custom/           # 用户自定义配方类型
```

**设计目标**：新增 JSON 文件即可支持新机器/新配方类型，无需修改代码。

---

## 开发注意事项 / Development Notes

### 安全准则
- **永远使用 preload 脚本**：不要直接在渲染进程启用 `nodeIntegration`
- **contextIsolation: true**：主进程与渲染进程上下文隔离
- **IPC 通道白名单**：所有通道必须在 `IPC_CHANNELS` 常量中定义

### 类型安全
- 共享类型定义在 `packages/shared/src/types/`
- 数据库 Schema 变更需同步更新类型定义
- IPC 参数/返回值使用 `unknown` 谨慎断言，避免隐式 `any`

### 错误处理
- IPC 处理器应返回 `{ success: boolean, data?, error? }` 格式
- 异步操作提供进度回调（`xxx:progress` 通道）

### JAR 解析策略
Node.js 无法在运行时访问 JVM 注册表，使用**三重策略 + 多部位方块合并**达到 ~98% 物品覆盖率：

1. **Lang 文件反推**：`assets/{modid}/lang/en_us.json`
   - Key: `item.{modid}.{item_name}` → ID: `{modid}:{item_name}`
2. **Tags 文件补充**：`data/{modid}/tags/items/*.json`
3. **Recipes 文件扫描**：`data/{modid}/recipes/*.json`
4. **多部位方块合并**：`services/jar-parser/multi-part-block-detector.ts`
   - 识别多方块结构的不同部位（如 `lemon_tree_upper`, `lemon_tree_mid`）
   - 合并为单一基础方块（`lemon_tree`）
   - 支持的后缀模式：位置（upper/lower/mid）、大小（small/medium/large）、状态（fruits/flowering/mature）及其组合
   - 排除独立方块类型：`_block`, `_cauldron`, `_chest`, `_furnace` 等被视为独立方块，不会与基础物品合并
   - 智能合并策略：只有当 >= 2 个物品共享同一基础名称时，或存在基础方块 + 部位变体时，才执行合并

---

## CI/CD

GitHub Actions 工作流（`.github/workflows/typecheck.yml`）：
- 触发条件：push 到 main 分支、pull_request
- Node.js 20 + pnpm 9
- 缓存 pnpm 模块
- 执行 `pnpm typecheck`

### 跨平台构建实现

项目使用以下工具确保跨平台兼容性：

| 工具 | 用途 | 版本 |
|------|------|------|
| `cross-env` | 跨平台环境变量设置 | ^7.0.3 |
| `rimraf` | 跨平台文件删除（替代 `rm -rf`） | ^6.0.1 |

**示例 - 改造前后对比：**

```json
// 改造前（仅 Unix 兼容）
{
  "scripts": {
    "electron": "NODE_ENV=development electron .",
    "clean": "rm -rf dist"
  }
}

// 改造后（全平台兼容）
{
  "scripts": {
    "electron": "cross-env NODE_ENV=development electron .",
    "clean": "rimraf dist"
  }
}
```

**CI 工作流配置：**
- `.github/workflows/typecheck.yml` - 类型检查
- `.github/workflows/build.yml` - 多平台打包（Windows/macOS/Linux）
- `.github/workflows/windows-test.yml` - Windows 环境专项测试

---

## 技术决策记录（ADR）

关键决策已记录在 `docs/tech-stack.md`：

| ADR | 决策 | 放弃方案 | 理由 |
|-----|------|----------|------|
| ADR-001 | Node.js 全栈 | Python 全栈 | 类型同步、打包体积、生态覆盖 |
| ADR-002 | React + Vite | Gradio/NiceGUI | UI 表达能力、状态管理 |
| ADR-003 | Node.js JAR 解析 | Java 全栈 | LLM 生态、UI 开发成本 |
| ADR-004 | 本地 Node.js 运行 | Docker | 用户门槛、JAR 文件大小 |
| ADR-005/007 | Electron 桌面应用 | 本地 WebUI | IPC 效率、文件系统访问、桌面集成 |
| ADR-006 | 本地优先 | 纯云端 SaaS | JAR 上传不现实、本地文件交互需求 |

---

## 开发路线图（Roadmap）

当前阶段：**M2 - 物品浏览器（可用级）+ 材质渲染（v0.3）✅ 已完成**

| 里程碑 | 版本 | 核心交付物 | 状态 |
|--------|------|------------|------|
| M0 | v0.1 | 工程骨架、IPC 框架、基础配置读取 | ✅ 已完成 |
| M1 | v0.2 | global.db、JAR 导入闭环、三策略提取 | ✅ 已完成 |
| M2 | v0.3 | 物品浏览器、材质渲染、查询优化 | ✅ 已完成 |
| M3 | v0.4 | 配方浏览器、配方类型元数据驱动 | 🚧 进行中 |
| M3 | v0.4 | 配方浏览器、配方类型元数据驱动 | 📋 待开始 |
| M4 | v0.5 | 可视化配方编辑、KubeJS 导出 | 📋 待开始 |
| M5 | v0.6 | 语义关系系统、global 推荐 + project 覆盖 | 📋 待开始 |
| M6 | v0.7 | LLM 批量迁移工作流（可选） | 📋 待开始 |
| M7 | v0.8 | 打包分发、稳定性优化 | 📋 待开始 |

详见 `docs/roadmap.md`

---

## 相关文档索引

- `docs/project-structure.md` - 数据库 Schema、路径体系、JAR 解析流程
- `docs/tech-stack.md` - 完整技术选型决策记录
- `docs/roadmap.md` - 开发路线图与里程碑规划
- `README.md` - 项目介绍、快速开始、功能特性

---

## 快速参考 / Quick Reference

**添加新的 IPC 通道**：
1. `packages/shared/src/constants/ipc.ts` - 添加通道常量
2. `packages/main/src/ipc/xxx.ts` - 实现处理器
3. `packages/main/src/preload.ts` - 暴露到渲染进程
4. `packages/renderer/src/ipc/index.ts` - 添加类型定义与封装

**添加新的页面**：
1. `packages/renderer/src/pages/NewPage/index.tsx` - 创建页面组件
2. `packages/renderer/src/App.tsx` - 添加路由与导航链接

**修改数据库 Schema**：
1. `packages/main/src/services/database/schema.ts` - 更新 Schema（待实现）
2. `packages/shared/src/types/` - 同步更新 TypeScript 类型
3. 考虑 schema 版本迁移策略

**添加配方类型支持**：
1. `config/recipe_types/custom/` - 添加新的 JSON 定义文件
2. 遵循现有 builtin 文件的结构与字段规范

---

*最后更新：2026-03-22*

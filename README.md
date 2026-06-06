# 🎮 Delightify

> 一站式可视化 Minecraft 配方魔改平台，支持模组数据库管理、可视化配方编辑与 AI 辅助转换
> One-stop visual Minecraft recipe modification platform with mod database management, visual recipe editing, and AI-assisted conversion

[English](#english) | [中文](#中文)

---

## 中文

### 🎯 项目简介

整合包开发者在魔改配方时面临诸多痛点：需要手动翻阅文档才能找到物品 ID、手写 JSON 且无法直观预览效果、不同模组的配方格式各异难以统一、缺乏可视化工具来管理大量配方……

**Delightify** 是专为整合包开发者打造的**可视化配方魔改工作台**。通过导入模组 JAR 文件，自动解析并建立物品、配方、材质、翻译的**本地知识数据库**；提供**可视化配方编辑器**，拖拽式操作，物品图标实时渲染，所见即所得；内置 **AI 辅助功能**（可选），针对批量迁移场景提供智能建议，但用户始终掌控最终决策。支持导出为 KubeJS、Datapack 等主流格式，未来规划扩展到附魔、战利品表等更多魔改类型。

### ✨ 核心特性

- 🗄️ **模组知识库**：导入模组 JAR，自动解析并持久化物品、配方、材质、翻译数据，建立本地数据库
- 🎨 **可视化配方编辑器**：拖拽式操作，物品图标实时渲染，3×3 工作台/烹饪锅等多种配方类型可视化呈现
- 🔍 **物品浏览器**：按模组/类别/标签筛选，材质图标展示，快速定位目标物品
- 🤖 **AI 辅助转换**（可选功能）：对于批量迁移场景，支持 LLM 智能建议配方类型，提供置信度评分，人工审核确认
- 📤 **多格式导出**：KubeJS Script/JSON、原版 Datapack，一键生成可用脚本
- 🔧 **高度可扩展**：配方类型定义完全自定义，支持任意模组的任意配方格式
- 💻 **桌面客户端**: 基于 Electron + React 的本地桌面应用，原生文件系统访问，无需浏览器
- 📦 **原版数据内置**：预置 Minecraft 原版全部物品与配方数据，开箱即用

### 🚀 快速开始

#### 安装

**通用安装（macOS/Linux/WSL）:**

```bash
# 克隆仓库
git clone https://github.com/Aero-Seira/Delightify.git
cd Delightify

# 安装依赖（需要 Node.js 18+ 和 pnpm）
pnpm install

# (推荐) 安装本地模型支持
# 安装 ollama: https://ollama.ai
ollama pull qwen2.5:7b
```

**Windows 安装:**

```powershell
# 克隆仓库
git clone https://github.com/Aero-Seira/Delightify.git
cd Delightify

# 方式1：使用 PowerShell 自动设置脚本
.\scripts\setup-windows.ps1

# 方式2：手动安装
pnpm install
pnpm build
```

详见 [Windows 构建指南](./docs/windows-build.md)

#### 配置 LLM

1. **使用 Ollama (推荐，本地运行)**
   
   确保 Ollama 已安装并运行：
   ```bash
   ollama serve
   ```
   
   系统将自动使用本地 Ollama 模型（配置在 `config/llm_config.json`）

2. **使用在线 API (可选)**
   
   如需使用 OpenAI 或 Anthropic，创建 `.env` 文件：
   ```bash
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   
   编辑 `config/llm_config.json` 启用相应提供商

#### 运行

```bash
# 启动 Electron 开发模式（前端热重载 + 主进程监听）
pnpm dev
```

Electron 窗口将自动打开

### 📖 典型工作流

**第一步：导入模组 JAR**
```
→ 自动解析 farmersdelight-1.20.jar
→ 识别到 127 个物品，89 个配方，341 张材质
```

**第二步：浏览物品库**
在物品浏览器中搜索「tomato」，可以看到：
- 番茄的 16×16 材质图标
- 所有以番茄为材料的配方列表
- 番茄所属的物品标签（forge:vegetables 等）

**第三步：可视化编辑配方**
打开「番茄沙拉」配方，在 3×3 格子中拖拽调整材料，实时预览生成的 KubeJS 代码：
```javascript
ServerEvents.recipes(event => {
  event.custom({
    type: 'farmersdelight:cooking',
    ingredients: [
      {item: 'farmersdelight:tomato'},
      {item: 'minecraft:bowl'}
    ],
    result: {item: 'farmersdelight:tomato_soup'},
    cookingtime: 200,
    experience: 0.35
  });
});
```

**第四步（可选）：AI 辅助批量转换**
上传旧版整合包的配方 JSON → AI 建议转换为 farmersdelight:cooking → 逐条审核，一键确认

**第五步：导出**
生成完整的 KubeJS 脚本，直接放入整合包的 kubejs/server_scripts/ 目录

### 📚 文档链接

- 📘 [系统架构设计](docs/architecture.md) - 原始系统设计和工作流程（历史参考）
- 📐 [技术栈决策](docs/tech-stack.md) - 技术选型决策记录与 ADR
- 🗂️ [项目结构](docs/project-structure.md) - monorepo 结构、数据库 Schema、API 设计
- ⚙️ [配置指南](docs/configuration.md) - LLM 配置、配方类型元数据、输出选项
- 📋 [数据格式规范](docs/data-formats.md) - 输入输出格式的完整规范

### 🏗️ 项目架构

```
┌─────────────────────────────────────────────────┐
│              Delightify（Electron）              │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │           渲染进程（React UI）             │  │
│  │  ModManager · ItemBrowser · RecipeEditor  │  │
│  └────────────────┬──────────────────────────┘  │
│                   │ IPC                         │
│  ┌────────────────▼──────────────────────────┐  │
│  │           主进程（Node.js）               │  │
│  │  ┌─────────┐ ┌──────────────┐ ┌────────┐ │  │
│  │  │模组管理  │ │  可视化编辑  │ │AI 辅助 │ │  │
│  │  │JAR 解析  │ │  配方槽位   │ │LLM建议 │ │  │
│  │  │材质提取  │ │  实时预览   │ │批量转换│ │  │
│  │  └────┬────┘ └──────┬───────┘ └───┬────┘ │  │
│  │       └─────────────┴─────────────┘      │  │
│  │                     │                    │  │
│  │                     ▼                    │  │
│  │       ┌─────────────────────────┐        │  │
│  │       │     本地知识数据库      │        │  │
│  │       │ 物品·配方·材质·翻译    │        │  │
│  │       └────────────┬────────────┘        │  │
│  │                    │                     │  │
│  │                    ▼                     │  │
│  │       ┌─────────────────────────┐        │  │
│  │       │       导出引擎          │        │  │
│  │       │   KubeJS · Datapack    │        │  │
│  │       └─────────────────────────┘        │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 🛣️ 开发路线图

- [x] **阶段 0**：项目规划与架构设计（技术选型、数据库设计、文档）
- [ ] **阶段 1 — 基础骨架**（v0.1）
  - [ ] pnpm + Turborepo monorepo 初始化
  - [ ] 共享 TypeScript 类型定义（物品、配方、模组、材质）
  - [ ] 数据库 Schema 设计（Drizzle ORM，7 张表）
  - [ ] Electron 主进程 + IPC 框架搭建
  - [ ] React + Vite 渲染进程脚手架
- [ ] **阶段 2 — 数据入库**（v0.2）
  - [ ] JAR 解析引擎（lang / textures / recipes / tags 三重策略）
  - [ ] 材质提取与 jimp 处理
  - [ ] Minecraft 原版种子数据内置
  - [ ] 模组管理 API
- [ ] **阶段 3 — 可视化 UI**（v0.3）
  - [ ] 物品图标组件（ItemIcon）
  - [ ] 配方槽位组件（RecipeSlot / RecipeGrid）
  - [ ] ModManager 页面
  - [ ] ItemBrowser 页面
  - [ ] RecipeBrowser 页面 + 基础配方编辑器
- [ ] **阶段 4 — AI 辅助**（v0.4）
  - [ ] 多提供商 LLM 客户端（Ollama / OpenAI / Anthropic）
  - [ ] 数据库驱动的 Prompt 构建（注入物品上下文）
  - [ ] 批量转换工作流
  - [ ] 交互审核界面 + 置信度可视化
- [ ] **阶段 5 — 导出与完善**（v0.5）
  - [ ] KubeJS / Datapack 导出引擎
  - [ ] 转换历史记录
  - [ ] 规则引擎雏形
- [ ] **未来规划**：附魔魔改、战利品表编辑、标签管理、整合包版本管理

### 🎯 目标用户

- 整合包开发者（主要用户）
- 模组包作者，需要跨模组统一配方风格
- 服务器管理员，需要快速调整游戏内配方平衡
- 不熟悉代码但想进行配方魔改的玩家

### 🤝 贡献指南

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md)

### 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)

---

## English

### 🎯 Overview

Modpack developers face many pain points when modifying recipes: looking up item IDs in documentation, writing JSON blindly without visual preview, dealing with different recipe formats across mods, and lacking visual tools to manage large numbers of recipes.

**Delightify** is a **visual recipe modification workbench** built for modpack developers. By importing mod JAR files, it automatically parses and builds a **local knowledge database** of items, recipes, textures, and translations. It provides a **visual recipe editor** with drag-and-drop operations, real-time item icon rendering, and WYSIWYG editing. Built-in **AI assistance** (optional) provides intelligent suggestions for bulk migration scenarios, while users always retain full control over final decisions. Supports export to KubeJS, Datapack, and other mainstream formats, with future plans to expand to enchantments, loot tables, and more.

### ✨ Features

- 🗄️ **Mod Knowledge Base**: Import mod JARs, auto-parse and persist items/recipes/textures/translations into a local database
- 🎨 **Visual Recipe Editor**: Drag-and-drop operation, real-time item icon rendering, visual presentation of 3×3 crafting table, cooking pot, and more
- 🔍 **Item Browser**: Filter by mod/category/tag, display texture icons, quickly locate target items
- 🤖 **AI-Assisted Conversion** (optional): For bulk migration scenarios, supports LLM recipe type suggestions with confidence scoring and manual review
- 📤 **Multi-format Export**: KubeJS Script/JSON, vanilla Datapack, one-click script generation
- 🔧 **Highly Extensible**: Recipe type definitions fully customizable, supports any mod's recipe format
- 💻 **Desktop Client**: Electron + React native desktop application, direct filesystem access, no browser required
- 📦 **Vanilla Data Built-in**: Pre-loaded Minecraft vanilla items and recipes, ready out of the box

### 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/Aero-Seira/Delightify.git
cd Delightify

# Install dependencies (requires Node.js 18+ and pnpm)
pnpm install

# (Recommended) Install local model support
# Install Ollama: https://ollama.ai
ollama pull qwen2.5:7b

# Start Electron development mode (hot reload + main process watch)
pnpm dev
```

The Electron window will open automatically.

### 📖 Typical Workflow

**Step 1: Import Mod JAR**
```
→ Auto-parse farmersdelight-1.20.jar
→ Detected 127 items, 89 recipes, 341 textures
```

**Step 2: Browse Item Library**
Search for "tomato" in the Item Browser to see:
- 16×16 texture icon for tomato
- All recipes that use tomato as an ingredient
- Item tags for tomato (forge:vegetables, etc.)

**Step 3: Visual Recipe Editing**
Open the "Tomato Soup" recipe, drag and drop ingredients in the 3×3 grid, and preview the generated KubeJS code in real time:
```javascript
ServerEvents.recipes(event => {
  event.custom({
    type: 'farmersdelight:cooking',
    ingredients: [
      {item: 'farmersdelight:tomato'},
      {item: 'minecraft:bowl'}
    ],
    result: {item: 'farmersdelight:tomato_soup'},
    cookingtime: 200,
    experience: 0.35
  });
});
```

**Step 4 (Optional): AI-Assisted Bulk Conversion**
Upload legacy modpack recipe JSON → AI suggests conversion to farmersdelight:cooking → Review each entry and confirm with one click

**Step 5: Export**
Generate a complete KubeJS script and place it directly in your modpack's kubejs/server_scripts/ directory

### 📚 Documentation

- 📘 [System Architecture Design](docs/architecture.md) - Original system design and workflow (historical reference)
- 📐 [Tech Stack Decisions](docs/tech-stack.md) - Technology selection decisions and ADRs
- 🗂️ [Project Structure](docs/project-structure.md) - Monorepo structure, database schema, API design
- ⚙️ [Configuration Guide](docs/configuration.md) - LLM config, recipe type metadata, output options
- 📋 [Data Format Specification](docs/data-formats.md) - Complete specification for input/output formats

### 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│           Delightify (Electron)                 │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │         Renderer Process (React UI)       │  │
│  │  ModManager · ItemBrowser · RecipeEditor  │  │
│  └────────────────┬──────────────────────────┘  │
│                   │ IPC                         │
│  ┌────────────────▼──────────────────────────┐  │
│  │          Main Process (Node.js)           │  │
│  │  ┌─────────┐ ┌──────────────┐ ┌────────┐ │  │
│  │  │Mod Mgr  │ │Visual Editor │ │AI Asst.│ │  │
│  │  │JAR Parse│ │Recipe Slots  │ │LLM Tips│ │  │
│  │  │Textures │ │Live Preview  │ │Bulk Cvt│ │  │
│  │  └────┬────┘ └──────┬───────┘ └───┬────┘ │  │
│  │       └─────────────┴─────────────┘      │  │
│  │                     │                    │  │
│  │                     ▼                    │  │
│  │       ┌─────────────────────────┐        │  │
│  │       │  Local Knowledge DB    │        │  │
│  │       │Items·Recipes·Textures  │        │  │
│  │       └────────────┬────────────┘        │  │
│  │                    │                     │  │
│  │                    ▼                     │  │
│  │       ┌─────────────────────────┐        │  │
│  │       │      Export Engine     │        │  │
│  │       │   KubeJS · Datapack    │        │  │
│  │       └─────────────────────────┘        │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 🛣️ Roadmap

- [x] **Phase 0**: Project planning and architecture design (tech stack, database design, documentation)
- [ ] **Phase 1 — Foundation** (v0.1)
  - [ ] pnpm + Turborepo monorepo initialization
  - [ ] Shared TypeScript type definitions (items, recipes, mods, textures)
  - [ ] Database schema design (Drizzle ORM, 7 tables)
  - [ ] Electron main process + IPC framework setup
  - [ ] React + Vite renderer process scaffold
- [ ] **Phase 2 — Data Ingestion** (v0.2)
  - [ ] JAR parsing engine (lang / textures / recipes / tags triple strategy)
  - [ ] Texture extraction and jimp processing
  - [ ] Minecraft vanilla seed data built-in
  - [ ] Mod management API
- [ ] **Phase 3 — Visual UI** (v0.3)
  - [ ] Item icon component (ItemIcon)
  - [ ] Recipe slot component (RecipeSlot / RecipeGrid)
  - [ ] ModManager page
  - [ ] ItemBrowser page
  - [ ] RecipeBrowser page + basic recipe editor
- [ ] **Phase 4 — AI Assistance** (v0.4)
  - [ ] Multi-provider LLM client (Ollama / OpenAI / Anthropic)
  - [ ] Database-driven prompt construction (inject item context)
  - [ ] Bulk conversion workflow
  - [ ] Interactive review interface + confidence visualization
- [ ] **Phase 5 — Export & Polish** (v0.5)
  - [ ] KubeJS / Datapack export engine
  - [ ] Conversion history
  - [ ] Rule engine prototype
- [ ] **Future**: Enchantment modding, loot table editing, tag management, modpack version management

### 🎯 Target Users

- Modpack developers (primary users)
- Mod pack authors who need to unify recipe styles across mods
- Server administrators who need to quickly adjust in-game recipe balance
- Players who want to modify recipes without writing code

### 🤝 Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md)

### 📄 License

MIT License - see [LICENSE](LICENSE)

---

## 📞 联系方式 / Contact

- Issues: [GitHub Issues](https://github.com/Aero-Seira/Delightify/issues)
- Discussions: [GitHub Discussions](https://github.com/Aero-Seira/Delightify/discussions)

**Made with ❤️ for the Minecraft modding community**

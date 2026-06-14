# 🎮 Delightify

> 面向 Minecraft 整合包作者的 **ModPack IDE / 意图编译器**：声明目标，工具感知整合包、按语义分类、规划如何全包应用，并产出可审、可撤销的改包脚本。
> A **ModPack IDE / "intent compiler"** for Minecraft modpack authors: state a goal, and the tool perceives the pack, classifies each case semantically, plans a pack-wide application, and emits reviewable, reversible scripts.

[中文](#中文) · [English](#english)

> **现状（early-stage，以代码为准）**：MVP-0 后端主链路已落地并有可跑通的 smoke 验收——从 exporter 快照导入 → 浏览物品/配方 → unify 候选查询 → dry-run diff → 生成/撤销 KubeJS。浏览层打磨与更高阶 Agent 能力仍在推进。完整实现状态见 [`docs/current/mvp0-implementation-plan.md`](docs/current/mvp0-implementation-plan.md)。

---

## 中文

### 这是什么

Delightify 是一个 Electron 桌面应用（**Delightify 是产品名**；"ModPack IDE" 是品类描述）。作者陈述一个*目标*（如"把全包同名/等价物品统一"），Agent 负责两件事：**(a) 语义识别**——感知整合包、逐例分类；**(b) 执行规划**——规划如何在全包安全应用。**设计/平衡判断 (c) 始终归作者**。高置信 + 低风险 → 自动（可审）；不确定 / 影响面大 → 进搁置队列；过宽或主要属 (c) 的请求 → 引导式规划（只读决策支持）。

与传统改包工具不同，Delightify **不靠离线解析 mod JAR** 来取事实。脚本化整合包（KubeJS / CraftTweaker / datapack 覆盖 / 运行时 tag 合并）的**最终态本就是运行时产物**，离线无法健全求值。因此事实来源是游戏内运行时导出器。

### 数据来源：运行时导出器（不是 JAR 解析）

`packages/exporter` 是并入本仓的 **NeoForge 1.21.1** mod。在游戏内执行 `/mpide_export dump`，它从运行时注册表 / RecipeManager / 已解析 tag 导出一份 SQLite 快照到 `<实例>/mpide-exporter/export.sqlite`，包含：mods、items（含组件/食物/耐久等确定性事实）、blocks、item_tags、结构化 `recipe_inputs`/`recipe_outputs`、translations 等。IDE 把这份快照导入项目库 `<整合包>/.delightify/project.db`，作为 `data:*` 确定性事实层。

### MVP-0 端到端流程

1. **导入** exporter v1 SQLite 快照（按 schema 分流：`exporter_v1` 完整导入并启用 unify；legacy 旧快照仅浏览）。
2. **浏览** 物品 / 配方（ItemBrowser / RecipeBrowser）。
3. **查询** 同名 / 等价物品候选及其配方引用者（Unify 工作台）。
4. **dry-run**：生成可审决策清单 + before/after diff，自动项与搁置项分流，每条带证据、置信度与风险理由。
5. **导出** Delightify 独享的 KubeJS 文件 `kubejs/server_scripts/zzz_delightify_generated.js`（带生成标记，拒绝覆盖手写脚本）。
6. **撤销**：删除该生成文件，幂等可逆。

### 安全纪律（不可协商）

先分类再行动 → 置信度 × 风险门控 → 不确定就搁置（绝不静默猜测）→ 透明决策账本 → dry-run / diff → 可逆。任何破坏世界状态的动作默认不自动执行；生成物归 Delightify 所有，不改作者手写脚本。

### 输出后端

多后端 IR；**v1 = KubeJS emitter**。datapack / Almost Unified 等后端待后续。

### Monorepo 结构

| 包 | 职责 |
|---|---|
| `packages/shared` | 跨进程 TS 类型 + IPC 通道常量 |
| `packages/main` | Electron 主进程：`ipc/` 处理器、`services/`（database / mod-data-importer / unify / export / llm / …）、`fs/` 路径 |
| `packages/renderer` | React + Vite 渲染进程：8 个页面（Dashboard、ProjectManager、ModManager、ItemBrowser、RecipeBrowser、RecipeEditor、ConversionTool、DebugTools） |
| `packages/exporter` | NeoForge 1.21.1 运行时数据导出器（Gradle / Java 21） |

IPC 经 `contextBridge`/preload（无 `nodeIntegration`），通道在 `packages/shared/src/constants/ipc.ts` 白名单，处理器返回 `{ success, data?, error? }`。

### 快速开始

```bash
# 需要 Node.js >=18、pnpm >=9
git clone https://github.com/Aero-Seira/Delightify-IDE.git
cd Delightify-IDE
pnpm install

pnpm dev          # 构建并启动 Electron（最快预览）
pnpm dev:full     # Vite HMR + Electron（前端开发）
```

Windows 用户见 [Windows 构建指南](docs/guides/windows-build.md)（或 `scripts/setup-windows.ps1`）。

### 构建运行时导出器（可选，需 Java 21 / Gradle）

```bash
pnpm exporter:build      # 构建 NeoForge 导出器 jar
pnpm exporter:runClient  # 起集成端单人世界，便于游戏内 /mpide_export dump 实跑
```

默认 `pnpm build` 只走 TypeScript / Turborepo 构建，不触发 Gradle；导出器需显式构建。

### 常用命令

```bash
pnpm build         # turbo run build（shared 先构建）
pnpm typecheck     # turbo run typecheck —— CI 跑的就是这个
pnpm smoke:mvp0    # MVP-0 端到端验收（import → unify → dry-run → KubeJS → revert）
pnpm dist:mac | dist:win | dist:linux   # 打包
```

无单元测试命令；CI 仅跑 `pnpm typecheck`。改动用 `pnpm typecheck` + `pnpm smoke:mvp0` + 构建/实跑验证。

真实快照验收：

```bash
pnpm smoke:mvp0 -- --data-file /path/to/export.sqlite --query 铜锭 --target minecraft:copper_ingot
```

### LLM / Agent

LLM provider 抽象（`packages/main/src/services/llm`）存在但**当前不在 v1 关键路径上**。MVP-0 的 unify 是确定性 / 启发式版本，不接 LLM。完整语义 Agent 主循环是后续目标。

### 文档

从 [`CLAUDE.md`](CLAUDE.md) 开始，再到 [`docs/README.md`](docs/README.md)。当前决策在 [`docs/current/`](docs/current/)：

- [`mvp0-implementation-plan.md`](docs/current/mvp0-implementation-plan.md) —— MVP-0 可落地实现方案（代码事实 + 任务清单）
- [`mvp0-data-foundation.md`](docs/current/mvp0-data-foundation.md) —— 数据地基决策
- [`exporter-contract-v1.md`](docs/current/exporter-contract-v1.md) —— IDE ↔ 导出器 v1 契约

完整产品规格快照在 [`docs/spec-snapshot/`](docs/spec-snapshot/)（`设计/01` 为真相源）。`docs/archive/` 内文档仅作历史背景，**不代表当前实现**。

### 许可证

MIT。

---

## English

### What it is

Delightify is an Electron desktop app (**Delightify is the product name**; "ModPack IDE" describes the category). The author states a *goal* (e.g. "unify same-named / equivalent items across the pack); the Agent does two things: **(a) semantic recognition** — perceive the pack, classify each case — and **(b) execution planning** — plan how to apply it pack-wide safely. **Design / balance judgement (c) always stays with the author.** High-confidence + low-risk → auto (reviewable); uncertain / high blast-radius → defer queue; over-broad or mostly-(c) requests → guided planning (read-only decision support).

Unlike traditional tools, Delightify does **not** rely on offline JAR parsing for facts. The final state of a scripted modpack (KubeJS / CraftTweaker / datapack overrides / runtime tag merges) **is a runtime artifact** that can't be soundly evaluated offline. So the source of truth is an in-game runtime exporter.

### Data source: a runtime exporter (not JAR parsing)

`packages/exporter` is a **NeoForge 1.21.1** mod vendored into this repo. Running `/mpide_export dump` in-game exports a SQLite snapshot to `<instance>/mpide-exporter/export.sqlite` from the runtime registries / RecipeManager / resolved tags: mods, items (with deterministic facts — components, food, durability), blocks, item_tags, structured `recipe_inputs`/`recipe_outputs`, translations, and more. The IDE imports that snapshot into the project db at `<modpack>/.delightify/project.db` as the `data:*` deterministic fact layer.

### MVP-0 end-to-end flow

1. **Import** an exporter v1 SQLite snapshot (routed by schema: `exporter_v1` → full import + unify enabled; legacy snapshots → browse-only).
2. **Browse** items / recipes (ItemBrowser / RecipeBrowser).
3. **Query** same-named / equivalent item candidates and their recipe references (Unify workbench).
4. **Dry-run**: produce a reviewable decision list + before/after diff, splitting auto vs deferred, each with evidence, confidence, and risk rationale.
5. **Export** a Delightify-owned KubeJS file `kubejs/server_scripts/zzz_delightify_generated.js` (carries a generated marker; refuses to overwrite hand-written scripts).
6. **Revert**: delete the generated file, idempotent and reversible.

### Safety discipline (non-negotiable)

Classify-then-act → confidence × risk gating → defer when unsure (never silently guess) → transparent decision ledger → dry-run / diff → reversible. World-mutating actions never run automatically; generated output is owned by Delightify and never edits the author's scripts.

### Output backend

Multi-backend IR; **v1 = KubeJS emitter**. Datapack / Almost Unified come later.

### Monorepo layout

| Package | Role |
|---|---|
| `packages/shared` | Cross-process TS types + IPC channel constants |
| `packages/main` | Electron main: `ipc/` handlers, `services/` (database / mod-data-importer / unify / export / llm / …), `fs/` paths |
| `packages/renderer` | React + Vite renderer: 8 pages (Dashboard, ProjectManager, ModManager, ItemBrowser, RecipeBrowser, RecipeEditor, ConversionTool, DebugTools) |
| `packages/exporter` | NeoForge 1.21.1 runtime data exporter (Gradle / Java 21) |

IPC goes through `contextBridge`/preload (no `nodeIntegration`); channels are whitelisted in `packages/shared/src/constants/ipc.ts`; handlers return `{ success, data?, error? }`.

### Quick start

```bash
# Requires Node.js >=18, pnpm >=9
git clone https://github.com/Aero-Seira/Delightify-IDE.git
cd Delightify-IDE
pnpm install

pnpm dev          # build all + launch Electron (fastest preview)
pnpm dev:full     # Vite HMR + Electron (frontend dev)
```

Windows users: see the [Windows build guide](docs/guides/windows-build.md) (or `scripts/setup-windows.ps1`).

### Build the runtime exporter (optional, needs Java 21 / Gradle)

```bash
pnpm exporter:build      # build the NeoForge exporter jar
pnpm exporter:runClient  # launch an integrated single-player world to run /mpide_export dump
```

`pnpm build` only runs the TypeScript / Turborepo build and does not trigger Gradle; the exporter is built explicitly.

### Common commands

```bash
pnpm build         # turbo run build (shared builds first)
pnpm typecheck     # turbo run typecheck — this is what CI runs
pnpm smoke:mvp0    # MVP-0 end-to-end check (import → unify → dry-run → KubeJS → revert)
pnpm dist:mac | dist:win | dist:linux   # package
```

There is no unit-test command; CI runs only `pnpm typecheck`. Verify changes with `pnpm typecheck` + `pnpm smoke:mvp0` + building/running the app.

Real-snapshot check:

```bash
pnpm smoke:mvp0 -- --data-file /path/to/export.sqlite --query 铜锭 --target minecraft:copper_ingot
```

### LLM / Agent

An LLM provider abstraction (`packages/main/src/services/llm`) exists but is **not on the v1 critical path**. MVP-0 unify is deterministic / heuristic and does not call an LLM. A full semantic Agent loop is a later goal.

### Docs

Start at [`CLAUDE.md`](CLAUDE.md), then [`docs/README.md`](docs/README.md). Current decisions live in [`docs/current/`](docs/current/):

- [`mvp0-implementation-plan.md`](docs/current/mvp0-implementation-plan.md) — MVP-0 implementation plan (code facts + task list)
- [`mvp0-data-foundation.md`](docs/current/mvp0-data-foundation.md) — data foundation decisions
- [`exporter-contract-v1.md`](docs/current/exporter-contract-v1.md) — IDE ↔ exporter v1 contract

The full product spec snapshot is in [`docs/spec-snapshot/`](docs/spec-snapshot/) (`设计/01` is the source of truth). Anything under `docs/archive/` is historical background only and does **not** reflect current implementation.

### License

MIT.

---

- Issues: [GitHub Issues](https://github.com/Aero-Seira/Delightify-IDE/issues)
- Discussions: [GitHub Discussions](https://github.com/Aero-Seira/Delightify-IDE/discussions)

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

This repo is the **implementation** of **Delightify** — a ModPack IDE / "intent compiler" desktop app for Minecraft modpack authors. **Delightify is the product name**; "ModPack IDE" describes the product category and the planning/spec direction, not a replacement name. Electron + React + TypeScript, pnpm/Turborepo monorepo, with the NeoForge runtime exporter vendored as `packages/exporter`. **It is early-stage.**

## ⚠️ AGENT 全部搁置 —— 需更详细规划后再启动

**所有 Agent/LLM 相关内容已统一搁置。** 包括但不限于：语义 Agent 主循环、Intent Spec 自动生成、LLM 驱动的分类/决策、多信号置信度、Gate 1 人工审核决策清单、引导式规划模式、detect+shelve 类动作。上述内容对应规格 `设计/03/05/09` 及 M3-M5 里程碑。

**搁置原因**：Agent 部分涉及 LLM 驱动的语义判断与自动规划，需要在确定性能管线充分验证、M2 可用化完成后，做更详细的 Agent 专项规划（包括模型选型、prompt 工程策略、置信度校准方法、人机交互流程等），再启动实施。

**当前工作范围**：仅限确定性引擎（不接 LLM），即规格 M1 已建成 + M2 手动改包 IDE 可用化。

## 🟢 代码实际建成度（2026-06-30 核对）

**确定性数据管线已大量建成**：SQLite 导入 → 18 表 Drizzle schema → 浏览/查询 → 动作引擎(dry-run+blast-radius) → KubeJS 导出（含受管文件覆盖保护 + revert）。**Agent/LLM 语义层尚未启动**（LLM 模块已废弃孤立，M2 路线明确"先做非 Agent 可用化"）。

`docs/archive/` 中的旧规划文档（两阶段 `global.db`/`project.db`、三策略 JAR 解析器等）**不是当前实现**，仅作背景参考。`docs/current/` 和 `docs/spec-snapshot/` 是当前设计依据。

### 已验证存在的代码

**服务（12 个模块，均完整实现，非桩）：**
`services/database/`（schema.ts/client.ts/schema-manager.ts） · `services/engine/`（6 action + 3 composite + blast-radius + dispatch，13 文件） · `services/mod-data-importer/`（4 文件） · `services/unify/`（3 文件） · `services/export/`（kubejs-emitter） · `services/llm/`（⚠️ 孤立废弃，provider 层可复用） · `services/recipe-types/` · `services/config.ts` · `services/paths.ts` · `services/script-workspace.ts` · `services/project-inspector.ts`

**IPC（10 个 handler 模块，41 个通道）：**
`project` · `mod-data` · `items` · `recipes` · `recipe-types` · `unify` · `engine` · `export` · `script-workspace` · `debug`

**Renderer 页面（10 个）：**
Dashboard · ProjectManager · ModManager(DataImportPage) · ItemBrowser · RecipeBrowser · ConversionTool(Unify工作台) · ActionWorkbench · ScriptWorkspace(Monaco) · DebugTools · ~~RecipeEditor~~（⚠️ 桩代码，55行，"第二阶段实现"）

### ⚠️ 关键注意点

- **`global.db`** 在 `paths.ts` 中定义了路径，但**代码中完全未被使用**；当前所有运行时操作均走 `project.db`
- **RecipeEditor** 只有占位页面，非功能页面
- **LLM 服务**（`services/llm/`）的 provider 封装可复用，但 `service.ts` 的旧 JAR 分析业务逻辑已废弃；需按 `设计/09` 重写为规格 Agent
- **Agent/Intent Spec/置信度×风险/引导式规划/Gate审核** 均未实现 —— 当前是确定性引擎，不接 LLM

## The design spec (read this) — vendored locally + canonical vault

The full v0 spec is **vendored locally** at **`docs/spec-snapshot/`** (`设计/01–10` + `例子/01–05`, read-only snapshot @2026-06-13) — read it there. The **canonical** source is the Obsidian planning vault at:
`/Users/aeroseira/Library/Mobile Documents/iCloud~md~obsidian/Documents/MC-Workbench/Projects/ModPack IDE/` (the planning vault still uses the product-category name; may be newer; if in doubt it wins; re-copy to refresh).

- `设计/01-核心设计与决策模型.md` = **single source of truth**; `设计/03–10` = complete spec (Intent Spec, engine semantics, guided-planning, data layer, KubeJS output, UI, LLM/Agent, MVP roadmap); `例子/01–05` = behavioral specs / test cases. **Implement against that spec.**
- One-line direction: author states a *goal* → Agent perceives the modpack, classifies each case semantically, plans how to apply it pack-wide. **(a) semantic recognition + (b) execution planning = Agent's job; (c) design/balance judgment = author's.** High-confidence+low-risk → auto (reviewable); uncertain/high-blast-radius → defer queue; over-broad/mostly-(c) requests → guided planning (read-only decision-support view).
- Note: the spec's `设计/10` defines **MVP-0 = offline ingest one modpack → catalog/graph → ONE workflow (unify same-named items) end-to-end → reviewable diff → KubeJS output**. **MVP-0 的确定性管线已基本建成**（exporter 导出 → importer 导入 → Item/Recipe 浏览 → Unify 工作台 query/dry-run/revert → KubeJS 输出，已通过真实 194-mod 样本 pack smoke 验证）。**尚未实现的是 Agent 语义层**：LLM 驱动的自动分类、Intent Spec 生成、multi-signal 置信度、Gate 1 人工审核决策清单、引导式规划模式。当前 M2 阶段以"非 Agent 可用化"为方向（手动动作工作台 + 脚本编辑器），不接 LLM。

## Spec ↔ 代码对齐度（2026-06-30）

确定性引擎层已对标规格落地；Agent 语义层尚未启动：

| 规格层 | 实现状态 |
|---|---|
| Action primitives（scale/replace/retag/remove/hide/rename） | 🟢 100%，6 个 action 均完整 |
| Composite actions（unify/harmonize/differentiate/constrain-inputs） | 🟢 100%，4 个 composite 均完整 |
| Blast radius 计算（跨mod/方块/未解析引用） | 🟢 100% |
| KubeJS emitter（v1 唯一后端）+ revert | 🟢 100% |
| 项目数据库导入（exporter → project.db） | 🟢 100% |
| Dry-run / diff 机制 | 🟢 100% |
| 置信度 × 风险双门控 | 🟡 部分（dry-run 有 risk 分析，无 multi-signal 置信度） |
| Intent Spec（结构化决策清单） | 🔴 未实现 |
| Gate 1 人工审核决策清单 | 🔴 未实现 |
| 语义 Agent（LLM 驱动分类/决策） | 🔴 未实现（llm 模块废弃待重写） |
| 引导式规划模式 | 🔴 未实现 |
| detect+shelve 类动作 | 🔴 未实现 |

## Commands

```bash
pnpm install          # Node >=18, pnpm >=9
pnpm dev              # build all + launch Electron (fastest preview)
pnpm dev:full         # Vite HMR + Electron (frontend dev; localhost:5173 auto-detected)
pnpm dev:web          # Vite only, in browser
pnpm dev:safe         # Electron with GPU accel disabled (compat testing)
pnpm build            # turbo run build  (the `shared` package must build first)
pnpm typecheck        # turbo run typecheck  — this is what CI runs
pnpm clean
pnpm dist:win | dist:mac | dist:linux   # package
pnpm exporter:build   # build the NeoForge exporter in packages/exporter
pnpm exporter:compile # compile Java only
pnpm exporter:runClient | exporter:runServer
```
**No unit-test command exists** — CI only runs `pnpm typecheck`. Verify changes by `pnpm typecheck` + building/running the app.

## Intended architecture (per docs — confirm against code)

- **Monorepo**: `packages/shared` (cross-process TS types + IPC channel constants) → `packages/main` (Electron main: `ipc/` handlers, `services/`, `fs/` AppPaths) + `packages/renderer` (React + Vite: `pages/`) + `packages/exporter` (NeoForge 1.21.1 runtime data exporter, Gradle/Java 21).
- **IPC**: Electron `contextBridge`/preload only (no `nodeIntegration`); channels whitelisted in `packages/shared/src/constants/ipc.ts`; handlers return `{ success, data?, error? }`.
- **Data**: a DB layer exists at `services/database/` (schema.ts, client.ts, schema-manager.ts) using Drizzle over libsql; AppPaths in `services/paths.ts`. Current MVP-0 work is project-db/exporter-v1-first; archived `global.db` / graph/relations plans are not current ground truth.

## Locked decisions (from the spec; see `设计/01` §2,§6 and `设计/04` §2)

- **Output**: multi-backend IR; **v1 = KubeJS emitter** (datapack/Almost Unified later).
- **v1 action tiers**: auto-executable `scale / replace_ingredient / remove(hide) / retag / rename` + composites `unify / harmonize / differentiate / 输入集校正`; **detect-and-defer only**: `add_bridge_recipe / change_recipe_type / add_item / remove_item`.
- **Safety discipline (non-negotiable)**: classify-then-act → confidence×risk gating → defer when unsure (never silently guess) → transparent decision ledger → dry-run/diff → reversible.
- **Data strategy**: offline-first; runtime export / vector search / ONNX embeddings deferred, off the v1 critical path.

## Conventions

- **Respond in Chinese.** Repo comments/docs are Chinese; match them.
- Shared types in `packages/shared/src/types/`; keep DB schema and types in sync.
- Doc landscape: start at `docs/README.md`. Current decisions live in `docs/current/`; the vendored spec lives in `docs/spec-snapshot/`; old planning, stale audits and legacy implementation logs live in `docs/archive/`.

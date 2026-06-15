# 前端收敛与重构 · 种子简报（给新会话）

> 用途：本文是「前端收敛/重构」工作流的**起点上下文**。新 Claude 会话应先读本文 + CLAUDE.md + 下列文档，再开始审计。
> 角色分工（沿用本项目既定节奏）：**Claude = 审计 + 找方案 + 写计划 + 出 Codex prompt + 审计 Codex 产出**；**Codex = 落实代码**。Claude 一般不直接改实现。
> 目标：**收敛 + 重构「旧代码已实现的前端」**——修复漂移/半接/失效/不一致的既有 renderer 内容，而非加新功能。

## 0. 必读（恢复上下文）
- `CLAUDE.md`：铁律。**docs 多为规划，以代码为准**；冲突时代码赢。响应用中文。
- `docs/README.md`：文档地图。
- `docs/current/m2-action-engine-plan.md`：引擎层 M2 + NA1/NA2 引擎 IPC + NA3/NA4(未做) 的完整轨迹与决策。
- `docs/current/visualization-texture-plan.md`：exporter 材质提取（进行中）。
- `git log --oneline -30`：近期落地轨迹（M2 引擎、engine:dry-run/blast IPC、exporter 贴图）。

## 1. 架构现状（已验证，代码为准）
- 后端「非 Agent」能力大多已接通；引擎层 M2 全齐（actions/composites/blast-radius/IR）。
- **NA1/NA2 已落地**：`engine:dry-run`（dispatch 9 个动作）、`engine:blast`（只读爆炸半径）IPC + preload + ElectronAPI + mock。
- **NA3/NA4 未做**：动作工作台 UI、只读浏览强化——属**新建 UI**，不在「修旧前端」范围；但收敛应为它打好地基（先稳旧的，再建新的）。
- exporter 贴图提取进行中；下游贴图通路（`item_resources`→`items:get-texture`→`useTexture`/`ItemIcon`）已就绪。

## 2. 前端现状（本轮审计结论，新会话须复核）
8 个页面均挂路由、可从 Sidebar 到达，无孤儿页：
| 页面 | 状态 |
|---|---|
| Dashboard | 纯静态 UI |
| ProjectManager | 已接通；**编辑功能占位（仅 console.log）** |
| ModManager/DataImport | 已接通（检测→验证→导入+进度） |
| ItemBrowser | 已接通（分页/搜索/筛选/多视图） |
| RecipeBrowser | 已接通（分页/搜索/筛选/详情） |
| **RecipeEditor** | **空壳占位「功能开发中—第二阶段」** |
| ConversionTool | 已接通 unify 工作流（query→dry-run→导出→撤销） |
| DebugTools | 已接通（SQL/表/清空） |

其它事实：
- IPC：renderer `ipc/index.ts` ElectronAPI ~34 方法；`mock.ts` 全量假实现；运行时 `window.electronAPI ?? mock`（浏览器降级 mock）。
- **死通道**：`RECIPE_EDIT_*`、`EXPORT_DATAPACK`（常量已声明，主进程无 handler）。
- **风险点（须复核）**：① mock.ts 与真实 handler 返回形状是否漂移（后端改过多次）；② renderer 类型与 shared 类型在引擎类型新增后是否漂移；③ 各页面是否在不同时期用不同约定（错误/加载/空态/样式不一致），是「重构收敛」的主战场；④ 是否存在 legacy/dead 组件、未用导入、断链。
- **功能完整度 CLAUDE.md 标注「未验证」**：每个「已接通」页面需在真实后端下端到端跑过才算数。

## 3. 已锁定决策（必须沿用，勿推翻）
- **配方编辑本轮不做**：RecipeEditor 不实现编辑，只**强化只读查看**（详情/引用，配合 `engine:blast`）。
- 输出层（KubeJS 精确发射/scale 重建/JEI/datapack）后置，技术栈待定；非 Agent 优先；**LLM/Agent 排除**。
- **不重写**稳定后端：schema/importer/validator/unify/emitter 发射/ConversionTool 既有逻辑。重构以**增量、保行为**为度。
- 不引入新依赖/新框架；保持中文注释与文案。

## 4. 新会话应产出 & 工作流
1. **审计**：用并行 Explore agent 扫 renderer（pages/components/hooks/stores/ipc/styles/types/router），产出「问题清单」并分类：**broken / stale / dead / 不一致 / 类型漂移 / mock 漂移 / 未接**。
2. **范围澄清**：用 AskUserQuestion 把第 5 节的开放决策定下来，再定计划。
3. **计划**：写 `docs/current/frontend-convergence-plan.md`（小而可独立验证的任务，按依赖排序；每任务：目标/涉及文件/验收/验证命令），commit。
4. **Codex prompt**：按本项目验证过的格式输出（见第 6 节），每次一批、勿摊太大。
5. **审计 Codex 产出**：读实际改动核对，再 commit（消息尾 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`）。

## 5. 须由用户拍板的开放决策（用 AskUserQuestion）
- **重构深度**：仅一致性收敛（统一错误/加载/空态、抽公共组件、删死码、修类型/mock 漂移），还是更深的结构重整？（既有强烈「勿大重写」倾向 → 默认偏保守增量。）
- **mock.ts 去留**：保留并与真实 handler 对齐（浏览器 dev 便利，但需维护防漂移），还是弱化/移除？
- **死通道处置**：`RECIPE_EDIT_*`（编辑不做）、`EXPORT_DATAPACK`（输出层未定）→ 删除，还是标注 reserved？
- **与 NA3/NA4 的顺序**：是否先收敛旧前端、再建动作工作台 UI（推荐）。

## 6. Codex prompt 格式（本项目验证有效）
分节：**背景与铁律**（含「以代码为准」「响应中文」）→ **现状事实**（带文件路径+行号）→ **任务**（每个：目标 / 涉及文件 / 验收 / 验证命令）→ **整体验收** → **禁止事项**（显式列：不重写 X、增量化、无新依赖、勿扩范围、冲突即停并在 PR 说明）。
- **前端验证现实**：仓库**无 UI 测试**，CI 只跑 `pnpm typecheck`。所以验证 = `pnpm typecheck && pnpm build` + **真正跑 app**（`pnpm dev` / `pnpm dev:full`，用 /run 或 /verify 技能 + 截图核对）。务必要求实际运行验证，别只靠 typecheck。
- 小批量、可独立验证、保行为优先。

## 7. 明确不做
- 不做配方编辑、动作工作台新 UI（NA3/NA4 另立）、输出层发射、LLM/Agent。
- 不重写稳定后端；不引新依赖；不在收敛里夹带新功能。

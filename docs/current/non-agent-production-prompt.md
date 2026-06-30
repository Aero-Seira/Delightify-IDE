# Delightify 非 Agent 功能收尾 · Codex 可执行设计 Prompt

> **目标**：尽快将 Delightify 做成生产可用的整合包 IDE，不接 LLM/Agent。
> **现状基线**：数据管线 ✅ · 引擎全部动作 IR ✅ · 浏览层 ✅ · ActionWorkbench 四个基础动作 ✅ · ScriptWorkspace ✅ · ConversionTool ✅ · 引擎 IPC 全通 ✅
> **输出约定**：本 prompt 只给设计决策和执行路径，不写代码。每个任务标注涉及文件、设计要点、验收标准。

---

## Phase 1 · 收尾 M2（当前最优先）

---

### P1.1 · 复合动作接入 ActionWorkbench UI

**目标**：把引擎层已实现的 constrain_inputs / differentiate / harmonize 三个复合动作接入 ActionWorkbench 页面，让用户能从 UI 触发。

**已完成的部分**：
- 引擎层复合动作全部实现并通过 IR 级 smoke：
  - `packages/main/src/services/engine/composites/constrain-inputs.ts`（132 行）
  - `packages/main/src/services/engine/composites/differentiate.ts`（135 行）
  - `packages/main/src/services/engine/composites/harmonize.ts`（67 行）
- `dispatch.ts` 已注册这三个 action 的派发分支（与 `EngineActionRequest.action` 对应）
- IPC `engine:dry-run` 已通，接受 `{ action: 'constrain_inputs'|'differentiate'|'harmonize', params }`
- ActionWorkbench 当前只支持 4 个基础动作（replace / retag / remove / rename），动作列表定义在 `index.tsx:45-66` 的 `ACTIONS` 常量，类型约束为 `WorkbenchAction = 'replace'|'retag'|'remove'|'rename'`

**需要做的事**：

#### 1.1a 扩展 ActionWorkbench 动作列表

- 文件：`packages/renderer/src/pages/ActionWorkbench/index.tsx`
- 把 `WorkbenchAction` 类型扩展为包含三个复合动作
- 在 `ACTIONS` 常量中新增三项

#### 1.1b 实现 constrain_inputs 的 UI 参数表单

参考 `constrain-inputs.ts` 的 `ConstrainInputsRequest` 接口：

```typescript
// 已有接口（constrain-inputs.ts:15-21）
interface ConstrainInputsRequest {
  slotTag: string;                        // 要收窄的 tag（如 "#forge:vegetables"）
  allow?: string[];                        // 允许列表（白名单）
  deny?: string[];                         // 拒绝列表（黑名单）
  bridgeSuggestions?: { from: string; to: string }[];  // 桥接建议（如 "脂肪→荤油"）
  confirmedOperationIds?: string[];        // 确认的操作 ID
}
```

设计要点：
- `slotTag`：让用户输入或从已有 tag 列表中选择
- `allow` / `deny`：多值输入组件（可参考 RetagForm 的 items 输入方式，splitList 处理逗号/换行分隔）
- `bridgeSuggestions`：可选的高级区域，每项有 from/to 两个字段，可动态增删行
- dry-run 后展示 `CompositeResult.operations`（展开的原语操作列表）和 `deferredSuggestions`（桥接建议的搁置项）

#### 1.1c 实现 differentiate 的 UI 参数表单

参考 `differentiate.ts` 的 `DifferentiateRequest` 接口：

```typescript
interface DifferentiateRequest {
  groups: {
    label: string;                         // 变体标签（如 "石灰大理石"、"白云质大理石"）
    items: string[];                       // 该变体包含的物品
    chainReplaces?: { from: string; to: string }[];  // 链整合替换
  }[];
  locale?: string;                         // 用于 rename 的语言（默认 zh_cn）
  confirmedOperationIds?: string[];
}
```

设计要点：
- 这是一个相对复杂的表单——需要动态添加/删除 group
- 每个 group 有 label（文本输入）、items（多值输入，分割）、chainReplaces（可选，from/to 对）
- 提供一个"从物品多选器添加 group"的入口：用户可以先在 ItemBrowser 多选一组物品（如所有名为 "Marble" 的变体），然后跳转到 ActionWorkbench 并预填
- dry-run 后展示展开的原语列表（retag + rename + replace）和 deferred 建议（naming_style 搁置）

#### 1.1d 实现 harmonize 的 UI 参数表单

参考 `harmonize.ts` 的 `HarmonizeRequest` 接口：

```typescript
interface HarmonizeRequest {
  outliers: { from: string; to: string }[];  // 离群替换
  recipeTypeChanges?: { recipeId: string; fromType: string; toType: string }[]; // 配方型变更（M5 deferred）
  confirmedOperationIds?: string[];
}
```

设计要点：
- `outliers`：from/to 对列表，可动态增删行
- `recipeTypeChanges`：可选，但 UI 上需注明「配方型变更当前仅分析，不导出（M5）」
- dry-run 后展示展开的 replace 操作 + `change_recipe_type` 类型的 deferred 建议

#### 1.1e 统一 dry-run → export → revert 管线

- 复合动作 dry-run 返回的 `EngineDryRunResult` 与基础动作结构完全一致（`operations` / `changeSetPreview` / `deferredSuggestions` / `risk` / `blast`）
- 现有的 `confirmedOperationIds` 翻转逻辑、`exportKubeJs`/`revertKubeJs` 调用可复用
- 特别注意：differentiate 产出的 `rename_lang` 操作会写入 `kubejs/assets/<ns>/lang/<locale>.json`——这与基础 rename 动作的 emitter 行为一致，已实现

**验收标准**：
- `pnpm typecheck && pnpm build`
- 手动跑 app：从 ActionWorkbench 选择 constrain_inputs / differentiate / harmonize，填写参数，dry-run 能看到 operations / changeSetPreview / deferred / risk
- 确认 export 生成正确的 KubeJS 产物，revert 幂等

**边界**：
- 不重写引擎层（只扩展 UI）
- 不碰 schema / importer / validator / ConversionTool
- 不新增 IPC 通道（全部走现有 `engine:dry-run` / `export:kubejs` / `export:kubejs:revert`）
- 复合动作的 KubeJS 发射已在 emitter 中支持（复合动作展开为原语后走相同的 emit 路径）

---

### P1.2 · 轻量 Plan（保存/恢复方案）

**目标**：让用户能将一组 dry-run 出的动作方案保存为 Plan，后续重新打开、修改、执行。

**当前缺口**：
- ActionWorkbench 每次操作是临时的——dry-run 结果只存在于当前页面状态，刷新或离开后丢失
- 没有"保存这次操作方案"的能力
- M2 usability plan（U6）定义了 Plan 需要记录的内容但未实现

**设计决策**：

#### 1.2a Plan 存储位置

**决策：`project.db` 中新增两张表，不引入外部文件格式。**

理由：Plan 是项目级数据，与 `project.db` 生命周期一致，且已有 Drizzle schema 基础设施可复用。

```sql
-- 方案主表
plans(
  plan_id       TEXT PRIMARY KEY,          -- UUID
  name          TEXT NOT NULL,             -- 用户命名的方案名
  action        TEXT NOT NULL,             -- ActionRequestAction（哪个动作）
  params_json   TEXT NOT NULL,             -- JSON 序列化的 params
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  notes         TEXT                       -- 用户备注
)

-- 方案的 dry-run 快照（可重新执行前预览）
plan_snapshots(
  snapshot_id   TEXT PRIMARY KEY,          -- UUID
  plan_id       TEXT NOT NULL REFERENCES plans(plan_id),
  result_json   TEXT NOT NULL,             -- JSON 序列化的 EngineDryRunResult
  generated_files_json TEXT,               -- 导出产物文件列表（可选，仅导出过的 plan 有）
  created_at    TEXT NOT NULL
)
```

**设计要点**：
- `params_json` 和 `result_json` 用 JSON 文本存储，因为不同 action 的 params 形状不同（不需要做关系型拆分）
- 每次 dry-run 自动保存一个 snapshot（无需用户手动操作）
- 用户点"保存当前方案"时创建/更新 plan 记录 + 写 snapshot

#### 1.2b 后端实现

新增文件：
- `packages/main/src/services/plan-store.ts`（~200 行）
  - `savePlan(projectPath, plan)` — 创建或更新 plan
  - `listPlans(projectPath)` — 列出所有 plan
  - `getPlan(projectPath, planId)` — 获取 plan + 最新 snapshot
  - `deletePlan(projectPath, planId)` — 删除 plan 及其所有 snapshot
  - `saveSnapshot(projectPath, planId, result)` — 保存 dry-run 快照

新增 IPC：
- `shared/constants/ipc.ts` 新增 4 个 channel：
  - `PLAN_SAVE: 'plan:save'`
  - `PLAN_LIST: 'plan:list'`
  - `PLAN_GET: 'plan:get'`
  - `PLAN_DELETE: 'plan:delete'`
- `packages/main/src/ipc/plan.ts` — 注册 handler
- `ipc/index.ts` — register

Schema 更新：
- `packages/main/src/services/database/schema.ts` 新增 `plans` 和 `plan_snapshots` 两张 Drizzle 表定义
- `schema-manager.ts` 的 `CORE_TABLES` 新增这两张表

Shared types：
- `packages/shared/src/types/plan.ts` 新增 `Plan`、`PlanSnapshot`、`PlanListItem`、IPC 参数/返回值类型

#### 1.2c 前端实现

ActionWorkbench 增强（`index.tsx`）：
- dry-run 完成后，显示"保存方案"按钮
- 弹出命名对话框（输入 plan name + notes）
- 保存成功后显示方案名和保存时间

新增 Plan 管理入口：
- 在 ActionWorkbench 页面顶部增加一个"已保存方案"区域（或独立的小面板）
- 列出当前项目的所有 plan，显示：名称、动作类型、保存时间、是否有已导出的产物
- 点击 plan → 加载 params 到表单 + 显示最近的 snapshot 结果
- 支持删除 plan

Plan 加载后的交互：
- 加载 plan 后，params 回填到对应动作的表单
- 自动展示最近一次 dry-run 结果（snapshot）
- 用户可以修改参数 → 重新 dry-run → 重新保存

**验收标准**：
- `pnpm typecheck && pnpm build`
- 手动跑 app：完成一次 dry-run → 保存 → 离开页面 → 回来 → 加载 → 看到之前的 dry-run 结果
- 删除 plan 后不再出现在列表中

**边界**：
- Plan 不跨项目共享
- Plan snapshot 的 `generated_files_json` 仅在用户实际导出过后非空
- 不从 Plan 自动触发导出（用户必须手动确认 exported）
- 不做 Plan 版本管理（每次保存覆盖）
- 不做 Plan 的导入/导出/分享

---

### P1.3 · smoke:m2 完整验收脚本

**目标**：为所有 9 个动作（6 原语 + 3 复合）创建端到端 smoke 脚本，覆盖 dry-run → export → revert 全流程。

**已有 smoke**：
- `smoke:mvp0` — unify 的端到端
- `smoke:engine-dispatch` — 所有动作的 dispatch 层
- `smoke:m2:retag` / `smoke:m2:remove` / `smoke:m2:replace` / `smoke:m2:rename` / `smoke:m2:scale` / `smoke:m2:hide` / `smoke:m2:constrain` / `smoke:m2:differentiate` / `smoke:m2:harmonize` — 各动作的独立 IR 级 smoke
- `smoke:m2:blast-radius` — blast 独立 smoke
- `smoke:m2:fileset` — fileset 管理 smoke

**需要做的事**：

#### 1.3a 合并为单一 `smoke:m2` 命令

- 根 `package.json` 新增 `"smoke:m2": "node scripts/smoke-m2.mjs"`
- 新建 `scripts/smoke-m2.mjs`（~300 行）
- 脚本构造统一的 fixture SQLite 数据库，包含用例覆盖：
  - 4 种铜锭（用例 03） + 大理石变体（用例 05） + 面食链（用例 01） + 油炸链（用例 02）的关键物品/配方
- 依次对 9 个 action 调用 `engine:dry-run`，断言：
  - 返回结构非空
  - `operations` 数组非空
  - `risk` 对象包含 `severity` / `mustDefer` / `reasons`
  - `blast` 数组非空
  - `changeSetPreview` 是 `operations` 的子集（仅 `includedInChangeSet` 的项）
- 对可发射的动作（replace_input / remove / retag / rename）额外断言：
  - `export:kubejs` 返回文件列表非空
  - `export:kubejs:revert` 返回成功
  - 二次 export 产物与首次一致（幂等）
- 对 scale/hide 断言 `includedInChangeSet` 全 false
- 输出汇总：通过数/失败数/跳过数

#### 1.3b 更新 CI 验证链

- 在 `根 package.json` 的验证链中确保 `smoke:m2` 被包含（或单独文档化）
- 当前 CI 只跑 `pnpm typecheck`——`smoke:m2` 至少应在文档中列为必须的发布前验证

**验收标准**：
- `pnpm smoke:m2` 全绿
- 覆盖每个 action 至少一条正向路径 + 每个复合动作至少一条

---

## Phase 2 · 输出层定案与实施

---

### P2.1 · 输出层技术方案决策

**背景**：scale 和 hide_in_jei 两个动作的 KubeJS 发射因技术栈不确定而被搁置。引擎层已产出 IR（`scale_recipe_field` 和 `hide_in_jei` 的 ChangeOperation），但 `includedInChangeSet` 恒为 false，emitter 永不看到这些 kind。

**需要决策的问题**：

#### 2.1a scale 的 KubeJS 发射方案

当前 emitter 支持的配方操作模式是 `e.replaceInput` / `e.remove` / `e.replaceOutput`。scale 需要修改配方的数值字段（output_count / time / energy），这在 KubeJS 中**没有直接的"修改数值"API**——只有"删掉原配方 + 重建新配方"。

**方案选择**：

| 方案 | 描述 | 风险 |
|---|---|---|
| **A: KubeJS remove + custom recipe** | 对每个要 scale 的配方，emit `e.remove({id})` + `e.custom({type, ...modifiedFields})` | 需按配方类型逐类实现 custom 签名；未知类型 defer |
| **B: KubeJS remove + datapack override** | emit `e.remove` + 生成 datapack JSON 覆盖文件（非 KubeJS 手段） | 引入第二个后端（datapack），但 v1 本应只有 KubeJS |
| **C: 仅 emit 配方型白名单** | 对已知可表达的配方型（smelting/blasting 的 cookingtime、crafting 的 count）走方案 A；其他类型永远 deferred | 保守但工程可控 |
| **D: 仅分析不发射** | scale 永远只展示 IR 分析结果（before→after 数值），不生成产物，用户自行改 | 零工程量，但不算"可用" |

**推荐决策：C（白名单 + 逐型扩展）**。

理由：与 M2 action-engine-plan §5 T8 的设计一致——已知 vanilla 配方类型白名单 + 未知类型 deferred。白名单至少覆盖：
- `minecraft:smelting` / `blasting` / `smoking` / `campfire_cooking`：可改 cookingtime 和 experience
- `minecraft:crafting_shaped` / `crafting_shapeless`：可改 result.count

实现时需**核实 KubeJS `event.custom()` 在各配方类型下的具体签名**（1.21 版本），不确定即 defer。

#### 2.1b hide_in_jei 的 KubeJS 发射方案

KubeJS 有 JEI 集成事件 `JEIEvents.hideItems`，但：
- 需要 KubeJS JEI addon
- 写法是 `JEIEvents.hideItems(e => e.hide('item:id'))`，落点在 `kubejs/client_scripts/`
- 如果整合包用 REI 或 EMI 而非 JEI，这个发射无效

**方案选择**：

| 方案 | 描述 | 风险 |
|---|---|---|
| **A: KubeJS JEI 集成** | emit `JEIEvents.hideItems(...)` 到 client_scripts | 仅对 JEI 有效 |
| **B: 三平台分别 emit** | 同时生成 JEI / REI / EMI 三套隐藏脚本 | 工程量大，且 REI/EMI 的 KubeJS API 不一定存在 |
| **C: 降级为仅分析** | hide 永远展示 IR 分析结果（哪些物品要被隐藏、各自的 blast），不生成产物 | 零工程量，用户需自行在 JEI/REI/EMI 配置中手动隐藏 |

**推荐决策：A + 文档化降级条件**。

emit JEI 版本作为默认，同时在 UI 和产物注释中说明"此脚本仅对 JEI 生效；REI/EMI 用户需手动配置"。如果运行时探测到整合包没有 JEI（通过 modlist），UI 上标明"当前整合包未检测到 JEI，隐藏操作可能不生效"。

**决策记录要求**：
- 更新 `docs/current/m2-action-engine-plan.md` 的 §13（输出层后置），把本节的两个决策写进去
- 更新 `进度.md`

---

### P2.2 · scale 发射实施

**前置**：P2.1 决策确认后。

**涉及文件**：
- `packages/main/src/services/engine/actions/scale.ts`：当前 IR 层的 `classifications` 字段记录了每个 op 的 `decision`（emission_pending / conservation_skip / type_defer / no_baseline）。需要增加"哪些 op 可以发射、哪些 deferred"的判定逻辑。
- `packages/main/src/services/export/kubejs-emitter.ts`：`emitChangeSet` 中新增 `scale_recipe_field` 的处理分支。

**设计要点**：

scale 的发射流程：
1. `planScale` 产出 operations（`includedInChangeSet=false`） + classifications
2. 按 P2.1 的白名单判定后，将 `decision=emission_pending` 且配方类型在已知白名单内的 op 翻转为 `includedInChangeSet=true`
3. emitter 收到 `scale_recipe_field` 的 op 后：
   - 对每个原始配方 emit `event.remove({id: recipeId})` 
   - 然后 emit `event.custom({type: originalType, ...modifiedFields})`，修改后的字段从 `after.field` 和 `after.value` 取
   - 按配方类型逐类构造 custom 调用的参数（smelting 的 `cookingtime` / `experience` 等字段名取决于 KubeJS 版本）
4. 未知配方类型保持在 `includedInChangeSet=false`，在 UI 上展示 deferred 理由

**受影响的 emitter 逻辑**：
- `emitServerScriptsFile` 当前处理 `replace_recipe_input_item` / `remove_recipe` / `retag_add` / `retag_remove` / `rename_lang`（非 recipe 类走 lang 落点）——需要新增 `scale_recipe_field` 分支
- 因为 scale 同时涉及 remove + custom，需要在文件中先产出所有 remove，再产出所有 custom（避免 remove 覆盖 custom）

**验收标准**：
- smoke fixture：smelting 配方（type=smelting，output_count=1），scale factor=2 → 产物包含 `e.remove({id})` + `e.custom({type:'smelting', result: {item:'...', count:2}, cookingtime:200, experience:0.7})`
- 未知配方类型（如 `create:mixing`）→ `includedInChangeSet=false` + deferred 理由
- 守恒 1:1 配方 → 不发射，分类为 `conservation_skip`
- revert 删除产物文件后恢复
- `pnpm typecheck && pnpm build && pnpm smoke:m2`

**边界**：
- 不新建 datapack emitter
- KubeJS `event.custom()` 签名需先手动验证（在一个真实 1.21 实例中测试），不确定的参数标记 TODO
- 白名单外的配方类型永远不猜

---

### P2.3 · hide_in_jei 发射实施

**前置**：P2.1 决策确认后。

**涉及文件**：
- `packages/main/src/services/export/kubejs-emitter.ts`
- `packages/main/src/services/engine/actions/hide.ts`：可能需要增加确认翻转逻辑

**设计要点**：

1. hide 的 IR op 当前 `includedInChangeSet=false`。用户确认后翻转为 true
2. emitter 收到 `hide_in_jei` op 后：
   - 落点：`kubejs/client_scripts/zzz_delightify_generated.js`
   - 内容：`JEIEvents.hideItems(event => { event.hide('item:id1'); event.hide('item:id2'); })`
   - 文件标记 `// @delightify-generated`
   - 纳入 `.delightify-generated.json` 清单
3. revert 时一并删除 client_scripts 文件

**需要核实的事项（实现前必须验证）**：
- KubeJS 1.21 的 `JEIEvents.hideItems` 事件名和 API 是否如文档所述
- `kubejs/client_scripts/` 下的脚本是否在客户端自动加载
- 如果整合包没有 KubeJS JEI addon，这个文件是否会导致报错（应 warn 而不 crash）

**验收标准**：
- smoke fixture：2 个物品 hide，确认后产物含 `JEIEvents.hideItems(...)` 
- revert 删除 client_scripts 产物
- 产物文件中有 `@delightify-generated` 标记
- `pnpm typecheck && pnpm build && pnpm smoke:m2`

**边界**：
- 只支持 JEI 的隐藏 API；REI/EMI 用户在 UI 上有提示
- hide 不需要 blast-radius 强制 defer（hide 是可逆的低风险操作，比 remove_item 安全得多）
- 不实现 remove_item 注册删除

---

## Phase 3 · 生产打磨

---

### P3.1 · Recipe 只读详情强化

**目标**：让 RecipeBrowser 的详情面板不仅是"展示 raw JSON 和输入/输出列表"，而是以**配方图**的方式呈现配方结构。

**当前状态**：
- RecipeBrowser 有详情面板（`RecipeDetailCard` 组件）
- 已有 `recipes:get-detail` IPC 返回 `{ recipe, inputs, outputs }`
- 输入/输出数据来自 `recipe_inputs` / `recipe_outputs` 表，结构化程度足够

**设计要点**：

1. **配方图视图**：用简单的 ASCII/CSS 流程图展示输入→配方→输出：
   ```
   [小麦 ×1] ─┐
   [水桶 ×1] ─┼─ [ crafting_shaped ] ─→ [面团 ×2]
   [盐   ×1] ─┘
   ```
   （不需要真正的图形引擎，CSS flex/grid + 箭头字符即可）

2. **blast 接入**：详情面板中展示：
   - "此配方消耗的物品各自还被多少配方消耗"（下游引用）
   - "此配方产出的物品被多少配方用作输入"（上游引用）
   - 调用 `engine:blast`

3. **未结构化配方的友好展示**：
   - `unparsed=true` 的配方显示"此配方来自脚本/自定义处理，无结构化数据"
   - 提供 raw_json 的可折叠查看

**涉及文件**：
- `packages/renderer/src/pages/RecipeBrowser/index.tsx`
- `packages/renderer/src/components/RecipeDetailCard/`（如果有）
- 可能新增 `packages/renderer/src/components/RecipeFlowDiagram/`

**验收标准**：
- `pnpm typecheck && pnpm build`
- 手动跑 app：在 RecipeBrowser 中点击任意配方，详情面板展示输入→输出流程图 + blast 信息

---

### P3.2 · 死通道清理

**当前死通道**（`shared/constants/ipc.ts`）：
- `RECIPE_EDIT_CREATE` / `RECIPE_EDIT_UPDATE` / `RECIPE_EDIT_DELETE` / `RECIPE_EDIT_LIST` — 标了 `reserved`，无 handler
- `EXPORT_DATAPACK` — 标了 `reserved`，无 handler

**设计决策**：

**推荐：保留 channel 常量但加明确标注，不移除。**

理由：
- RecipeEditor 是 M2 明确推迟的功能（"第二阶段实现"），不是永远不会做
- `EXPORT_DATAPACK` 是规格定义的多后端之一（虽然在 v1.x 才做）
- 移除常量会在后续重新加回时增加轮子成本

需要做的事：
- 在 `shared/constants/ipc.ts` 中将注释从 `// reserved` 改为明确标注推迟的阶段：
  ```typescript
  // 推迟：RecipeEditor 二期（非 M2 范围）
  RECIPE_EDIT_CREATE: 'recipe-edit:create',
  ...
  // 推迟：datapack emitter（v1.x，非 M2 范围）
  EXPORT_DATAPACK: 'export:datapack',
  ```
- 在 `preload.ts` 中检查这些 channel 是否被暴露到 `electronAPI`——如果有，保留但标注

**验收标准**：
- `pnpm typecheck`
- 代码注释清晰，不引起"为什么有通道无实现"的疑惑

---

### P3.3 · 错误处理 & 用户反馈

**目标**：让应用在大数据量、异常场景下不崩溃，给用户清晰的错误信息。

**当前可能的薄弱点**：
- 大数据量下的渲染性能（194 mod 样本包在 ItemBrowser 900 行组件中运行良好，但更大包未测试）
- 导入失败时的错误信息是否友好
- dry-run 失败时 UI 是否有错误提示
- ScriptWorkspace 保存失败时的反馈

**设计要点**：

1. **状态视图标准化**：所有页面统一使用 `StateViews`（loading / empty / error），当前 ItemBrowser 和 RecipeBrowser 已用，Dashboard 和 ActionWorkbench 应补齐
2. **导入失败友好提示**：当前 importer 已有 `data_imports(is_success=0, error_message)` 记录，UI 上应展示 error_message 而非通用"导入失败"
3. **dry-run 错误捕获**：ActionWorkbench 调用 `engine:dry-run` 时应有 try/catch，失败时展示具体错误而非页面崩溃
4. **大数据量分页**：ItemBrowser 已有分页（20/50/100/200），RecipeBrowser 同样的机制。确认 10K+ items 场景下分页性能可接受

**验收标准**：
- 构造缺表 SQLite，导入 → 显示具体缺表名和"请重新导出"建议
- dry-run 传无效参数 → 显示具体错误，不发白屏

---

### P3.4 · 用户文档

**目标**：让整合包作者能独立使用 Delightify 完成一次完整的 导入→浏览→分析→改包→导出 流程。

**文档结构建议**：

1. **快速上手**（`docs/guides/quickstart.md`）：
   - 安装 exporter（`packages/exporter` 构建 + 放入 mods）
   - 导出数据（`/mpide_export dump`）
   - 打开 Delightify → 创建项目 → 导入数据
   - 浏览物品/配方
   - 完成一次 unify（统一铜锭）

2. **动作工作台指南**（`docs/guides/action-workbench.md`）：
   - 四个基础动作的使用说明和示例
   - dry-run / diff / export / revert 四步流程
   - 风险信号的理解
   - deferred 确认的含义

3. **脚本工作区指南**（`docs/guides/script-workspace.md`）：
   - managed vs user 文件
   - Monaco 编辑器的使用
   - 生成产物的文件结构

**验收标准**：
- 按照文档，一个新手能独立完成从导出到 KubeJS 产物生成的完整流程

---

### P3.5 · 打包分发验证

**目标**：验证 `pnpm dist:mac` / `dist:win` / `dist:linux` 产物在目标平台可正常启动。

**涉及范围**：
- 检查 electron-builder 配置（`packages/main/electron-builder.yml` 或 `package.json` 中的 build 配置）
- 在各平台验证：启动 → 加载渲染进程 → 创建项目 → 导入数据 → 浏览 → 不崩溃
- 特别关注：`better-sqlite3` / `@libsql/client` 的原生模块是否正确打包
- Exporter 不在打包范围内（Java/Gradle 独立分发）

**验收标准**：
- 至少 macOS 打包产物可启动并走完基本流程
- `pnpm typecheck` 通过

---

## 执行顺序总览

```
Phase 1（现在）
  P1.1 复合动作 UI ──→ P1.2 轻量 Plan ──→ P1.3 smoke:m2
  产出：所有 9 个动作可在 UI 触发，方案可保存，全量 smoke 绿

Phase 2（Phase 1 完成后）
  P2.1 输出层决策 ──→ P2.2 scale 发射 ──→ P2.3 hide 发射
  产出：scale 和 hide 可端到端导出 + revert

Phase 3（Phase 2 完成后）
  P3.1 Recipe 详情 · P3.2 死通道 · P3.3 错误处理 ──→ P3.4 用户文档 · P3.5 打包验证
  产出：生产可用发布
```

## 不变量（全阶段）

- **不接 LLM/Agent**：所有 Agent 内容已搁置
- **增量不重写**：不重写 schema / importer / validator / unify / emitter / ConversionTool / 已有页面
- **确定性引擎**：所有动作由 ActionRequest 驱动，引擎展开为原语
- **生成物归 Delightify**：marker + 清单 + 覆盖保护 + revert 幂等
- **不确定即 defer**：删除/改 tag/跨 mod/世界方块 → 强制搁置
- **验证基线**：`pnpm typecheck && pnpm build` 为每次提交前提

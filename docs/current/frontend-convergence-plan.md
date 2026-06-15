# 前端收敛与重构 · 执行计划

> 状态：已完成（2026-06-16）。上游：`docs/current/frontend-convergence-brief.md`（种子简报）。
> 角色：**Claude = 审计 + 计划 + 出 Codex prompt + 审计产出**；**Codex = 落实代码**。响应中文。
> 目标：**收敛 + 重构「旧代码已实现的前端」**——修漂移/半接/失效/不一致，不加新功能。
> 基线提交：`1e436f3`。本计划基于本会话 A 阶段四路并行审计（pages×2 / IPC 契约 / 横切层）的分类问题清单。
> 完成提交区间：`1e436f3..895271e`（最新：`895271e fix(renderer): align remaining modules with global theme colors`）。

---

## 实施状态（2026-06-16）

本计划按批次完成并已推送到 `origin/main`。所有批次均以代码为准执行，保守增量、未引入新依赖、未重写页面结构或数据流。

| 任务 | 状态 | 结果摘要 |
| --- | --- | --- |
| FC-T1 | ✅ 已完成 | preload IPC 常量单源化，孤儿/保留通道按计划分类处置。 |
| FC-T2 | ✅ 已完成 | mock 与 ElectronAPI 接口对齐，删除 renderer 端 browser-* 死代码与未用 recipeTypes 声明。 |
| FC-T3 | ✅ 已完成 | ItemBrowser key 稳定化，category 无效联动降为纯图例。 |
| FC-T4 | ✅ 已完成 | ModManager 无数据文件检测不再静默，调试 console 清理。 |
| FC-T5 | ✅ 已完成 | ProjectManager 降级入口统一，编辑入口诚实置灰。 |
| FC-T6 | ✅ 已完成 | 新增公共 `StateViews`，建立 Loading / Empty / Error 状态组件与全局 spin 基础。 |
| FC-T7 | ✅ 已完成 | ItemBrowser / ProjectManager / ModManager / RecipeBrowser 分批迁移公共状态组件。 |
| FC-T8 | ✅ 已完成 | RecipeBrowser、RecipeCard、DebugTools、ItemIcon、SearchableSelect 等改走全局 CSS 变量。 |
| FC-T9 | ✅ 已完成 | 补 `nav.debug`、语言持久化、清死 key，ModManager 接通现有 dataImport key。 |
| FC-T10 | ✅ 已完成 | 删除 BlockRenderer / LanguageSwitcher / ThemeToggle，清 dataImportStore 历史链和 projectStore 未用 action/state。 |
| FC-T11 | ✅ 已完成 | 根级 ErrorBoundary 接入；Dashboard 统计改真实数据/诚实占位，移除 `#` 死链。 |
| 主题补修 | ✅ 已完成 | 补齐 ItemBrowser、ItemCard、CategoryLegend、ModManager、ConversionTool、CreateProjectDialog、ErrorBoundary 的全局亮暗主题跟随。 |

### 实际验证

- `pnpm typecheck && pnpm build` 多轮通过。
- `pnpm dev` 真实 Electron 启动验证。
- 手动/脚本实跑覆盖：
  - Dashboard 有/无当前项目两态。
  - 根级 ErrorBoundary 临时抛错兜底。
  - zh/en 语言切换与重启持久化。
  - light/dark 主题切换下 ItemBrowser、CategoryLegend、CreateProjectDialog 等 computed style 随 `data-theme` 变化。

### 偏离与保留项

- `projectStore.isCreating` 原计划候选删除，但 `CreateProjectDialog` 仍实际消费，用于禁用态和“创建中...”显示，因此保留。
- ProjectManager 中遮罩/叠加类 rgba 与 ItemCard 分类色属于非主题表面色/语义分类色，未强行变量化。
- RecipeEditor 仍为后续功能范围，本轮未实现；Quick Start 第三步已改往只读 `/recipes`。

## 0. 已锁定决策（本会话 B 阶段，AskUserQuestion）

1. **重构深度 = 保守增量收敛**：修 P0 真 bug + 收敛一致性（抽公共错误/加载/空态组件、统一样式变量走 global.css、补 i18n）+ 删死码 + 防漂移地基。**不动页面结构 / 数据流架构**，保行为优先。
2. **mock = 保留并对齐 + 删 browser-***：补齐 mock 缺失方法、修形状漂移使其与真实 handler 一致；删死代码文件 `ipc/browser-api.ts` / `browser-db.ts` / `browser-fs.ts`。
3. **死/孤通道 = 分类处理**：
   - 未来要用的 → 标 `reserved` + 注释指向计划：`RECIPE_EDIT_*`（编辑二期）、`EXPORT_DATAPACK`（输出层）。
   - 纯孤儿 → 删：`mod-data:get-manifest`（无前端出口）、`recipe-types:get-stats`（接口都没声明）。
   - `recipe-types:*` 五通道 → **见 §4 审计修正：实为孤儿，按孤儿处置（删 renderer 端未用接口声明），不桥接**。
4. **顺序 = 先收敛旧前端，再建 NA3/NA4**：本轮只收敛既有 8 页 / 组件 / IPC，为 NA3（动作工作台）NA4（只读浏览强化）打地基；新 UI 另立。

---

## 1. 工作流与验证基线

- **每个任务**：目标 / 涉及文件 / 验收 / 验证命令。小而可独立验证、依赖排序、保行为。
- **验证基线（务必双轨，勿只靠 typecheck）**：
  - 硬门：`pnpm typecheck && pnpm build`（CI 只跑 typecheck）。
  - **真跑 app**：`pnpm dev`（或 `pnpm dev:full` 走 Vite HMR；`pnpm dev:web` 验浏览器降级/mock）。仓库**无 UI 测试**，UI 改动一律用 `/run` 或 `/verify` 实跑 + 截图核对。
- **Codex 批次**：按 §5 分小批输出 prompt，每批一层或半层，勿摊太大；改动后 Claude 读实际 diff 核对再 commit（消息尾 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`）。

---

## 2. 任务清单（分层、依赖排序）

### Layer 0 — IPC 契约收敛与防漂移（地基，先做：后续任务都调 IPC）

#### FC-T1：preload 单源化 + 死/孤通道分类处置
- **目标**：消除 preload 自带的 `IPC_CHANNELS` 副本双源漂移；按决策 3 分类处置死/孤通道，使「常量 / handler / preload / 接口」四者一致。
- **涉及文件**：
  - `packages/main/src/preload.ts`：删内嵌 `IPC_CHANNELS`（`:11-60`），改 `import { IPC_CHANNELS } from '@delightify/shared'`（或现用别名）。
  - `packages/shared/src/constants/ipc.ts`：`RECIPE_EDIT_*`（`:46-49`）、`EXPORT_DATAPACK`（`:54`）加注释标 `reserved`（指向「配方编辑二期」/「输出层」计划），**保留常量**；确认 `items:get-texture` / `shell:open-external` / `engine:*` 等活通道都在常量内（当前 `items:get-texture`、`shell:open-external` 是硬编码字符串，纳入常量统一）。
  - `packages/main/src/ipc/mod-data.ts`：删孤儿 handler `mod-data:get-manifest`（`:194`，无常量/preload/接口/调用）。
  - `packages/main/src/ipc/recipe-types.ts`：删孤儿 handler `recipe-types:get-stats`（`:69`，接口未声明、无消费）。
- **验收**：preload 不再有 `IPC_CHANNELS` 字面量；reserved 通道有明确注释；两个孤儿 handler 删除后全仓无引用；活通道全部走 shared 常量。
- **验证**：`pnpm typecheck && pnpm build`；`pnpm dev` 冒烟（各页能打开、IPC 不报「channel not allowed」）。

#### FC-T2：mock 对齐真实 handler + 删 browser-* + 修接口类型漂移
- **目标**：mock 与真实 handler 返回形状一致、方法齐全；删死代码降级文件；修接口层类型漂移。
- **涉及文件**：
  - `packages/renderer/src/ipc/mock.ts`：补缺失假实现 `itemsGetTexture`（返回 `{base64,mimeType}|null`）；修形状漂移 —— `modDataValidate` 对齐 `ValidationResultWithCapabilities`（`mod.ts`）、`modDataImport` 对齐 `ModDataImportResult`、`itemsGetDetail` 补 `displayName`、`recipesGetDetail` 改 `IpcResponse<RecipeDetail|null>`、`projectList` 的 `total` 与接口对齐。`projectCreate/Update` 的 `any` 改 `CreateProjectData/UpdateProjectData`。
  - `packages/renderer/src/ipc/index.ts`：接口补 `projectList` 的 `total`；`modsQuery` 内联类型 `{modid;version?;name?}[]` 改用 shared `Mod`；删 `recipeTypesGetAll/Get/GetByMod/ClearCache` 四个未用声明（`:89-92`，见 §4 修正）；移除随之多余的 import。
  - **删** `packages/renderer/src/ipc/browser-api.ts` / `browser-db.ts` / `browser-fs.ts`（零引用确认）；清理 `index.ts:137` 的 `browserElectronAPI` 重导出若指向已删文件（当前实际等于 mock，核对后保留或改名）。
- **验收**：mock 方法集 = ElectronAPI 接口方法集（无缺）；`pnpm dev:web` 下 8 页面不出现 `undefined is not a function`；删文件后全仓无残留 import；`index.ts:121` 的 `as unknown as ElectronAPI` 强制断言可保留但不再掩盖缺方法。
- **验证**：`pnpm typecheck && pnpm build`；`pnpm dev:web` 实跑各页（浏览器降级路径），`pnpm dev` 实跑（Electron 真实路径）。

---

### Layer 1 — P0 真 bug（各自独立，可并行交付）

#### FC-T3：ItemBrowser key 稳定化 + category 死筛选收敛
- **目标**：消除 `Math.random()` 作 React key 导致的重建/闪烁；解除 category 与后端的虚假联动（点击触发无效重查、误导用户）。
- **涉及文件**：`packages/renderer/src/pages/ItemBrowser/index.tsx`
  - `:347` key 改用稳定 `item.itemId`（`:352` 已挡 null，`|| Math.random()` 是死分支，一并去掉）。
  - category：`ItemQueryParams` 无该字段、**本轮不新增后端字段**。处置：把 CategoryLegend 降为**纯图例展示**，移除其点选触发 `loadItems` 的无效联动（`:629-630`），并清理只为它服务的 `filters.category` / `hasFilters` 中的 category 分支。
- **验收**：列表滚动/重查时图标不闪烁、不重建；点类别图例不再触发无效 `itemsQuery`；其余筛选（mod/tag/search/分页/多视图）行为不变。
- **验证**：`pnpm typecheck && pnpm build`；`pnpm dev` 实跑 ItemBrowser，截图核对图标稳定 + 类别交互。

#### FC-T4：ModManager 检测断点修复 + console 清理
- **目标**：检测「未找到文件」时给出明确 UI 反馈（当前静默无反应）；清调试日志。
- **涉及文件**：
  - `packages/renderer/src/store/dataImportStore.ts`：`detectDataFile`（`:87-92`）在 `found=false` 时写 `detectionError`（或返回带状态标志），不再把 `filePath:null` 当成功静默；清 `:79,83,85,101` 的 `console.log`。
  - `packages/renderer/src/pages/ModManager/index.tsx`：`handleDetect`（`:200-222`）在无文件时设错误态 / 提示，不再只 `console.log`；清 7 处 `console.log`。
- **验收**：无数据文件时点「开始检测」有明确提示（错误态走 §FC-T6 公共组件或现有 errorAlert，先修逻辑、样式在 T7 收敛）；有文件路径不变；无残留 console。
- **验证**：`pnpm typecheck && pnpm build`；`pnpm dev` 实跑：在无 export.sqlite 的项目点检测，确认有反馈。

#### FC-T5：ProjectManager 降级统一 + 编辑入口诚实化
- **目标**：统一 IPC 降级策略（store 不再自行 throw，与顶层 `ipc/index.ts` 一致）；编辑入口不再「点了没反应」。
- **涉及文件**：`packages/renderer/src/store/projectStore.ts`、`packages/renderer/src/pages/ProjectManager/index.tsx`
  - `projectStore.ts:73-78` 的自带 `electronAPI()`（无 preload 即 throw）→ 改为复用 `ipc/index.ts` 的降级入口（mock 兜底），与 ItemBrowser 行为一致。
  - 编辑入口（`:228`、`:324` 下拉「编辑」）：**本轮不实现编辑对话框（属新功能）**。处置：入口置灰 + tooltip「编辑功能开发中」，删 `:417-419` 的 `console.log` 占位。（保留 store `updateProject` 不动，供二期接。）
  - 顺手：`:298,303` 等硬编码中文留待 FC-T9 i18n 统一处理（此任务只碰逻辑，不碰文案）。
- **验收**：`pnpm dev:web` 浏览器降级下 ProjectManager 不抛「Electron API not available」、与 ItemBrowser 一致可跑；编辑入口置灰不再误导；无 console 占位。
- **验证**：`pnpm typecheck && pnpm build`；`pnpm dev` + `pnpm dev:web` 实跑 ProjectManager。

---

### Layer 2 — 一致性收敛（主战场；T6 是 T7 前置）

#### FC-T6：抽公共状态组件（Loading / Error / Empty）+ spin 单源
- **目标**：建立全应用统一的加载/错误/空态展示组件与单一 `@keyframes spin`，作为各页收敛的承接点。**纯新增，不改调用方**（调用方迁移在 T7）。
- **涉及文件**：
  - 新增 `packages/renderer/src/components/StateView/`（或 `Loading`/`ErrorState`/`EmptyState` 三件，二选一，**增量、无新依赖**）：覆盖现有三套形态的并集（错误态含可选「重试」回调、空态含图标+文案、加载态含 spinner）。
  - `packages/renderer/src/styles/global.css`：收口唯一 `@keyframes spin`（当前散落 6 个 module.css）。
- **验收**：组件可渲染 loading/error(+retry)/empty 三态；global.css 有唯一 spin；尚未被任何页引用前不改变现有行为。
- **验证**：`pnpm typecheck && pnpm build`。

#### FC-T7：各页迁移到公共状态组件 + 删重复 spin
- **目标**：ItemBrowser / ProjectManager / ModManager / RecipeBrowser 的错误/加载/空态改用 FC-T6 组件；删各自重复的 spin/态类名。
- **涉及文件**：`pages/{ItemBrowser,ProjectManager,ModManager,RecipeBrowser}/index.tsx` 及对应 `style.module.css`（删 `.loading/.loadingState/.error/.errorMessage/.errorAlert/.empty/.emptyState` 重复定义与 `@keyframes spin`）。
- **验收**：四页错误/加载/空态视觉与交互统一（错误态重试按钮口径一致）；删除重复 CSS 后无样式回退。**Codex 可拆两批**（先 ItemBrowser+ProjectManager，再 ModManager+RecipeBrowser）。
- **验证**：`pnpm typecheck && pnpm build`；`pnpm dev` 实跑四页，逐页截图核对三态（含触发错误：无项目/查询失败）。

#### FC-T8：样式变量统一（HEX / 逐类 dark → global.css 变量）
- **目标**：消除硬编码 HEX 与逐类 `[data-theme='dark']` 覆盖，统一走 `styles/global.css` 的 CSS 变量体系（以 ConversionTool 为已收敛基准）。
- **涉及文件**：`RecipeBrowser/style.module.css`（全量 HEX + ~40 dark 选择器）、`components/RecipeCard/style.module.css`（~34 dark 选择器）、`pages/DebugTools/style.module.css`（`--accent-primary`/`--primary-color` 等非标准名 + fallback）、`components/SearchableSelect/style.module.css`、`components/ItemIcon/style.module.css`；必要时 `styles/global.css` 补缺变量。统一引号风格（`[data-theme="dark"]`）。
- **验收**：上述文件无逐类 dark 硬编码覆盖、无游离 HEX；dark/light 两模式实跑视觉不回退。**Codex 按文件分批**（RecipeBrowser → RecipeCard → DebugTools → 其余）。
- **验证**：`pnpm typecheck && pnpm build`；`pnpm dev` 切换 dark/light 实跑 RecipeBrowser/DebugTools 截图核对。

#### FC-T9：i18n 接入收敛 + persist
- **目标**：让已存在却无人消费的整组译文真正接入；补缺 key；语言选择持久化。
- **涉及文件**：
  - 接入 `useI18n`：`ItemBrowser` / `RecipeBrowser` / `ConversionTool` / `DebugTools`（译文 `itemBrowser.* / recipeBrowser.* / conversionTool.*` 等已存在）；`ModManager`（`:165` 已声明 `t` 未用，`dataImport.*` 已存在）。
  - 补 `nav.debug`（`App.tsx:41`/`Sidebar:109` 硬编码「数据库管理」）；处置死 key `nav.modManager`（接入或删）。
  - `ProjectManager` 残留硬编码中文（`:298,303` 等）→ `t()`。
  - `components/ErrorBoundary/index.tsx` fallback 文案（`:54,57,60`）→ i18n。
  - `i18n/store.ts:36` 加 `persist`（localStorage，与 theme store 对齐），重启不再强制回 `zh-CN`。
  - 接入后复查 locales：删确认无消费的死 key（如 `welcome.*`），保 en/zh-CN key 对齐。
- **验收**：上述页面切换语言全部生效、无硬编码漏网；重启保留语言选择；en.ts 与 zh-CN.ts key 一一对齐。**Codex 按页分批**。
- **验证**：`pnpm typecheck && pnpm build`；`pnpm dev` 切换 en/zh 实跑各页 + 重启验持久化。

---

### Layer 3 — 清死码

#### FC-T10：删死组件 + 清未用 store action/state
- **目标**：删零引用死组件与重复实现；清未接的 store 字段。
- **涉及文件**：
  - **删** `components/BlockRenderer/`、`components/LanguageSwitcher/`、`components/ThemeToggle/`（零引用确认；后两者已被 `Header` 内联实现）。
  - `store/projectStore.ts`：清未用 `refreshCurrentProject` / `closeProject` 及未消费的 `isUpdating/isCreating`（`isDeleting` 若 T7 用于删除态则保留——核对后定）。
  - `store/dataImportStore.ts`：处置未接的「导入历史」链 `importHistory/isLoadingHistory/loadImportHistory`——**本轮不接 UI**，故删除或标 reserved（与决策 3 风格一致，倾向删，因无对应计划）。
- **验收**：删除后 `pnpm typecheck` 无未解析引用；全仓 grep 无残留；app 行为不变。
- **验证**：`pnpm typecheck && pnpm build`；`pnpm dev` 冒烟各页。

---

### Layer 4 — 根级接入 + 假数据

#### FC-T11：ErrorBoundary 根级接入 + Dashboard 真实统计/死链接
- **目标**：错误边界覆盖全应用；Dashboard 不再用写死 `0` 冒充状态、不再有 `#` 死链接。
- **涉及文件**：
  - `packages/renderer/src/App.tsx`：用 `ErrorBoundary` 包裹路由根（当前仅 ItemBrowser/RecipeBrowser 局部包）。
  - `packages/renderer/src/pages/Dashboard/index.tsx`：Quick Stats（`:175-192` 写死 `0`）改读真实来源——无项目时显示诚实空态/提示，有当前项目时读 `projectGetStats`（已有 IPC）；资源卡 `link:'#'`（`:140-155`）改真实链接或移除该卡；`step3` 指向 `/editor`（空壳）改指向只读浏览或加「即将支持」标注。
- **验收**：任一页渲染抛错时根级 ErrorBoundary 兜底；Dashboard 统计反映真实数据或诚实空态；无 `to="#"` 死链接。
- **验证**：`pnpm typecheck && pnpm build`；`pnpm dev` 实跑 Dashboard（有/无项目两态）+ 故意抛错验边界。

---

## 3. 依赖图（执行顺序）

```
Layer0  FC-T1(preload单源/通道) ── FC-T2(mock对齐/删browser-*)      ← 地基，先做
                 │
Layer1  ┌────────┼─────────┐
        FC-T3   FC-T4    FC-T5            ← P0 真 bug，三者独立，可并行
        (ItemBr) (ModMgr) (ProjMgr)
                 │
Layer2  FC-T6(公共态组件/spin) ── FC-T7(各页迁移)
        FC-T8(样式变量统一)              ← T8/T9 与 T7 弱耦合，可并行推进
        FC-T9(i18n接入/persist)
                 │
Layer3  FC-T10(删死组件/未用store)
                 │
Layer4  FC-T11(ErrorBoundary根级 + Dashboard真实数据)
```
- 关键路径：**T1→T2**（契约地基）必须最先；**T6→T7** 有硬依赖；T3/T4/T5 独立；T8/T9 可与 T7 并行；T10/T11 收尾。
- 每层交付后 `pnpm typecheck && pnpm build` + 实跑回归，再进下一层。

---

## 4. 审计修正记录（写入计划前的核实，覆盖简报/审计旧结论）

1. **`recipe-types:*` 五通道是孤儿，非「RecipeBrowser 待用」**：RecipeBrowser 用的是 `recipesGetTypes`（`recipes:get-types`，`RecipeBrowser:100`），与 `recipe-types:*` 无关。renderer 接口 `recipeTypesGetAll/Get/GetByMod/ClearCache`（`index.ts:89-92`）**无任何页面消费**，preload/mock 也未实现。→ 决策 3「补桥接接通」前提不成立，**改为孤儿处置**：FC-T2 删 renderer 端 4 个未用接口声明；主进程 `services/recipe-types` 与 handler 属后端，**不动**（保留备用）。如需保留为 reserved-reachable 可后续再桥接。
2. **ElectronAPI 实为 37 方法、mock 非全量**（缺 5：`itemsGetTexture` + `recipeTypes*` 四个）——简报「~34、全量」修正。FC-T2 处理（其中 4 个 recipeTypes 走删除而非补 mock）。
3. **ErrorBoundary 仅 2 页局部接入、根级缺失**——FC-T11 上提根级。
4. **零引用确认**：`ipc/browser-{api,db,fs}.ts`、`BlockRenderer`、`LanguageSwitcher`、`ThemeToggle` 全仓无 import，可安全删除（FC-T2 / FC-T10）。
5. **preload 双源**：`preload.ts:11` 自带 `IPC_CHANNELS` 字面量副本，与 shared 漂移——FC-T1 单源化。

---

## 5. Codex prompt 批次规划

按简报第 6 节格式（背景与铁律 → 现状事实[带行号] → 任务[目标/涉及文件/验收/验证] → 整体验收 → 禁止事项）。建议批次：

- **批 1**：FC-T1 + FC-T2（IPC 契约地基，一起交，互相关联）。
- **批 2**：FC-T3、FC-T4、FC-T5（P0 bug，可一批三任务或分两批）。
- **批 3**：FC-T6 + FC-T7-a（公共组件 + 前两页迁移）。
- **批 4**：FC-T7-b + FC-T8（剩余两页迁移 + 样式变量，按文件再分小批）。
- **批 5**：FC-T9（i18n，按页分小批）。
- **批 6**：FC-T10 + FC-T11（清死码 + 根级/Dashboard）。

每批通用**禁止事项**：不重写稳定后端（schema/importer/validator/unify/emitter 发射/ConversionTool 既有逻辑）；不引新依赖/新框架；不夹带新功能（配方编辑、动作工作台、输出层、LLM 均不在本轮）；增量化、保行为；遇与本计划冲突即停并在 PR/回复说明。

---

## 6. 明确不做（本轮）

- 不实现配方编辑（RecipeEditor 保持占位，仅后续可改纯只读查看，属 NA4）。
- 不建动作工作台 UI（NA3）、不接 `engine:dry-run/blast` 到页面（保留悬空，待 NA3）。
- 不实现项目编辑对话框（入口仅诚实置灰）。
- 不实现输出层发射 / datapack / scale·hide 发射；不接 LLM/Agent。
- 不新增后端查询字段（如 ItemQueryParams.category）——category 按移除无效联动处理。
- 不重写页面结构 / 数据流架构（保守增量）。
</content>
</invoke>

# Delightify MVP-0 可落地实现方案

> 状态：实现设计（以 2026-06-14 仓库真实代码为准）。本文用于直接交给 Codex 执行。
> 更新：2026-06-16 exporter 已实现真实贴图导出，本文中”exporter v1 不写 item_resources / 贴图为空”的描述仅代表 2026-06-14 基线事实；当前贴图状态以 `docs/current/visualization-texture-plan.md` 与代码为准。
> 审计基线：`packages/main/src/{services,ipc,preload.ts}`、`packages/renderer/src/{ipc,pages}`、`packages/shared/src/{types,constants}`、`packages/exporter/`、`scripts/smoke-mvp0-unify.mjs`。
> 关键结论（颠覆 `进度.md` 的”待办”描述，以代码为准）：**MVP-0 后端主链路已基本实现并有可跑通的 smoke 断言**。schema、importer（全 v1 表）、validator（分流 + capabilities）、unify query/dry-run、KubeJS emitter、全部 IPC、preload、renderer 接线、`pnpm smoke:mvp0` 均已存在。真正剩余的工程缺口集中在**浏览层显示名（v1 应走 `translations`，但 `items.ts` 仍查 `item_resources.lang_name`）**与几处打磨项。本方案优先修这些缺口，不做重写。
> ⚠️ **AGENT 搁置（2026-06-30）**：本文中任何 LLM/Agent 相关排除项仍然有效；所有 Agent 内容已统一搁置，待更详细专项规划。

---

## 1. 当前代码事实

### 1.1 数据库 schema（已实现，基本对齐 v1 契约）

- 运行时建表走 **`packages/main/src/services/database/schema-manager.ts` 的 `CORE_TABLES`**（`SchemaManager.initialize()` → `createTableIfNotExists()`）。**不是** drizzle 的 `schema.ts`。
- `CORE_TABLES` 已建的表（共 15 张）：`schema_version`、`manifest`、`mods`、`items`、`blocks`、`item_creative_tabs`、`item_tags`、`recipes`、`recipe_inputs`、`recipe_outputs`、`translations`、`data_imports`、`item_resources`、`recipe_views`、`recipe_view_backgrounds`。
- `items` 列与契约一致：含 `translation_key`、`is_block`、`max_stack`、`max_damage`、`is_damageable`、`is_fire_resistant`、`rarity`、`enchant_value`、`food_nutrition`、`food_saturation`、`food_always_eat`、`default_components_json`（`schema-manager.ts:66-85`）。
- `drizzle` 的 `schema.ts` 与 `CORE_TABLES` 表集合一致，但**仅用于类型导出**，运行时 DDL 不经过它（`createTableIfNotExists` 不发出 `references` 外键）。两者表集合现已对齐，`mvp0-data-foundation.md §9` 说的"脱节"问题在表层面已不存在。
- `data_imports` 同时有 `data_version`（NOT NULL，旧字段）**和** `schema_version` 两列（`schema-manager.ts:184-201`）。这是与 `mvp0-data-foundation.md §4.1`（只有 `schema_version`）的**文档/代码冲突，以代码为准**：保留 `data_version`。

### 1.2 importer（已实现，读取全部 v1 表）

文件 `packages/main/src/services/mod-data-importer/importer.ts`：

- 已实现并被调用的读取函数：`readManifest`、`readMods`、`readItems`（含 `translation_key` 与全部 v1 列，`importer.ts:456-489`）、`readItemTags`、`readRecipes`、`readItemResources`、`readBlocks`、`readItemCreativeTabs`、`readRecipeInputs`、`readRecipeOutputs`、`readTranslations`、`readRecipeViews`、`readRecipeViewBackgrounds`。可选表用 `tableExists()` 容错（缺失返回 `[]`）。
- 已实现并被调用的导入函数：`importManifest/Mods/Items/ItemTags/Recipes/Blocks/ItemCreativeTabs/RecipeInputs/RecipeOutputs/Translations/ItemResources/RecipeViews/RecipeViewBackgrounds`（通用批量 helper `importRows`，逐条回退 + UNIQUE 容错）。
- 事务：`schemaManager.initialize()`（DDL，在 BEGIN 之前）→ `BEGIN` → `clearExistingData()`（全量清空 13 张事实表）→ 逐表导入 → `recordImportHistory()` → `COMMIT`；异常 `ROLLBACK`（`importer.ts:214-352`）。**失败不会留下半成品事实层**。
- `item_resources` **不再被砍裁**（保留全部 `resource_type`，`importer.ts:1285-1324`），契约 §8.1 已满足。
- batch size：items=500、tags=500、recipes=200、resources=100、recipe_views=100、backgrounds=50、其余=300/500。
- 目标库路径：`<projectPath>/.delightify/project.db`（`importer.ts:180`，与 `paths.ts` 一致）。

### 1.3 validator（已实现分流 + capabilities）

文件 `packages/main/src/services/mod-data-importer/validator.ts` + `types.ts`：

- `classifyDataSource(tables)`：
  - 含全部 `EXPORTER_V1_REQUIRED_TABLES` → `exporter_v1` + `EXPORTER_V1_CAPABILITIES`（`{browse:true,mvp0Unify:true}`）。
  - 仅有部分结构化表（`recipe_inputs`/`recipe_outputs`/`translations` 之一）但不全 → **报错拒绝**（`Exporter v1 数据文件缺少必需的表...`）。
  - 含全部 `LEGACY_REQUIRED_TABLES` 但无结构化表 → `legacy_exporter` + `LEGACY_EXPORTER_CAPABILITIES`（`{browse:true,mvp0Unify:false,reason:'legacy_export_without_structured_recipes'}`）。
  - 否则报错。
- 必需表常量（`types.ts:225-238`）：
  - `LEGACY_REQUIRED_TABLES = [manifest, mods, items, item_tags, recipes]`
  - `EXPORTER_V1_REQUIRED_TABLES = [...legacy, recipe_inputs, recipe_outputs, translations]`
- 候选探测路径（`types.ts:207-223`）：v1 = `mpide-exporter/export.sqlite`、`.mpide-exporter/export.sqlite`、`delightify/export.sqlite`、`.delightify/export.sqlite`；legacy = `delightify-exporter/export.sqlite`、`.delightify-exporter/export.sqlite`、`config/delightify-exporter/export.sqlite`。

### 1.4 unify（已实现 query + dry-run）

- `packages/main/src/services/unify/query-service.ts`：
  - 候选召回三路：display name 精确（规范化后等值）、item id path 规范化等值 + 子串包含、tag（仅当 query 含 `:`/`/`）。
  - `normalizeText`：`trim().toLowerCase().normalize('NFKC')` 去除 `\s_\-:：/\\[](){}`。
  - display name 来自 `LEFT JOIN translations t ON t.key=i.translation_key AND t.lang=?`（`query-service.ts:279-293`）——**unify 已正确走 translations**。
  - 引用查询：direct item input、tag input、output、`unparsed=1` 的 raw_json LIKE。
  - 风险信号：`is_block_item`、`has_recipe_outputs`、`many_tag_input_references`(>10)、`tag_input_references`、`related_unparsed_recipes`(high)，以及跨候选的 `different_default_components`/`different_durability`/`different_food_properties`（均 medium）。
  - 守门：`getDataSourceStatus` 读最近一次 `is_success=1` 的 `data_imports`，非 `exporter_v1` 或 `mvp0Unify=false` → 抛 `UnifyUnavailableError`。
- `packages/main/src/services/unify/dry-run-service.ts`：
  - target 选择：用户指定优先；否则按 风险升序 → 引用权重降序(`outputs*2`) → `minecraft` 优先 → itemId 排序。
  - `computeConfidence`：基线 0.5，display_name +0.2，同 path +0.15，tag 交集 +0.1，risk≥medium −0.2，unparsed −0.2，clamp `[0.05,0.98]`。
  - `shouldAutoApply`：risk≥medium / 有 outputs / 有 unparsed / is_block 任一为真 → false；需 `directInputs.length>0`。
  - 操作：仅 `replace_recipe_input_item` 会 `includedInChangeSet=true`；`replace_recipe_output_item`、`tag_input_reference`、`raw_unparsed_reference` 一律 `false`（只展示，不入 change set）。

### 1.5 KubeJS emitter（已实现）

文件 `packages/main/src/services/export/kubejs-emitter.ts`：

- 生成路径：`kubejs/server_scripts/zzz_delightify_generated.js`（常量 `GENERATED_RELATIVE_PATH`）。
- 文件头标记：`// @delightify-generated`（`GENERATED_MARKER`）+ "Do not edit by hand"。
- 覆盖/删除保护：`assertGeneratedFileIsOwned` / `revertKubeJs` 检查已存在文件是否含 marker，否则抛错拒绝。
- 空 change set：抛错 `change set 为空...`。
- 支持的 operation：`replace_recipe_input_item` → `event.replaceInput({ id: ... }, before, after)`；`replace_recipe_output_item` → `event.replaceOutput(...)`；其余抛错。包裹在 `ServerEvents.recipes(event => { ... })`。
- 撤销：`revertKubeJs` 删除文件，幂等（不存在返回 `deleted:false`）。

### 1.6 IPC / preload / renderer 接线（已实现）

- IPC 常量 `packages/shared/src/constants/ipc.ts` 含 `UNIFY_QUERY`、`UNIFY_DRY_RUN`、`EXPORT_KUBEJS`、`EXPORT_KUBEJS_REVERT`、全部 `MOD_DATA_*`、`ITEMS_*`、`RECIPES_*`。
- handlers 全部注册（`ipc/index.ts:registerAllHandlers`）：`unify.ts`、`export.ts`、`mod-data.ts`、`items.ts`、`recipes.ts` 等。
- `preload.ts` 暴露：`unifyQuery`、`unifyDryRun`、`exportKubeJs`、`revertKubeJs`、`modData*`、`items*`、`recipes*`。
- renderer 类型 `packages/renderer/src/ipc/index.ts` 的 `ElectronAPI` 接口与 preload 一致，且引用 shared 的 `UnifyQueryResult/UnifyDryRunResult/KubeJsExport*` 等类型。
- `mock.ts` 已提供 `unifyQuery/unifyDryRun/exportKubeJs/revertKubeJs/recipesGetDetail` 的样例数据（browser-mock 模式可联调）。

### 1.7 renderer 页面

- `pages/ConversionTool/`（`index.tsx` + `style.module.css`，组件 `ConversionToolPage`）：**已完全接通 unify 工作台**——`modDataGetImportHistory`（数据源状态）、`unifyQuery`、`unifyDryRun`、`exportKubeJs`、`revertKubeJs`；含 lang 选择器、target 选择、决策清单、diff、导出/撤销与 error/notice/loading。
- `pages/ItemBrowser/`（组件 `ItemBrowser`）：调用 `itemsQuery/modsQuery/tagsQuery`；`displayName` 来自后端 `Item.displayName`，缺失时前端 `formatDisplayName(itemId)` 兜底；有 `searchField`（all/id/name/tag）选择器；**无 lang 选择器**。
- `pages/RecipeBrowser/`（组件 `RecipeBrowserPage`）：调用 `recipesQuery/modsQuery/recipesGetTypes`；**客户端解析 `raw_json`** 渲染网格输入输出；`raw_json` 为 NULL/`unparsed` → 输入空、输出显示 `?`；**未使用已导入的 `recipe_inputs/recipe_outputs`**。

### 1.8 exporter 子包（`packages/exporter/`）

- 输出路径：`<serverDir>/mpide-exporter/export.sqlite`（`ExporterService` 常量 `OUTPUT_DIR/OUTPUT_FILE`），临时文件 `.tmp` + `ATOMIC_MOVE`，清理 `-wal/-shm`。
- 命令：`/mpide_export dump`（OP，permission level 2）。
- `Schema.java` 定义并 CREATE 全部 15 张表 DDL；`schema_version = 1`。
- manifest 实际写入 key：`schema_version`、`exporter_version`(`0.1.0`)、`loader`(`neoforge`)、`mc_version`、`neo_version`、`environment`、`exported_at_utc`、`world_name`、`modlist_hash`（**真实 SHA-256**，非数量）。**未写 `mod_count`**。
- 已写入数据的表：`mods`、`items`、`item_creative_tabs`、`blocks`、`item_tags`、`recipes`、`recipe_inputs`、`recipe_outputs`、`translations`、`item_resources`（2026-06-16 起含 `resource_type='texture'` 贴图资源）。
- **仅有 DDL、当前无数据写入**：`recipe_views`、`recipe_view_backgrounds`（source 未实现，见 `source/package-info.java`）。
- recipes 容错：`unparsed = rawJson==null || isSpecial || !inputsStructured`；unparsed 配方 inputs/outputs 写空列表，`raw_json=NULL`。
- 脚本：`exporter:build`=gradle `build`、`exporter:runClient`=`runClient`（集成端单人世界，便于实跑 dump）。

### 1.9 smoke（已实现）

- `scripts/smoke-mvp0-unify.mjs` + 根脚本 `smoke:mvp0`（先 `pnpm build` 再跑）。
- 内置 fixture：构造 7 物品 / 5 配方（含 1 条 `unparsed=1`）/ 3 同名"铜锭"/translations，写到 `<tmp>/delightify/export.sqlite`，跑 `validate → import → queryUnifyCandidates → dryRunUnify → exportKubeJs(x2) → revertKubeJs(x2)`，断言 sourceKind/capabilities、候选集、`autoDecisionCount=1`/`deferredDecisionCount=1`/`changeSet=2`、生成代码含 `event.replaceInput(...)`、撤销幂等。
- 支持真实快照：`pnpm smoke:mvp0 -- --data-file <export.sqlite> --query 铜锭 --target minecraft:copper_ingot`。

---

## 2. 当前主要问题和优先级

### P0-1 ItemBrowser 显示名/按名搜索对 v1 数据失效（阻塞 MVP-0「浏览 items」）

- 问题：`packages/main/src/ipc/items.ts` 全部用 `LEFT JOIN item_resources ir ... ir.resource_type='lang_name'` 取显示名（`items.ts:114,158,196`），按名搜索也查 `item_resources.lang_name`（`items.ts:52,69`）。
- 证据：exporter v1 **不写 `item_resources`**（§1.8），显示名应来自 `items.translation_key → translations`。
- 影响：导入真实 v1 数据后，ItemBrowser 所有物品**无中文/英文显示名**（仅靠前端 path 兜底），`searchField='name'` 与 `'all'` 的名称分支**返回空**。
- 修复策略：改为 `LEFT JOIN translations`，按 `i.translation_key` 关联，lang fallback `zh_cn → en_us → item path`（用两个 JOIN + COALESCE）。name 搜索改查 `translations.value`。
- 阻塞 MVP-0：**是**（浏览体验对真实数据不可用）。

### P1-1 RecipeBrowser 不使用已导入的结构化 input/output

- 问题：`RecipeBrowserPage` 仅客户端 `JSON.parse(raw_json)`；`recipes:get-detail`（`ipc/recipes.ts:115-150`）只回 `recipes` 行，不含 `recipe_inputs/outputs`。
- 证据：`recipe_inputs/recipe_outputs` 已导入但浏览层未用；`unparsed`/`raw_json=NULL` 配方在 UI 显示 `?`。
- 影响：结构化数据浪费；脚本化/熔炼等非合成配方展示不稳定；与契约 §4/§8.3 "IDE 应基于结构化字段" 不符。
- 修复策略：扩展 `recipes:get-detail` 返回 `{ recipe, inputs, outputs }`（解析 `recipe_inputs/recipe_outputs` 并用 translations 解析显示名），RecipeBrowser 优先用结构化数据，`unparsed` 显示明确徽标。
- 阻塞 MVP-0：**否**（浏览可用，仅体验/正确性提升）。属"端到端跑通"中 step 2 的质量项。

### P1-2 ItemBrowser 无 lang 选择，显示名语言固定

- 问题：ItemBrowser 无语言选择；`ItemQueryParams` 无 `lang`。
- 影响：无法在 zh_cn/en_us 间切换；fallback 由后端决定。
- 修复策略：`ItemQueryParams` 增加可选 `lang`（默认 `zh_cn`），后端 COALESCE fallback；ItemBrowser 增加与 ConversionTool 一致的简易 lang selector（可选，最小实现可仅后端 fallback）。
- 阻塞 MVP-0：**否**。

### P2-1 物品贴图对 v1 数据为空

- 状态更新（2026-06-16）：已由 exporter 真实贴图导出修复；`item_resources.resource_type='texture'` 现在可由 exporter 写入。
- 当前策略：无贴图数据时仍优雅返回 `null`，前端继续回退占位；有贴图数据时走既有 `items:get-texture` / `ItemIcon` 链路显示。
- 阻塞 MVP-0：**否**。

### P2-2 导入失败不记录 `data_imports` 行

- 问题：`recordImportHistory` 仅在成功路径且在事务内调用，失败 `ROLLBACK` 后无任何记录，`is_success` 恒写 1（`importer.ts:1260`）。
- 影响：失败导入无审计痕迹；`mvp0-data-foundation.md §5.3` 要求"记录失败原因"。
- 修复策略：失败时在事务外另起一次写入 `data_imports`（`is_success=0`+`error_message`）。
- 阻塞 MVP-0：**否**。

### P2-3 schema-manager 迁移可能重建表

- 问题：`migrateExistingTables → recreateTableWithFixedConstraints` 在检测到"应可空但当前 NOT NULL"列时整表重建（`schema-manager.ts:430-549`）。
- 影响：当前列定义下不会触发对组合主键表的破坏（已核对），但属隐患。
- 修复策略：本轮不动；仅在文档登记风险，新增列时避免改既有列可空性。
- 阻塞 MVP-0：**否**。

### P2-4 unify 全表扫描

- 问题：`readBaseItemRows` 每次查询载入全部 items + translations JOIN，JS 端规范化匹配。
- 影响：~8k items 单次查询可接受，但非最优。
- 修复策略：本轮不优化；登记为后续项。
- 阻塞 MVP-0：**否**。

---

## 3. 目标行为规格

1. **打开项目**：用户在 ProjectManager 选目录创建/打开项目；项目根目录即整合包根；`project.db` 落 `<root>/.delightify/project.db`。
2. **探测 exporter SQLite**：`mod-data:detect(projectPath)` 按 `DATA_FILE_PATHS` 顺序探测；找到首个存在文件返回；找不到返回 `{filePath:null,found:false}`。也允许用户显式传 `dataFilePath` 给 import/validate。
3. **分流**：`mod-data:validate(filePath)` 读表集合 → `classifyDataSource`：全 v1 必需表 = `exporter_v1`；部分结构化表 = 拒绝；legacy 必需表无结构化 = `legacy_exporter`；否则拒绝。
4. **导入成功后 capabilities**：写入最近一次 `data_imports` 行的 `capabilities_json`（`exporter_v1`→`{browse:true,mvp0_unify:true}`，legacy→`{browse:true,mvp0_unify:false,reason:'legacy_export_without_structured_recipes'}`）。unify/ConversionTool 据此守门。
5. **ItemBrowser 显示 v1 translations**：显示名 = `COALESCE(translations[zh_cn], translations[en_us], item path)`，按 `items.translation_key` 关联；name 搜索查 `translations.value`。
6. **RecipeBrowser 对 raw_json NULL/unparsed**：`unparsed=1` 或 `raw_json=NULL` → 显示"未结构化"徽标；若有 `recipe_inputs/outputs` 则用结构化展示，否则展示占位，不报错、不崩溃。
7. **ConversionTool 状态机**：`idle → 数据源校验（history 最近成功导入 & mvp0Unify）→ 查询候选 → 选 target → dry-run（决策清单 + diff + changeSet）→ 导出 KubeJS → 撤销`。任一步出错显示 error；查询无结果显示 notice；进行中 loading。browse-only/未导入项目在进入查询时由后端 `UnifyUnavailableError` 给出明确原因。
8. **KubeJS 写入与保护**：只写 `kubejs/server_scripts/zzz_delightify_generated.js`；写前检查既有文件含 `@delightify-generated` 否则拒绝覆盖；撤销=删除该文件（同样校验 marker），幂等。

---

## 4. 数据库 schema 设计（MVP-0 最终）

说明：均为**已实现**（`schema-manager.ts CORE_TABLES`）。除特别注明外**保持现状**。"参与 unify"指被 `services/unify` 直接查询。

| 表 | 主键 | 来自 exporter 导入 | 参与 unify | 现状 | 调整 |
|---|---|---|---|---|---|
| `schema_version` | `version` | 否（IDE 自写 1） | 否 | 已实现 | 保持 |
| `manifest` | `key` | 是 | 否 | 已实现 | 保持 |
| `data_imports` | `import_id` | 否（IDE 写） | 是（读 source_kind/capabilities_json） | 已实现 | 小修：失败行记录（P2-2） |
| `mods` | `modid` | 是 | 间接 | 已实现 | 保持 |
| `items` | `item_id` | 是 | 是 | 已实现（全 v1 列） | 保持 |
| `blocks` | `block_id` | 是（可选） | 间接（is_block 在 items 上） | 已实现 | 保持 |
| `item_creative_tabs` | `(item_id,tab_id)` | 是（可选） | 否 | 已实现 | 保持 |
| `item_tags` | `(tag_id,item_id)` | 是 | 是 | 已实现 | 保持 |
| `recipes` | `recipe_id` | 是 | 是 | 已实现 | 保持 |
| `recipe_inputs` | `(recipe_id,slot,role,kind,ref)` | 是 | 是 | 已实现 | 保持 |
| `recipe_outputs` | `(recipe_id,slot,item_id)` | 是 | 是 | 已实现 | 保持 |
| `translations` | `(key,lang)` | 是 | 是 | 已实现 | **P0-1：items.ts 改用本表取显示名** |
| `item_resources` | `(item_id,resource_type,namespace,path)` | 是（exporter 暂不写） | 否 | 已实现 | 保持；importer 容忍缺失（已是） |
| `recipe_views` | `type_id` | 是（exporter 暂不写） | 否 | 已实现 | 保持；容忍缺失（已是） |
| `recipe_view_backgrounds` | `type_id` | 是（exporter 暂不写） | 否 | 已实现 | 保持；容忍缺失（已是） |

索引（已实现，保持）：`idx_items_modid`、`idx_blocks_item_id`、`idx_item_tags_item_id/tag_id`、`idx_recipes_type_id/modid`、`idx_recipe_inputs_ref(kind,ref)/recipe_id`、`idx_recipe_outputs_item_id/recipe_id`、`idx_translations_lang_value(lang,value)`、`idx_item_resources_*`、`idx_item_creative_tabs_*`。

> 注：`idx_translations_lang_value(lang, value)` 正好支持 P0-1 的 name 搜索（`WHERE lang=? AND value LIKE ?`）。

字段冲突登记：`data_imports` 代码有 `data_version`+`schema_version` 两列，文档只列 `schema_version`——**以代码为准，保留两列**，importer 已正确填两者。

---

## 5. Importer 落地设计

整体结论：`mod-data-importer/*` **已实现 MVP-0 所需的全部读取/导入/分流/事务**，本节多为"保持现状"，仅 P2-2 一处小修。

### 5.1 `types.ts`（保持现状）

- 类型齐全：`ImportProgress/ImportResult/ModDataImportOptions/ValidationResult/DataSourceKind/ProjectCapabilities`、各 `*Entry`。
- 常量齐全：`EXPORTER_V1_DATA_FILE_PATHS/LEGACY_DATA_FILE_PATHS/DATA_FILE_PATHS`、`LEGACY_REQUIRED_TABLES`、`EXPORTER_V1_REQUIRED_TABLES`、`EXPORTER_V1_CAPABILITIES`、`LEGACY_EXPORTER_CAPABILITIES`。
- 任务：**无需修改**。`EXPORTER_V1_REQUIRED_TABLES` 已正确 = legacy + `recipe_inputs/recipe_outputs/translations`，与 exporter 实际写入一致，**保持**（exporter 即使空数据也建这三张表，分流按"表存在"判断成立）。

### 5.2 `validator.ts`（保持现状）

- `validateModDataFile`：表检测 → 分流 → 读 manifest（loader/mc_version/exported_at_utc/modlist_hash）→ 统计 mods/items/recipes/item_tags。
- 任务：**无需修改**。`mod_count` 优先 manifest 否则 COUNT（兼容 exporter 未写 `mod_count`）。

### 5.3 source SQLite 读取方式

- 现状：直接 `createClient({url:'file:'+dataFilePath})` 只读读取，导入完成 `close()`。**不复制到缓存、不强制 immutable**。
- 任务：**保持现状**。对 MVP-0 足够（exporter 输出原子改名，导入时不并发写）。如未来出现 WAL/锁问题再加 `?mode=ro&immutable=1`，本轮不做。

### 5.4 清空旧数据 / 导入顺序 / batch（保持现状）

- `clearExistingData` 顺序（子表先于父表，避免外键问题，虽运行时无 FK）：backgrounds→views→translations→recipe_outputs→recipe_inputs→recipes→item_tags→item_creative_tabs→blocks→item_resources→items→mods→manifest。
- 导入顺序：manifest→mods→items→blocks→creative_tabs→item_tags→recipes→recipe_inputs→recipe_outputs→translations→item_resources→recipe_views→backgrounds。
- 任务：**保持现状**。

### 5.5 边界处理（保持现状）

- `raw_json IS NULL`：`readRecipes` 转 `undefined`，导入写 `NULL`（`importer.ts:533,982`）。
- `unparsed=1`：`String(row.unparsed)==='1'||'true'` 解析为 boolean，写回 `1/0`。
- 重复主键：批量失败回退逐条，UNIQUE 冲突 `console.warn` 跳过。
- 缺失可选表：`tableExists()` 返回 `[]`，导入函数空数组直接返回。
- 任务：**保持现状**。

### 5.6 导入历史 / 进度（小修 P2-2）

- 现状：`recordImportHistory` 成功路径写 `is_success=1`；进度通过 `onProgress` 回调 → `ipc/mod-data.ts:sendProgress` → `MOD_DATA_IMPORT_PROGRESS`。
- **任务（小修）**：在 `importModData` 顶层 `catch` 中（事务已回滚后），新增一次独立写入失败行的逻辑：
  - 新增函数 `recordFailedImport(targetClient 或新建短连接, {importId, sourceFilePath, sourceKind?, error})`，写 `data_imports`（`is_success=0`、`error_message=errorMessage`、计数为 0、`imported_at=now`、`capabilities_json` 用 legacy 默认）。
  - 注意：失败可能发生在 targetClient 创建之前（如 detect/validate 阶段）；此时新建一个到 `<projectPath>/.delightify/project.db` 的连接并先 `schemaManager.initialize()` 再写。包在 try/catch 里，记录失败本身不得抛出。

### 5.7 函数级任务清单

- `readItems(...)`：**保持现状**。
- `readTranslations(...)`：**保持现状**（已存在，已被调用）。
- `recordImportHistory(...)`：**保持现状**。
- 新增 `recordFailedImport(...)`：**P2-2，小修**。
- `EXPORTER_V1_REQUIRED_TABLES`：**保持现状**，不改。

---

## 6. 查询层和 IPC 设计

格式：通道 | 输入 | 输出 | 错误 | 数据来源 | 文件修改点。所有 handler 返回 `IpcResponse<T> = {success, data?, error?}`。

- `mod-data:detect` | `(projectPath)` | `{filePath:string|null, found:boolean}` | catch→`{success:false,error}` | `detectModDataFile`(fs) | **保持**（`ipc/mod-data.ts`）。
- `mod-data:validate` | `(filePath)` | `ValidationResult` | catch | `validateModDataFile`(源 sqlite) | **保持**。
- `mod-data:import` | `(projectPath, dataFilePath?)` | `ModDataImportResult` | catch + 进度事件 | `importModData` | **保持**（P2-2 在 service 内部）。
- `mod-data:get-import-history` | `(projectPath)` | `DataImportHistory[]`（含 capabilities） | catch | `project.db data_imports` | **保持**。
- `items:query` | `(projectPath, ItemQueryParams)` | `ItemQueryResult` | catch | `project.db items + translations` | **P0-1 改写 `ipc/items.ts`**（见下）。
- `items:get-detail` | `(projectPath, itemId)` | `Item & {tags}` | catch | items+translations+item_tags | **P0-1 改写**（显示名 join translations）。
- `items:get-by-mod` | `(projectPath, modid)` | `Item[]` | catch | items+translations | **P0-1 改写**。
- `recipes:query` | `(projectPath, RecipeQueryParams)` | `{recipes, total}` | catch | recipes（search 仍含 raw_json LIKE） | **保持**。
- `recipes:get-detail` | `(projectPath, recipeId)` | `RecipeDetail`（recipe + inputs + outputs） | catch | recipes + recipe_inputs + recipe_outputs + translations | **P1-1 扩展 `ipc/recipes.ts`**。
- `unify:query` | `(projectPath, UnifyQueryParams)` | `UnifyQueryResult` | `UnifyUnavailableError`→friendly error；其他 catch | unify service | **保持**。
- `unify:dry-run` | `(projectPath, UnifyDryRunParams)` | `UnifyDryRunResult` | 同上 | unify service | **保持**。
- `export:kubejs` | `(projectPath, KubeJsExportParams)` | `KubeJsExportResult` | catch（含覆盖保护错误） | fs | **保持**。
- `export:kubejs:revert` | `(projectPath)` | `KubeJsRevertResult` | catch | fs | **保持**。

### 6.1 P0-1：`ipc/items.ts` 改写（关键）

把三处 `LEFT JOIN item_resources ir ... resource_type='lang_name'` 改为按 `translation_key` 关联 translations，并做 lang fallback。示意（query 主查询）：

```sql
SELECT
  i.item_id,
  i.modid,
  COALESCE(tl.value, te.value) AS display_name
FROM items i
LEFT JOIN translations tl ON tl.key = i.translation_key AND tl.lang = ?   -- 主语言(默认 zh_cn)
LEFT JOIN translations te ON te.key = i.translation_key AND te.lang = ?   -- 回退 en_us
<where>
ORDER BY i.item_id
LIMIT ? OFFSET ?
```

- name 搜索条件改为：`i.translation_key IN (SELECT key FROM translations WHERE lang IN (?,?) AND value LIKE ?)`（或 `EXISTS`）。
- `all` 分支：`i.item_id LIKE ? OR <上面的 name EXISTS> OR i.item_id IN (SELECT item_id FROM item_tags WHERE tag_id LIKE ?)`。
- 前端兜底（`displayName || formatDisplayName(itemId)`）保留——即第三级 fallback（item path）。
- `lang` 由新增的 `ItemQueryParams.lang`（默认 `'zh_cn'`，回退 `'en_us'`）传入；`get-detail`/`get-by-mod` 同样支持但可默认。
- `items:get-texture`：**保持现状**（无 texture 资源时返回 `null`）。

### 6.2 P1-1：`ipc/recipes.ts` 扩展 `recipes:get-detail`

```sql
-- inputs
SELECT slot, role, kind, ref, count FROM recipe_inputs WHERE recipe_id=? ORDER BY slot;
-- outputs
SELECT slot, item_id, count, components_json, is_primary FROM recipe_outputs WHERE recipe_id=? ORDER BY slot;
```

- 返回 `RecipeDetail = { recipe: Recipe; inputs: RecipeInputView[]; outputs: RecipeOutputView[] }`。
- 可选：对 `ref`(item)/`item_id` 批量解析 translations 显示名（按 lang fallback），便于 UI 直接展示。
- 不破坏现有 `recipes:query` 列表行为。

### 6.3 类型一致性检查

- preload(`preload.ts`) ↔ renderer(`ipc/index.ts` ElectronAPI) ↔ shared types 必须同步：
  - `ItemQueryParams` 新增 `lang?` → 同步 `shared/src/types/item.ts`。
  - `recipes:get-detail` 返回类型变化 → 新增 `RecipeDetail` 到 `shared/src/types/recipe.ts`，更新 `ElectronAPI.recipesGetDetail` 返回类型，更新 `mock.ts`。
  - preload 已转发参数，无需改通道。

---

## 7. Unify v0 设计

结论：`services/unify` **已实现下述规则**。本节为"规格确认 + 现有实现核对"，**无需重写**；仅登记可选微调。

- 候选发现（`query-service.ts`）：
  - display name exact：规范化后 `normalizeText(value)===normalizedQuery`。✅
  - item id path normalized：`normalizeText(itemPath)===normalizedQuery`，外加 `itemId.includes(query)` 子串。✅
  - tag：query 含 `:`/`/` 时按 `tag_id = ? OR tag_id LIKE %?%`。✅
- 规范化算法：`trim+lowercase+NFKC+去分隔符`（见 §1.4）。✅
- 查询参数：`{query, lang?(默认 zh_cn), limit?(1..200,默认50)}`。✅
- 返回结构：`UnifyQueryResult{query,normalizedQuery,lang,sourceKind,capabilities,candidates[],generatedAt}`，`UnifyCandidate{item,matchedBy,references,riskSignals,riskLevel}`。✅
- target 自动选择：风险升序 → 引用权重降序 → minecraft 优先 → itemId（`dry-run-service.ts:chooseTarget`）。✅
- confidence 公式：见 §1.4。✅
- risk signals：`is_block_item`、`has_recipe_outputs`、`many_tag_input_references`、`tag_input_references`、`related_unparsed_recipes`、`different_default_components/durability/food_properties`。✅
- 自动进入 change set 条件：`shouldAutoApply` 为真（无 medium+ 风险/无 outputs/无 unparsed/非 block 且有 directInputs），且 operation 为 `replace_recipe_input_item`。✅
- 必须 defer：risk≥medium、有 outputs、有 unparsed、is_block、无 directInputs。✅
- direct item input 替换：`replace_recipe_input_item`（before/after item ref）。✅
- tag input：`tag_input_reference`，`includedInChangeSet=false`（只审阅）。✅
- outputs：`replace_recipe_output_item`，`includedInChangeSet=false`（默认不自动替换）。✅
- unparsed raw：`raw_unparsed_reference`，high 风险，只提示。✅
- 避免误合并：跨候选 component/durability/food 差异 → medium 风险 → 阻止 auto；block → medium。✅

可选微调（**非阻塞，可不做**）：
- `query-service.ts` 文件级独立类型（`UnifyQueryResult` 等）与 `shared/src/types/unify.ts` 是**两份并行定义**（结构一致）。建议后续让 service 引用 shared 类型以单一来源，但本轮**保持现状**避免牵动 import。
- 若要更稳健的"组件不同则降risk"，可把 `different_default_components` 也纳入 per-candidate（目前为 group 级），本轮不改。

涉及文件：`services/unify/query-service.ts`、`services/unify/dry-run-service.ts`、`shared/src/types/unify.ts` —— 均**保持现状**。

---

## 8. KubeJS emitter 设计

结论：`services/export/kubejs-emitter.ts` **已满足 MVP-0**，保持现状 + 一条保守化注释。

- 生成路径：`kubejs/server_scripts/zzz_delightify_generated.js`。✅
- generated marker：`// @delightify-generated`。✅
- 非 Delightify 文件禁止覆盖/删除：`assertGeneratedFileIsOwned` / revert 校验 marker。✅
- 空 change set：抛错。✅
- 支持 operation：`replace_recipe_input_item`（`event.replaceInput`）。✅ `replace_recipe_output_item`（`event.replaceOutput`）**已写但 dry-run 永不把 output 放进 changeSet**，故实际只会发出 replaceInput。
- 生成格式：`ServerEvents.recipes(event => { ...ops... })`，每 op 一行。✅
- 撤销：`revertKubeJs` 删除文件，幂等。✅
- 错误处理：缺 before/after ref 抛错；不支持的 kind 抛错。✅

KubeJS API 可靠性说明（给 Codex）：
- `event.replaceInput({ id: <recipeId> }, <oldItem>, <newItem>)` 是稳定的 ServerEvents.recipes API，按单配方 `id` 过滤，可靠。**保持**。
- `event.replaceOutput(...)` 的跨版本行为与 output 替换语义不确定。**要求 Codex 保守处理**：不要把 output 替换接入 changeSet（现状即如此），并在 `outputOperation`/`emitOperation` 的 `replace_recipe_output_item` 分支补 `// TODO: replaceOutput 语义/版本兼容未验证，MVP-0 不纳入 change set` 注释，不要为了"补全"而让 output 自动进入 changeSet。

任务：**仅加 TODO 注释**，不改逻辑。

---

## 9. Renderer UI 设计

### 9.1 ConversionTool（保持现状）

`pages/ConversionTool/index.tsx` 已实现：数据源状态（`modDataGetImportHistory` 取最近成功导入）、查询输入、lang selector、候选列表、target selector、dry-run 按钮、决策清单、diff 列表、导出按钮、撤销按钮、error/notice/loading。**任务：保持现状**，不重写。若 P1-1 落地后想在候选/diff 里展示更友好的物品名，可复用 dry-run 已有 `displayName`，**非必须**。

### 9.2 ItemBrowser（P0-1 + 可选 P1-2）

- 文件：`pages/ItemBrowser/index.tsx`、`pages/ItemBrowser/ItemCard/index.tsx`、`pages/ItemBrowser/style.module.css`。
- 改动：
  - **后端 P0-1 落地后，前端无需大改**——`item.displayName` 会自动来自 translations，`ItemCard` 的 `item.displayName || formatDisplayName(itemName)` 兜底保留。
  - 按名搜索（`searchField='name'/'all'`）随后端修复自动生效。
  - 可选 P1-2：在筛选区（`style.module.css` 的搜索行）加一个 lang `<select>`（zh_cn/en_us），把 `lang` 透传给 `itemsQuery`；最小实现可不加 UI，仅后端默认 fallback。
- 类型：`ItemQueryParams` 增 `lang?`（shared）。

### 9.3 RecipeBrowser（P1-1）

- 文件：`pages/RecipeBrowser/index.tsx`、`pages/RecipeBrowser/RecipeCard/index.tsx`、`pages/RecipeBrowser/style.module.css`。
- 改动：
  - 详情视图调用扩展后的 `recipesGetDetail` 拿 `inputs/outputs`，优先用结构化数据渲染槽位；`raw_json` 解析作为列表卡片的轻量兜底可保留。
  - 对 `recipe.unparsed===true` 或 `rawJson` 为空：显示"未结构化/脚本配方"徽标（新增一个 CSS class，如 `.unparsedBadge`），不再只显示 `?`。
  - 结构化 input/output 是后续 RecipeEditor 的扩展点（本轮只读展示）。
- 类型：新增 `RecipeDetail`/`RecipeInputView`/`RecipeOutputView`（shared），更新 `ElectronAPI.recipesGetDetail` 与 `mock.ts`。

---

## 10. Shared types 设计

`packages/shared/src/types/`：

- `ProjectCapabilities`（`mod.ts`）：已存在 `{browse, mvp0Unify, reason?}`。**保持**。注意 DB 内 JSON 用 snake_case `mvp0_unify`，TS 用 `mvp0Unify`；`ipc/mod-data.ts:parseCapabilities` 与 `unify/query-service.ts:parseCapabilities` 已兼容两种写法。**保持这层兼容，不要改字段名**。
- `DataSourceKind`（`mod.ts`）：`'exporter_v1'|'legacy_exporter'`。**保持**。
- `ValidationResult`（`mod.ts`）：已含 sourceKind/capabilities/loader/mcVersion/modlistHash/exportedAt/计数。**保持**。
- `DataImportHistory`（`mod.ts`）：含 sourceKind/schemaVersion/capabilities/modlistHash/errorMessage。**保持**。
- `UnifyQueryResult`/`UnifyDryRunResult`（`unify.ts`）：已完整且与 service 字段一致。**保持**。
- `KubeJsExportParams`/`KubeJsExportResult`/`KubeJsRevertResult`（`export.ts`）：已与 service/IPC 一致。**保持**。
- **新增**：
  - `ItemQueryParams.lang?: string`（`item.ts`，P1-2）。
  - `RecipeDetail`、`RecipeInputView`、`RecipeOutputView`（`recipe.ts`，P1-1）：
    ```ts
    export interface RecipeInputView { slot: number; role: string; kind: string; ref?: string; count: number; displayName?: string }
    export interface RecipeOutputView { slot: number; itemId: string; count: number; componentsJson?: string; isPrimary: boolean; displayName?: string }
    export interface RecipeDetail { recipe: Recipe; inputs: RecipeInputView[]; outputs: RecipeOutputView[] }
    ```

一致性要求：主进程 handler 返回字段 = renderer `ElectronAPI` 类型 = `mock.ts` 形状，三者必须同步。改 `recipesGetDetail` 返回类型时，三处一起改。

---

## 11. Exporter 子包设计

IDE 侧需对齐的事实（来自 `packages/exporter/` 真实代码）：

- 输出路径：`<serverDir>/mpide-exporter/export.sqlite`（原子改名）。IDE `EXPORTER_V1_DATA_FILE_PATHS` 已含 `mpide-exporter/export.sqlite` + `.mpide-exporter/export.sqlite`，**对齐**。
- manifest keys：`schema_version`、`exporter_version`、`loader`、`mc_version`、`neo_version`、`environment`、`exported_at_utc`、`world_name`、`modlist_hash`。**未写 `mod_count`**（validator 已用 COUNT 兜底，OK）。
- schema version：`1`。
- 当前导出（有数据）的表：`mods`、`items`、`item_creative_tabs`、`blocks`、`item_tags`、`recipes`、`recipe_inputs`、`recipe_outputs`、`translations`、`item_resources`（真实贴图）。
- 仍未导出（仅 DDL）：`recipe_views`、`recipe_view_backgrounds`。
- IDE importer **必须容忍缺失** `item_resources`/`recipe_views`/`recipe_view_backgrounds`（已通过 `tableExists()` 实现）。**这三张表不进 `EXPORTER_V1_REQUIRED_TABLES`，保持现状**。
- `pnpm exporter:build`：gradle `build`（出 fat jar，sqlite-jdbc jarJar 内嵌）。`pnpm exporter:runClient`：起集成端单人世界，便于在游戏内 `/mpide_export dump` 实跑导出，产出真实 `export.sqlite` 供 IDE 验证。
- 本轮**不改 exporter Java 代码**。

---

## 12. Codex 执行任务清单

按顺序执行；每个任务可独立 `pnpm typecheck`/`pnpm build` 验证。

### Task 1: ItemBrowser 显示名/搜索改用 translations（P0-1）

- 目标：v1 数据下 ItemBrowser 显示中文/英文名且按名搜索可用。
- 修改文件：
  - `packages/shared/src/types/item.ts`（`ItemQueryParams` 增 `lang?: string`；更新 `Item.displayName` 注释为"来自 translations"）。
  - `packages/main/src/ipc/items.ts`（`ITEMS_QUERY`、`ITEMS_GET_BY_MOD`、`ITEMS_GET_DETAIL` 三处）。
- 具体改动：
  - `items:query`：解析 `lang`（默认 `'zh_cn'`，回退 `'en_us'`）。主查询把 `LEFT JOIN item_resources ... 'lang_name'` 换成两个 `LEFT JOIN translations`（主语言 + en_us）并 `COALESCE(tl.value, te.value) AS display_name`，`ON ?.key = i.translation_key AND ?.lang = ?`。
  - name 搜索（`searchField='name'` 与 `'all'` 的名称分支）改为 `i.translation_key IN (SELECT key FROM translations WHERE lang IN (?,?) AND value LIKE ?)`。注意 count 查询与 data 查询的参数顺序一致。
  - `items:get-by-mod`、`items:get-detail` 同样把 lang_name join 改为 translations join（默认 zh_cn→en_us）。
  - 保留前端 `formatDisplayName` 作为第三级 path 兜底（不改前端）。
- 注意事项：count 查询用 `items.` 前缀、data 查询用 `i.`/`tl.`/`te.` 前缀，保持现有两套别名约定；参数数组与占位符数量严格对应（新增 lang 参数后逐处核对）。
- 验证命令：`pnpm typecheck && pnpm build && pnpm smoke:mvp0`。
- 验收标准：typecheck/build 通过；smoke 通过；用真实快照 `--data-file` 导入后（手动）ItemBrowser 显示名非空、按名搜"铜"有结果。

### Task 2: ItemBrowser 透传 lang（可选 P1-2）

- 目标：前端可切换显示语言（最小实现）。
- 修改文件：`packages/renderer/src/pages/ItemBrowser/index.tsx`、`packages/renderer/src/pages/ItemBrowser/style.module.css`。
- 具体改动：在筛选行加 `<select>`（`zh_cn`/`en_us`），state `lang`，调用 `itemsQuery` 时带 `lang`。
- 注意事项：默认 `zh_cn`；不改 `ItemCard`。若不做 UI，仅依赖 Task 1 的后端默认 fallback 也可接受——此任务可跳过。
- 验证命令：`pnpm typecheck && pnpm build`。
- 验收标准：切换语言后列表显示名随之变化。

### Task 3: recipes:get-detail 返回结构化 input/output（P1-1）

- 目标：浏览层使用已导入的 `recipe_inputs/recipe_outputs`。
- 修改文件：
  - `packages/shared/src/types/recipe.ts`（新增 `RecipeInputView/RecipeOutputView/RecipeDetail`）。
  - `packages/main/src/ipc/recipes.ts`（`RECIPES_GET_DETAIL` 返回 `RecipeDetail`）。
  - `packages/renderer/src/ipc/index.ts`（`ElectronAPI.recipesGetDetail` 返回类型）。
  - `packages/renderer/src/ipc/mock.ts`（`recipesGetDetail` 返回含空 `inputs/outputs`）。
- 具体改动：handler 在取 `recipes` 行后并发查 `recipe_inputs`/`recipe_outputs`（按 slot 排序），可选用 translations 解析 `displayName`；组装 `{recipe, inputs, outputs}` 返回。
- 注意事项：保持 `recipe` 字段与现有 `Recipe` 一致，避免破坏其他调用方；mock 与真实形状一致。
- 验证命令：`pnpm typecheck && pnpm build`。
- 验收标准：typecheck/build 通过；mock 与真实返回结构一致。

### Task 4: RecipeBrowser 使用结构化数据 + unparsed 徽标（P1-1）

- 目标：详情用结构化 input/output；`unparsed`/`raw_json=NULL` 显示明确徽标，不显示 `?` 报错态。
- 修改文件：`packages/renderer/src/pages/RecipeBrowser/index.tsx`、`packages/renderer/src/pages/RecipeBrowser/RecipeCard/index.tsx`、`packages/renderer/src/pages/RecipeBrowser/style.module.css`。
- 具体改动：详情视图调用 `recipesGetDetail` 用 `inputs/outputs` 渲染；`recipe.unparsed===true || !recipe.rawJson` 时渲染 `.unparsedBadge`（新 CSS class，文案"未结构化/脚本配方"）。
- 注意事项：列表卡片可保留现有 raw_json 轻量解析；不要因结构化缺失而抛异常。
- 验证命令：`pnpm typecheck && pnpm build`。
- 验收标准：unparsed 配方显示徽标；结构化配方显示正确槽位。

### Task 5: KubeJS emitter 保守化注释（P2，配合 §8）

- 目标：明确 replaceOutput 不纳入 MVP-0 change set。
- 修改文件：`packages/main/src/services/export/kubejs-emitter.ts`。
- 具体改动：在 `replace_recipe_output_item` 分支加 `// TODO: replaceOutput 语义/版本兼容未验证，MVP-0 不纳入 change set`。不改逻辑。
- 验证命令：`pnpm typecheck && pnpm build && pnpm smoke:mvp0`。
- 验收标准：smoke 仍通过；注释存在。

### Task 6: 导入失败记录 data_imports（P2-2）

- 目标：失败导入留审计行。
- 修改文件：`packages/main/src/services/mod-data-importer/importer.ts`。
- 具体改动：新增 `recordFailedImport(...)`；在 `importModData` 顶层 `catch` 中（不抛出地）写入 `data_imports`（`is_success=0`、`error_message`、计数 0）。需要时新建到 `project.db` 的连接并 `schemaManager.initialize()`。
- 注意事项：记录失败不得影响返回的错误信息；包 try/catch 静默。
- 验证命令：`pnpm typecheck && pnpm build`。
- 验收标准：构造一个缺表的源文件导入后，`data_imports` 出现 `is_success=0` 行。

### Task 7: 全量验证

- 目标：回归。
- 修改文件：无。
- 具体改动：跑全部验证命令。
- 验证命令：`pnpm typecheck && pnpm build && pnpm smoke:mvp0`（如有 Java 环境额外 `pnpm exporter:build`）。
- 验收标准：全部通过。

---

## 13. 验证方案

- `pnpm typecheck`：CI 基准，必须通过。
- `pnpm build`：turbo 全量构建（shared 先构建）。smoke 依赖 `packages/main/dist`，故 smoke 前必须 build（`smoke:mvp0` 已内置 `pnpm build`）。
- `pnpm exporter:build`：仅在改 exporter（本轮不改）或需要产出真实快照时跑，需 Java 21/Gradle。
- `pnpm smoke:mvp0`：跑内置 fixture，断言 validate→import→unify query→dry-run→KubeJS 生成/重生成/撤销 全链路；覆盖低风险自动 change set（`moda:copper_gear`/`copper_wire` 的 replaceInput）与高风险搁置（`unparsed` + block + output）。**现有脚本已满足，无需新增。**
- 真实 Labpack 快照验证：
  - 准备：游戏内 `/mpide_export dump` → 取 `<instance>/mpide-exporter/export.sqlite`。
  - 命令：`pnpm smoke:mvp0 -- --data-file /path/to/export.sqlite --query 铜锭 --target minecraft:copper_ingot`。
  - 断言：`sourceKind=exporter_v1`、`mvp0Unify=true`、候选>0、dry-run 有 target、（如有自动项）生成 + 撤销成功。
- legacy browse-only 验证：
  - 用旧 `delightify-exporter/export.sqlite`（仅 manifest/mods/items/item_tags/recipes）→ `validate` 返回 `sourceKind=legacy_exporter`、`mvp0Unify=false`；导入后 ItemBrowser/RecipeBrowser 可浏览；ConversionTool 查询时后端抛 `UnifyUnavailableError`，UI 显示"当前项目数据不支持 MVP-0 unify"。
- KubeJS 覆盖保护验证：
  - 手动在 `kubejs/server_scripts/zzz_delightify_generated.js` 写入不含 `@delightify-generated` 的内容 → `export:kubejs`/`revert` 应抛"拒绝覆盖/删除非 Delightify 生成文件"。

---

## 14. 不做事项

- 不做完整 LLM Agent 主循环。
- 不做通用 `entities/relations` 图谱表。
- 不做向量检索 / 本地 embedding。
- 不做 datapack / Almost Unified emitter。
- 不重写整个 UI（ConversionTool 保持现状）。
- 不恢复旧 JAR parser 主路径。
- 不引入新数据库驱动（继续 `@libsql/client`）。
- 不引入重型新框架。
- 不改 exporter Java 代码（除非阻塞，本轮无）。
- 不把 `replace_recipe_output_item` 接入自动 change set。
- 不动 `services/unify` 的算法（仅核对，必要时小注释）。

---

## 15. 最终 Codex Prompt

```
背景：
你在 Delightify-IDE（Electron + React + TS，pnpm/turbo monorepo）上工作。产品名 Delightify，"ModPack IDE" 只是品类描述。MVP-0 后端主链路（schema/importer/validator/unify query+dry-run/KubeJS emitter/IPC/preload/renderer 接线/scripts/smoke-mvp0-unify.mjs）已实现并有可跑通的 smoke 断言。请勿重写已实现部分。代码事实优先于历史文档。

目标：
修复浏览层与 v1 数据的不一致，主要是 ItemBrowser 显示名/搜索应走 translations（而非 item_resources.lang_name，因为 exporter v1 不写 lang_name 资源），并让 RecipeBrowser 使用已导入的结构化 recipe_inputs/recipe_outputs。仅做小而可验证的改动。

要修改的文件（按任务）：
1) packages/shared/src/types/item.ts；packages/main/src/ipc/items.ts —— ItemQueryParams 增 lang?；三处 ITEMS_* 查询把 item_resources lang_name 改为 LEFT JOIN translations(items.translation_key)，lang fallback zh_cn→en_us→前端 path 兜底；name 搜索改查 translations.value。
2)（可选）packages/renderer/src/pages/ItemBrowser/* —— 加 lang selector 透传。
3) packages/shared/src/types/recipe.ts（新增 RecipeDetail/RecipeInputView/RecipeOutputView）；packages/main/src/ipc/recipes.ts（recipes:get-detail 返回结构化 inputs/outputs）；packages/renderer/src/ipc/index.ts 与 mock.ts 同步类型/mock。
4) packages/renderer/src/pages/RecipeBrowser/* —— 详情用结构化数据；unparsed/raw_json NULL 显示徽标，不显示 ?。
5) packages/main/src/services/export/kubejs-emitter.ts —— 在 replace_recipe_output_item 分支加 TODO 注释（不改逻辑，不纳入 change set）。
6) packages/main/src/services/mod-data-importer/importer.ts —— 失败时静默写一行 data_imports(is_success=0, error_message)。

任务顺序：Task1 → Task2(可选) → Task3 → Task4 → Task5 → Task6 → Task7(全量验证)。每个任务单独验证后再做下一个。

验证命令：每个任务后 `pnpm typecheck`，关键任务后 `pnpm build` 与 `pnpm smoke:mvp0`。最终 `pnpm typecheck && pnpm build && pnpm smoke:mvp0` 必须全绿。

验收标准：
- typecheck/build/smoke 全通过。
- v1 数据导入后 ItemBrowser 显示名非空、按名搜索有结果。
- RecipeBrowser 对结构化配方显示槽位、对 unparsed 配方显示徽标。
- KubeJS 覆盖/删除保护与撤销幂等不被破坏。
- preload / renderer ElectronAPI / mock / shared types 四处类型一致。

禁止事项：
- 不重写 schema/importer/unify/emitter/ConversionTool。
- 不把 replaceOutput 自动纳入 change set。
- 不引入新依赖/新数据库驱动/新框架。
- 不改 exporter Java。
- 不做 LLM Agent / 图谱 / 向量检索 / datapack emitter。
- 不擅自扩大范围；遇到与上面冲突的"顺手优化"，停下并在 PR 描述里说明。
```

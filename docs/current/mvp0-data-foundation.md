# MVP-0 数据地基方案

> 状态：已决策，待实现。日期：2026-06-13。
> 本文把 `exporter-contract-v1.md`、`现状审计.md` 与当前代码基线收敛成可落地方案。
> 目标只覆盖 MVP-0：导入一个真实整合包快照，跑通“统一同名/等价物品”工作流，生成可审 diff，并输出 KubeJS。

## 1. 范围

### 1.1 MVP-0 必须支持

- 从 Delightify Exporter v1 导出的 SQLite 快照导入项目库。
- 建立物品、tag、配方输入/输出、翻译、资源等确定性事实。
- 查询同名/等价物品候选及其配方引用者。
- 为 `unify` 生成可审决策清单和 dry-run diff。
- 生成 KubeJS 产物。

### 1.2 明确推迟

- 完整 LLM Agent 主循环。
- 通用 `entities/relations` 图谱表。
- 向量检索、本地 embedding。
- datapack / Almost Unified emitter。
- 从 legacy `raw_json` 中强行解析所有模组配方结构。

## 2. 核心决策

### D1. Exporter v1 是主数据源

Delightify Exporter v1 是 `data:*` 确定性事实的权威来源。IDE 的 MVP-0 主路径不再依赖离线 JAR 解析。

原因：

- KubeJS / CraftTweaker / datapack 覆盖 / 运行时 tag 合并的最终态，离线 JAR 解析天然拿不全。
- `unify -> diff -> KubeJS` 需要最终态配方输入/输出和 tag 成员。

### D2. legacy `export.sqlite` 只保留浏览兼容

旧 `delightify-exporter/export.sqlite` 仍可导入，用于 ProjectManager、ItemBrowser、RecipeBrowser。

但 legacy 数据没有结构化 `recipe_inputs` / `recipe_outputs` 时，项目能力标记为：

```json
{
  "browse": true,
  "mvp0_unify": false,
  "reason": "legacy_export_without_structured_recipes"
}
```

legacy 数据不进入 MVP-0 unify 工作流。

### D3. 先建结构化事实表，不先建通用图谱

MVP-0 使用结构化 SQL 表直接支持查询，不先实现通用 `entities` / `relations` / `relation_evidence`。

原因：

- `unify` 的第一批查询可以由 `items`、`item_tags`、`recipe_inputs`、`recipe_outputs` 直接满足。
- 通用图谱适合后续 Agent 主循环，但不是 MVP-0 的最小阻塞项。

### D4. `unify` v0 不接 LLM

MVP-0 的 unify 先做确定性/启发式版本。

使用信号：

- 规范化后的 item id path。
- `translations` 中的显示名。
- tag 交集。
- modid。
- 是否方块、是否可损耗、食物属性、默认组件差异。
- 配方输入/输出引用关系。

输出必须包含：

- 自动项：高置信、低风险。
- 搁置项：同名但组件/用途/方块属性明显不同。
- 每个决策的证据和风险理由。

### D5. MVP-0 只实现 KubeJS emitter

MVP-0 只输出 KubeJS。生成物只写工具拥有的独立文件，并带生成标记。

推荐路径：

```text
kubejs/server_scripts/zzz_delightify_generated.js
```

要求：

- dry-run 先产出 diff。
- 作者确认后才写文件。
- 重生成只覆盖工具文件。
- 撤销等价于删除或禁用工具生成文件。

### D6. importer 必须按 schema 版本分流

导入时先读取 `manifest.schema_version`，并检查必要表。

分流规则：

| 输入 | 条件 | 行为 |
|---|---|---|
| exporter v1 | 有 v1 必需 manifest keys 和结构化表 | 完整导入，启用 MVP-0 capabilities |
| legacy | 有旧 `manifest/mods/items/item_tags/recipes`，无结构化表 | 导入浏览数据，标记 browse-only |
| unknown | 缺少必要表或版本无法识别 | 拒绝导入，提示重新导出 |

## 3. Exporter v1 契约修正

`exporter-contract-v1.md` 已定义 `translations(key, lang, value)`，但 `items` 表没有显式 `translation_key`。MVP-0 需要从 item 稳定找到显示名，因此做以下修正：

```sql
items(
  item_id TEXT PRIMARY KEY,
  modid TEXT NOT NULL,
  translation_key TEXT,
  is_block INTEGER NOT NULL,
  max_stack INTEGER NOT NULL,
  max_damage INTEGER NOT NULL DEFAULT 0,
  is_damageable INTEGER NOT NULL DEFAULT 0,
  is_fire_resistant INTEGER NOT NULL DEFAULT 0,
  rarity TEXT,
  enchant_value INTEGER DEFAULT 0,
  food_nutrition INTEGER,
  food_saturation REAL,
  food_always_eat INTEGER,
  default_components_json TEXT
)
```

Exporter 应优先写运行时真实 translation key。IDE 不应只靠 `item.<namespace>.<path>` 约定拼接。

## 4. MVP-0 `project.db` 最小 schema

实现时可以继续使用当前 `SchemaManager`，但 `CORE_TABLES` 需要扩展到 v1 表。以下是 IDE 侧最小事实层。

### 4.1 元信息与导入批次

```sql
schema_version(
  version INTEGER PRIMARY KEY
)

manifest(
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)

data_imports(
  import_id TEXT PRIMARY KEY,
  source_file_path TEXT NOT NULL,
  source_kind TEXT NOT NULL,             -- exporter_v1 | legacy_exporter
  schema_version TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  modlist_hash TEXT,
  exported_at TEXT,
  mod_count INTEGER NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  recipe_count INTEGER NOT NULL DEFAULT 0,
  tag_count INTEGER NOT NULL DEFAULT 0,
  imported_at TEXT NOT NULL,
  is_success INTEGER NOT NULL DEFAULT 1,
  error_message TEXT
)
```

MVP-0 采用全量快照导入。每次导入清空事实表并重灌，因此事实表暂不强制每行带 `import_id`。若后续引入多来源合并，再追加 per-row provenance。

### 4.2 注册表事实

```sql
mods(
  modid TEXT PRIMARY KEY,
  version TEXT,
  name TEXT
)

items(
  item_id TEXT PRIMARY KEY,
  modid TEXT NOT NULL,
  translation_key TEXT,
  is_block INTEGER NOT NULL DEFAULT 0,
  max_stack INTEGER NOT NULL DEFAULT 64,
  max_damage INTEGER NOT NULL DEFAULT 0,
  is_damageable INTEGER NOT NULL DEFAULT 0,
  is_fire_resistant INTEGER NOT NULL DEFAULT 0,
  rarity TEXT,
  enchant_value INTEGER DEFAULT 0,
  food_nutrition INTEGER,
  food_saturation REAL,
  food_always_eat INTEGER,
  default_components_json TEXT
)

blocks(
  block_id TEXT PRIMARY KEY,
  item_id TEXT,
  hardness REAL,
  resistance REAL,
  light_emission INTEGER,
  requires_correct_tool INTEGER,
  sound_type TEXT
)

item_creative_tabs(
  item_id TEXT NOT NULL,
  tab_id TEXT NOT NULL,
  PRIMARY KEY(item_id, tab_id)
)

item_tags(
  tag_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  PRIMARY KEY(tag_id, item_id)
)
```

### 4.3 配方事实

```sql
recipes(
  recipe_id TEXT PRIMARY KEY,
  type_id TEXT NOT NULL,
  modid TEXT NOT NULL,
  hash TEXT NOT NULL,
  raw_json TEXT,
  unparsed INTEGER NOT NULL DEFAULT 0,
  "group" TEXT
)

recipe_inputs(
  recipe_id TEXT NOT NULL,
  slot INTEGER NOT NULL,
  role TEXT NOT NULL,                   -- input | catalyst
  kind TEXT NOT NULL,                   -- item | tag | custom
  ref TEXT,                             -- item_id / tag_id; custom 为 NULL
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(recipe_id, slot, role, kind, ref)
)

recipe_outputs(
  recipe_id TEXT NOT NULL,
  slot INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  components_json TEXT,
  is_primary INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(recipe_id, slot, item_id)
)
```

约束：

- `unparsed = 1` 的配方只作为浏览/风险提示，不参与自动 rewrite。
- `kind = custom` 的输入不参与 MVP-0 自动替换。
- fluid / energy 输入暂不建专表，后续按真实 exporter 需求扩展。

### 4.4 翻译与资源

```sql
translations(
  key TEXT NOT NULL,
  lang TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY(key, lang)
)

item_resources(
  item_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  namespace TEXT NOT NULL,
  path TEXT NOT NULL,
  content TEXT,
  PRIMARY KEY(item_id, resource_type, namespace, path)
)

recipe_views(
  type_id TEXT PRIMARY KEY,
  layout_json TEXT NOT NULL,
  base64_png TEXT,
  version INTEGER
)

recipe_view_backgrounds(
  type_id TEXT PRIMARY KEY,
  png BLOB NOT NULL,
  sha1 TEXT NOT NULL
)
```

重要修正：

- importer 不再过滤 `item_resources`，所有 `resource_type` 原样保留。
- `lang_name` 不再作为 v1 主路径，显示名走 `items.translation_key -> translations`。

## 5. importer 分流策略

### 5.1 检测顺序

1. 使用当前项目目录检测候选 SQLite 文件。
2. 打开 SQLite，读取 `manifest`。
3. 检查表集合。
4. 判定 source kind。

建议候选路径：

```text
delightify-exporter/export.sqlite        # legacy
.delightify-exporter/export.sqlite       # legacy
config/delightify-exporter/export.sqlite # legacy
delightify/export.sqlite                 # v1 推荐
.delightify/export.sqlite                # v1 可选
```

最终路径以 exporter v1 实现为准。IDE importer 只要求可配置、可扩展。

### 5.2 v1 必需表

v1 最小必需：

- `manifest`
- `mods`
- `items`
- `item_tags`
- `recipes`
- `recipe_inputs`
- `recipe_outputs`
- `translations`

可选但应导入：

- `blocks`
- `item_creative_tabs`
- `item_resources`
- `recipe_views`
- `recipe_view_backgrounds`

### 5.3 幂等与失败策略

- 导入采用事务。
- 写入前创建或迁移 schema。
- 同一次导入全量替换事实表。
- 导入失败不得留下半成品事实层。
- `data_imports` 记录失败原因。
- `manifest.modlist_hash` 未变化时可以提示“无需重新导入”，但 MVP-0 可先允许强制重导。

## 6. unify 需要的查询能力

### 6.1 候选召回

按显示名召回：

```sql
SELECT i.*, t.value AS display_name
FROM items i
LEFT JOIN translations t
  ON t.key = i.translation_key AND t.lang = ?
WHERE normalize(t.value) = ?
```

实现时 `normalize` 在服务层做，不要求 SQLite 自定义函数。

按 id path 召回：

```sql
SELECT *
FROM items
WHERE item_id LIKE '%:' || ?
```

按 tag 召回：

```sql
SELECT item_id
FROM item_tags
WHERE tag_id = ?
```

### 6.2 引用者查询

直接输入引用：

```sql
SELECT r.*, ri.slot, ri.count
FROM recipe_inputs ri
JOIN recipes r ON r.recipe_id = ri.recipe_id
WHERE ri.kind = 'item' AND ri.ref = ?
```

tag 输入引用：

```sql
SELECT r.*, ri.slot, ri.ref AS tag_id
FROM item_tags it
JOIN recipe_inputs ri
  ON ri.kind = 'tag' AND ri.ref = it.tag_id
JOIN recipes r ON r.recipe_id = ri.recipe_id
WHERE it.item_id = ?
```

输出引用：

```sql
SELECT r.*, ro.slot, ro.count, ro.components_json
FROM recipe_outputs ro
JOIN recipes r ON r.recipe_id = ro.recipe_id
WHERE ro.item_id = ?
```

### 6.3 风险信号

unify 决策至少需要这些风险特征：

- 候选是否 `is_block = 1`。
- 候选 `default_components_json` 是否不同。
- 候选 `max_damage` / `is_damageable` 是否不同。
- 候选是否 food，且 food 属性是否不同。
- 候选是否有配方输出引用。
- 候选是否被 tag 间接大量引用。
- 是否存在 `unparsed = 1` 的相关配方。

规则：

- 组件/耐久/食物属性明显不同：默认搁置。
- 方块物品：默认升高风险，涉及 remove/hide 时必须搁置。
- `unparsed` 相关配方：不做自动 rewrite，只进入风险说明。

## 7. KubeJS 输出的 MVP-0 约束

MVP-0 emitter 只接收已审通过的 deterministic change set，不直接做语义判断。

输出文件：

```text
kubejs/server_scripts/zzz_delightify_generated.js
```

文件头：

```js
// @delightify-generated
// Do not edit by hand. Regenerate from Delightify.
```

MVP-0 先覆盖这些动作：

- replace direct item input。
- replace direct item output，必要时 remove + rewrite 或使用 KubeJS 能力替换。
- tag add/remove 只在低风险、已审通过时输出。

不在 MVP-0 自动输出：

- hide item。
- remove item。
- add item。
- rewrite custom/unparsed recipe。

## 8. 分阶段实现计划

### PR 1：schema 与能力检测

内容：

- 扩展 `SchemaManager` 支持 v1 表。
- 增加 source kind / capabilities 判断。
- legacy 导入后标记 browse-only。

验收：

- `pnpm typecheck`
- `pnpm build`
- legacy 导入仍能打开 ItemBrowser / RecipeBrowser。

### PR 2：Exporter v1 importer

内容：

- 新增 v1 importer 分支。
- 读取 `recipe_inputs` / `recipe_outputs` / `translations` / 新 items 字段。
- 保留全部 `item_resources`。
- 读取 `recipe_views` / `recipe_view_backgrounds`。

验收：

- 用 v1 SQLite fixture 导入成功。
- 项目 capabilities 显示 `mvp0_unify: true`。
- 结构化配方引用查询能返回结果。

### PR 3：unify 查询服务

内容：

- 增加后端服务：候选召回、引用者查询、风险信号聚合。
- 增加 IPC 或内部 service API。
- 不生成 KubeJS。

验收：

- 给定样例“铜锭”，能列出候选、引用者、风险理由。
- legacy browse-only 项目拒绝进入 unify，并给出清晰原因。

### PR 4：unify dry-run 引擎

内容：

- 生成决策清单。
- 自动项和搁置项分流。
- 生成 before/after diff model。

验收：

- 不写文件。
- 每个决策含 evidence、confidence、risk、action。
- 高风险项不会自动进入 change set。

### PR 5：KubeJS emitter

内容：

- 将已审 change set 编译为 KubeJS。
- 写入工具文件。
- 支持撤销/重生成。

验收：

- 生成文件只覆盖 `zzz_delightify_generated.js`。
- `pnpm typecheck`
- `pnpm build`
- 对样例包执行 `/reload` 可生效。

### PR 6：unify 审阅与导出 UI

内容：

- 改造 ConversionTool 为 MVP-0 unify 工作台。
- 接入 `unifyQuery`、`unifyDryRun`、`exportKubeJs`、`revertKubeJs`。
- 展示候选、目标选择、决策清单、diff、change set、生成结果。
- browser/mock 模式提供可联调样例数据。

验收：

- `pnpm typecheck`
- `pnpm build`
- 在打开项目后可从“转换工具”完成 查询候选 → dry-run → 生成/撤销 KubeJS。

### PR 7：MVP-0 smoke 验收脚本

内容：

- 新增 `pnpm smoke:mvp0`。
- 脚本构造最小 Exporter v1 SQLite 快照。
- 调用真实服务跑通 导入 → unify 查询 → dry-run → KubeJS 生成 → 重生成 → 撤销。
- 覆盖低风险自动 change set 与高风险搁置项。

验收：

- `pnpm smoke:mvp0`
- `pnpm typecheck`

## 9. 当前代码对应关系

可复用：

- `packages/main/src/services/paths.ts`
- `packages/main/src/services/database/client.ts`
- `packages/main/src/services/database/schema-manager.ts`
- `packages/main/src/services/mod-data-importer/*` 的 legacy 读取逻辑
- `packages/main/src/ipc/items.ts`
- `packages/main/src/ipc/recipes.ts`
- ProjectManager / DataImport / ItemBrowser / RecipeBrowser 页面

需要改造：

- `schema-manager.ts` 的 `CORE_TABLES`
- `schema.ts` 与运行时建表脱节的问题
- `mod-data-importer/importer.ts` 的单一路径导入
- `item_resources` 过滤逻辑
- 项目状态/capabilities 展示

新建：

- exporter v1 schema validator
- exporter v1 importer
- unify query service
- unify dry-run engine
- KubeJS emitter

## 10. 不变量

- 不确定就搁置，不静默猜测。
- legacy 数据不参与自动改包。
- emitter 只处理已审 change set。
- 生成物归 Delightify 所有，不修改作者手写脚本。
- 任何破坏世界状态的动作默认不自动执行。

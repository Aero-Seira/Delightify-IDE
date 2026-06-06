# 项目结构

该文档描述了项目的文件结构、数据库架构与重要设计概念。

---

## 目录结构

```
Delightify/
├── packages/
│   ├── shared/            # 跨进程共享的 TypeScript 类型与 IPC 常量
│   ├── main/              # Electron 主进程（Node.js）
│   │   └── src/
│   │       ├── fs/        # AppPaths 路径体系
│   │       ├── ipc/       # IPC handler（jar、items、project）
│   │       └── services/
│   │           └── database/  # Drizzle ORM schema、client、repositories
│   └── renderer/          # React + Vite 前端
├── config/                # 配方类型等用户可编辑的元数据 JSON
├── docs/                  # 文档
├── pnpm-workspace.yaml
└── turbo.json
```

---

## 路径体系（AppPaths）

参考 PCL2CE `Paths.cs` 的多层路径分离设计，Delightify 将路径分为三个独立体系：

| 路径键 | 实际位置 | 说明 |
| ------ | -------- | ---- |
| `userData` | `%AppData%/Delightify/` | 应用全局数据根目录 |
| `globalDb` | `userData/global.db` | 全局模组知识库（跨项目共享） |
| `textureCache` | `userData/cache/textures/` | 材质缓存目录 |
| `projectsJson` | `userData/projects.json` | 整合包项目注册表 |
| `projectDb(p)` | `<modpack>/.delightify/project.db` | 单个整合包的项目私有库 |

三个路径体系互不耦合，支持灵活部署与迁移，且项目数据（`.delightify/`）可随整合包目录一起备份、分享。

---

## 数据库架构

### 全局知识库（`global.db`）

`global.db` 存储所有模组解析后的结构化知识，供多个整合包项目共享复用。

#### 基础业务表（共 7 张）

| 表名 | 描述 |
| ---- | ---- |
| `mods` | 已导入的模组元信息（modId、版本、JAR 路径、哈希） |
| `items` | 物品/方块条目（item_id、display_name、modId、category） |
| `item_tags` | 物品与 tag 的多对多映射 |
| `recipes` | 配方原始数据（recipe_id、类型、原始 JSON、slots） |
| `recipe_types` | 配方类型注册表（type_id、显示名、字段规格） |
| `translations` | lang key → 显示文本映射 |
| `textures` | 材质 PNG 二进制数据（Blob，与 DB 自包含） |

#### 图谱层扩展表（共 4 张）

| 表名 | 描述 |
| ---- | ---- |
| `entities` | 统一实体注册表（item/recipe/tag/block/… 均映射为 entity_id） |
| `relations` | 统一关系边表（有向边，涵盖数据关系与语义关系两层） |
| `imports` | 导入批次记录（每次解析 JAR 为一次 import，含哈希与解析器版本） |
| `relation_evidence` | 关系证据溯源表（每条关系可关联多条证据） |

### 项目私有库（`project.db`）

`project.db` 存储整合包级别的私有决策，不影响全局知识库。

| 表名 | 描述 |
| ---- | ---- |
| `conversion_history` | 配方转换历史记录 |
| `project_relations` | 项目级语义关系覆盖（可 override 或 block 全局推荐） |

---

#### 表关系图

```
mods ─────────────────────────────────┐
  │                                   │
  ▼                                   ▼
items ──── item_tags ──── (tag)     recipes ──── recipe_types
  │                                   │
  ▼                                   ▼
translations                        (slots → items/tags)
  │
  ▼
textures

── 图谱层 ──────────────────────────────────────────────
entities (item:* / recipe:* / tag:* / block:* / …)
  │
  ▼
relations (from_entity_id → to_entity_id, relation_type, layer)
  │                  ▲
  └── relation_evidence ◄── imports
```

---

### 关系系统设计：数据层（Data）与语义层（Semantic）

Delightify 的关系系统分为**两个独立层次**，分别服务于不同的确定性需求：

#### 数据关系（Data Relations）

**来源**：JAR 内的 JSON 文件（配方、tag、lang、模型引用等），可重复解析、可精确溯源。

**特点**：
- 确定性强，结果可复现
- 可回溯到具体文件路径与 JSONPath
- 导入时双写：写业务表（`recipes`/`item_tags`/…）+ 写图谱表（`relations` 中 `layer='data'`）

**常用 relation_type 示例**：
- `data:consumes_item` — 配方消耗某物品
- `data:consumes_tag` — 配方消耗某 tag
- `data:produces_item` — 配方产出某物品
- `data:has_tag` — 物品属于某 tag
- `data:uses_recipe_type` — 配方属于某配方类型
- `data:block_item_of` — 方块对应的物品形式

#### 语义关系（Semantic Relations）

**来源**：LLM 推断、启发式规则、人工标注；后期通过 LLM 管线自动生成并审核。

**特点**：
- 不一定唯一正确，允许多候选（top-k）与置信度
- 可被推翻、版本化、审核确认
- 支持 per-modpack 的覆盖决策（见"优先级规则"）

**常用 relation_type 示例**：
- `sem:equivalent_to` — 跨模组同义物品（如两个 mod 的"番茄"）
- `sem:substitute_for` — 可替代使用（功能等价，但不完全同义）
- `sem:category_is` — 语义分类（如"食材"、"机械"）
- `sem:maps_to_recipe_type` — 建议将配方迁移至某类型

#### 折中策略：全局推荐 + 项目覆盖（Overlay）

受 PCL2CE 路径分层理念启发，语义关系采用**全局推荐 + 项目覆盖**的两级模型：

- **`global.db`**：存储可复用的通用语义推荐（跨整合包共享的知识，如同义词库、常见替代关系）
- **`project.db`**：存储整合包作者的最终裁决（可 override 全局推荐，也可显式 block 某条全局关系）

#### 优先级与合并规则

```
查询某实体对的有效语义关系时：

1. 读取 project.db 的 project_relations
   ├── 若存在 status='override'  → 使用项目版本，忽略全局
   └── 若存在 status='blocked'   → 屏蔽该关系，不向上查询

2. 若 project.db 无记录，回退到 global.db 的 relations
   └── 取 status='active' 的条目，按 confidence 降序排列

3. 同一实体对允许存在多个 relation_type（不互斥）
   └── 例：item:A → item:B 可同时存在 sem:equivalent_to 和 sem:substitute_for

4. 同一 relation_type 可存在多个候选（top-k）
   └── 通过 confidence 排序，payload.rank 标记候选顺序
   └── 人工审核后将选中条目设为 status='active'，其余设为 status='deprecated'
```

#### 语义关系字段规范（最小字段集）

`relations` 表中的语义关系记录，建议至少包含以下字段：

| 字段 | 类型 | 说明 |
| ---- | ---- | ---- |
| `relation_id` | TEXT PK | 可复现 hash（`sha1(from+type+to+count+slot)`，即 from/to/type 及核心数量槽位字段），重复导入时 upsert |
| `from_entity_id` | TEXT | 起点实体 ID（如 `item:farmersdelight:tomato`） |
| `to_entity_id` | TEXT | 终点实体 ID |
| `relation_type` | TEXT | 关系类型字符串（不用 enum，便于扩展） |
| `layer` | TEXT | `data` 或 `semantic` |
| `source_kind` | TEXT | `jar` / `builtin` / `manual` / `llm` / `inferred` |
| `status` | TEXT | `active` / `deprecated` / `deleted`（软删除，保留溯源） |
| `confidence` | REAL | 0～1，语义层必填；数据层可为 NULL 或固定 1.0 |
| `payload` | TEXT (JSON) | 扩展信息，语义层建议包含以下子字段： |
| `payload.rationale` | string | LLM 或规则给出的推理说明 |
| `payload.rank` | number | top-k 中的候选排序（1 = 最优） |
| `payload.model` | string | 生成该关系的模型标识（如 `gpt-4o`） |
| `payload.prompt_version` | string | 使用的 Prompt 版本号，便于复现与升级 |
| `payload.features` | object | 用于推断的特征快照（tag 交集、命名相似度等） |

---

### JAR 解析流程

JAR 文件本质上是 ZIP 压缩包，Delightify 使用纯 Node.js 三重策略提取物品 ID，覆盖率约 98%。

```
用户选择 JAR 文件
        │
        ▼
  zip-reader（解压 ZIP）
        │
        ├──► lang-parser
        │       assets/{modid}/lang/en_us.json
        │       key "item.{modid}.{name}" → ID "{modid}:{name}"
        │
        ├──► tag-parser
        │       data/{modid}/tags/items/*.json
        │       values[] → item ID 列表
        │
        ├──► recipe-parser
        │       data/{modid}/recipes/*.json
        │       ingredient/result → item ID
        │       同时建立 recipe_types 条目
        │
        └──► texture-parser
                assets/{modid}/textures/item/*.png
                jimp 提取 PNG → Blob 写入 textures 表

                    │（三重合并去重）
                    ▼
              item-resolver
                    │
                    ▼
         写入 global.db（mods / items / item_tags / recipes / recipe_types / translations / textures）
         同步写入 entities + relations（图谱层 data 关系）
         记录 imports + relation_evidence（溯源层）
```

**解析器版本化**：每次导入在 `imports` 表记录 `parser_version`，升级解析逻辑后可对比同一 JAR 的前后差异，便于调试与回归验证。
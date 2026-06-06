# Delightify 架构重构方案

> 从「JAR解析」模式迁移到「整合包为中心 + Mod数据导入」模式

---

## 一、变更概述

### 1.1 核心变更

| 维度 | 当前架构 | 新架构 |
|------|----------|--------|
| **操作单位** | 模组 JAR 文件 | 整合包项目 |
| **数据来源** | 解析 JAR 文件（lang/recipes/tags） | 附属 Mod 生成的 SQLite 数据文件 |
| **数据库模式** | global.db（共享）+ project.db（私有） | project.db（项目隔离，独立完整） |
| **数据准确性** | ~98% 覆盖率（启发式推断） | 100% 权威数据（游戏内注册表读取） |
| **使用流程** | 逐个导入 JAR → 查看物品/配方 | 打开整合包 → 导入 Mod 数据 → 编辑 |

### 1.2 架构对比图

```
【当前架构】                          【新架构】
                                    
┌─────────────┐                    ┌─────────────────┐
│  JAR 文件 1  │                    │   整合包目录     │
│  JAR 文件 2  │ ──解析──┐          │  (Minecraft实例) │
│  JAR 文件 N  │         │          └────────┬────────┘
└─────────────┘         │                   │
                        ▼                   ▼
┌─────────────────────────────────┐    ┌─────────────────┐
│         global.db               │    │ 附属Mod输出文件  │
│  (跨项目共享的模组知识库)        │    │ (modpack_data.db)│
│  • mods, items, recipes         │    └────────┬────────┘
│  • textures, translations       │             │
└─────────────────────────────────┘             ▼
           │                            ┌─────────────────┐
           │                            │  Delightify 桌面端 │
           ▼                            │                 │
┌─────────────────────────────────┐    │  ┌───────────┐  │
│      project.db (可选)          │    │  │数据导入器 │  │
│  (项目级覆盖/转换历史)           │◄───│  │(取代JAR解析)│  │
└─────────────────────────────────┘    │  └─────┬─────┘  │
                                       │        │        │
                                       │  ┌─────▼─────┐  │
                                       │  │ project.db │  │
                                       │  │(项目独立)  │  │
                                       │  └───────────┘  │
                                       └─────────────────┘
```

---

## 二、数据库架构重构

### 2.1 新 Schema 设计（project.db）

```typescript
// ============================================
// 核心数据表（来自附属Mod）
// ============================================

/**
 * 模组信息表 - 存储该整合包包含的所有模组
 */
export const mods = sqliteTable('mods', {
  modId: text('mod_id').primaryKey(),           // 模组ID (如 "farmersdelight")
  modName: text('mod_name').notNull(),          // 显示名称
  version: text('version'),                     // 版本号
  mcVersion: text('mc_version'),                // 适配的MC版本
  isBuiltin: integer('is_builtin', { mode: 'boolean' }).default(false), // 是否原版
  importedAt: text('imported_at').notNull(),    // 导入时间
});

/**
 * 物品/方块表 - 权威注册表数据
 */
export const items = sqliteTable('items', {
  itemId: text('item_id').primaryKey(),         // 完整ID (如 "farmersdelight:tomato")
  modId: text('mod_id').notNull(),              // 所属模组
  name: text('name').notNull(),                 // 短名称 (如 "tomato")
  displayName: text('display_name'),            // 本地化显示名
  displayNameKey: text('display_name_key'),     // 翻译键
  category: text('category'),                   // 分类
  isBlock: integer('is_block', { mode: 'boolean' }).default(false),
  maxStackSize: integer('max_stack_size').default(64),
  rarity: text('rarity').default('common'),     // 稀有度
  // 新增：注册表元数据
  registryOrder: integer('registry_order'),     // 注册顺序（用于排序）
  creativeTab: text('creative_tab'),            // 创造模式标签页
});

/**
 * 配方类型表 - 该整合包支持的所有配方类型
 */
export const recipeTypes = sqliteTable('recipe_types', {
  recipeTypeId: text('recipe_type_id').primaryKey(), // 如 "minecraft:crafting_shaped"
  modId: text('mod_id').notNull(),              // 定义该类型的模组
  displayName: text('display_name').notNull(),
  icon: text('icon'),                           // 图标路径（可选）
  inputSlotCount: integer('input_slot_count').default(1),
  outputSlotCount: integer('output_slot_count').default(1),
  // 序列化器信息（用于导出）
  serializerId: text('serializer_id'),          // 配方序列化器ID
});

/**
 * 配方表 - 该整合包的所有配方
 */
export const recipes = sqliteTable('recipes', {
  recipeId: text('recipe_id').primaryKey(),     // 完整ID
  modId: text('mod_id').notNull(),              // 所属模组
  recipeTypeId: text('recipe_type_id').notNull(),
  // 输入槽位（JSON数组）
  inputSlots: text('input_slots'),              // [{slot:0, items:["mod:id"], count:1}]
  // 输出槽位
  outputSlots: text('output_slots'),            // [{slot:0, item:"mod:id", count:1}]
  // 原始JSON（用于导出）
  rawJson: text('raw_json'),
  // 配方元数据
  group: text('group'),                         // 配方分组
  isSpecial: integer('is_special', { mode: 'boolean' }).default(false),
});

/**
 * 标签表 - 完整的标签数据
 */
export const tags = sqliteTable('tags', {
  tagId: text('tag_id').primaryKey(),           // 如 "forge:vegetables"
  tagType: text('tag_type').notNull(),          // items/blocks/fluids/entity_types
  modId: text('mod_id').notNull(),              // 定义该标签的模组
  items: text('items').notNull(),               // JSON数组 ["mod:item1", "mod:item2"]
});

// ============================================
// 资源引用表（材质等）
// ============================================

/**
 * 材质引用表 - 记录物品对应的材质路径
 * 注意：实际材质文件存储在整合包目录或缓存中
 */
export const textures = sqliteTable('textures', {
  textureId: text('texture_id').primaryKey(),   // 如 "farmersdelight:item/tomato"
  itemId: text('item_id').notNull(),            // 关联的物品
  modId: text('mod_id').notNull(),
  textureType: text('texture_type').notNull(),  // item/block
  // 材质来源
  source: text('source').notNull(),             // jar/mod_folder/cache
  sourcePath: text('source_path'),              // 原始路径
  // 缓存信息
  cacheName: text('cache_name'),                // 本地缓存文件名
});

// ============================================
// 项目工作区数据（用户编辑内容）
// ============================================

/**
 * 配方编辑历史 - 用户对配方的修改记录
 */
export const recipeEdits = sqliteTable('recipe_edits', {
  editId: text('edit_id').primaryKey(),
  recipeId: text('recipe_id').notNull(),        // 修改的配方ID
  editType: text('edit_type').notNull(),        // create/modify/disable/delete
  originalRecipe: text('original_recipe'),      // 原始配方JSON
  editedRecipe: text('edited_recipe'),          // 修改后的配方JSON
  // 编辑元数据
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  isExported: integer('is_exported', { mode: 'boolean' }).default(false),
});

/**
 * 导出历史
 */
export const exportHistory = sqliteTable('export_history', {
  exportId: text('export_id').primaryKey(),
  exportType: text('export_type').notNull(),    // kubejs/datapack
  targetPath: text('target_path').notNull(),    // 导出路径
  exportedFiles: text('exported_files'),        // JSON数组，导出的文件列表
  exportedAt: text('exported_at').notNull(),
});

/**
 * 项目元数据
 */
export const projectMeta = sqliteTable('project_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});
```

### 2.2 移除的表

| 表名 | 原因 |
|------|------|
| `translations` | 由附属Mod直接提供本地化后的数据 |
| `item_tags` | 合并到 `tags` 表（JSON数组存储） |
| `entities` | 简化架构，暂不需要图谱层 |
| `relations` | 简化架构，暂不需要语义关系层 |
| `imports` | 不再需要导入批次追踪 |
| `relation_evidence` | 随 relations 移除 |
| `conversion_history` | 由 `recipeEdits` 替代 |
| `project_relations` | 不再需要全局/项目关系覆盖 |

---

## 三、核心模块重构计划

### 3.1 新增模块

#### 3.1.1 Mod数据导入器 (`mod-data-importer/`)

```typescript
// packages/main/src/services/mod-data-importer/index.ts

export interface ModDataImportOptions {
  projectPath: string;           // 整合包路径
  dataFilePath: string;          // 附属Mod生成的数据文件路径
  importAssets?: boolean;        // 是否导入材质等资源
  onProgress?: (progress: ImportProgress) => void;
}

export interface ImportProgress {
  phase: 'reading' | 'validating' | 'importing' | 'assets' | 'completed';
  percent: number;
  message: string;
  currentMod?: string;
  processedMods?: number;
  totalMods?: number;
}

/**
 * 导入 Mod 数据到项目数据库
 */
export async function importModData(
  options: ModDataImportOptions
): Promise<ImportResult>;

/**
 * 验证数据文件格式
 */
export function validateModDataFile(filePath: string): ValidationResult;

/**
 * 检测整合包中的数据文件
 */
export function detectModDataFile(projectPath: string): string | null;
```

#### 3.1.2 附属Mod数据格式规范

附属Mod需要输出的 SQLite 文件结构：

```sql
-- modpack_data.db (由附属Mod生成)

CREATE TABLE modpack_info (
    key TEXT PRIMARY KEY,
    value TEXT
);
-- 插入: ('mc_version', '1.20.1'), ('mod_loader', 'forge'), ('export_time', '...')

CREATE TABLE mods (
    mod_id TEXT PRIMARY KEY,
    mod_name TEXT NOT NULL,
    version TEXT,
    mc_version TEXT
);

CREATE TABLE items (
    item_id TEXT PRIMARY KEY,      -- "modid:item_name"
    mod_id TEXT NOT NULL,
    name TEXT NOT NULL,            -- 短名
    display_name TEXT,             -- 本地化名称
    display_name_key TEXT,         -- 翻译键
    is_block INTEGER DEFAULT 0,
    max_stack_size INTEGER DEFAULT 64,
    rarity TEXT DEFAULT 'common',
    creative_tab TEXT,
    nbt_data TEXT                  -- 默认NBT（JSON）
);

CREATE TABLE recipe_types (
    recipe_type_id TEXT PRIMARY KEY,
    mod_id TEXT NOT NULL,
    display_name TEXT,
    serializer_id TEXT
);

CREATE TABLE recipes (
    recipe_id TEXT PRIMARY KEY,
    mod_id TEXT NOT NULL,
    recipe_type_id TEXT NOT NULL,
    group_name TEXT,
    input_slots TEXT,              -- JSON
    output_slots TEXT,             -- JSON
    raw_json TEXT                  -- 完整配方JSON
);

CREATE TABLE tags (
    tag_id TEXT PRIMARY KEY,       -- "type:modid/name"
    tag_type TEXT NOT NULL,        -- items/blocks/fluids
    mod_id TEXT NOT NULL,
    entries TEXT                   -- JSON数组
);

CREATE TABLE textures (
    texture_id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    texture_type TEXT,             -- item/block
    asset_path TEXT                -- 在assets中的路径
);
```

### 3.2 修改的模块

#### 3.2.1 数据库服务 (`database/`)

| 变更项 | 说明 |
|--------|------|
| 移除 `global.db` | 不再使用全局共享数据库 |
| 简化 `client.ts` | 只保留项目数据库连接 |
| 更新 `schema.ts` | 使用新的表结构 |
| 移除 `batch-save.ts` | 不再需要批量导入优化 |

#### 3.2.2 IPC 处理器 (`ipc/`)

| 处理器 | 变更 |
|--------|------|
| `jar.ts` | **移除**，不再解析 JAR |
| `jar-bytecode-import.ts` | **移除** |
| `import-engine-test.ts` | **移除** |
| `import-strategy.ts` | **移除** |
| `project.ts` | 大幅简化，移除统计功能 |
| `items.ts` | 从项目数据库查询 |
| `recipes.ts` | 从项目数据库查询 |
| **新增** `mod-data.ts` | 处理 Mod 数据导入 |

#### 3.2.3 路径服务 (`paths.ts`)

```typescript
// 移除
get globalDb(): string;           // 不再使用
get textureCache(): string;       // 可选保留（资源缓存）

// 保留
projectDb(projectPath: string): string;
```

### 3.3 移除的模块

| 模块 | 说明 |
|------|------|
| `jar-parser/` | 整个目录移除，不再需要 JAR 解析 |
| `import-engine/` | 整个目录移除 |
| `resource-renderer/` | 功能合并到纹理服务 |

---

## 四、UI 重构计划

### 4.1 页面调整

| 页面 | 变更 |
|------|------|
| `ModManager` | **重命名为** `DataImport`，管理 Mod 数据导入而非 JAR |
| `ProjectManager` | 简化，移除统计信息展示 |
| `ItemBrowser` | 从项目数据库查询 |
| `RecipeBrowser` | 从项目数据库查询 |
| `RecipeEditor` | 基本不变，数据源调整 |
| `ImportEngineTest` | **移除** |
| `DebugTools` | 简化，移除全局数据库调试 |

### 4.2 新增组件

#### 4.2.1 数据导入向导

```typescript
// 三步导入流程

Step 1: 检测/选择整合包
  ├─ 自动扫描常见路径查找整合包
  ├─ 手动选择整合包目录
  └─ 检测附属Mod数据文件

Step 2: 预览数据
  ├─ 显示检测到的模组列表
  ├─ 显示物品/配方/标签数量统计
  └─ 确认导入

Step 3: 导入进度
  └─ 显示导入进度和状态
```

#### 4.2.2 项目状态面板

```typescript
interface ProjectStatusPanelProps {
  project: Project;
  dataStatus: {
    lastImportedAt: string | null;
    modCount: number;
    itemCount: number;
    recipeCount: number;
    needsReimport: boolean;  // 当整合包更新时
  };
  onReimport: () => void;
}
```

---

## 五、数据迁移策略

### 5.1 用户数据迁移

由于架构变更巨大，**不提供自动迁移**：

1. **global.db 中的数据**：引导用户重新从整合包导入
2. **project.db 中的编辑历史**：保留但标记为"旧版数据"（可选）

### 5.2 配置迁移

```typescript
// 检测旧版本配置
function detectLegacyData(): boolean {
  return fs.existsSync(appPaths.globalDb);
}

// 显示迁移提示
"检测到你使用了旧版本的 Delightify。\n"
"由于架构重大更新，你需要重新导入整合包数据。\n"
"旧版的配方编辑历史可以在备份中查看。"
```

---

## 六、实施计划

### 阶段一：基础架构重构（预计 3-4 天）

1. **数据库层**
   - [ ] 更新 schema.ts，实现新的表结构
   - [ ] 简化 database/index.ts，移除 global.db 支持
   - [ ] 创建新的项目数据库初始化逻辑

2. **服务层**
   - [ ] 创建 `mod-data-importer/` 模块
   - [ ] 实现数据文件验证和导入逻辑
   - [ ] 移除 `jar-parser/` 目录

3. **IPC 层**
   - [ ] 创建新的 `mod-data.ts` IPC 处理器
   - [ ] 移除 `jar.ts`, `jar-bytecode-import.ts`, `import-engine-test.ts`
   - [ ] 更新其他 IPC 处理器以使用项目数据库

### 阶段二：UI 重构（预计 2-3 天）

1. **页面重构**
   - [ ] 重写 `ModManager` → `DataImport`
   - [ ] 简化 `ProjectManager`
   - [ ] 移除 `ImportEngineTest` 页面
   - [ ] 更新导航和路由

2. **组件开发**
   - [ ] 创建数据导入向导组件
   - [ ] 创建项目状态面板
   - [ ] 更新物品/配方浏览器以适配新数据

### 阶段三：测试与优化（预计 2-3 天）

1. **功能测试**
   - [ ] 数据导入流程测试
   - [ ] 配方编辑器测试
   - [ ] 导出功能测试

2. **清理工作**
   - [ ] 移除未使用的依赖
   - [ ] 更新文档
   - [ ] 更新类型定义

---

## 七、风险与回滚策略

### 7.1 主要风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 附属Mod未就绪 | 无法获取数据 | 提供模拟数据生成器用于开发测试 |
| 用户数据丢失 | 用户不满 | 保留旧版数据备份，提供导出功能 |
| 功能回退 | 体验下降 | 确保核心功能（编辑/导出）先稳定 |
| 性能问题 | 使用卡顿 | 新架构数据量更小，性能应提升 |

### 7.2 回滚策略

由于变更涉及整个架构，**不支持热回滚**。如果需要回滚：

1. 从 Git 历史检出 `v0.3.x` 标签
2. 保留用户数据目录备份
3. 重新安装旧版本依赖

---

## 八、附属Mod接口约定

### 8.1 数据文件位置

```
.minecraft/
└── delightify/
    └── modpack_data.db      # 主数据文件
    └── assets/              # 材质等资源（可选）
        └── minecraft/
            └── textures/
```

### 8.2 版本兼容性

```typescript
// 数据文件版本检查
const SUPPORTED_DATA_VERSION = '1.0';

interface DataVersionInfo {
  version: string;
  minAppVersion: string;    // 要求的 Delightify 最低版本
}

function checkDataVersion(db: Database): CompatibilityResult {
  // 检查数据文件版本兼容性
}
```

---

## 九、附录：文件变更清单

### 9.1 删除的文件

```
packages/main/src/services/jar-parser/           (整个目录)
packages/main/src/services/import-engine/        (整个目录)
packages/main/src/services/resource-renderer/    (整个目录)
packages/main/src/ipc/jar.ts
packages/main/src/ipc/jar-bytecode-import.ts
packages/main/src/ipc/import-engine-test.ts
packages/main/src/ipc/import-strategy.ts
packages/renderer/src/pages/ImportEngineTest/
packages/renderer/src/pages/ModManager/          (重写为 DataImport)
```

### 9.2 新增的文件

```
packages/main/src/services/mod-data-importer/
├── index.ts
├── validator.ts
├── importer.ts
└── types.ts
packages/main/src/ipc/mod-data.ts
packages/renderer/src/pages/DataImport/
├── index.tsx
├── steps/
│   ├── SelectModpackStep.tsx
│   ├── PreviewDataStep.tsx
│   └── ImportProgressStep.tsx
└── style.module.css
```

### 9.3 修改的文件

```
packages/main/src/services/database/schema.ts
packages/main/src/services/database/client.ts
packages/main/src/services/database/index.ts
packages/main/src/services/paths.ts
packages/main/src/ipc/index.ts
packages/main/src/ipc/project.ts
packages/main/src/ipc/items.ts
packages/main/src/ipc/recipes.ts
packages/main/src/main.ts
packages/shared/src/types/*.ts                    (多个类型文件)
packages/renderer/src/App.tsx
packages/renderer/src/ipc/index.ts
packages/renderer/src/pages/ProjectManager/
packages/renderer/src/pages/ItemBrowser/
packages/renderer/src/pages/RecipeBrowser/
```

---

## 十、总结

本次重构将 Delightify 从「通用模组知识库」转变为「整合包专属工具」：

**优势：**
1. 数据准确性从 ~98% 提升到 100%
2. 架构大幅简化（移除 JAR 解析、全局数据库）
3. 使用流程更自然（打开整合包即可工作）
4. 数据实时同步（附属Mod随游戏启动更新数据）

**代价：**
1. 需要开发附属 Minecraft Mod
2. 不支持独立分析单个 JAR 文件
3. 用户需要重新导入数据

---

*文档版本：1.0*
*最后更新：2026-03-25*

# 可视化渲染 · exporter 材质提取计划

> 状态：已完成（2026-06-16）。目标：补全 exporter 的物品/方块**材质（贴图）提取**，让 UI 里的 ItemIcon 显示真实图标。**按原设计来**（规格 `设计/06 §5` 材质策略 + `设计/01` "材质是第一语言"）。
> 依据：代码审计（提交 `640e399` 基线）。代码事实优先。

## 1. 现状（审计结论）

**下游整条通路已就绪，exporter 源头已补齐。**

| 环 | 文件 | 状态 |
|---|---|---|
| project.db schema | `services/database/schema-manager.ts` `item_resources(item_id, resource_type, namespace, path, content)` | ✅ |
| importer | `mod-data-importer/importer.ts` `readItemResources`/`importItemResources` 逐列拷贝；`item_resources` 不在 `EXPORTER_V1_REQUIRED_TABLES`，缺表返回 `[]` 容错 | ✅ |
| IPC | `ipc/items.ts` `items:get-texture` 查 `content WHERE resource_type='texture'`，返回 `{base64, mimeType}`，缺失返回 `null` | ✅ |
| renderer | `hooks/useTexture.ts` + `components/ItemIcon` 渲染 data URL，缺失显示彩色字母占位（非紫黑格） | ✅ |
| **exporter 源头** | `packages/exporter` 已实现 `ItemResourceCapture` / `ItemResourceSource` / `ClientItemIconExportBridge`，`ExporterService` 写入 `item_resources(resource_type='texture')` | ✅ |

- exporter `Schema.java` 的 `item_resources` 列与 project.db **完全一致** → exporter 写入后下游零改动直通。
- 当前实现：物理客户端 / 集成服优先走客户端最终态渲染；专用服或客户端渲染失败时回退到离线模型/贴图提取。

## 2. 设计（按原设计：离线 asset + 模型 JSON 合成）

规格 `设计/06 §5`：渲染依赖活动客户端是最重依赖 → **不走实时 GPU 渲染**；多数物品/方块材质可从 `assets/.../textures` + 模型 JSON **离线合成**，复杂模型再回退批量渲染（**批量渲染本期推迟**）。

- **写入目标**：`item_resources` 行 `(item_id, resource_type='texture', namespace, path, content)`。
- **content 契约（关键）**：写**裸 base64**（PNG 字节的 base64，**不加 `data:` 前缀**）。IPC 靠 PNG 签名 `iVBORw0KGgo` 探测 MIME，且不剥离前缀；加前缀会导致 renderer 双前缀渲染失败。
- **贴图解析（item → PNG）**，复用 `TranslationSource` 的 CLIENT_RESOURCES ResourceManager：
  1. 读物品模型 `assets/<ns>/models/item/<path>.json`：
     - 含 `textures.layer0`（generated/handheld，覆盖绝大多数物品）→ 该 ResourceLocation 即图标贴图；
     - 否则跟随 `parent`（`item/generated`/`item/handheld` 取 layer0）；
  2. 回退：约定路径 `assets/<ns>/textures/item/<path>.png`，再 `textures/block/<path>.png`；
  3. 解析到的贴图 ResourceLocation → 读 PNG 字节 → base64。
- **解析不到**（复杂 3D 方块模型 / 多层合成 / vanilla 在专用服缺客户端 assets）→ **跳过该物品**（下游显示占位，符合规格"图标空白可接受"）。

## 3. 任务

### TX1：ItemResourceSource（Java，server 线程）✅
- 新增 `packages/exporter/src/main/java/io/github/aeroseira/mpide_exporter/source/ItemResourceSource.java`：
  - `record ItemResourceRow(String itemId, String resourceType, String namespace, String path, String content)`。
  - `static List<ItemResourceRow> capture(MinecraftServer server)`：
    - 用 `BuiltInRegistries.ITEM` 枚举物品（对齐 `ItemRegistrySource` 的物品集合）；
    - 构建 `MultiPackResourceManager(PackType.CLIENT_RESOURCES, server.getResourceManager().listPacks())`（**共享 server-owned packs，不要 close**，照 `TranslationSource:47-50`）；
    - 按 §2 解析每个物品的图标贴图 → 读 PNG → `Base64.getEncoder().encodeToString(bytes)`（裸 base64）；
    - 行：`resourceType="texture"`，`namespace`/`path` 填贴图 ResourceLocation 的 ns/path；
    - 解析失败/缺资源 → 跳过并 `LOGGER.debug`，绝不抛断整个导出；
    - 结果排序确定化（按 item_id）保产物稳定。

### TX2：写库接线✅
- `db/Schema.java`：加 `UPSERT_ITEM_RESOURCE = "INSERT OR REPLACE INTO item_resources (item_id, resource_type, namespace, path, content) VALUES (?, ?, ?, ?, ?)"`（表 DDL 已存在，勿改列）。
- `db/SqliteDatabase.java`：加 `writeItemResources(List<ItemResourceSource.ItemResourceRow> rows)`，单事务批量 UPSERT（照现有写表方法）。
- `export/ExporterService.java`：在 worker 阶段调用 `ItemResourceCapture.capture(server, progress)` + `db.writeItemResources(...)`；进度提示「导出物品贴图…」。
- `source/package-info.java`：更新已实现 Source 列表。

### TX3：验证✅
- 硬门：`pnpm exporter:compile`（Java 编译通过）；建议 `pnpm exporter:build`。
- 手动端到端：游戏内（**优先单人/集成服**，客户端 assets 齐全）`/mpide_export dump` → 生成 export.sqlite（含 item_resources）→ IDE 导入 → ItemBrowser 显示真实图标。
- TS 侧零改动；`pnpm typecheck && pnpm build` 仍绿（回归确认）。

## 4. 契约与边界

- **裸 base64**，`resource_type='texture'`，列严格对齐下游（item_id/namespace/path/content）。
- **本期范围**：物理客户端 / 集成服导出物品最终态图标；专用服导出保留 layer0/约定路径离线降级。
- **推迟/不做**：PBO 异步 readback 优化；`recipe_views`/`recipe_view_backgrounds`（客户端渲染，`@OnlyIn(Dist.CLIENT)`，另立）；vanilla 在专用服缺客户端 assets 的补齐（建议从客户端跑 dump）。
- **不改** TS 下游（schema/importer/IPC/renderer 已就绪）；不改其它 Source；不改导出命令/触发机制。

## 4.1 客户端最终态渲染决策

补充决策（2026-06-15）：**不做"简单物品 / 复杂物品"分类**。该分类天然不完备，mod 可通过模型 override、tint、组件、BEWLR 或自定义客户端渲染改变最终图标，任何启发式都会漏。

新的正确性路径：

- 物理客户端 / 集成服导出：`ItemResourceCapture` 反射进入 client bridge，统一复用游戏客户端 `GuiGraphics.renderItem(...)` 渲染最终态图标。
- 专用服导出：没有客户端渲染上下文，回退到 `ItemResourceSource` 离线贴图提取；缺失仍跳过，IDE 显示占位。
- 下游契约不变：仍写 `item_resources(resource_type='texture')`，`content` 仍为最终 PNG 的裸 base64。

性能路径：

- 客户端渲染结果落盘缓存到 `<world>/mpide-exporter/icon-cache/v1/`，cache key 包含 `item_id`、默认组件 JSON、`modlist_hash`、MC 版本、客户端资源包列表、图标尺寸和 renderer 版本。
- cache miss 进入 `ClientIconRenderQueue`。队列在 `ClientTickEvent.Post` 分帧处理，每批使用 `1024x1024` 离屏 atlas，一次渲染最多 `16x16` 个 64px 图标，再一次 readback 后切成单 PNG。64px 是当前默认，主要为降低方块 3D 图标在 IDE 缩放时的模糊感。
- 离屏 atlas 必须复用 vanilla GUI 投影与 ModelView：`setOrtho(..., 1000, ClientHooks.getGuiFarPlane())`，并把 ModelView 平移到 `10000 - ClientHooks.getGuiFarPlane()`；否则 `GuiGraphics.renderItem` 的 z=150 会被裁剪，导出 PNG 表现为全透明。
- 后续如需进一步优化，可在该队列内部替换 readback 为 PBO；不影响 DB 契约和 Source 边界。

## 5. 完成定义（DoD）

1. `pnpm exporter:compile` 通过；ItemResourceSource 产出 `resource_type='texture'` 裸 base64 行。
2. 单人存档 dump → 导入 → ItemBrowser 多数物品显示真实图标，解析不到的回退占位、不报错、不阻断导出。
3. TS 侧 `pnpm typecheck && pnpm build` 不回归。

## 6. 完成记录

- 已实现 `ItemResourceCapture` 统一入口：客户端环境尝试 `ClientItemIconExportBridge` 渲染最终态图标，失败或非客户端环境回退 `ItemResourceSource` 离线提取。
- 已实现 `SqliteDatabase.writeItemResources(...)` 与 `Schema.UPSERT_ITEM_RESOURCE`，`ExporterService` 在导出流程中写入 `item_resources`。
- 下游契约保持不变：`resource_type='texture'`，`content` 为 PNG 裸 base64，IDE 通过既有 `items:get-texture` / `useTexture` / `ItemIcon` 直通显示。

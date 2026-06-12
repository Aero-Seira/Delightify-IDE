# 启动清单：代码现状审计 → MVP-0

> **给在本仓库开新对话的 Claude（与作者）。一次性。**
> 目的：在"设计代码结构 / 动手写"之前，**先摸清真实代码到底能跑什么**——产出一份"能用 / 半成品 / 待建"清单，再定 MVP-0 的实现结构。
> 完整规格已 vendored 到 **`docs/spec-snapshot/`**（`设计/01–10` + `例子`；只读快照，真相源仍是规划库 `设计/01`）。**本仓库的 `AGENTS.md`/`docs/`（除快照）/`README.md` 多为「规划/意图」，大部分未必实现——一律以代码 + 实跑结果为准。**

---

## 第 0 步 · 先跑起来

```bash
pnpm install
pnpm typecheck     # 类型是否通过 → 间接反映代码完整度
pnpm dev           # 或 pnpm dev:full → 应用能否启动？哪些页面能打开？
```
记录：能不能装、能不能编译、能不能起、起来后什么样。

## 第 1 步 · 按重要性读这些文件

**数据 / 导入（MVP-0 的地基）**
- `packages/main/src/services/database/schema.ts` — 实际建了哪些表？对照规格 [设计/06] 的设想（mods/items/recipes/tags/translations/textures + 有没有 relations/entities 图谱层）
- `services/database/{client,schema-manager,batch-save}.ts` — DB 怎么连 / 建表 / 批量写
- `services/mod-data-importer/{importer,validator,types}.ts` — **导入的是 JAR 还是预导出数据？** 提取了物品/配方/tag/材质里的哪些？
- `services/paths.ts` — 是否真有 global / project 两层路径
- `services/recipe-types/loader.ts` — 配方类型怎么加载（config/recipe_types）

**IPC + 页面（看闭环到哪）**
- `ipc/{items,recipes,mod-data}.ts` — 暴露了哪些能力
- 页面 `ModManager`（导入入口）、`ItemBrowser`、`RecipeBrowser` — 数据能否真正显示

**LLM / 转换（看 Agent 雏形）**
- `services/llm/{service,types}.ts` + `providers/` — 接了什么模型、做什么
- 页面 `ConversionTool` — "AI 辅助转换"实际做了什么

## 第 2 步 · 逐项验证功能点

每项标 **✅能用 / ⚠️半成品 / ❌没有**：
1. 导入一个真实 mod / 整合包 → 建库成功？
2. ItemBrowser 显示物品 + 图标？
3. RecipeBrowser 显示配方？
4. RecipeEditor 能编辑？
5. 有没有任何"导出 KubeJS / datapack"？（MVP-0 需要，规格 [设计/07]）
6. ConversionTool / LLM 能产出任何建议？
7. 有没有 data/semantic 关系系统的影子？（规格 [设计/03]/[设计/09] 的地基）

## 第 3 步 · 产出「现状审计」

一张表：`模块 × {能用/半成品/没有} × 与规格(设计/0X)的差距 × MVP-0 是否需要`。这是后续一切决策的依据。

## 第 4 步 · 据审计定 MVP-0 实现结构

**MVP-0**（规格 [设计/10] §2）= 离线灌一个真实整合包 → 目录/图谱 → **端到端跑通"统一同名物品"** → 可审 diff → **KubeJS 产物**。
据审计决定：**复用**哪些（importer / database / ItemBrowser 很可能可复用）、**重构**哪些、**新建**哪些（`unify` 引擎、KubeJS emitter、决策清单审阅 UI）。规格↔代码映射见 `CLAUDE.md`。

---

## 两条铁律

- **别信文档的"已完成"**——信代码 + 跑出来的结果。
- **安全纪律**（规格 [设计/01] §6）从第一天起：分类 → 置信×风险门 → 不确定就搁置 → diff → 可逆。绝不静默猜测。

> [设计/0X] 指 `docs/spec-snapshot/设计/` 下对应文档。

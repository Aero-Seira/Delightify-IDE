# Delightify M2 后续规划：v1 动作引擎落地

> 状态：规划（2026-06-15）。基线：MVP-0（= 规格 M1）已落地并验证（exporter v1 导入 / schema / importer / validator / 浏览层 v1 对齐 / unify query+dry-run / KubeJS emitter / 全部 IPC·preload·renderer / smoke）。本文不重列已完成项，只规划下一阶段。
> 依据：规格 `docs/spec-snapshot/设计/{02,04,07,10}` 与例子 `01/02/05`。代码事实优先于历史文档。
> 不要求重写 schema / importer / validator / unify / emitter / ConversionTool —— 下述全部为**增量扩展**。

---

## 1. 规格里程碑 ↔ 当前实现对应

规格路线图（`设计/10 §3`）用 M1–M7 命名，**M1 即 MVP-0**：

| 里程碑 | 规格定义 | 当前状态 | 说明 |
|---|---|---|---|
| **M1 = MVP-0** | unify 端到端：导入→图谱→一个工作流→可审 diff→KubeJS | ✅ **已完成** | 对应例03"统一所有铜锭"。已有 smoke 验收（含真实快照）。 |
| **M2** | 补齐 v1 原语 `scale/replace/remove·hide/retag/rename` + 复合 `harmonize/differentiate/constrain_inputs` | ⛏️ **本规划目标** | DoD = 例01/02/05 端到端跑通。依赖 `设计/03/04/07`。 |
| **M3** | 引导式规划模式（只读决策支持视图） | 未开始 | 例04"前期太肝"。依赖 M2 动作齐备 + `设计/05/08`。 |
| **M4** | Agent 主循环硬化（多信号置信 + 分类法 + 先查图谱） | 未开始 | 依赖 `设计/09`。**引入 LLM 在此阶段，不在 M2**。 |
| **M5** | 探测+搁置类 `add_bridge_recipe/change_recipe_type/add_item/remove_item`（仅探测建议） | 未开始 | M2 的复合动作会**产出指向 M5 的 deferred 建议**，但不执行。 |
| **M6**（条件） | runtime reload 通道 | 推迟 | 仅当离线缺口成真实瓶颈才启动。 |
| **M7**（条件） | 向量/嵌入检索 | 推迟 | 仅当词法+tag 检索不够。 |

当前代码相对 M1 的实现要点（作为 M2 的地基，**不动**）：
- `packages/main/src/services/unify/{query-service,dry-run-service}.ts`：unify 是**唯一**动作消费者；`UnifyDiffOperationKind = replace_recipe_input_item | replace_recipe_output_item | tag_input_reference | raw_unparsed_reference`；**仅 `replace_recipe_input_item` 进 changeSet**。
- `packages/main/src/services/export/kubejs-emitter.ts`：单文件 `kubejs/server_scripts/zzz_delightify_generated.js`，单 `ServerEvents.recipes(...)`；支持 `event.replaceInput`（稳）/`event.replaceOutput`（带保守 TODO，不入 changeSet）；marker `@delightify-generated`；覆盖/删除保护 + 幂等 revert。
- IPC：`unify:query`、`unify:dry-run`、`export:kubejs`、`export:kubejs:revert`。

> 结论：M1 的引擎是**unify 专用**的。M2 的本质工作是把它**通用化为一个确定性动作引擎 + 多动作 KubeJS emitter**，让 unify 之外的原语/复合都能复用同一条 dry-run→diff→export→revert 管线。

---

## 2. 命名建议：下一阶段叫 **M2**

- **采用规格的 M 编号**（`设计/01–10` 通用），下一阶段就叫 **M2**。不要另造一套 `MVP-1/MVP-2` 平行编号，避免与规格里程碑表脱节、造成"两套路线"混乱。
- 若需要面向用户的**发布标签**，定义为：**MVP-1 = M2 的可发布子集**（原语 `replace/retag/remove_recipe/rename` 全绿 + 至少一个新复合 `differentiate` 跑通例05）。即 MVP-1 是 M2 的一个发布切片，不是独立里程碑。
- 文档与代码注释统一用 **M2**；commit/PR 前缀建议 `feat(m2): ...`。

---

## 3. M2 设计原则（每个动作任务都必须满足的不变量）

来自 `设计/04`，作为所有 M2 任务的硬约束（验收时逐条核对）：

1. **引擎是纯函数**：`(图谱快照, ActionRequest) → 变更集(IR)`，不写源 JAR，只产覆盖产物 → 天然可逆。
2. **不确定就 defer，绝不静默**（`设计/04 §5`）：歧义、冲突、被引用仍要删/改 → 强制 `defer` + 完整引用清单。
3. **爆炸半径先算后提议**（`设计/04 §4`）：删除 / 改 tag / 跨 mod / 世界已放置（方块）→ 即使高置信也 `defer`。
4. **幂等**：动作以**原始基线**定义，同一请求重生成产物一致、不累积。
5. **生成物归 Delightify 所有**：带 marker、只覆盖 owned 文件、可逆（revert = 删 owned 文件集）。
6. **守恒型 1:1 转化遇 `scale` → 跳过 + 提示**（`设计/04 §5`）。
7. **后端表达不了的动作 → 明确报"需回退/人工"，不静默漏掉**（`设计/07 §2` 路由规则）。

M2 **不接 LLM**：动作由确定性 `ActionRequest`（UI/测试构造）驱动，引擎展开为原语。Intent Spec 解析 / 多信号置信 / 语义分类属 M4。

---

## 4. KubeJS 落地映射（M2 emitter 目标，来自 `设计/07 §3`）

| 动作 | KubeJS 映射 | 文件落点 | API 可靠性 |
|---|---|---|---|
| `replace_ingredient`(input) | `e.replaceInput(filter, from, to)` | `server_scripts/` | **稳**（已实现） |
| `replace_ingredient`(output) | `e.replaceOutput(filter, from, to)` | `server_scripts/` | ⚠️ 需核实，默认 defer |
| `remove_recipe` | `e.remove(filter)` | `server_scripts/` | **稳** |
| `retag` | `ServerEvents.tags('item', e => e.add/remove(tag, item))` | `server_scripts/` | **稳** |
| `rename`(显示名) | lang 覆盖 `kubejs/assets/<ns>/lang/<locale>.json`（不动 id） | `assets/` | 较稳（资源覆盖通用做法） |
| `scale` | 取原配方 → `e.remove(filter)` + 重建（recipe-type-aware） | `server_scripts/` | ⚠️ 按配方类型白名单，未知类型 defer |
| `remove(hide_in_jei)` | JEI 插件事件（client_script） | `client_scripts/` | ⚠️ 需核实，否则降级"仅探测" |

落点规则（`设计/07 §3`）：配方/tag → `server_scripts/`；lang → `assets/`；JEI 隐藏 → `client_scripts/`；注册类（add_item，M5）→ `startup_scripts/`。**M2 因此必须把单文件 emitter 扩展为多文件 fileset**。

---

## 5. M2 可执行任务清单（按依赖顺序）

格式：目标 / 涉及文件 / 验收 / 验证命令。每个任务小而可独立验证，遵循 §3 不变量。统一验证基线：`pnpm typecheck && pnpm build`，动作类任务额外加 smoke 断言。

### Layer 0 —— IR 与 emitter 通用化（地基，纯增量）

#### M2-T1：定义通用变更集 IR 与最小 ActionRequest
- 目标：在 unify 之外建立通用的动作/操作类型，使后续原语复用同一 IR；unify 现有输出仍合法（其 kind 是新 IR 的子集）。
- 涉及文件：
  - 新增 `packages/shared/src/types/engine.ts`：`ChangeOperationKind`（超集：`replace_recipe_input_item | replace_recipe_output_item | remove_recipe | retag_add | retag_remove | rename_lang | scale_recipe_field | hide_in_jei`，并保留只读 diff 用的 `tag_input_reference | raw_unparsed_reference`）、`ChangeOperation`、`ChangeSet`、`DecisionStatus('target'|'auto'|'deferred')`、`ActionRequest`（确定性：`{ action: 'replace'|'retag'|'remove'|'rename'|'scale'|'unify'|'differentiate'|'harmonize'|'constrain_inputs', params, scope }`）。
  - 新增 `packages/main/src/services/engine/ir.ts`：从 shared 复用类型 + 构造 helper。
  - `packages/shared/src/types/index.ts` 导出 engine 类型。
- 验收：`UnifyDiffOperation` 的现有 kind 是 `ChangeOperationKind` 子集（类型层面可赋值）；不改 unify 运行时行为。
- 验证：`pnpm typecheck && pnpm build && pnpm smoke:mvp0`（全部不变绿）。

#### M2-T2：emitter 多文件化（fileset）
- 目标：把 emitter 从"单文件单 ServerEvents.recipes"扩展为"按落点分组的 fileset 输出"，为 retag/rename/hide 铺路；保留现有 recipes 文件路径与行为。
- 涉及文件：
  - `packages/main/src/services/export/kubejs-emitter.ts`：新增 `GeneratedFile { relativePath, content, marker }` 概念与 `emitChangeSet(changeSet): GeneratedFile[]`；`server_scripts/zzz_delightify_generated.js`（recipes + tags）、`assets/<ns>/lang/<locale>.json`（rename）、`client_scripts/zzz_delightify_generated.js`（hide，若启用）。每文件带对应 marker。
  - `exportKubeJs`/`revertKubeJs`：对**一组** owned 文件写入/删除；revert 删除全部 owned 文件（lang json 用 JSON 注释不可行 → 用文件名约定 + 旁置 `.delightify-generated` 清单或固定路径白名单识别 owner）。
  - `packages/shared/src/types/export.ts`：`KubeJsExportResult` 增 `files: { filePath; operationCount }[]`（保持 `filePath` 兼容旧字段指向 recipes 文件）。
  - 同步 `packages/renderer/src/ipc/index.ts`、`mock.ts`。
- 验收：空 changeSet 不写任何文件；仅 recipes 操作时行为与现状一致（现 smoke 不变）；revert 删除全部 owned 文件且幂等。
- 验证：`pnpm typecheck && pnpm build && pnpm smoke:mvp0`。

#### M2-T3：通用 blast-radius / 风险服务
- 目标：所有动作共用的"爆炸半径 + 风险分级"服务，复用 unify 查询形态但**独立模块、不改 unify**。
- 涉及文件：新增 `packages/main/src/services/engine/blast-radius.ts`：`computeBlastRadius(db, target: {item|tag}) → { recipeRefsAsInput, recipeRefsAsOutput, tagConnectedRecipes, isBlock, crossMod, relatedUnparsed }`；`classifyRisk(...) → { severity, mustDefer, reasons[] }`（删除/改 tag/跨 mod/isBlock/unparsed → mustDefer）。
- 验收：fixture 单测，铜锭返回正确引用集与风险；is_block 物品触发 mustDefer。
- 验证：`pnpm typecheck && pnpm build`（+ 新增 smoke/单测断言）。

### Layer 1 —— 可靠 server 原语（KubeJS 服务端 API 稳，先做）

#### M2-T4：`retag` 原语
- 目标：实现 retag add/remove，emit `ServerEvents.tags`。
- 涉及文件：新增 `packages/main/src/services/engine/actions/retag.ts`（`{items[], tag, op:add|remove} → ChangeOperation[]`）；emitter 增 `retag_add/retag_remove` → `ServerEvents.tags('item', e => e.add/remove(tag, item))`（与 recipes 同文件）；调用 blast-radius 列出受影响配方（只读 diff）。
- 验收：dry-run 产出 retag 操作 + 受影响配方清单；导出文件含 `ServerEvents.tags` 块；revert 移除。
- 验证：`pnpm typecheck && pnpm build && pnpm smoke:m2`（见 T14）。

#### M2-T5：`remove_recipe` 原语
- 目标：实现 remove（强度=remove_recipe），emit `e.remove({id})`。
- 涉及文件：新增 `packages/main/src/services/engine/actions/remove.ts`（仅 `remove_recipe` 强度；`hide_in_jei`→T9，`remove_item`→M5 探测）。
- 验收：dry-run 产出 remove_recipe 操作；导出含 `e.remove(...)`；被其他配方引用的产物移除前先算 blast-radius、按 §3 规则该 defer 则 defer。
- 验证：`pnpm typecheck && pnpm build && pnpm smoke:m2`。

#### M2-T6：`replace_ingredient` 原语（从 unify 解耦）
- 目标：通用 from→to 替换，可作用任意配方范围，不再 unify 专用。
- 涉及文件：新增 `packages/main/src/services/engine/actions/replace.ts`（`{from:item|tag, to:item|tag, scope:input|output|both, filter}`）；input 复用现有 `replaceInput`；output 走 verification flag（默认 defer，呼应现有保守 TODO）。
- 验收：input 替换进 changeSet 并正确 emit；output 默认不入 changeSet（deferred + 理由）。
- 验证：`pnpm typecheck && pnpm build && pnpm smoke:m2`。

### Layer 2 —— 需核实 API 的原语（保守，必须核实 KubeJS，不准猜）

#### M2-T7：`rename` 原语（lang 覆盖）
- 目标：改显示名不动 id，生成 `kubejs/assets/<ns>/lang/<locale>.json`。
- 涉及文件：新增 `packages/main/src/services/engine/actions/rename.ts`（`{item, locale, new_name} → rename_lang ChangeOperation`）；emitter 在 assets 落点合并生成 lang json（多个 rename 聚合到同 locale 文件）。
- 注意：**核实 KubeJS 1.21 是否识别 `kubejs/assets/<ns>/lang/<locale>.json` 覆盖**；不确定就按标准资源包 lang json 生成（最通用做法）并加 TODO 说明加载机制，不要猜测专有 API。
- 验收：dry-run 显示 before→after 显示名；导出 lang json 含新名；revert 删除该 json。
- 验证：`pnpm typecheck && pnpm build && pnpm smoke:m2`（例05 大理石 rename 断言）。

#### M2-T8：`scale` 原语（recipe-type-aware）
- 目标：按原始基线缩放 output_count / time / energy，重建配方。
- 涉及文件：新增 `packages/main/src/services/engine/actions/scale.ts`（`{field, factor|delta, clamp, round}`）；emitter 对**已知 vanilla 配方类型白名单**（smelting/blasting/smoking/campfire 的 cookingtime/experience、crafting 的 result count）用 `e.remove(filter)` + 重建；**未知类型 → deferred**（"需回退/人工"）；守恒 1:1 转化识别并跳过（`设计/04 §5`）。
- 注意：**核实 KubeJS 各配方类型重建签名**；白名单外一律 defer，不猜测。
- 验收：smelting time 缩放生成 remove+重建；未知类型产出 deferred；同请求重跑产物一致（幂等）。
- 验证：`pnpm typecheck && pnpm build && pnpm smoke:m2`（例01 面食含 scale 断言）。

#### M2-T9：`remove(hide_in_jei)` 强度（client_script）
- 目标：JEI 隐藏（非注册移除）。
- 涉及文件：扩展 `actions/remove.ts` + emitter client_scripts 落点。
- 注意：**核实 KubeJS 1.21 JEI 插件隐藏事件**；若不可靠表达，**降级为仅探测+搁置（不生成）**并文档化（`设计/07 §6` hide 在 JEI/REI/EMI 的差异）。
- 验收：要么生成 client_scripts hide 块 + revert，要么明确产出 deferred + 文档说明降级原因。
- 验证：`pnpm typecheck && pnpm build && pnpm smoke:m2`。

### Layer 3 —— 复合动作（编排原语，DoD 对齐例子）

#### M2-T10：`constrain_inputs`（输入集校正）
- 目标：把宽 tag 换成精选列表 / 经 retag 调整 tag 成员（例02 #3 油）。
- 涉及文件：新增 `packages/main/src/services/engine/composites/constrain-inputs.ts`，编排 `replace_ingredient`(tag→精选) 或 `retag`。
- 验收：例02 油的输入集校正 fixture 跑通；展开过程对作者透明（diff 列出展开的原语）。
- 验证：`pnpm typecheck && pnpm build && pnpm smoke:m2`。

#### M2-T11：`differentiate`（区分 + 链整合）
- 目标：retag 拆子 tag + rename 不同变体 + 链整合（replace）（例05 大理石 / 例03 低高纯铜）。
- 涉及文件：新增 `composites/differentiate.ts`，编排 `retag` + `rename` + `replace_ingredient`；命名风格属作者判断 (c) → 默认给一套并 `defer` 供改名（例05 #0）。
- 验收：例05 fixture：生成多条 rename(lang) + retag，diff 含 differentiate 展开；不删除、不合并；`create:marble` 等有功能用途者保功能引用。
- 验证：`pnpm typecheck && pnpm build && pnpm smoke:m2`。

#### M2-T12：`harmonize`（离群对齐）
- 目标：replace_ingredient(+ change_recipe_type 若在范围) 对齐离群配方（例01/02）。
- 涉及文件：新增 `composites/harmonize.ts`；`change_recipe_type` 属 M5 → 在 harmonize 内**只产出 deferred 建议**，不执行。
- 验收：例01 离群配方 harmonize 跑通；change_recipe_type 需求进 deferred。
- 验证：`pnpm typecheck && pnpm build && pnpm smoke:m2`。

> `unify` 已在 M1 完成，**不重写**。可选（非必须、低优先）：让 unify 复用 T1 IR 与 T3 blast-radius 以统一代码路径，标记为 `M2-后续可选`，不阻塞 M2 DoD。

### Layer 4 —— UI 与验收

#### M2-T13：动作驱动 UI（增量，不重写 ConversionTool）
- 目标：从 UI 触发原语/复合的 dry-run→diff→export(fileset)→revert。
- 涉及文件：扩展 `packages/renderer/src/pages/ConversionTool/`（新增 action 选择/参数区，复用现有决策清单/diff 组件）或新增 `pages/ActionWorkbench/`（二选一，**增量**）；新增/扩展 IPC（如 `engine:dry-run`、复用 `export:kubejs`）。
- 验收：能从 UI 完成 retag / rename / differentiate 的 dry-run → 导出 → 撤销，多文件产物正确显示。
- 验证：`pnpm typecheck && pnpm build`。

#### M2-T14：M2 smoke 验收脚本
- 目标：例01/02/05 的 fixture 端到端 + 多文件生成/撤销 + deferred 断言。
- 涉及文件：新增 `scripts/smoke-m2-actions.mjs`，根 `package.json` 增 `smoke:m2`；构造含同名大理石 / 面食链 / 油配方的 fixture。
- 验收：`pnpm smoke:m2` 全绿；覆盖每个原语至少一条 + 三个复合 + deferred（change_recipe_type / output 替换 / 未知 scale 类型）+ fileset revert 幂等。
- 验证：`pnpm typecheck && pnpm build && pnpm smoke:m2`。

---

## 6. 依赖图（执行顺序）

```
T1(IR) ─┬─> T2(fileset emitter) ─┬─> T7(rename/lang)
        │                        └─> T9(hide/client)
        └─> T3(blast-radius) ──> T4(retag) ─┐
                                  T5(remove) ─┤
                                  T6(replace)─┼─> T10(constrain_inputs)
                                              ├─> T11(differentiate) ──> T13(UI) ──> T14(smoke:m2)
                                              └─> T12(harmonize)
```
- 关键路径先做 **T1→T2→T3**（地基），再做 Layer1 稳原语（T4/T5/T6），再 Layer2 需核实原语（T7/T8/T9），最后复合（T10–T12）→ UI（T13）→ 验收（T14）。
- **MVP-1 发布切片** = T1–T7 + T11（differentiate 跑通例05）+ T13/T14 子集。scale(T8)/hide(T9) 因 API 不确定可作为 M2 收尾或 MVP-1.1。

---

## 7. 明确不纳入 M2（及理由）

| 项 | 处置 | 理由 |
|---|---|---|
| LLM Agent 主循环 | M4 | M2 是确定性引擎，动作由 ActionRequest 驱动，不需 LLM。引入 LLM 会越级。 |
| 向量检索 / 本地 embedding | M7（条件） | 词法 + tag 检索对 M2 动作足够。 |
| datapack emitter | v1.x | v1 用 KubeJS 兜底（`设计/07 §2` 能力矩阵）。 |
| Almost Unified emitter | v1.x | 同上；AU 仅能表达 unify 子集。 |
| `add_item` 实际生成 | M5 + 单独立项 | 涉及注册/材质/模型，是另一条工程线；v1 仅探测建议。 |
| `add_bridge_recipe` / `change_recipe_type` / `remove_item` 执行 | M5 探测+搁置 | 爆炸半径最高；M2 复合**只产出 deferred 建议**，不执行（例02 桥接、例05 被否的删除即此类）。 |
| exporter 贴图导出（`item_resources.texture`） | exporter 侧未来项 | 已确认是 exporter 尚未写 item_resources，非 importer/renderer 漏接；图标空白可接受，不在 M2。 |
| runtime reload 通道 | M6（条件） | 仅当离线缺口成真实瓶颈才启动。 |
| 引导式规划模式 | M3 | 依赖 M2 动作齐备后才有意义。 |
| 重写 unify / emitter / ConversionTool / schema / importer / validator | 不做 | 全部以增量扩展实现。 |

---

## 8. M2 完成定义（DoD）

1. `设计/04` 的 v1 原语 `scale/replace_ingredient/remove(hide+recipe)/retag/rename` 与复合 `harmonize/differentiate/constrain_inputs` 均有确定性实现，落 KubeJS（hide/scale 若 API 不可表达则明确降级 deferred 并文档化）。
2. 例 01 / 02 / 05 能在 `pnpm smoke:m2` 中端到端跑通：dry-run 决策清单（含 deferred）→ 多文件 KubeJS 产物 → 一键撤销，引用正确、幂等。
3. 所有动作遵守 §3 七条不变量；删除/改 tag/跨 mod/世界已放置一律 defer + 完整引用清单。
4. `pnpm typecheck && pnpm build && pnpm smoke:mvp0 && pnpm smoke:m2` 全绿。
5. 未触动 M1 已交付组件的既有行为（unify/ItemBrowser/RecipeBrowser/导入回归不破坏）。

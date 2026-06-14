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

---

## 9. T1–T3 地基审查（2026-06-15，基于提交 `3bce0ad`）

T1–T3 已实现并通过 `typecheck/build/smoke:mvp0/smoke:m2:blast-radius`。审查结论：**合格，符合本规划与 §3 七条不变量，可在其上做 T4–T6。**

- **T1 IR**（`packages/shared/src/types/engine.ts` / `packages/main/src/services/engine/ir.ts`）：`ChangeOperationKind` 为超集；用 `AssertAssignable<…, ChangeOperation>` 两条类型断言**编译期**钉死 unify op 可赋值性（比规划更稳）；unify 运行时零改动。
- **T2 fileset emitter**（`kubejs-emitter.ts`）：owner 双轨识别正确（脚本类文件内 marker / lang json 用旁置清单 `kubejs/.delightify-generated.json` + 路径白名单）；revert 强制纳入 legacy recipes 路径、幂等；空 changeSet 不写文件；仅 recipes 时产物与现状一致。
- **T3 blast-radius**（`blast-radius.ts`）：item/tag 双路径覆盖直接 input / output / tag 连带 / `raw_json LIKE` 未结构化关联；`classifyRisk` 规则与不变量②③对齐。

### 做 T4 前需注意的 3 个点

1. **`emitChangeSet` 对未知 kind 是 `throw` 非 defer**（`kubejs-emitter.ts`）：T4 把 `retag_add` 放进 changeSet 前**必须先扩 `emitChangeSet`**（硬依赖，已计入 T4）。
2. **多文件导出无「孤儿清理」**：重生成只覆盖当前 fileset 并以之覆盖清单，旧 fileset 不再产出的文件（如 T7 换 locale 的旧 lang json）会变孤儿、revert 漏删，违反幂等。**T4–T6 不触发**（均落单文件），但**列为 T7 前置**：导出时 diff(旧清单, 新 fileset) 删孤儿。
3. **`classifyRisk` 把「改 tag」无条件判 `mustDefer`**：符合规格 §4，因此 **retag/remove 形态 = 探测→搁置→确认→才进 changeSet→才 emit**，非直接 auto。下列 T4/T5 据此设计。

> 另记（非阻塞）：emitter 用 `new Date().toISOString()` 写时间戳 → 产物非字节级幂等。owner/revert 不受影响；smoke 比对需忽略时间戳行。列为 T7 前置一并处理。

## 10. T4–T6 细化（小步可验证）

**贯穿决策（规格 §4）**：删除/改 tag → 即便高置信也 defer。故 retag(T4)、remove(T5) 形态为：dry-run 产 **deferred** 决策 + 完整受影响引用清单（`includedInChangeSet=false`）→ 显式 `confirmedOperationIds` 确认 → 翻转进 changeSet → 导出才 emit。replace(T6) 的 input 替换可 auto（复用 unify 判据），output 恒 deferred。smoke 必须同时覆盖「默认 deferred」与「确认后 emit」两条路径。

### T4 `retag`
- 新增 `packages/main/src/services/engine/actions/retag.ts`：`planRetag(db, { items, tag, op:'add'|'remove', confirmedOperationIds? }) → { operations, blast, risk }`；每 item 产 `retag_${op}` op，`before:{tag,item,op}`；调 `computeBlastRadius({kind:'tag',ref:tag})` + `classifyRisk({action:'retag'})`；默认全 deferred，`confirmedOperationIds` 翻转；跨 mod/unparsed/isBlock 不可被 confirm 覆盖。
- `kubejs-emitter.ts`：`emitChangeSet` 分组——recipe 类 → `ServerEvents.recipes` 块；retag 类 → 同文件追加 `ServerEvents.tags('item', e => e.add/remove(tag,item))` 块；**无 retag op 时产物逐字节同现状**；op 按 `tag,item` 排序保幂等。
- smoke `scripts/smoke-m2-retag.mjs`（`smoke:m2:retag`）：默认 deferred + 引用清单非空；confirm 后导出含 `ServerEvents.tags`；revert 幂等；回归 recipes-only 产物。

### T5 `remove_recipe`
- 新增 `packages/main/src/services/engine/actions/remove.ts`：`planRemoveRecipe(db, { recipeIds, confirmedOperationIds? }) → { operations, downstream, risk }`；每 recipe 产 `remove_recipe`（`recipeId` 必填）；下游半径 = 读该配方 `recipe_outputs`，对每个 output item 调 `computeBlastRadius({kind:'item'})` 汇总下游 input 引用；任一下游引用/unparsed → 强制保留 deferred（§5）；仅 `remove_recipe` 强度（hide→T9、remove_item→M5 不做）。
- `kubejs-emitter.ts`：`emitRecipeOperation` 增 `remove_recipe` → `event.remove(recipeFilter)`，落 `ServerEvents.recipes` 块（复用 `recipeFilter`）。
- smoke `scripts/smoke-m2-remove.mjs`（`smoke:m2:remove`）：无下游引用可 confirm → 含 `event.remove({id})`；有下游引用即便 confirm 仍 deferred + 完整清单；revert 幂等。

### T6 `replace_ingredient`（从 unify 解耦，不改 unify）
- 新增 `packages/main/src/services/engine/actions/replace.ts`：`planReplace(db, { from, to, scope:'input'|'output'|'both', filter? }) → { operations, blast, risk }`；input 用 `computeBlastRadius(from)` 取 `recipeRefsAsInput` 逐条产 `replace_recipe_input_item`，auto 判据复用 unify 标准（低风险∧无 output 引用∧无 unparsed∧非 isBlock）；output 产 `replace_recipe_output_item` 但**恒 `includedInChangeSet=false`+reason**（呼应保守 TODO）。
- emitter：input 已支持无需改；output 休眠。
- smoke `scripts/smoke-m2-replace.mjs`（`smoke:m2:replace`）：input 低风险进 changeSet 含 `replaceInput`；`scope:'output'` op 不入 changeSet、不导出；跨 mod/unparsed 时 input 也降级 deferred。

### 顺序与边界
- 顺序 **T4 → T5 → T6**：T4 顺手把 `emitChangeSet` 扩成「分组多事件块 + 未知 kind 仍 throw」，T5/T6 复用。
- 不碰 rename/scale/hide/复合/UI/LLM；不重写 schema/importer/validator/unify/ConversionTool；孤儿清理与字节幂等列 T7 前置、本批不实现（T4–T6 均单文件不触发）。

---

## 11. T4–T6 审查与 T7 前置（2026-06-15，基于提交 `eb83aa2`）

T4–T6 已实现并通过 `typecheck/build/smoke:mvp0/smoke:m2:blast-radius/smoke:m2:retag/smoke:m2:remove/smoke:m2:replace`。审查结论：**通过，符合规格 §4 与七条不变量。**

- **默认 deferred + confirm 翻转**（`retag.ts:74`、`remove.ts:278`）：`includedInChangeSet = requestedConfirm && !forceDeferred`，无 confirm 默认全 false。✅
- **强风险不可被 confirm 覆盖**：retag 的 `forceDeferred = crossMod|relatedUnparsed|isBlock`；remove 的 `forceDeferred = 产物有下游 input 引用|关联 unparsed`（且排除被删配方自引用 `remove.ts:260`）。命中即 false 无视 confirm，smoke 已断言。✅
- **emitter recipe-only 逐字节兼容**：`emitServerScriptsFile` 在无 retag op 时回退原 `emitRecipesFile`；retag smoke 用 `assertRecipeOnlyOutputUnchanged()` 精确比对钉死。✅
- 提示（非回归）：T2 起任何非空导出都附带写 `kubejs/.delightify-generated.json` ledger（脚本 `.js` 内容仍逐字节一致，revert 清理）。

### T7 前置（必须先做，再做 rename）
1. **孤儿清理**：`exportKubeJs`（`kubejs-emitter.ts:280-299`）只写当前 fileset 并覆盖清单，**旧清单里这轮不再产出的 owned 文件不会被删**。单文件不触发，多 locale lang 必触发。→ 写入前 `diff(旧清单, 新 fileset)`，删旧清单中已不在新 fileset 的 owned 文件。
2. **字节幂等**：`exportKubeJs` 内部用 `new Date().toISOString()`，产物非字节稳定。→ `exportKubeJs` 接受可选 `generatedAt`（`emitChangeSet` 已支持），smoke 注入固定值断言两次产物相同。

### 低危 latent（不阻塞 T7，T10 复合前必处理）
1. **tag-scoped replace 缺 `#` 前缀**：`planReplace` 对 `from.kind==='tag'` 取裸 tag id，emit 成 `replaceInput({id}, "forge:...", …)` 会被当物品。当前 smoke 仅 item→item 未暴露。**T10 `constrain_inputs`（tag→精选）必须修**。
2. **replace 无 confirm 通道**：retag/remove 有 `confirmedOperationIds`，replace 是 auto-or-defer，deferred 的 input 替换无补救路径。T11/T12 编排 replace 前给 replace 也加 `confirmedOperationIds`（强风险仍不可覆盖）。
3. **retag ADD 的 crossMod 漏计被加入项**：`computeBlastRadius({kind:'tag'})` 只统计现有成员 modid，不含正在 add 的新成员。危害低，记录即可。

## 12. T7 细化（rename/lang + 两个前置）

> 形态：rename 只改 lang 显示名、不动 id（规格 §3/§4 → 低风险可逆，可 auto，不强制 defer）。本任务首次真正启用 fileset 多文件路径，故先补 T7 前置-1/2。

### T7-a 前置：fileset 孤儿清理 + 字节幂等
- `kubejs-emitter.ts`：`exportKubeJs(projectPath, params, options?: { generatedAt?: string })`；写入前读旧清单，计算 `旧清单.files \ 新 fileset` 的 owned 文件并删除（走与 revert 相同的 owner 校验/白名单）；时间戳改用 `options.generatedAt ?? new Date().toISOString()`。
- 同步 `KubeJsExportParams`/IPC/`renderer mock` 若签名变动（优先用 options 不破坏既有 IPC）。
- smoke `scripts/smoke-m2-fileset.mjs`（`smoke:m2:fileset`）：先导出 A（含 lang en_us）→ 再导出 B（仅 lang zh_cn）→ 断言 en_us 被回收、zh_cn 存在；固定 `generatedAt` 两次导出产物逐字节相同。

### T7-b rename 原语
- 新增 `packages/main/src/services/engine/actions/rename.ts`：`planRename(db, req: { items: { item, locale, newName }[] }) → { operations, blast, risk }`；每项产 `rename_lang` op，`before:{ item, locale, oldName? }`、`after:{ item, locale, newName }`；rename 仅动 lang → 默认可 auto（`includedInChangeSet=true`），但 blast 仍列出该物品引用供审阅。
- `kubejs-emitter.ts`：`emitChangeSet` 增 lang 落点——把同一 `locale` 的多条 `rename_lang` 聚合进 `kubejs/assets/<ns>/lang/<locale>.json`（`<ns>` 取自 item 的 modid 或固定 `delightify`，按 KubeJS 资源覆盖惯例；**核实 KubeJS 1.21 是否识别 `kubejs/assets/<ns>/lang/*.json` 覆盖，不确定就按标准资源包 lang json 生成并加 TODO，不猜专有 API**）。lang json owner 经清单登记（无内嵌 marker）。
- smoke `scripts/smoke-m2-rename.mjs`（`smoke:m2:rename`）：dry-run 显示 before→after 显示名；导出 lang json 含新名 + 经清单 owner；revert 删该 json；多 locale 聚合正确；配合 T7-a 验证孤儿清理。

### 边界
- 只做 rename + 两个前置；不碰 scale/hide/复合/UI/LLM；不重写 schema/importer/validator/unify/ConversionTool。
- tag-replace `#` 前缀、replace confirm 通道留待 T10 前处理。

> **T7 状态**：✅ 已完成并提交（`1c6f4f3`，含 T7-a 孤儿清理 + 可注入 generatedAt、T7-b rename/lang）。lang 加载机制按标准资源包 JSON + KubeJS 1.21 待核实 TODO。

---

## 13. 路线调整：输出层后置（2026-06-15 决定）

**决定**：把「编辑与导出」这一**具体后端层**（KubeJS 精确发射、scale 重建签名、JEI 隐藏、datapack/AU、真正写盘的导出 UI，以及可能借用现有模组手段 / 更换后端）整体**收口为最后一个里程碑「输出层」，技术栈待进一步讨论后再实现**。引擎层（IR）继续推进。

**为何不需要回退**：T1 定的 `ChangeOperation/ChangeSet` 就是**后端无关 IR**——引擎只把动作展开成 IR + dry-run/diff/blast/defer，emitter 只是 IR 的一个消费者。IR 即接缝，输出技术栈日后插入这个接缝即可。

**冻结范围（用户确认）**：只冻结**不确定的发射**；**保留现有可用产物**——`replace_input / remove_recipe / retag / rename` 的现有 KubeJS 发射已测试可用，保留不动。

### 重排后的两层结构

| 层 | 内容 | 何时做 |
|---|---|---|
| **引擎层（IR，现在继续）** | 复合 T10–T12（IR 编排原语 + 产 deferred 建议）；T8 scale / T9 hide 的 **语义部分**（IR op + dry-run + blast + defer，发射留空）；replace confirm 通道补全 | 现阶段 |
| **输出层（最后做，技术栈待定）** | scale 重建发射、JEI 隐藏发射、datapack/AU emitter、真正写盘的「导出/编辑」UI、tag-replace `#` 前缀、可能的后端换型/借现有模组 | 技术栈定案后 |

- T8/T9 在引擎层只产 `scale_recipe_field` / `hide_in_jei` 的 IR + 风险/defer 判定；其 **KubeJS 发射**归输出层。
- 复合层验收改为 **IR 级 smoke**（断言 operations / included-deferred / blast / deferred 建议），不依赖 emitted 文本——这样不与未定的后端耦合。能稳定发射的部分（retag/rename/replace input）可选附带发射断言。
- **MVP-1 发布切片**定义顺延：因「真正导出」属输出层，MVP-1（可发布切片）在输出层定案后才成立；在此之前以「引擎层 IR + IR 级验收」为阶段性 DoD。

### 下一阶段：复合动作（IR 层）

#### 前置 · replace confirm 通道
- `replace.ts`：`planReplace` 增 `confirmedOperationIds?`，对 deferred 的 input 替换支持显式确认翻转；**强风险（跨 mod/unparsed/block/output）仍不可被覆盖**（与 retag/remove 对齐）。复合编排 replace 时需要它。

#### T10 `constrain_inputs`（输入集校正，IR 层）
- 新增 `packages/main/src/services/engine/composites/constrain-inputs.ts`：`planConstrainInputs(db, req) → { operations, deferredSuggestions, blast }`，编排 `planReplace`(tag→精选 item 列表) 或 `planRetag`(调 tag 成员)；脂肪→荤油类「桥接」→ 产 `add_bridge_recipe` **deferred 建议**（M5，不执行）。
- 验收 smoke `smoke:m2:constrain`：例02 油 fixture，IR 级断言展开的原语 op + deferred 建议；展开对作者透明（operations 可枚举）。

#### T11 `differentiate`（区分+链整合，IR 层）
- 新增 `composites/differentiate.ts`：编排 `planRetag`(拆子 tag) + `planRename`(变体名) + `planReplace`(链整合)；命名风格属作者判断 (c) → 默认给一套 + 产 `naming_style` deferred 建议；`create:marble` 等有功能用途者保功能引用、不删不合并。
- 验收 smoke `smoke:m2:differentiate`：例05 大理石 fixture，IR 级断言多条 rename_lang(auto) + retag(defer) + deferred 建议；不出现删除/合并 op。

#### T12 `harmonize`（离群对齐，IR 层）
- 新增 `composites/harmonize.ts`：编排 `planReplace` 对齐离群配方；`change_recipe_type` 属 M5 → 产 deferred 建议不执行。
- 验收 smoke `smoke:m2:harmonize`：例01 离群配方 fixture，IR 级断言 replace op + `change_recipe_type` deferred 建议。

#### 复合层公共类型
- `packages/shared/src/types/engine.ts` 增 `DeferredSuggestion { kind: 'change_recipe_type'|'add_bridge_recipe'|'naming_style'|'add_item'|'remove_item'; target?; reason; references? }` 与 `CompositeResult { operations: ChangeOperation[]; deferredSuggestions: DeferredSuggestion[]; blast?: ... }`。

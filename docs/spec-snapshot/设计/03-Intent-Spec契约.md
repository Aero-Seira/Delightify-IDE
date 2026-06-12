---
up: "[[01-核心设计与决策模型]]"
tags: [project, minecraft, ide, design, spec]
---

# Intent Spec（意图规格 / 决策清单契约）—— v0 草案

> **状态**：v0 草案。这是 LLM/Agent 与确定性引擎之间的**契约**，也是作者在闸门1看到、可审可改的东西。本文内嵌的两个决策 **#2 分类法形态**、**#3 目标模式** 已于 2026-06-12 确认（下方标 ✅已定）。
> 依赖：动作清单见 [[02-动作词汇表与分类法]]；管线与安全纪律见 [[01-核心设计与决策模型]]。

---

## 1. 它是什么、在哪一环

```
目标 → [LLM/Agent: 召回→分类→决策] → ★ Intent Spec ★ → 闸门1(作者审) → 引擎执行 → diff → 闸门2 → 产物
```

**Intent Spec = Agent 对"要在全包做哪些改动"的完整、结构化、可审的陈述**。它有三个硬要求：
1. **可读可改**：老手能扫一眼看懂、就地纠正（闸门1）。
2. **目标无关于后端**：同一份 Spec 可被 KubeJS / datapack / AU 等多个 emitter 消费（编译器 IR）。
3. **确定性可执行**：引擎不需再做 AI 判断即可编译。

---

## 2. 顶层结构

```yaml
intent_spec:
  task:
    user_input: "<作者原话>"
    goal_modes: [...]          # 目标模式（见 §6），含 Agent 推断 + 头号假设
    style_profile_ref: "<风格档案>"   # 可选，见 §6
    assumptions:               # 头号"可改假设"，闸门1首先确认
      - "<Agent 对目标的理解，作者可改>"
  recall:                      # 召回透明（杜绝静默截断）
    seeds: [...]               # 展开出的种子概念
    scope_note: "经 X 种子 / Y tag 命中 N 个对象"
    matched_count: N
  decisions: [ <决策条目>, ... ]      # 逐案决策清单，见 §7
  deferred:   [ <待裁决条目>, ... ]   # 待裁决队列，见 §8
  aggregate_findings: [ ... ]         # 聚合级发现（如"厨锅被滥用"），见 设计/02 §3
```

> 引导式规划模式下（见 [[05-引导式规划模式|设计/05]]）**不产出 decisions**，而是产出"决策支持视图"；Intent Spec 只在执行型任务里生成。

---

## 3. 选择器语言（Selector）——「反 Ctrl+F」核心

选择器寻址一个**可枚举、可预览**的对象集合（物品 / 配方 / tag）。**决策（拟定）**：v1 用**固定类型 + 布尔组合**，先不做任意自由查询。

| 选择器 | 含义 | 例 |
|---|---|---|
| `by_id` | 按注册名（含通配 `*`） | `create:*` |
| `by_tag` | 按 tag | `#forge:ingots/copper` |
| `by_mod` | 按来源 mod | `mod:create` |
| `by_type` | 按配方类型/机器 | `type:create:mixing` |
| `by_graph` | 按图谱关系 | `output_in:#forge:dough` / `references:minecraft:wheat` / `depth<=2` / `unused`（无引用） |
| `by_name_semantic` | 按显示名语义（LLM 辅助成组） | `name~"面条"` |
| `by_semantic_family` | 产物语义家族（LLM 成组） | `family:"鸡腿料理"` |
| `by_equivalence_class` | 配方等价类（同逻辑步骤不同形态） | `eqclass:"裹糊步"` |
| `by_category_template` | 品类 + 规范链模板 | `category:"炸制食品"` |

- **组合**：`AND / OR / NOT`，集合运算。
- **可预览**：任一选择器必须能就地解析出"匹配 N 项"并带图标列出（闸门1 之前）。这是卸载"查"的关键。
- 后四种偏语义、需 LLM 辅助成组 → 成组结果本身要可审、可改。

---

## 4. ✅已定 · 决策 #2：分类法形态

**我的推荐：固定的小枚举（多facet）+ 每个 facet 允许 `其它(说明)` 逃生口**。可控、可测，又不被框死。分类是"先分类再动作"里人能一眼复核的最小单元。

```yaml
classification:           # 一个对象贴这几个正交 facet
  domain:    in | out | uncertain          # 目标语义域内 / 域外(跳过) / 存疑
  role:      raw | intermediate | product | standalone | other(说明)   # 链中角色
  mechanism: handcraft | automated | magic | vanilla | other(说明)     # 机制形态
  status:    ok | needs_fix | other(说明)  # 优化状态
  fix_kind:  [wrong_input | wrong_type | inconsistent | redundant | incomplete_chain]  # 仅 needs_fix 时
  redundancy: true_redundant | meaningful_variant | n/a   # 真冗余 vs 有意义区分（定 unify/differentiate）
```

> 例：`面粉--锅煮-->熟面条` 的"面粉输入"= `{domain:in, role:intermediate, mechanism:handcraft, status:needs_fix, fix_kind:[wrong_input]}`。
> `面团--魔法转化-->造物面包` = `{domain:out, mechanism:magic}` → 跳过。

**为何不用开放标签**：开放标签灵活但**无法测**（每个例子的期望分类对不上就没法验证），且会让置信/路由难以稳定。`其它(说明)` 已给足逃生空间，真出现高频的"其它"再把它升格为正式枚举值。

---

## 5. ✅已定 · 决策 #3：目标模式（Goal Mode）

**我的推荐：Agent 推断本次命中哪些目标模式 → 列为 `assumptions` 头号可改项 → 同时在 UI 提供显式勾选作捷径**。既不强迫作者每次填表，又不让 Agent 闷头猜到底。

目标模式取值（来自 [[02-动作词汇表与分类法|设计/02 §2]]，可多选）：
`语义贴切 | 合理性/常识 | 完备性 | 一致性 | 风格贴合 | 去重统一 | 数值平衡 | 清理`

```yaml
goal_modes:
  inferred: [语义贴切, 一致性]      # Agent 推断
  confidence: 中
  shown_as_assumption: true         # 闸门1 首条："我把'优化'理解为求 语义贴切+一致性，可改"
  user_override: null               # 作者显式勾选则覆盖
```

> **风格档案**是合理性/风格贴合判断的前提（写实风 ⇒ 余烬面粉无效）。它是作者**一次性声明、全局复用**的对象，被目标模式引用。

---

## 6. 决策清单条目（每案一条）

```yaml
- id: d1
  object:        "<选择器解析出的具体对象>"   # 如 配方 `小麦--合成-->面团`
  source_intent: "<由作者哪句话/哪个目标模式驱动>"   # 溯源
  classification: { ... }            # §4
  action:                            # 动作 + 参数（动作清单见 设计/02 §3）
    verb: replace_ingredient
    params: { from: minecraft:wheat, to: create:wheat_flour }
  rationale:     "<语义线索：为什么这么判>"
  confidence:    高 | 中高 | 中 | 中低 | 低     # 见 §8
  confidence_signals: [name, tag, type, graph]   # 多信号一致性的来源
  risk:          低 | 中 | 高                    # 爆炸半径/可逆性
  blast_radius:  { refs: N, placed_in_world: bool, cross_mod: bool }   # 高风险时必填
  disposition:   auto | defer | skip             # 由 置信×风险 双门路由（设计/01 §4）
  cascades:      [ <因本条引发的连带条目 id> ]   # 如 替换→孤立物品→可清理
```

**路由规则**（复述 [[01-核心设计与决策模型|设计/01 §4]]）：高置信 & 低风险 → `auto`；其余 → `defer`；域外 → `skip`。删除/改tag/跨mod/世界已放置 → 即使高置信也 `defer`。

---

## 7. 待裁决队列条目

```yaml
- id: q1
  situation:   "<为什么需要你定>"
  options:     [ {label, effect}, ... ]
  recommend:   "<Agent 暂定推荐 + 一句理由>"
  why_unsure:  "<不确定来源：多信号冲突 / 多个合理选项 / 高爆炸半径 / 属设计判断(c)>"
  blocks:      [ <受此裁决影响的 decision id> ]   # 裁决前这些条目不落地
```

> 队列在**任务其余部分完成后**集中呈现（作者不被打断）。每条都给"暂定推荐"，让作者多数时候只需点头。

---

## 8. 置信与风险

- **置信不靠 LLM 自报**，靠**多信号一致性**：`名称语义 + tag + 配方类型/机器 + 图谱位置` 四者同向 → 高；相互冲突 → 自动降级、进 `defer`。`confidence_signals` 记录哪些信号支持本判断（可审）。
- **风险 = 爆炸半径 × 可逆性**：替换原料（可逆、本地）= 低；改 tag / 删配方 = 中；删物品 / 改注册 / 世界已放置方块 = 高。

---

## 9. 完整实例（用 [[01-优化所有面食配方|例子01]] 渲染成 Intent Spec，兼作验证）

```yaml
intent_spec:
  task:
    user_input: "优化整合包内所有面食的配方"
    goal_modes: { inferred: [语义贴切, 去重统一], confidence: 中, shown_as_assumption: true }
    style_profile_ref: "写实烹饪向"
    assumptions: ["把'优化'理解为：用语义最贴切的中间产物 + 合并功能重复物品（可改）"]
  recall:
    seeds: [flour, dough, noodle, 馒头, pasta]
    scope_note: "经 5 种子展开命中 4 配方 / 9 物品"
    matched_count: 13
  decisions:
    - { id: d1, object: "小麦--合成-->面团",
        classification: {domain: in, role: intermediate, mechanism: handcraft, status: needs_fix, fix_kind: [wrong_input]},
        action: {verb: replace_ingredient, params: {from: minecraft:wheat, to: create:wheat_flour}},
        rationale: "面团应源于面粉而非整粒小麦", confidence: 高, confidence_signals: [name, graph], risk: 低, disposition: auto }
    - { id: d2, object: "面粉--锅煮-->熟面条",
        classification: {domain: in, role: intermediate, status: needs_fix, fix_kind: [wrong_input]},
        action: {verb: replace_ingredient, params: {from: create:wheat_flour, to: "<面条·见q1>"}},
        rationale: "煮面输入应是生面条而非面粉", confidence: 高, risk: 低, disposition: auto }
    - { id: d3, object: "面团--蒸-->馒头",
        classification: {domain: in, role: intermediate, status: needs_fix, fix_kind: [wrong_input]},
        action: {verb: replace_ingredient, params: {from: create:dough, to: bakery:fermented_dough}},
        rationale: "馒头是发酵面食", confidence: 中高, risk: 低, disposition: auto, cascades: [q2] }
    - { id: d4, object: "面团--魔法转化阵-->造物面包",
        classification: {domain: out, mechanism: magic},
        action: null, rationale: "魔法转换非烹饪链", confidence: 高, disposition: skip }
  deferred:
    - { id: q1, situation: "煮面用哪种生面条？存在通用/拉面/乌冬 3 种",
        options: [{label: farmersdelight:raw_pasta, effect: 通用}, {label: cuisine:ramen_noodles}, {label: cuisine:udon_raw}],
        recommend: "farmersdelight:raw_pasta（其上游是面团→擀制，最通用）",
        why_unsure: "多个语义相近物品，原配方未指定面种", blocks: [d2] }
    - { id: q2, situation: "d3 替换后 create:dough 在本链出现冗余引用，是否清理？",
        options: [{label: 移除物品}, {label: 保留但去引用}, {label: 不动}],
        recommend: "保留物品但从本链去引用（移除物品爆炸半径高）",
        why_unsure: "create:dough 可能被其它 mod 引用，需完整引用清单", blocks: [] }
  aggregate_findings: []
```

→ **走查结论**：例子01 能完整渲染为 Intent Spec，各条 disposition 与例子的期望处置一致（d1/d2/d3 自动、q1/q2 搁置、d4 跳过）。✅

---

## 10. 待打磨 / 关系

- 动作的**确定性语义、级联与爆炸半径算法**在 [[04-引擎与动作语义]]（下一份）细化；本文只定"长什么样"。
- 选择器后四种（语义家族/等价类/品类模板）的成组算法 → [[09-LLM-Agent集成]]。
- `by_name_semantic` 等的可预览实现依赖数据层 → [[06-数据层]]。
- Spec 载体：JSON 为权威格式，UI 表单为主编辑界面，可切 YAML 视图给老手手改（本文用 YAML 仅为易读）。

---
up: "[[01-核心设计与决策模型]]"
tags: [project, minecraft, ide, design, spec, output]
---

# 输出层（KubeJS 后端，v1）—— v0 草案

> **状态**：v0 草案。把引擎算出的**变更集**编译成真实可生效的产物。**编译器多后端模型**：变更集是 IR，KubeJS / datapack / Almost Unified 各为一个 emitter；**v1 只实现 KubeJS 后端**（能力最全、可兜底），datapack / AU 列 v1.x。
> 输入来自 [[04-引擎与动作语义|设计/04]] 的变更集；动作清单见 [[02-动作词汇表与分类法]]。

---

## 1. 位置

```
Intent Spec → [引擎] 变更集(IR) → [emitter] → 产物文件 → 放入整合包 → /reload 生效
                                       ▲
                              本文：v1 = KubeJS 后端
```

---

## 2. 能力矩阵（各后端能表达哪些动作）

| 动作 | KubeJS (v1) | datapack (v1.x) | Almost Unified (v1.x) |
|---|---|---|---|
| replace_ingredient | ✅ | ⚠️ 逐配方重写 | 部分 |
| scale | ✅ | ❌（需逐配方重写） | ❌ |
| retag | ✅ | ✅ | ✅ |
| remove(hide/recipe) | ✅ | ✅(recipe) / ⚠️(hide需JEI) | ✅ |
| rename(显示名) | ✅(lang) | ✅(lang) | ❌ |
| unify / differentiate / harmonize | ✅(展开为原语) | ⚠️ 啰嗦 | unify ✅、其余 ❌ |

> **路由规则**：作者选的后端表达不了某动作时，引擎**明确报"该动作需回退 KubeJS"**，绝不静默漏掉（呼应"系统允许不做决定"）。这正是 v1 先做 KubeJS 兜底的原因。

---

## 3. KubeJS 后端映射（动作 → KubeJS API；具体签名实现时按 KubeJS 版本核对）

| 动作 | 大致映射 |
|---|---|
| replace_ingredient | `ServerEvents.recipes(e => e.replaceInput(filter, from, to))` / `replaceOutput` |
| scale | 取原配方 → 改数量重写（`e.remove(filter)` + 重新 `e.shaped/shapeless/custom`），或 modify |
| retag | `ServerEvents.tags('item', e => e.add(tag, item) / e.remove(tag, item))` |
| remove_recipe | `ServerEvents.recipes(e => e.remove(filter))` |
| hide_in_jei | 经 JEI/REI 隐藏（KubeJS JEI 插件事件），**注意：非注册移除** |
| rename(显示名) | KubeJS lang 文件 `kubejs/assets/<ns>/lang/<locale>.json` 覆盖显示名（不动 id） |
| add_item（仅探测，v1 不自动） | 若日后启用：`StartupEvents.registry('item', ...)` + 数据驱动模板 |

放置位置：配方/tag → `kubejs/server_scripts/`；物品/注册类 → `kubejs/startup_scripts/`；lang → `kubejs/assets/`。

---

## 4. 应用、幂等、可逆

- **dry-run/diff**：emitter 先产出"将生成什么 + 逐配方 before→after"，作为闸门2 界面；确认后才写文件。
- **生成物归工具所有**：写到**带标记的独立文件**（如 `kubejs/server_scripts/zzz_modpackide_generated.js`，含 `// @modpackide-generated` 头）。重生成**只覆盖工具文件**，作者手写脚本不受影响。
- **幂等**：动作以原始基线定义（[[04-引擎与动作语义|设计/04 §1]]），同一 Spec 重生成产物一致。
- **可逆**：撤销 = 删除/禁用生成文件；不动源 JAR。唯一例外是已影响世界状态的（删方块）——故那类只探测+搁置。
- **生效**：游戏内 `/reload`（server_scripts）或重启（startup_scripts）。

---

## 5. 走查（例子01 的 Intent Spec → KubeJS）

```js
// @modpackide-generated  (例01 面食优化，已审通过的决策)
ServerEvents.recipes(e => {
  // d1: 小麦→面粉（做面团步骤）
  e.replaceInput({output: 'create:dough'}, 'minecraft:wheat', 'create:wheat_flour')
  // d2: 面粉→生面条（煮面步骤；面种经 q1 裁决后填入）
  e.replaceInput({type: 'cuisine:boiling'}, 'create:wheat_flour', '<q1 选定的生面条>')
  // d3: 面团→发酵面团（蒸馒头）
  e.replaceInput({output: 'bakery:mantou'}, 'create:dough', 'bakery:fermented_dough')
  // d4 魔法配方：跳过（不出现在产物里）
})
```
→ 例01 的自动决策能干净编译为 KubeJS；搁置项（q1/q2）裁决后才填入/追加。✅

---

## 6. 待打磨

- KubeJS `replaceInput` 的 filter 精度（按 output/type/mod 限定）以避免误伤——与选择器 [[03-Intent-Spec契约|设计/03 §3]] 对齐。
- hide 在不同前端（JEI vs REI）的差异；是否需要 EMI 支持。
- datapack 后端（v1.x）：直接生成 `data/<ns>/recipes|tags/*.json`，不依赖 KubeJS mod，但表达力受限（见矩阵）。
- 与现有 `@libsql` 数据层的衔接：emitter 读图谱拿配方原样以做"重写"。

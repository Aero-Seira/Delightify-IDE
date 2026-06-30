# Agent 图谱：六维实体模型

> 状态：设计草案（2026-06-30）。本文定义 Agent 知识图谱中每个实体应具备的六个信息维度。
> **全部 Agent 内容已搁置**，本文作为 Agent 专项规划的前置设计参考。
> 来源：用户输入 + `设计/06`（数据层） + `设计/09`（LLM-Agent集成）。

---

## 一、核心原则

图谱中的每个实体（物品 / 配方 / tag / mod / ...）应能沿六个维度被查询和遍历：

```
                         ┌──────────────┐
                         │   ① 来自哪     │
                         │  Provenance   │
                         └──────┬───────┘
                                │
        ┌───────────────┐       │       ┌───────────────┐
        │  ② 做什么       │ ←── 实体 ──→ │  ③ 与什么有关   │
        │  Function      │   (Entity)   │  Association   │
        └───────────────┘       │       └───────────────┘
                                │
                 ┌──────────────┴──────────────┐
                 │        ④ 关系如何             │
                 │    Relation Semantics        │
                 └─────────────────────────────┘

    ┌──────────────────────┐     ┌──────────────────────┐
    │    ⑤ 游戏内是什么      │     │   ⑥ 游戏外如何实现     │
    │   In-Game Reality     │     │   Implementation     │
    └──────────────────────┘     └──────────────────────┘
```

六个维度不是六个字段，而是**六种查询方向**——每个维度通过节点属性和图谱边承载。

---

## 二、六维逐一定义

### ① 来自哪 — Provenance（溯源）

> 这个实体从**哪些来源**进入知识库

Provenance **不是单一值，是一个链**。同一实体可能有多个来源互相印证或冲突。

```
minecraft:copper_ingot 的 provenance 链：
  ├─ 来自 mod:minecraft              ← JAR 字节码注册
  ├─ 来自 datapack:vanilla           ← 原版 datapack 配方定义
  └─ 来自 exporter_snapshot:v3       ← runtime 确认存在 ✅

create:dough 的 provenance 链：
  ├─ 来自 mod:create                 ← JAR 声明注册
  └─ 来自 exporter_snapshot:ABSENT   ← runtime 中不存在 ⚠️（被脚本/配置移除？）

thermal:copper_ingot 的 provenance 链：
  ├─ 来自 mod:thermal               ← JAR 注册
  ├─ 来自 config:thermal/disable    ← 配置禁用了 ⚠️（冲突！）
  └─ 来自 exporter_snapshot:ABSENT
```

**provenance 信号对 Agent 的意义**：
- 多来源一致 → 事实可靠，高置信
- JAR 声明但 runtime 缺失 → 可能被禁用/覆盖，需标注
- runtime 存在但 JAR 无声明 → 脚本/datapack 动态生成，需特殊处理

### ② 做什么 — Function（功能/角色）

> 这个实体在整合包生态里**扮演什么角色**

角色**不是人工标注的固定标签**，而是从分类学 + 图谱位置 + 配方引用模式**联合推导**的。

```
物品角色的推导链：
  minecraft:copper_ingot
    ├─ 分类学:    category:ingot → category:material
    ├─ 材料族:    material_family:copper
    ├─ 链位置:    intermediate（矿石→锭→块/板/线，它在中间）
    ├─ 用途模式:  [recipe_input, beacon_payment]
    └─ 推导:      基础金属锭，大量配方消耗，承上启下

  create:wheat_flour
    ├─ 分类学:    category:dust → category:material
    ├─ 材料族:    material_family:wheat
    ├─ 链位置:    intermediate（小麦→面粉→面团→成品）
    ├─ 用途模式:  [recipe_input]
    └─ 推导:      中间加工品，上游是谷物，下游是面食

  minecraft:furnace
    ├─ 配方型:    recipe_type:minecraft:smelting
    ├─ 机制:      mechanism:automated（烧炼）
    ├─ 用途模式:  [machine]
    └─ 推导:      基础热处理机器，大量配方使用
```

**角色推导对 Agent 的意义**：
- `intermediate` 物品的改动会级联影响上下游 → 升高风险
- `machine` 节点是配方聚类核心 → by_graph 遍历的枢纽
- 同角色的物品/配方应一致处理 → 驱动 harmonize

### ③ 与什么有关 — Association（关联）

> 这个实体**连接到哪些其他实体**

关联是**图遍历的结果**，不是预存字段。图谱的价值就是把这一维展开到任意深度。

```
minecraft:copper_ingot 的关联（沿图谱边展开）：

  与物品有关:
    ├─ minecraft:raw_copper           ← 上游原料（CONSUMES 反查）
    ├─ minecraft:copper_block          ← 下游合成产物（CRAFTED_FROM）
    ├─ create:copper_sheet             ← 跨 mod 下游产物
    ├─ thermal:copper_ingot            ← 同材料族·同类物品（SAME_MATERIAL）
    └─ minecraft:copper_ingot          ← 自身（某些配方输入即输出，守恒型）

  与配方有关:
    ├─ minecraft:copper_block_recipe   ← 作为输入（CONSUMES）
    ├─ create:copper_sheet_recipe      ← 作为输入
    └─ minecraft:copper_ingot_from_block ← 作为输出（CRAFTED_FROM）

  与 tag 有关:
    ├─ #forge:ingots/copper            ← TAGGED_UNDER
    ├─ #forge:ingots                   ← 父 tag（SUB_TAG_OF 推导）
    └─ #minecraft:beacon_payment_items ← 功能 tag

  与 mod 有关:
    └─ mod:minecraft                   ← PROVIDED_BY
```

**关联深度控制**：Agent 遍历时限定跳数——召回阶段 1-2 跳，爆炸半径 2-3 跳，链分析不限。

### ④ 关系如何 — Relation Semantics（关系语义）

> 连接**意味着什么**

相同的方向（A→B）可能有完全不同的语义——这是 Agent 做决策的核心依据。

```
minecraft:copper_ingot → minecraft:copper_block
  关系: CRAFTED_INTO（合成为）
  属性: { count: 9, recipe_id: "minecraft:copper_block", reversible: true }

minecraft:copper_ingot → #forge:ingots/copper
  关系: TAGGED_UNDER（属于此 tag）
  属性: { source_file: "data/forge/tags/items/ingots/copper.json" }

thermal:copper_ingot → minecraft:copper_ingot
  关系: SAME_MATERIAL（同材料族 · 不同 mod 的实现）
  属性: { confidence: high, signals: [tag, name, category, graph] }

  不同于:
  copper_alloy_ingot → minecraft:copper_ingot
    关系: MEANINGFUL_VARIANT（有意义的变体——含锡的合金，不是纯铜）
    属性: { differentiating_signal: "contains tin", should_not_unify: true }

minecraft:copper_ingot → create:copper_sheet_recipe
  关系: CONSUMED_BY（被此配方消耗）
  属性: { slot: 0, count: 1, kind: item }
```

**关键区分**（Agent 必须能分辨）：

| 关系 | 含义 | Agent 行为 |
|---|---|---|
| SAME_MATERIAL | 语义等价的不同实现 | → unify |
| MEANINGFUL_VARIANT | 有意义的区分 | → differentiate，不合并 |
| SAME_NAME_DIFFERENT | 同名但不同物 | → rename 消歧 |
| CRAFTED_FROM / CONSUMED_BY | 物理配方关系 | → 爆炸半径计算 |
| TAGGED_UNDER | 标签归属 | → retag 决策 |
| DEPENDS_ON | 跨配方链依赖 | → 级联影响分析 |

### ⑤ 游戏内是什么 — In-Game Reality（运行时表现）

> 玩家在游戏里**实际看到和交互到**的是什么

这一维 = **exporter 快照的全部内容**。它是"玩家视角"的实体。

```
minecraft:copper_ingot 的游戏内现实：

  视觉:
    显示名: "Copper Ingot" (en_us) / "铜锭" (zh_cn)
    材质:   assets/minecraft/textures/item/copper_ingot.png
    模型:   assets/minecraft/models/item/copper_ingot.json

  属性:
    堆叠:   64
    所属创造标签页: ingredients
    可放置: 否（不是方块）
    耐久:   无
    食物:   否
    稀有度: common

  运行时存在:
    ✅ 存在于整合包中 (exporter 确认)
    ✅ 在 JEI/REI 中可见
    ✅ 被 3 个配方作为输入使用
    ✅ 被 2 个配方作为输出产出

  玩家交互:
    获得途径: [烧炼粗铜, 分解铜块]
    消耗途径: [合成铜块, 合成铜板]
```

**游戏内 vs 游戏外的关键矛盾**：
- 游戏内存在但游戏外无声明 → 脚本/datapack 动态生成
- 游戏内不存在但游戏外有声明 → 被配置/脚本禁用
- 游戏内属性被修改过 → KubeJS/CT 脚本覆盖了原始定义

Agent 必须能检测和标注这些矛盾。

### ⑥ 游戏外如何实现 — Implementation（声明/定义层）

> 这个实体在 JAR / datapack / 脚本 / 配置中**是怎么定义出来的**

这一维回答两个问题：**"为什么它是这样"** 和 **"要改它，去哪里改"**。

```
minecraft:copper_ingot 的实现层：

  注册:
    注册方式: DeferredRegister (Forge)
    注册类:   net.minecraft.world.item.Items
    注册名:   copper_ingot
    源 JAR:   minecraft.jar

  tag 声明:
    ├─ minecraft.jar:data/forge/tags/items/ingots/copper.json
    │   └─ { "replace": false, "values": ["minecraft:copper_ingot"] }
    ├─ thermal.jar:data/forge/tags/items/ingots/copper.json
    │   └─ { "values": ["thermal:copper_ingot"] }
    └─ datapack:custom/forge/tags/items/ingots/copper.json
        └─ { "values": ["custom:copper_variant"] }    ← 追加的

  配方定义:
    ├─ minecraft.jar:data/minecraft/recipes/copper_block.json
    │   └─ 铜锭×9 → 铜块
    ├─ create.jar:data/create/recipes/copper_sheet.json
    │   └─ 铜锭 → 铜板 (机械加工)
    └─ kubejs/server_scripts/recipes.js:42
        └─ event.shaped('2x copper_wire', [...], {C: '#forge:ingots/copper'})
        ← KubeJS 动态生成，exporter 能捕获结果但不知道它来自脚本

  翻译:
    ├─ minecraft.jar:assets/minecraft/lang/en_us.json → "Copper Ingot"
    ├─ minecraft.jar:assets/minecraft/lang/zh_cn.json → "铜锭"
    └─ resourcepack:assets/minecraft/lang/zh_cn.json → "铜锭" (覆盖)

  材质/模型:
    ├─ minecraft.jar:assets/minecraft/textures/item/copper_ingot.png
    └─ minecraft.jar:assets/minecraft/models/item/copper_ingot.json

  脚本影响:
    └─ ✅ 无 KubeJS/CraftTweaker 脚本覆盖此物品

  配置影响:
    └─ ✅ 无 config 文件禁用或修改此物品
```

**实现层对 Agent 的意义**：
- 知道配方的源文件 → 如果 Agent 要改配方，知道改哪个文件、用什么格式
- 知道物品的注册方式 → 判断能否安全删除（DeferredRegister = 删不掉）
- 知道 tag 声明的来源分布 → 跨 mod 影响面评估
- 知道哪些是脚本生成的 → 脚本生成的内容 Agent 不能直接改原始脚本

---

## 三、双层知识图谱

六维模型自然地将知识分为两层：

| | Layer 1: 游戏内事实 | Layer 2: 文件解析知识 |
|---|---|---|
| **承载维度** | ⑤ 游戏内是什么（主体）+ ③④ 部分（运行时边） | ① 来自哪 + ② 做什么 + ⑥ 游戏外如何实现 |
| **来源** | exporter 运行时快照 | JAR · datapack · config · script 文件解析 |
| **可变性** | 每包不同（全量替换） | 跨包相对稳定（增量积累） |
| **节点类型** | Item, Recipe, Tag, Translation, Texture | Category, RecipeType, MaterialFamily, Mod, SourceFile, RegistrationSite, ScriptIntent, StyleProfile, DisabledContent |
| **与其他层的关系** | 被 Layer 2 描述和解释 | 描述和解释 Layer 1 |

**两类节点之间的桥接边**：

```
Layer 1 ←→ Layer 2 桥接:
  Item ──CATEGORIZED_AS──→ Category         (copper_ingot 属于 ingot 类)
  Item ──IN_FAMILY───────→ MaterialFamily    (所有铜物品 属于 copper 材料族)
  Recipe ──HAS_TYPE──────→ RecipeType        (某配方 是 shaped_crafting 型)
  Recipe ──DEFINED_IN────→ SourceFile        (某配方 定义在 foo.json)
  Item ──REGISTERED_VIA──→ RegistrationSite  (某物品 在 Items.java 注册)
  Mod ──PROVIDES─────────→ Item/Recipe       (Create mod 提供这些内容)
  Script ──GENERATES─────→ Recipe            (KubeJS 脚本生成了这个配方)
  Config ──DISABLES──────→ Item/Recipe       (配置禁用了这个物品/配方)
```

---

## 四、六维如何支撑 Agent 决策

以具体判断为例：

> 「thermal:copper_ingot 应该被 unify 到 minecraft:copper_ingot 吗？」

```
Agent 遍历六维：

① 来自哪：
   thermal:copper_ingot → mod:thermal（跨 mod → 风险 +1）
   exporter 确认存在 → 事实可靠

② 做什么：
   两个都是 category:ingot → 同类
   两个都是 material_family:copper → 同材料族
   chain_position 都是 intermediate → 角色一致

③ 与什么有关：
   两个都被 #forge:ingots/copper 引用 → tag 一致
   各自有下游配方引用 → 不能简单删除

④ 关系如何：
   thermal → minecraft = SAME_MATERIAL · DIFFERENT_MOD
   不是 MEANINGFUL_VARIANT（无差异化信号）
   不是 TRUE_REDUNDANT（各自有独立配方链）

⑤ 游戏内：
   显示名相同："Copper Ingot" (en_us)
   组件/耐久/食物/方块属性 → 均相同
   thermal 版本在 JEI 可见 → 玩家看得见

⑥ 游戏外：
   thermal 铜锭在 thermal.jar 中 DeferredRegister 注册 → 无法删除
   未被任何配置禁用 → 必须保留
   下游配方在 create.jar / thermal.jar 中 → 需跨 JAR 改输入引用

→ 结论：unify 方向正确，但不能 remove thermal 版本
→ 动作：retag(统一 tag) + replace_input(thermal→minecraft) + hide(thermal 版本)
→ 置信：高（四信号同向：name + tag + category + graph）
→ 风险：中（跨 mod，有下游配方）
→ 处置：auto（替换 + 隐藏，不删除物品）
```

---

## 五、Layer 2 知识类型全景

| 知识类型 | 数据来源 | 图谱节点 | Agent 用途 |
|---|---|---|---|
| **物品分类学** | `config/item_categories.json` + JAR 推导 | Category（层级树） | 召回扩展、语义约束、角色推导 |
| **配方型模式** | `config/recipe_types/` + JAR/datapack 解析 | RecipeType（含 field_specs, mechanism） | 分类法 mechanism 信号、动作可行性判断 |
| **映射规则** | `config/mapping_rules.json` | MappingRule（CAN_CONVERT_TO 边） | 配方型互转决策 |
| **材料族** | tag 层级解析 + 物品分类学交叉 | MaterialFamily | 召回扩展（锭→粒/块/粉）、风险级联 |
| **tag 层级** | 所有 JAR/datapack 的 `tags/**/*.json` 解析 | Tag（SUB_TAG_OF 边） | 输入集校正、retag 影响面 |
| **Mod 依赖图** | JAR 的 `mods.toml` / `fabric.mod.json` | Mod（DEPENDS_ON 边） | 跨 mod 爆炸半径、风格推导 |
| **风格档案** | 作者声明（交互界面） | StyleProfile | 合理性/风格贴合判断的约束输入 |
| **脚本意图** | KubeJS/CT 脚本静态解析 | ScriptIntent | 区分"设计如此"和"遗漏需要补" |
| **隐匿内容** | config + 脚本解析 vs exporter 快照对比 | DisabledContent | 避免 Agent 误判"缺失"为"遗漏" |
| **注册信息** | JAR 字节码分析 | RegistrationSite | 判断删除可行性 |

---

## 六、对当前图谱设计的修正

| 原规格 (设计/06 §4) | 六维模型 |
|---|---|
| nodes/edges 通用存储，无维度概念 | 节点 + 边承载六维，每个维度是查询方向 |
| 只有 exporter 数据源 | 双层（Layer 1 运行时 + Layer 2 文件解析） |
| 边类型以物理关系为主 | 增加语义关系层（SAME_MATERIAL, MEANINGFUL_VARIANT, EQUIVALENT） |
| 无 provenance 显式建模 | provenance 变成显式边（DECLARED_IN / REGISTERED_VIA / GENERATED_BY） |
| 角色 (role) 作为分类法字段 | 角色从图谱位置 + 分类学边 + 配方引用模式联合推导 |
| 无实现层 | 新增 SourceFile / RegistrationSite / ScriptIntent / DisabledContent 节点类型 |
| 无 Layer 1 ↔ Layer 2 桥接 | 桥接边连接双层知识（CATEGORIZED_AS / HAS_TYPE / IN_FAMILY / DEFINED_IN） |

---

## 七、待定（Agent 专项规划时解决）

- Layer 2 各知识类型的提取管线（哪些从已有 config 直接图谱化，哪些需新建文件解析器）
- 分类学推导算法（物品→分类的自动归类准确率目标）
- 材料族自动发现（能否从 tag 层级 + 名称模式自动聚类，还是需要人工标注）
- 语义关系边（SAME_MATERIAL / MEANINGFUL_VARIANT）的判定规则——是 LLM 判断还是基于信号打分
- Layer 1 和 Layer 2 的重建策略差异（全量替换 vs 增量积累）在图谱上的工程实现

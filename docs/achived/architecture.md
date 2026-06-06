# (已过时)系统架构设计文档 / System Architecture Design

[中文](#中文) | [English](#english)

---

> ## ⚠️ 架构变更说明 / Architecture Change Notice
>
> **中文**：本文档为原始架构设计，反映项目初期基于 Python + Gradio 的技术思路。当前实际技术栈和架构已按以下文档更新，原文档中的 Python 相关内容作为历史参考保留，不删除。
>
> - 📐 [技术栈决策文档](tech-stack.md) — 从 Python/Gradio 迁移到 Node.js/React 的完整决策记录
> - 🗂️ [项目结构文档](project-structure.md) — 新的 monorepo 目录结构、数据库 Schema 与 API 设计
>
> **English**: This document reflects the original architecture based on Python + Gradio. The current technology stack and architecture have been updated per the documents below. Python-related content in this document is retained as historical reference and has not been deleted.
>
> - 📐 [Tech Stack Decisions](tech-stack.md) — Complete decision record for the migration from Python/Gradio to Node.js/React
> - 🗂️ [Project Structure](project-structure.md) — New monorepo directory structure, database schema, and API design

---

## 中文

### 概述

Delightify 是一个 LLM 驱动的 Minecraft 配方转换系统，能够智能地将各种来源的配方转换为统一的格式。系统采用灵活的架构设计，支持多种输入输出格式，并通过 LLM 实现智能配方类型推荐和转换。

**当前阶段**：LLM 驱动方案（100%）- 快速、智能、可解释

**未来规划**：混合架构 - 规则引擎（80%）→ 本地 LLM（15%）→ 人工确认（5%）

### 1. 输入系统设计

#### 1.1 统一中间格式规范

系统定义了标准的中间格式，用于统一处理来自不同源的配方数据：

```json
{
  "internal_id": "temp_uuid_12345",
  "source": {
    "type": "json_upload",  // 或 "kubejs_script", "manual_input"
    "filename": "recipes.json",
    "upload_time": "2024-01-14T08:00:00Z",
    "original_format": "minecraft:crafting_shaped"
  },
  "recipe_data": {
    "inputs": [
      {
        "type": "item",  // 或 "tag", "fluid", "energy"
        "item": "minecraft:iron_ingot",
        "count": 3,
        "nbt": null
      }
    ],
    "outputs": [
      {
        "type": "item",
        "item": "minecraft:bucket",
        "count": 1,
        "chance": 1.0
      }
    ],
    "original_type": "minecraft:crafting_shaped",
    "extra_properties": {
      "pattern": ["III", " I ", " I "],
      "key": {"I": {"item": "minecraft:iron_ingot"}}
    }
  },
  "parsing_info": {
    "status": "success",  // 或 "partial", "failed"
    "warnings": [],
    "errors": [],
    "timestamp": "2024-01-14T08:00:01Z"
  }
}
```

**字段说明**：

- `internal_id`: 系统生成的临时唯一标识符
- `source`: 配方来源信息
  - `type`: 来源类型（json_upload, kubejs_script, manual_input）
  - `filename`: 源文件名
  - `upload_time`: 上传时间戳
  - `original_format`: 原始配方类型
- `recipe_data`: 核心配方数据
  - `inputs`: 输入材料列表
  - `outputs`: 输出物品列表
  - `original_type`: 原始配方类型标识
  - `extra_properties`: 额外属性（如工作台摆放模式、处理时间等）
- `parsing_info`: 解析状态信息

#### 1.2 两种输入模式

**模式 1: JSON 文件上传/手动输入**

支持以下格式：
- 标准 Minecraft 配方 JSON（单个或数组）
- 批量配方格式（自定义包装格式）

```json
// 单个配方
{
  "type": "minecraft:crafting_shaped",
  "pattern": ["###", "# #", "###"],
  "key": {
    "#": {"item": "minecraft:stick"}
  },
  "result": {"item": "minecraft:chest"}
}

// 批量配方数组
[
  {"type": "...", ...},
  {"type": "...", ...}
]
```

**模式 2: KubeJS 脚本解析**

解析 `ServerEvents.recipes()` 回调中的配方定义：

```javascript
ServerEvents.recipes(event => {
  // 支持标准方法
  event.shaped('minecraft:chest', [
    '###',
    '# #',
    '###'
  ], {
    '#': 'minecraft:stick'
  });
  
  // 支持 custom 方法
  event.custom({
    type: 'farmersdelight:cooking',
    ingredients: [...],
    result: {...}
  });
});
```

**解析器功能**：
- AST 解析 JavaScript 代码
- 提取配方定义调用
- 转换为统一中间格式
- 保留原始代码位置信息（用于错误报告）

#### 1.3 待处理队列

系统维护一个配方处理队列，跟踪每个配方的状态：

```json
{
  "queue_id": "batch_20240114_001",
  "created_at": "2024-01-14T08:00:00Z",
  "recipes": [
    {
      "internal_id": "temp_uuid_12345",
      "status": "pending",  // pending, processing, completed, failed, requires_review
      "priority": 1,
      "retry_count": 0,
      "last_updated": "2024-01-14T08:00:00Z"
    }
  ],
  "statistics": {
    "total": 100,
    "pending": 50,
    "processing": 10,
    "completed": 35,
    "failed": 2,
    "requires_review": 3
  }
}
```

### 2. 元数据系统设计

#### 2.1 配方类型元数据库结构

```
config/
├── recipe_types/
│   ├── builtin/              # 内置常见配方类型
│   │   ├── minecraft.json    # 原版配方
│   │   ├── farmers_delight.json
│   │   ├── create.json
│   │   └── ...
│   └── custom/               # 用户自定义扩展
│       ├── my_mod.json
│       └── README.md
├── item_categories.json      # 物品分类定义
└── mapping_rules.json        # 映射规则
```

#### 2.2 配方类型元数据格式

每个配方类型定义文件包含以下结构：

```json
{
  "recipe_type_id": "farmersdelight:cooking",
  "display_name": "Farmer's Delight 烹饪",
  "description": "使用烹饪锅制作食物",
  "icon": "farmersdelight:cooking_pot",
  "mod_id": "farmersdelight",
  "version": "1.0.0",
  
  "template": {
    "type": "farmersdelight:cooking",
    "ingredients": [],
    "result": {},
    "cookingtime": 200,
    "experience": 0.35
  },
  
  "field_specs": {
    "ingredients": {
      "required": true,
      "type": "array",
      "min_items": 1,
      "max_items": 6,
      "description": "烹饪材料列表"
    },
    "result": {
      "required": true,
      "type": "item",
      "description": "输出物品"
    },
    "cookingtime": {
      "required": false,
      "type": "integer",
      "default": 200,
      "range": [1, 72000],
      "description": "烹饪时间（游戏刻）"
    },
    "experience": {
      "required": false,
      "type": "float",
      "default": 0.0,
      "range": [0.0, 10.0],
      "description": "获得的经验值"
    },
    "container": {
      "required": false,
      "type": "item",
      "description": "容器物品（如碗）"
    }
  },
  
  "suitable_for": {
    "item_categories": [
      "food",
      "consumable",
      "cooked_food"
    ],
    "keywords": [
      "soup", "stew", "meal", "dish",
      "汤", "炖菜", "料理"
    ],
    "input_count": {
      "min": 1,
      "max": 6
    },
    "output_count": {
      "min": 1,
      "max": 2
    },
    "typical_patterns": [
      "多种食材组合成复杂食物",
      "需要加热或烹饪的食物"
    ]
  },
  
  "incompatible_with": {
    "output_categories": ["tool", "weapon", "armor"],
    "reasons": [
      "烹饪锅仅用于制作食物",
      "不支持非消耗品输出"
    ]
  },
  
  "examples": [
    {
      "name": "蔬菜汤",
      "recipe": {
        "type": "farmersdelight:cooking",
        "ingredients": [
          {"item": "minecraft:carrot"},
          {"item": "minecraft:potato"},
          {"item": "minecraft:beetroot"}
        ],
        "result": {
          "item": "farmersdelight:vegetable_soup"
        },
        "container": {"item": "minecraft:bowl"},
        "cookingtime": 200,
        "experience": 0.35
      }
    }
  ]
}
```

#### 2.3 内置配方类型

系统提供以下内置配方类型定义：

1. **minecraft.json** - 原版配方
   - crafting_shaped (有序合成)
   - crafting_shapeless (无序合成)
   - smelting (熔炉)
   - blasting (高炉)
   - smoking (烟熏炉)
   - campfire_cooking (篝火)
   - stonecutting (切石机)
   - smithing (锻造台)

2. **farmers_delight.json** - 农夫乐事
   - cooking (烹饪锅)
   - cutting (切菜板)

3. **create.json** - 机械动力
   - crushing (粉碎)
   - milling (研磨)
   - mixing (搅拌)
   - pressing (压制)
   - deploying (装配)
   - filling (灌注)
   - emptying (抽取)

### 3. 输出系统设计

#### 3.1 输出配置选项

```json
{
  "output_config": {
    "format": "kubejs_script",  // kubejs_json, kubejs_script, datapack_json
    "grouping": "by_type",      // by_type, single_file, individual_files
    "include_metadata": true,    // 包含转换元数据注释
    "mark_suspicious": true,     // 标记可疑配方
    "base_path": "output/",
    "filename_pattern": "{mod_id}_{recipe_type}.js"
  }
}
```

#### 3.2 三种输出格式

**格式 1: KubeJS JSON (用于数据包)**

```json
{
  "type": "farmersdelight:cooking",
  "ingredients": [
    {"item": "minecraft:carrot"},
    {"item": "minecraft:potato"}
  ],
  "result": {"item": "farmersdelight:vegetable_soup"},
  "cookingtime": 200
}
```

**格式 2: KubeJS Script (.js 文件)**

```javascript
// Generated by Delightify
// Conversion Date: 2024-01-14T08:00:00Z
// Total Recipes: 3

ServerEvents.recipes(event => {
  // ===== Farmer's Delight: Cooking =====
  
  // Vegetable Soup
  // Confidence: HIGH (95%)
  // Original: modA:cooking_pot -> farmersdelight:cooking
  event.custom({
    type: 'farmersdelight:cooking',
    ingredients: [
      {item: 'minecraft:carrot'},
      {item: 'minecraft:potato'}
    ],
    result: {item: 'farmersdelight:vegetable_soup'},
    container: {item: 'minecraft:bowl'},
    cookingtime: 200,
    experience: 0.35
  });
  
  // [REVIEW NEEDED] Suspicious Sushi
  // Confidence: MEDIUM (65%)
  // Warning: Input count unusual for cooking recipe
  // Reason: 原始配方使用工作台，但物品语义更适合烹饪
  event.custom({
    type: 'farmersdelight:cooking',
    ingredients: [
      {item: 'minecraft:rice'},
      {item: 'minecraft:fish'}
    ],
    result: {item: 'modA:sushi'},
    cookingtime: 200  // Default value added
  });
});
```

**格式 3: Datapack JSON (原版数据包格式)**

```
data/
└── modpack_recipes/
    └── recipes/
        ├── farmersdelight/
        │   ├── vegetable_soup.json
        │   └── sushi.json
        └── create/
            └── crushed_ore.json
```

#### 3.3 可疑配方标记系统

```json
{
  "recipe_id": "temp_uuid_12345",
  "suspicious": true,
  "review_required": true,
  "flags": [
    {
      "type": "low_confidence",
      "severity": "warning",
      "message": "LLM 置信度较低 (65%)",
      "reason": "输入物品数量不符合典型烹饪配方模式"
    },
    {
      "type": "field_removed",
      "severity": "info",
      "message": "移除了不支持的字段: custom_property",
      "original_value": {"custom_property": "value"}
    },
    {
      "type": "default_value_used",
      "severity": "info",
      "message": "使用默认值: cookingtime = 200",
      "field": "cookingtime"
    }
  ],
  "suggested_actions": [
    "检查输入物品是否正确",
    "验证烹饪时间是否合理",
    "考虑使用其他配方类型"
  ]
}
```

**严重程度分类**：
- `error`: 严重问题，配方可能无法工作
- `warning`: 需要注意，可能需要调整
- `info`: 仅供参考的信息

#### 3.4 系统内预览和编辑

系统提供交互式界面进行配方审核：

**功能特性**：
- 并排对比原始和转换后配方
- 语法高亮显示
- 实时编辑转换结果
- 批量操作（接受/拒绝/修改）
- 筛选器（仅显示需要审核的配方）
- 搜索功能（按物品名、配方类型等）

**界面布局**：
```
┌─────────────────────────────────────────────────┐
│ Recipe Review Interface                          │
├─────────────┬───────────────────────────────────┤
│ Filter:     │ ☑ Needs Review  ☑ Warnings        │
│ Search:     │ [____________] 🔍                  │
├─────────────┴───────────────────────────────────┤
│ ┌─── Original Recipe ───┐ ┌─ Converted Recipe ─┐│
│ │ {                     │ │ event.custom({     ││
│ │   "type": "modA:...", │ │   type: 'farmers...││
│ │   ...                 │ │   ...              ││
│ │ }                     │ │ });                ││
│ └───────────────────────┘ └────────────────────┘│
│ Status: ⚠️ REVIEW NEEDED                         │
│ Confidence: 65% | Warnings: 2                    │
│ [✓ Accept] [✗ Reject] [✏️ Edit] [→ Next]        │
└─────────────────────────────────────────────────┘
```

### 4. LLM 驱动的转换系统

#### 4.1 模型配置

系统支持多个 LLM 提供商：

```json
{
  "llm_config": {
    "providers": [
      {
        "name": "ollama_primary",
        "type": "ollama",
        "enabled": true,
        "priority": 1,
        "config": {
          "base_url": "http://localhost:11434",
          "model": "qwen2.5:7b",
          "temperature": 0.3,
          "max_tokens": 2048,
          "timeout": 30,
          "retry": {
            "max_attempts": 3,
            "backoff_factor": 2
          }
        }
      },
      {
        "name": "openai_fallback",
        "type": "openai",
        "enabled": false,
        "priority": 2,
        "config": {
          "api_key": "${OPENAI_API_KEY}",
          "model": "gpt-4",
          "temperature": 0.2,
          "max_tokens": 2048
        }
      },
      {
        "name": "anthropic_fallback",
        "type": "anthropic",
        "enabled": false,
        "priority": 3,
        "config": {
          "api_key": "${ANTHROPIC_API_KEY}",
          "model": "claude-3-sonnet",
          "temperature": 0.2,
          "max_tokens": 2048
        }
      },
      {
        "name": "custom_endpoint",
        "type": "custom",
        "enabled": false,
        "priority": 4,
        "config": {
          "endpoint": "http://your-llm-server:8080/v1/chat/completions",
          "headers": {
            "Authorization": "Bearer ${CUSTOM_API_KEY}"
          },
          "model": "custom-model"
        }
      }
    ],
    "fallback_chain": true,
    "batch_processing": {
      "mode": "adaptive",  // sequential, parallel, adaptive
      "max_parallel": 5,
      "batch_size": 10,
      "enable_caching": true
    }
  }
}
```

**配置说明**：

- `providers`: 提供商列表，按优先级排序
- `fallback_chain`: 启用备用链（当高优先级失败时自动切换）
- `batch_processing`: 批量处理配置
  - `mode`: 
    - `sequential`: 顺序处理（稳定但慢）
    - `parallel`: 并行处理（快速但可能超出限制）
    - `adaptive`: 自适应（根据负载和成功率动态调整）
  - `max_parallel`: 最大并行请求数
  - `batch_size`: 单次批量处理的配方数
  - `enable_caching`: 启用响应缓存

#### 4.2 Prompt 工程

**System Prompt（系统提示词）**：

```
你是一个 Minecraft 模组配方专家，专门分析和转换不同模组的配方格式。

你的任务：
1. 分析给定的配方，理解其输入输出和制作过程
2. 根据物品语义和配方特征，推荐最合适的目标配方类型
3. 将配方转换为推荐的格式，确保所有必需字段都存在
4. 标记任何可疑或不确定的转换

判断标准：
- 物品语义（食物、工具、装备、材料等）
- 制作过程（烹饪、熔炼、合成、机械加工等）
- 输入输出数量和类型
- 模组兼容性

输出要求：
- 提供详细的分析和推理过程
- 给出置信度评分（0-100%）
- 列出所有警告和需要注意的问题
- 如果不确定，标记为需要人工审核
```

**User Prompt（用户提示词）**：

```
请分析并转换以下配方：

【原始配方】
```json
{
  "type": "modA:cooking_pot",
  "ingredients": [
    {"item": "minecraft:carrot"},
    {"item": "minecraft:potato"},
    {"item": "minecraft:beetroot"}
  ],
  "result": {"item": "modA:vegetable_soup"},
  "cooking_time": 100
}
```

【可用配方类型】
以下是你可以使用的目标配方类型及其适用场景：

1. farmersdelight:cooking
   - 适用于：复杂食物制作、需要烹饪的料理
   - 输入：1-6种材料
   - 特殊字段：cookingtime, experience, container
   - 详细说明：{farmersdelight:cooking的prompt_template内容}

2. minecraft:crafting_shapeless
   - 适用于：简单组合、不需要特定摆放的合成
   - 输入：1-9种材料
   - 特殊字段：无
   - 详细说明：{minecraft:crafting_shapeless的prompt_template内容}

[... 其他配方类型 ...]

**注意**：每个配方类型的"详细说明"部分会动态注入该类型的 `prompt_template.template` 内容，这是用户可以在配方类型元数据中自定义的，用于为 LLM 提供更准确的上下文信息。

【物品信息】
- minecraft:carrot: 类别=食材, 标签=[food, vegetable]
- minecraft:potato: 类别=食材, 标签=[food, vegetable]
- modA:vegetable_soup: 类别=食物, 标签=[food, consumable, soup]

请按照以下 JSON 格式输出：
```json
{
  "analysis": {
    "item_category": "分析输出物品属于什么类别",
    "recipe_characteristics": "配方的主要特征",
    "key_indicators": ["关键判断指标1", "指标2"]
  },
  "recommendation": {
    "target_type": "推荐的配方类型ID",
    "confidence": 95,
    "reasoning": "详细的推理过程",
    "alternatives": [
      {"type": "备选类型", "confidence": 60, "reason": "原因"}
    ]
  },
  "converted_recipe": {
    // 完整的转换后配方
  },
  "warnings": [
    "警告或需要注意的问题"
  ],
  "requires_review": false
}
```
```

**批量处理 Prompt**：

当一次处理多个配方时，使用优化的批量 Prompt：

```
请批量分析并转换以下 {count} 个配方。对于每个配方，提供独立的分析和转换结果。

【批量配方列表】
Recipe #1:
```json
{...}
```

Recipe #2:
```json
{...}
```

[...]

【输出格式】
请返回一个 JSON 数组，每个元素对应一个配方的转换结果：
```json
[
  {
    "recipe_index": 1,
    "analysis": {...},
    "recommendation": {...},
    "converted_recipe": {...},
    "warnings": [...],
    "requires_review": false
  },
  {...}
]
```
```

#### 4.3 LLM 输出格式

标准输出格式（单个配方）：

```json
{
  "analysis": {
    "item_category": "复杂食物",
    "recipe_characteristics": "多种蔬菜组合制作汤类食物",
    "key_indicators": [
      "输出物品是汤类食物",
      "需要3种蔬菜材料",
      "原始配方使用cooking_pot",
      "适合烹饪过程"
    ]
  },
  "recommendation": {
    "target_type": "farmersdelight:cooking",
    "confidence": 95,
    "reasoning": "输出物品'vegetable_soup'明显是烹饪类食物，使用烹饪锅最为合适。原始配方已经使用cooking_pot，直接对应到farmersdelight:cooking。材料数量(3)在范围内(1-6)，且都是食材类物品。",
    "alternatives": [
      {
        "type": "minecraft:crafting_shapeless",
        "confidence": 30,
        "reason": "技术上可行，但语义不匹配 - 汤类食物应该需要烹饪而不是简单组合"
      }
    ]
  },
  "converted_recipe": {
    "type": "farmersdelight:cooking",
    "ingredients": [
      {"item": "minecraft:carrot"},
      {"item": "minecraft:potato"},
      {"item": "minecraft:beetroot"}
    ],
    "result": {
      "item": "modA:vegetable_soup"
    },
    "container": {
      "item": "minecraft:bowl"
    },
    "cookingtime": 200,
    "experience": 0.35
  },
  "warnings": [
    "原始cooking_time值(100)已调整为标准值(200)",
    "自动添加了container字段(bowl)，这是汤类食物的标准容器"
  ],
  "requires_review": false
}
```

#### 4.4 响应解析和错误处理

**JSON 提取流程**：

1. **定位 JSON 代码块**
   - 查找 ```json ... ``` 标记
   - 如果没有标记，尝试查找 { ... } 完整对象

2. **解析和验证**
   ```python
   def parse_llm_response(response_text):
       # 尝试提取 JSON
       json_match = re.search(r'```json\s*(\{.*?\})\s*```', 
                              response_text, re.DOTALL)
       if json_match:
           json_str = json_match.group(1)
       else:
           # 尝试直接解析整个响应
           json_str = response_text.strip()
       
       try:
           data = json.loads(json_str)
           validate_llm_output(data)
           return data
       except json.JSONDecodeError as e:
           raise LLMResponseError(f"Invalid JSON: {e}")
   
   def validate_llm_output(data):
       required_fields = ['recommendation', 'converted_recipe']
       for field in required_fields:
           if field not in data:
               raise ValidationError(f"Missing required field: {field}")
       
       if 'target_type' not in data['recommendation']:
           raise ValidationError("Missing target_type in recommendation")
       
       # 验证配方格式
       validate_recipe_format(data['converted_recipe'])
   ```

3. **错误分类**
   - `ParseError`: JSON 解析失败
   - `ValidationError`: 格式验证失败
   - `IncompleteError`: 缺少必需字段
   - `InvalidRecipeError`: 配方格式不正确

**重试策略**：

```python
class LLMRetryStrategy:
    def __init__(self, max_attempts=3, backoff_factor=2):
        self.max_attempts = max_attempts
        self.backoff_factor = backoff_factor
    
    def execute(self, func, *args, **kwargs):
        for attempt in range(1, self.max_attempts + 1):
            try:
                return func(*args, **kwargs)
            except (ParseError, NetworkError) as e:
                if attempt == self.max_attempts:
                    # 最后一次尝试失败，标记为需要人工处理
                    return self.create_fallback_result(e)
                
                # 指数退避
                wait_time = self.backoff_factor ** (attempt - 1)
                time.sleep(wait_time)
                
                # 尝试下一个提供商（如果有）
                if isinstance(e, NetworkError):
                    switch_to_fallback_provider()
    
    def create_fallback_result(self, error):
        return {
            "status": "failed",
            "error": str(error),
            "requires_manual": True,
            "original_recipe": "..."
        }
```

**失败处理**：

当 LLM 处理失败时：
1. 记录错误详情（错误类型、原始配方、LLM 响应）
2. 标记配方为 `requires_manual = True`
3. 添加到人工审核队列
4. 如果是批量处理，继续处理其他配方
5. 在最终报告中汇总失败统计

#### 4.5 数据积累系统

系统记录每次转换的完整历史，为未来的规则引擎提供训练数据。

**转换历史记录格式**：

```json
{
  "record_id": "record_uuid_67890",
  "timestamp": "2024-01-14T08:00:00Z",
  "original_recipe": {
    "type": "modA:cooking_pot",
    "ingredients": [...],
    "result": {...}
  },
  "llm_recommendation": {
    "target_type": "farmersdelight:cooking",
    "confidence": 95,
    "reasoning": "...",
    "alternatives": [...]
  },
  "user_action": {
    "action": "accepted",  // accepted, modified, rejected
    "timestamp": "2024-01-14T08:01:00Z",
    "modifications": null  // 如果用户修改了，记录修改内容
  },
  "final_result": {
    "type": "farmersdelight:cooking",
    "ingredients": [...],
    "result": {...},
    "cookingtime": 200
  },
  "metadata": {
    "llm_provider": "ollama_primary",
    "llm_model": "qwen2.5:7b",
    "processing_time_ms": 1250,
    "input_tokens": 450,
    "output_tokens": 320
  }
}
```

**数据分析功能**：

1. **转换模式识别**
   ```python
   def analyze_conversion_patterns(history_records):
       """分析转换历史，识别常见模式"""
       patterns = {}
       
       for record in history_records:
           original_type = record['original_recipe']['type']
           target_type = record['final_result']['type']
           
           key = f"{original_type} -> {target_type}"
           if key not in patterns:
               patterns[key] = {
                   'count': 0,
                   'user_acceptance_rate': 0,
                   'avg_confidence': 0,
                   'common_modifications': []
               }
           
           patterns[key]['count'] += 1
           if record['user_action']['action'] == 'accepted':
               patterns[key]['user_acceptance_rate'] += 1
       
       return patterns
   ```

2. **规则提取**
   ```python
   def extract_rules_from_history(patterns, min_confidence=0.8, min_samples=10):
       """从转换模式中提取可靠的规则"""
       rules = []
       
       for pattern_key, stats in patterns.items():
           if (stats['count'] >= min_samples and 
               stats['user_acceptance_rate'] / stats['count'] >= min_confidence):
               
               original, target = pattern_key.split(' -> ')
               rules.append({
                   'condition': {'original_type': original},
                   'action': {'target_type': target},
                   'confidence': stats['user_acceptance_rate'] / stats['count'],
                   'source': 'learned_from_history',
                   'samples': stats['count']
               })
       
       return rules
   ```

3. **性能指标跟踪**
   - LLM 推荐准确率（用户接受率）
   - 平均置信度 vs 实际准确率
   - 各配方类型的转换成功率
   - 处理时间和成本统计

### 5. 完整工作流

```
┌─────────────┐
│ 用户上传    │
│ JSON/Script │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  输入解析器     │
│ ┌─────────────┐ │
│ │JSON Parser  │ │
│ │KubeJS Parser│ │
│ └─────────────┘ │
└──────┬──────────┘
       │
       ▼
┌─────────────────────┐
│ 统一中间格式        │
│ ┌─────────────────┐ │
│ │ internal_id     │ │
│ │ source          │ │
│ │ recipe_data     │ │
│ │ parsing_info    │ │
│ └─────────────────┘ │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────────┐
│ LLM 转换引擎            │
│ ┌─────────────────────┐ │
│ │ 1. 加载配方类型元数据│ │
│ │ 2. 构建 Prompt      │ │
│ │ 3. 调用 LLM API     │ │
│ │ 4. 解析响应         │ │
│ │ 5. 验证输出         │ │
│ └─────────────────────┘ │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ 结果分类                │
│ ┌─────────────────────┐ │
│ │ ✓ 高置信度 (>85%)  │ │
│ │ ⚠ 中置信度 (60-85%)│ │
│ │ ✗ 低置信度 (<60%)  │ │
│ │ ❌ 处理失败         │ │
│ └─────────────────────┘ │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ 交互审核界面            │
│ ┌─────────────────────┐ │
│ │ 原始 ←→ 转换后     │ │
│ │ 并排对比            │ │
│ │ 实时编辑            │ │
│ │ 批量操作            │ │
│ └─────────────────────┘ │
│ 用户选择：              │
│ [✓接受] [✗拒绝] [✏️编辑]│
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ 输出生成                │
│ ┌─────────────────────┐ │
│ │ KubeJS JSON         │ │
│ │ KubeJS Script       │ │
│ │ Datapack JSON       │ │
│ └─────────────────────┘ │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ 历史记录保存            │
│ ┌─────────────────────┐ │
│ │ 原始配方            │ │
│ │ LLM推荐             │ │
│ │ 用户操作            │ │
│ │ 最终结果            │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

**工作流说明**：

1. **用户上传** (0.1s)
   - 上传 JSON 文件或粘贴 KubeJS 脚本
   - 支持拖放和批量上传

2. **输入解析** (0.5s per 100 recipes)
   - 自动检测格式
   - 提取配方定义
   - 验证基本格式

3. **统一中间格式** (0.1s per recipe)
   - 转换为标准内部格式
   - 标准化字段名称
   - 提取元数据

4. **LLM 转换引擎** (1-3s per recipe, 取决于 LLM)
   - 并行或批量处理
   - 智能 Prompt 构建
   - 响应解析和验证

5. **结果分类** (0.01s per recipe)
   - 根据置信度分类
   - 标记警告和错误
   - 计算统计信息

6. **交互审核** (用户时间)
   - 展示需要审核的配方
   - 支持快速批量操作
   - 实时预览效果

7. **输出生成** (0.5s per 100 recipes)
   - 根据配置生成文件
   - 格式化代码
   - 添加注释和元数据

8. **历史记录** (0.1s per record)
   - 异步保存到数据库
   - 不阻塞主流程

**性能目标**：
- 小批量（<10配方）：<10秒完成
- 中批量（10-100配方）：<1分钟完成
- 大批量（100-1000配方）：<10分钟完成（使用并行处理）

---

## English

### Overview

Delightify is an LLM-driven Minecraft recipe conversion system that intelligently converts recipes from various sources into unified formats. The system features a flexible architecture supporting multiple input/output formats and uses LLM for intelligent recipe type recommendation and conversion.

**Current Stage**: LLM-driven approach (100%) - Fast, intelligent, explainable

**Future Plan**: Hybrid architecture - Rule engine (80%) → Local LLM (15%) → Manual review (5%)

### 1. Input System Design

#### 1.1 Unified Intermediate Format Specification

The system defines a standard intermediate format for uniformly processing recipe data from different sources:

```json
{
  "internal_id": "temp_uuid_12345",
  "source": {
    "type": "json_upload",
    "filename": "recipes.json",
    "upload_time": "2024-01-14T08:00:00Z",
    "original_format": "minecraft:crafting_shaped"
  },
  "recipe_data": {
    "inputs": [...],
    "outputs": [...],
    "original_type": "minecraft:crafting_shaped",
    "extra_properties": {...}
  },
  "parsing_info": {
    "status": "success",
    "warnings": [],
    "errors": [],
    "timestamp": "2024-01-14T08:00:01Z"
  }
}
```

#### 1.2 Two Input Modes

**Mode 1: JSON File Upload/Manual Input**
- Standard Minecraft recipe JSON (single or array)
- Batch recipe format

**Mode 2: KubeJS Script Parsing**
- Parse recipe definitions from `ServerEvents.recipes()` callback
- AST parsing of JavaScript code
- Extract recipe calls and convert to intermediate format

#### 1.3 Processing Queue

The system maintains a recipe processing queue tracking the status of each recipe.

### 2. Metadata System Design

#### 2.1 Recipe Type Metadata Database Structure

```
config/
├── recipe_types/
│   ├── builtin/              # Built-in common recipe types
│   │   ├── minecraft.json
│   │   ├── farmers_delight.json
│   │   ├── create.json
│   └── custom/               # User-defined extensions
├── item_categories.json
└── mapping_rules.json
```

#### 2.2 Recipe Type Metadata Format

Each recipe type definition includes:
- Display name, description, icon
- Template structure
- Field specifications (required/optional, type, defaults, ranges)
- Suitable scenarios (item categories, keywords, input/output counts)
- Incompatible scenarios

### 3. Output System Design

#### 3.1 Output Configuration Options

```json
{
  "output_config": {
    "format": "kubejs_script",
    "grouping": "by_type",
    "include_metadata": true,
    "mark_suspicious": true
  }
}
```

#### 3.2 Three Output Formats

1. **KubeJS JSON** (for datapacks)
2. **KubeJS Script** (.js files with comments)
3. **Datapack JSON** (vanilla datapack format)

#### 3.3 Suspicious Recipe Marking System

- Marking reasons (low confidence, removed fields, default values)
- Severity levels (error/warning/info)
- Suggested actions

#### 3.4 In-system Preview and Editing

- Side-by-side comparison of original and converted recipes
- Real-time editing support
- Batch operations

### 4. LLM-Driven Conversion System

#### 4.1 Model Configuration

Supports multiple LLM providers:
- Ollama (local)
- OpenAI
- Anthropic
- Custom endpoints

Configuration includes temperature, tokens, timeout, retry settings, and fallback chains.

#### 4.2 Prompt Engineering

- **System Prompt**: Defines role, task, criteria, output requirements
- **User Prompt**: Includes recipe info, context, format requirements
- **Batch Prompt**: Process multiple recipes at once
- Dynamic injection of recipe type metadata

#### 4.3 LLM Output Format

```json
{
  "analysis": {...},
  "recommendation": {
    "target_type": "...",
    "confidence": 95,
    "reasoning": "...",
    "alternatives": [...]
  },
  "converted_recipe": {...},
  "warnings": [...],
  "requires_review": false
}
```

#### 4.4 Response Parsing and Error Handling

- JSON extraction and validation
- Retry strategy with exponential backoff
- Fallback to manual processing on failure

#### 4.5 Data Accumulation System

- Record conversion history (LLM recommendations, user actions, final results)
- Provide training data for future rule engine
- Analyze conversion patterns to generate rules

### 5. Complete Workflow

```
User Upload → Input Parsing → Unified Format → LLM Engine → 
Result Classification → Interactive Review → Output Generation + History Recording
```

**Performance Targets**:
- Small batch (<10 recipes): <10 seconds
- Medium batch (10-100 recipes): <1 minute
- Large batch (100-1000 recipes): <10 minutes (with parallel processing)

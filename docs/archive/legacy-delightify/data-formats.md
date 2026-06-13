# (已过时)数据格式规范 / Data Format Specification

[中文](#中文) | [English](#english)

---

## 中文

本文档详细定义 Delightify 系统中所有数据的输入输出格式规范。

### 1. 统一中间格式完整规范

#### 1.1 格式说明

统一中间格式是系统内部使用的标准数据结构，用于表示从各种来源解析的配方。

```json
{
  "internal_id": "temp_uuid_a1b2c3d4",
  "source": {
    "type": "json_upload",
    "filename": "custom_recipes.json",
    "upload_time": "2024-01-14T10:30:00Z",
    "original_format": "minecraft:crafting_shaped",
    "line_number": 15,
    "batch_id": "batch_20240114_001"
  },
  "recipe_data": {
    "inputs": [
      {
        "type": "item",
        "item": "minecraft:iron_ingot",
        "count": 3,
        "nbt": null,
        "tag": null
      },
      {
        "type": "tag",
        "tag": "forge:gems/diamond",
        "count": 1
      }
    ],
    "outputs": [
      {
        "type": "item",
        "item": "modpack:custom_tool",
        "count": 1,
        "chance": 1.0,
        "nbt": {
          "Damage": 0,
          "display": {
            "Name": "{\"text\":\"Custom Tool\"}"
          }
        }
      }
    ],
    "original_type": "minecraft:crafting_shaped",
    "extra_properties": {
      "pattern": ["III", " D ", " S "],
      "key": {
        "I": {"item": "minecraft:iron_ingot"},
        "D": {"tag": "forge:gems/diamond"},
        "S": {"item": "minecraft:stick"}
      },
      "group": "tools"
    }
  },
  "parsing_info": {
    "status": "success",
    "warnings": [
      {
        "code": "UNKNOWN_FIELD",
        "message": "未知字段 'custom_property' 已被忽略",
        "field": "custom_property",
        "severity": "info"
      }
    ],
    "errors": [],
    "timestamp": "2024-01-14T10:30:01Z",
    "parser_version": "1.0.0"
  }
}
```

#### 1.2 字段详细说明

**顶层字段**：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `internal_id` | string | 是 | 系统生成的临时唯一标识符（UUID格式） |
| `source` | object | 是 | 配方来源信息 |
| `recipe_data` | object | 是 | 核心配方数据 |
| `parsing_info` | object | 是 | 解析状态和元数据 |

**source 对象**：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `type` | string | 是 | 来源类型：json_upload, kubejs_script, manual_input |
| `filename` | string | 是 | 源文件名 |
| `upload_time` | string | 是 | 上传时间（ISO 8601格式） |
| `original_format` | string | 是 | 原始配方类型ID |
| `line_number` | integer | 否 | 在源文件中的行号（如果适用） |
| `batch_id` | string | 否 | 批次标识符 |

**recipe_data.inputs 数组元素**：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `type` | string | 是 | 输入类型：item, tag, fluid, energy |
| `item` | string | 条件 | 物品ID（当type=item时必需） |
| `tag` | string | 条件 | 标签ID（当type=tag时必需） |
| `fluid` | string | 条件 | 流体ID（当type=fluid时必需） |
| `count` | integer | 否 | 数量（默认：1） |
| `nbt` | object | 否 | NBT数据 |
| `chance` | float | 否 | 概率（0.0-1.0） |

**recipe_data.outputs 数组元素**：

与 inputs 类似，但通常包含 chance 字段表示输出概率。

**parsing_info 对象**：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `status` | string | 是 | 解析状态：success, partial, failed |
| `warnings` | array | 是 | 警告列表 |
| `errors` | array | 是 | 错误列表 |
| `timestamp` | string | 是 | 解析时间戳 |
| `parser_version` | string | 否 | 解析器版本 |

### 2. 输入格式

#### 2.1 标准 Minecraft 配方 JSON

**有序合成（Shaped Crafting）**：

```json
{
  "type": "minecraft:crafting_shaped",
  "pattern": [
    "###",
    "# #",
    "###"
  ],
  "key": {
    "#": {
      "item": "minecraft:stick"
    }
  },
  "result": {
    "item": "minecraft:chest",
    "count": 1
  },
  "group": "storage"
}
```

**无序合成（Shapeless Crafting）**：

```json
{
  "type": "minecraft:crafting_shapeless",
  "ingredients": [
    {"item": "minecraft:wheat"},
    {"item": "minecraft:wheat"},
    {"item": "minecraft:wheat"}
  ],
  "result": {
    "item": "minecraft:bread",
    "count": 1
  }
}
```

**熔炼（Smelting）**：

```json
{
  "type": "minecraft:smelting",
  "ingredient": {
    "item": "minecraft:iron_ore"
  },
  "result": "minecraft:iron_ingot",
  "experience": 0.7,
  "cookingtime": 200
}
```

#### 2.2 KubeJS 脚本示例

**基础示例**：

```javascript
ServerEvents.recipes(event => {
  // 有序合成
  event.shaped('minecraft:chest', [
    '###',
    '# #',
    '###'
  ], {
    '#': 'minecraft:stick'
  });
  
  // 无序合成
  event.shapeless('minecraft:bread', [
    '3x minecraft:wheat'
  ]);
  
  // 自定义配方
  event.custom({
    type: 'farmersdelight:cooking',
    ingredients: [
      {item: 'minecraft:carrot'},
      {item: 'minecraft:potato'}
    ],
    result: {item: 'farmersdelight:vegetable_soup'},
    cookingtime: 200
  });
  
  // 熔炼
  event.smelting('minecraft:iron_ingot', 'minecraft:iron_ore');
  
  // 使用标签
  event.shaped('modpack:tool', [
    'III',
    ' S ',
    ' S '
  ], {
    'I': '#forge:ingots/iron',
    'S': '#forge:rods/wooden'
  });
});
```

**高级示例（带条件和修改器）**：

```javascript
ServerEvents.recipes(event => {
  // 带 ID 的配方
  event.custom({
    type: 'create:mixing',
    ingredients: [
      {item: 'minecraft:copper_ingot'},
      {item: 'minecraft:zinc_ingot'}
    ],
    results: [
      {item: 'create:brass_ingot', count: 2}
    ],
    heatRequirement: 'heated'
  }).id('modpack:brass_from_ingots');
  
  // 带概率输出
  event.custom({
    type: 'create:crushing',
    ingredients: [
      {item: 'minecraft:iron_ore'}
    ],
    results: [
      {item: 'create:crushed_iron', count: 1},
      {item: 'create:crushed_iron', count: 2, chance: 0.75},
      {item: 'minecraft:cobblestone', count: 1, chance: 0.12}
    ],
    processingTime: 150
  });
});
```

#### 2.3 批量输入格式

**JSON 数组格式**：

```json
[
  {
    "type": "farmersdelight:cooking",
    "ingredients": [...],
    "result": {...}
  },
  {
    "type": "create:crushing",
    "ingredients": [...],
    "results": [...]
  },
  ...
]
```

**带元数据的批量格式**：

```json
{
  "batch_info": {
    "name": "Custom Food Recipes",
    "description": "添加自定义食物配方",
    "author": "ModpackDev",
    "version": "1.0.0",
    "date": "2024-01-14"
  },
  "recipes": [
    {
      "type": "farmersdelight:cooking",
      "ingredients": [...],
      "result": {...},
      "metadata": {
        "comment": "蔬菜汤配方",
        "tags": ["food", "soup"]
      }
    },
    ...
  ]
}
```

### 3. 输出格式

#### 3.1 KubeJS JSON 完整示例

**目录结构**：

```
output/kubejs/data/
├── modpack/
│   └── recipes/
│       ├── farmersdelight/
│       │   ├── cooking/
│       │   │   ├── vegetable_soup.json
│       │   │   └── pumpkin_soup.json
│       │   └── cutting/
│       │       └── carrot_slices.json
│       └── create/
│           ├── crushing/
│           │   └── iron_ore.json
│           └── mixing/
│               └── brass_ingot.json
```

**单个文件内容** (`vegetable_soup.json`):

```json
{
  "type": "farmersdelight:cooking",
  "ingredients": [
    {
      "item": "minecraft:carrot"
    },
    {
      "item": "minecraft:potato"
    },
    {
      "item": "minecraft:beetroot"
    }
  ],
  "result": {
    "item": "farmersdelight:vegetable_soup"
  },
  "container": {
    "item": "minecraft:bowl"
  },
  "cookingtime": 200,
  "experience": 0.35
}
```

#### 3.2 KubeJS Script 完整示例

**单文件输出** (`farmersdelight_cooking.js`):

```javascript
// =============================================================================
// Generated by Delightify v1.0.0
// Generation Date: 2024-01-14T10:30:00Z
// Total Recipes: 5
// Recipe Type: farmersdelight:cooking
// =============================================================================

ServerEvents.recipes(event => {
  
  // ===== High Confidence Recipes (4) =====
  
  // Vegetable Soup
  // Confidence: 95% | Source: custom_recipes.json:15
  // Conversion: modA:cooking_pot -> farmersdelight:cooking
  event.custom({
    type: 'farmersdelight:cooking',
    ingredients: [
      {item: 'minecraft:carrot'},
      {item: 'minecraft:potato'},
      {item: 'minecraft:beetroot'}
    ],
    result: {
      item: 'farmersdelight:vegetable_soup'
    },
    container: {item: 'minecraft:bowl'},
    cookingtime: 200,
    experience: 0.35
  }).id('modpack:farmersdelight/cooking/vegetable_soup');
  
  // Pumpkin Soup
  // Confidence: 92% | Source: custom_recipes.json:28
  event.custom({
    type: 'farmersdelight:cooking',
    ingredients: [
      {item: 'minecraft:pumpkin'},
      {item: 'minecraft:sugar'}
    ],
    result: {
      item: 'farmersdelight:pumpkin_soup'
    },
    container: {item: 'minecraft:bowl'},
    cookingtime: 200,
    experience: 0.35
  }).id('modpack:farmersdelight/cooking/pumpkin_soup');
  
  // Mushroom Stew
  // Confidence: 90% | Source: custom_recipes.json:41
  event.custom({
    type: 'farmersdelight:cooking',
    ingredients: [
      {item: 'minecraft:brown_mushroom'},
      {item: 'minecraft:red_mushroom'}
    ],
    result: {
      item: 'minecraft:mushroom_stew'
    },
    container: {item: 'minecraft:bowl'},
    cookingtime: 200,
    experience: 0.35
  }).id('modpack:farmersdelight/cooking/mushroom_stew');
  
  // Rabbit Stew
  // Confidence: 88% | Source: custom_recipes.json:54
  event.custom({
    type: 'farmersdelight:cooking',
    ingredients: [
      {item: 'minecraft:cooked_rabbit'},
      {item: 'minecraft:carrot'},
      {item: 'minecraft:baked_potato'},
      {item: 'minecraft:brown_mushroom'}
    ],
    result: {
      item: 'minecraft:rabbit_stew'
    },
    container: {item: 'minecraft:bowl'},
    cookingtime: 250,
    experience: 0.5
  }).id('modpack:farmersdelight/cooking/rabbit_stew');
  
  
  // ===== Medium Confidence - Review Recommended (1) =====
  
  // [⚠️ REVIEW] Suspicious Sushi
  // Confidence: 65% | Source: custom_recipes.json:68
  // WARNING: Unusual input count for cooking recipe
  // WARNING: Original recipe used crafting table
  // INFO: Added default cookingtime value (200)
  // Conversion: minecraft:crafting_shapeless -> farmersdelight:cooking
  // 
  // Reason for low confidence:
  // - Original recipe was shapeless crafting, semantic analysis suggests cooking is more appropriate
  // - Input count (2) is lower than typical for cooking recipes
  // 
  // Suggested actions:
  // - Verify that cooking is the correct method for this item
  // - Check if cookingtime (200) is appropriate
  // - Consider alternatives: minecraft:crafting_shapeless (30% confidence)
  // 
  event.custom({
    type: 'farmersdelight:cooking',
    ingredients: [
      {item: 'minecraft:rice'},
      {item: 'minecraft:fish'}
    ],
    result: {
      item: 'modA:sushi'
    },
    cookingtime: 200,  // ⚠️ Default value added
    experience: 0.0
  }).id('modpack:farmersdelight/cooking/suspicious_sushi');
  
});

// =============================================================================
// Conversion Summary:
// - Total recipes: 5
// - High confidence (>85%): 4
// - Medium confidence (60-85%): 1
// - Low confidence (<60%): 0
// - Failed: 0
// 
// Please review recipes marked with [⚠️ REVIEW] before using in production.
// =============================================================================
```

**多文件输出（按类型分组）**：

- `farmersdelight_cooking.js` - Farmer's Delight 烹饪配方
- `farmersdelight_cutting.js` - Farmer's Delight 切割配方
- `create_crushing.js` - Create 粉碎配方
- `create_mixing.js` - Create 搅拌配方
- `minecraft_crafting.js` - Minecraft 合成配方

#### 3.3 带元数据的输出示例

**包含完整转换历史**：

```javascript
// =============================================================================
// Recipe: Vegetable Soup
// =============================================================================
// 
// Conversion Metadata:
// {
//   "conversion_id": "conv_20240114_001",
//   "original_recipe": {
//     "type": "modA:cooking_pot",
//     "ingredients": [...],
//     "result": {...},
//     "cooking_time": 100
//   },
//   "llm_analysis": {
//     "item_category": "复杂食物",
//     "key_indicators": [
//       "输出物品是汤类食物",
//       "需要3种蔬菜材料",
//       "原始配方使用cooking_pot"
//     ],
//     "confidence": 95,
//     "reasoning": "输出物品'vegetable_soup'明显是烹饪类食物..."
//   },
//   "modifications": [
//     {
//       "field": "cookingtime",
//       "action": "adjusted",
//       "from": 100,
//       "to": 200,
//       "reason": "标准化为 Farmer's Delight 默认值"
//     },
//     {
//       "field": "container",
//       "action": "added",
//       "value": {"item": "minecraft:bowl"},
//       "reason": "汤类食物需要容器"
//     },
//     {
//       "field": "experience",
//       "action": "added",
//       "value": 0.35,
//       "reason": "使用默认经验值"
//     }
//   ],
//   "llm_provider": "ollama_primary",
//   "llm_model": "qwen2.5:7b",
//   "processing_time_ms": 1250,
//   "timestamp": "2024-01-14T10:30:05Z"
// }
//
event.custom({
  type: 'farmersdelight:cooking',
  ingredients: [
    {item: 'minecraft:carrot'},
    {item: 'minecraft:potato'},
    {item: 'minecraft:beetroot'}
  ],
  result: {
    item: 'farmersdelight:vegetable_soup'
  },
  container: {item: 'minecraft:bowl'},
  cookingtime: 200,
  experience: 0.35
}).id('modpack:farmersdelight/cooking/vegetable_soup');
```

#### 3.4 可疑配方标记示例

```javascript
// =============================================================================
// [🔴 ERROR] Failed Conversion - Manual Review Required
// =============================================================================
// 
// Recipe ID: failed_recipe_001
// Source: custom_recipes.json:125
// 
// Errors:
// - INVALID_OUTPUT: Output item 'unknown:mysterious_item' not recognized
// - MISSING_FIELD: Required field 'result' is missing or invalid
// 
// Original Recipe:
// {
//   "type": "modB:mysterious_processor",
//   "input": {"item": "minecraft:diamond"},
//   "output": {"item": "unknown:mysterious_item"}
// }
// 
// LLM Response:
// Unable to determine appropriate target recipe type.
// The input/output combination does not match any known pattern.
// 
// Suggested Actions:
// 1. Verify the output item ID is correct
// 2. Check if the mod 'unknown' is installed
// 3. Manually create the recipe using appropriate format
// 4. Contact support if this is a valid recipe that should be recognized
// 
// This recipe has been SKIPPED and will not be included in the output.
// =============================================================================

// =============================================================================
// [⚠️ WARNING] Low Confidence Conversion
// =============================================================================
// 
// Recipe ID: low_confidence_recipe_002
// Source: custom_recipes.json:138
// Confidence: 45%
// 
// Warnings:
// - LOW_CONFIDENCE: LLM confidence below threshold (45% < 60%)
// - SEMANTIC_MISMATCH: Output item suggests tool, but input suggests food
// - UNUSUAL_PATTERN: Input/output ratio unusual for recommended recipe type
// 
// Original Recipe:
// {
//   "type": "modC:workbench",
//   "materials": [
//     {"item": "minecraft:apple"},
//     {"item": "minecraft:stick"}
//   ],
//   "output": {"item": "modC:apple_on_stick"}
// }
// 
// LLM Recommendation:
// Target: minecraft:crafting_shapeless
// Reasoning: Simple combination of two items without specific arrangement.
// Alternative: farmersdelight:cutting (20% confidence)
// 
// This conversion is HIGHLY UNCERTAIN. Please review carefully.
// 
event.custom({
  type: 'minecraft:crafting_shapeless',
  ingredients: [
    {item: 'minecraft:apple'},
    {item: 'minecraft:stick'}
  ],
  result: {
    item: 'modC:apple_on_stick'
  }
}).id('modpack:questionable/apple_on_stick');  // ⚠️ VERIFY THIS RECIPE

// =============================================================================
// [ℹ️ INFO] Successful Conversion with Modifications
// =============================================================================
// 
// Recipe ID: modified_recipe_003
// Source: custom_recipes.json:152
// Confidence: 88%
// 
// Info Messages:
// - FIELD_REMOVED: Removed unsupported field 'priority' (value: 10)
// - FIELD_ADDED: Added default 'processingTime' (value: 100)
// - VALUE_ADJUSTED: Adjusted 'count' from 0 to 1 (invalid value corrected)
// 
// Modifications Applied:
// 1. Removed custom field 'priority' (not supported in target format)
// 2. Added default processing time
// 3. Corrected invalid count value
// 
// Review recommended to verify the modifications are acceptable.
// 
event.custom({
  type: 'create:crushing',
  ingredients: [
    {item: 'minecraft:gravel'}
  ],
  results: [
    {item: 'minecraft:sand', count: 1},  // ℹ️ count corrected from 0
    {item: 'minecraft:flint', count: 1, chance: 0.1}
  ],
  processingTime: 100  // ℹ️ default value added
}).id('modpack:create/crushing/gravel_to_sand');
```

### 4. 转换历史记录格式

#### 4.1 完整历史记录结构

```json
{
  "record_id": "record_uuid_20240114_12345",
  "batch_id": "batch_20240114_001",
  "timestamp": "2024-01-14T10:30:05Z",
  
  "original_recipe": {
    "type": "modA:cooking_pot",
    "ingredients": [
      {"item": "minecraft:carrot"},
      {"item": "minecraft:potato"},
      {"item": "minecraft:beetroot"}
    ],
    "result": {"item": "modA:vegetable_soup"},
    "cooking_time": 100
  },
  
  "source_info": {
    "filename": "custom_recipes.json",
    "line_number": 15,
    "upload_time": "2024-01-14T10:30:00Z",
    "batch_name": "Custom Food Recipes"
  },
  
  "llm_recommendation": {
    "target_type": "farmersdelight:cooking",
    "confidence": 95,
    "reasoning": "输出物品'vegetable_soup'明显是烹饪类食物，使用烹饪锅最为合适。原始配方已经使用cooking_pot，直接对应到farmersdelight:cooking。材料数量(3)在范围内(1-6)，且都是食材类物品。",
    "alternatives": [
      {
        "type": "minecraft:crafting_shapeless",
        "confidence": 30,
        "reason": "技术上可行，但语义不匹配 - 汤类食物应该需要烹饪而不是简单组合"
      }
    ],
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
    "warnings": [
      "原始cooking_time值(100)已调整为标准值(200)",
      "自动添加了container字段(bowl)，这是汤类食物的标准容器"
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
  
  "user_action": {
    "action": "accepted",
    "timestamp": "2024-01-14T10:31:00Z",
    "user_id": "user_12345",
    "modifications": null,
    "review_time_seconds": 55,
    "feedback": {
      "rating": "good",
      "comment": "Perfect conversion"
    }
  },
  
  "final_result": {
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
  
  "metadata": {
    "llm_provider": "ollama_primary",
    "llm_model": "qwen2.5:7b",
    "llm_temperature": 0.3,
    "processing_time_ms": 1250,
    "input_tokens": 450,
    "output_tokens": 320,
    "cost_usd": 0.0,
    "cache_hit": false,
    "retry_count": 0,
    "system_version": "1.0.0"
  },
  
  "quality_metrics": {
    "confidence_score": 0.95,
    "user_accepted": true,
    "required_modifications": false,
    "warning_count": 2,
    "error_count": 0
  }
}
```

#### 4.2 批量历史记录

```json
{
  "batch_summary": {
    "batch_id": "batch_20240114_001",
    "start_time": "2024-01-14T10:30:00Z",
    "end_time": "2024-01-14T10:35:00Z",
    "total_duration_seconds": 300,
    
    "statistics": {
      "total_recipes": 100,
      "successful": 95,
      "failed": 2,
      "requires_review": 3,
      
      "confidence_distribution": {
        "high": 80,
        "medium": 15,
        "low": 3
      },
      
      "user_actions": {
        "accepted": 85,
        "modified": 10,
        "rejected": 2,
        "pending": 3
      },
      
      "conversion_types": {
        "farmersdelight:cooking": 35,
        "create:crushing": 20,
        "create:mixing": 15,
        "minecraft:crafting_shapeless": 25,
        "minecraft:smelting": 5
      }
    },
    
    "performance": {
      "avg_processing_time_ms": 1200,
      "total_llm_calls": 100,
      "cache_hit_rate": 0.15,
      "total_cost_usd": 0.25,
      "avg_tokens_per_recipe": 770
    }
  },
  
  "records": [
    // 完整的历史记录数组
  ]
}
```

#### 4.3 用于机器学习的数据导出

```json
{
  "training_data_export": {
    "export_date": "2024-01-14T12:00:00Z",
    "version": "1.0.0",
    "total_samples": 1000,
    "date_range": {
      "from": "2024-01-01T00:00:00Z",
      "to": "2024-01-14T12:00:00Z"
    },
    
    "samples": [
      {
        "input_features": {
          "original_type": "modA:cooking_pot",
          "input_count": 3,
          "output_count": 1,
          "input_categories": ["vegetable", "vegetable", "vegetable"],
          "output_categories": ["food", "soup"],
          "input_items": ["minecraft:carrot", "minecraft:potato", "minecraft:beetroot"],
          "output_items": ["modA:vegetable_soup"],
          "has_container": false,
          "has_fluid": false,
          "has_energy": false,
          "extra_properties": ["cooking_time"]
        },
        
        "llm_prediction": {
          "target_type": "farmersdelight:cooking",
          "confidence": 0.95
        },
        
        "ground_truth": {
          "user_accepted_type": "farmersdelight:cooking",
          "user_modified": false,
          "correct_prediction": true
        },
        
        "metadata": {
          "record_id": "record_uuid_20240114_12345",
          "timestamp": "2024-01-14T10:30:05Z"
        }
      }
    ]
  }
}
```

---

## English

This document defines the detailed specifications for all input/output data formats in the Delightify system.

### 1. Unified Intermediate Format Specification

The unified intermediate format is the standard internal data structure used to represent recipes parsed from various sources. See the Chinese section above for the complete specification.

### 2. Input Formats

#### 2.1 Standard Minecraft Recipe JSON

Examples of standard Minecraft recipe formats:
- Shaped Crafting
- Shapeless Crafting
- Smelting

See the Chinese section for detailed examples.

#### 2.2 KubeJS Script Examples

Examples of KubeJS script parsing including:
- Basic recipes (shaped, shapeless, custom)
- Advanced recipes (with IDs, conditions, probability outputs)

#### 2.3 Batch Input Formats

- JSON array format
- Format with metadata

### 3. Output Formats

#### 3.1 KubeJS JSON Complete Example

Directory structure and file format for KubeJS JSON output.

#### 3.2 KubeJS Script Complete Example

Comprehensive JavaScript file with:
- Header comments
- High confidence recipes
- Medium confidence recipes with warnings
- Conversion summary

#### 3.3 Output with Metadata

Complete conversion history embedded in comments.

#### 3.4 Suspicious Recipe Marking Examples

Examples of error, warning, and info level markings:
- 🔴 ERROR: Failed conversions requiring manual review
- ⚠️ WARNING: Low confidence conversions
- ℹ️ INFO: Successful conversions with modifications

### 4. Conversion History Record Format

#### 4.1 Complete History Record Structure

Comprehensive record including:
- Original recipe
- LLM recommendation and analysis
- User actions
- Final result
- Metadata and quality metrics

#### 4.2 Batch History Records

Summary statistics for batch processing.

#### 4.3 Machine Learning Data Export

Structured format for extracting training data from conversion history to build future rule engines.

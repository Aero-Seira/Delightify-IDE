# (已过时)配置文档 / Configuration Guide

[中文](#中文) | [English](#english)

---

## 中文

本文档详细说明 Delightify 系统的所有配置文件格式和选项。

### 1. LLM 配置

#### 1.1 配置文件位置

`config/llm_config.json`

#### 1.2 完整配置示例

```json
{
  "llm_config": {
    "providers": [
      {
        "name": "ollama_primary",
        "type": "ollama",
        "enabled": true,
        "priority": 1,
        "description": "本地 Ollama 模型（推荐用于隐私和离线使用）",
        "config": {
          "base_url": "http://localhost:11434",
          "model": "qwen2.5:7b",
          "temperature": 0.3,
          "max_tokens": 2048,
          "timeout": 30,
          "retry": {
            "max_attempts": 3,
            "backoff_factor": 2,
            "initial_delay": 1
          }
        }
      },
      {
        "name": "openai_fallback",
        "type": "openai",
        "enabled": false,
        "priority": 2,
        "description": "OpenAI GPT 模型（需要 API key）",
        "config": {
          "api_key": "${OPENAI_API_KEY}",
          "model": "gpt-4",
          "temperature": 0.2,
          "max_tokens": 2048,
          "timeout": 60,
          "organization": null
        }
      },
      {
        "name": "anthropic_fallback",
        "type": "anthropic",
        "enabled": false,
        "priority": 3,
        "description": "Anthropic Claude 模型（需要 API key）",
        "config": {
          "api_key": "${ANTHROPIC_API_KEY}",
          "model": "claude-3-sonnet-20240229",
          "temperature": 0.2,
          "max_tokens": 2048,
          "timeout": 60
        }
      },
      {
        "name": "custom_endpoint",
        "type": "custom",
        "enabled": false,
        "priority": 4,
        "description": "自定义 LLM 端点（OpenAI 兼容 API）",
        "config": {
          "endpoint": "http://your-llm-server:8080/v1/chat/completions",
          "headers": {
            "Authorization": "Bearer ${CUSTOM_API_KEY}",
            "Content-Type": "application/json"
          },
          "model": "custom-model-name",
          "temperature": 0.3,
          "max_tokens": 2048,
          "timeout": 45
        }
      }
    ],
    
    "fallback_chain": {
      "enabled": true,
      "description": "当高优先级提供商失败时自动切换到下一个",
      "max_chain_attempts": 3,
      "stop_on_success": true
    },
    
    "batch_processing": {
      "mode": "adaptive",
      "description": "批量处理模式：sequential（顺序）、parallel（并行）、adaptive（自适应）",
      "max_parallel": 5,
      "batch_size": 10,
      "adaptive_config": {
        "initial_parallel": 2,
        "increase_threshold": 0.9,
        "decrease_threshold": 0.5,
        "max_increase_step": 2,
        "min_parallel": 1
      }
    },
    
    "cache": {
      "enabled": true,
      "description": "缓存 LLM 响应以提高性能和降低成本",
      "ttl_seconds": 86400,
      "max_size_mb": 100,
      "cache_key_fields": ["recipe_type", "inputs", "outputs"],
      "storage": "file",
      "path": "cache/llm_responses"
    },
    
    "cost_tracking": {
      "enabled": true,
      "description": "跟踪 API 使用成本",
      "pricing": {
        "openai": {
          "gpt-4": {
            "input_per_1k_tokens": 0.03,
            "output_per_1k_tokens": 0.06
          },
          "gpt-3.5-turbo": {
            "input_per_1k_tokens": 0.0015,
            "output_per_1k_tokens": 0.002
          }
        },
        "anthropic": {
          "claude-3-sonnet": {
            "input_per_1k_tokens": 0.015,
            "output_per_1k_tokens": 0.075
          }
        }
      },
      "alert_threshold_usd": 10.0,
      "log_path": "logs/cost_tracking.json"
    }
  }
}
```

#### 1.3 配置说明

**提供商配置（providers）**：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 提供商唯一标识符 |
| `type` | string | 是 | 类型：ollama, openai, anthropic, custom |
| `enabled` | boolean | 是 | 是否启用此提供商 |
| `priority` | integer | 是 | 优先级（数字越小优先级越高） |
| `config` | object | 是 | 提供商特定配置 |

**Ollama 配置**：

```json
{
  "base_url": "http://localhost:11434",  // Ollama 服务地址
  "model": "qwen2.5:7b",                 // 模型名称
  "temperature": 0.3,                     // 温度（0-1，越低越确定）
  "max_tokens": 2048,                     // 最大生成 tokens
  "timeout": 30                           // 超时时间（秒）
}
```

**OpenAI 配置**：

```json
{
  "api_key": "${OPENAI_API_KEY}",  // 从环境变量读取
  "model": "gpt-4",                // gpt-4, gpt-3.5-turbo 等
  "temperature": 0.2,
  "max_tokens": 2048,
  "organization": null             // 可选：组织 ID
}
```

**Anthropic 配置**：

```json
{
  "api_key": "${ANTHROPIC_API_KEY}",
  "model": "claude-3-sonnet-20240229",  // Claude 模型版本
  "temperature": 0.2,
  "max_tokens": 2048
}
```

**自定义端点配置**：

```json
{
  "endpoint": "http://your-server:8080/v1/chat/completions",
  "headers": {
    "Authorization": "Bearer ${CUSTOM_API_KEY}",
    "Custom-Header": "value"
  },
  "model": "model-name",
  "temperature": 0.3,
  "max_tokens": 2048
}
```

**批量处理配置**：

- `sequential`: 顺序处理，稳定但较慢
- `parallel`: 并行处理，快速但可能超出 API 限制
- `adaptive`: 自适应模式，根据成功率动态调整并行度

**缓存配置**：

启用缓存可以显著提高重复配方的处理速度并降低 API 成本。缓存键基于配方的关键字段生成。

#### 1.4 环境变量

在 `.env` 文件中设置 API keys：

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# 自定义
CUSTOM_API_KEY=your-key
```

### 2. 配方类型元数据配置

**重要新特性：Prompt 模板**

从 v1.0.0 开始，每个配方类型定义都支持 `prompt_template` 字段，允许用户为每种配方类型自定义 LLM 提示词，以帮助模型更好地理解和转换该类型的配方。

**prompt_template 字段结构**：

```json
{
  "prompt_template": {
    "description": "LLM提示词模板，用于帮助模型理解此配方类型",
    "template": "这里是提供给LLM的详细说明文本...\n\n包含：\n- 配方类型的关键特征\n- 判断标准\n- 典型应用场景\n- 注意事项"
  }
}
```

**作用说明**：

当 LLM 处理配方转换时，系统会将相关配方类型的 `prompt_template.template` 内容注入到用户提示词中，为 LLM 提供该配方类型的详细上下文信息，包括：

1. **关键特征**：配方类型的核心属性和字段说明
2. **判断标准**：如何判断一个配方是否适合此类型
3. **典型场景**：常见的使用示例和转换模式
4. **注意事项**：转换时需要注意的特殊规则和限制

这使得 LLM 能够更准确地：
- 识别配方应该转换到哪种类型
- 正确设置字段的默认值
- 避免常见的转换错误
- 提供更合理的置信度评估

**自定义建议**：

用户可以根据实际需求调整 `prompt_template.template`，使其：
- 更符合自己整合包的特点
- 强调特定的转换规则
- 添加模组特有的注意事项
- 提供更多或更少的示例

#### 2.1 Farmer's Delight 完整示例

`config/recipe_types/builtin/farmers_delight.json`

```json
{
  "mod_info": {
    "mod_id": "farmersdelight",
    "mod_name": "Farmer's Delight",
    "version": "1.0.0",
    "description": "农夫乐事模组配方类型定义"
  },
  
  "recipe_types": [
    {
      "recipe_type_id": "farmersdelight:cooking",
      "display_name": "烹饪 / Cooking",
      "description": "使用烹饪锅制作食物",
      "icon": "farmersdelight:cooking_pot",
      
      "template": {
        "type": "farmersdelight:cooking",
        "ingredients": [],
        "result": {},
        "cookingtime": 200,
        "experience": 0.0,
        "container": null
      },
      
      "field_specs": {
        "type": {
          "required": true,
          "type": "string",
          "constant": "farmersdelight:cooking"
        },
        "ingredients": {
          "required": true,
          "type": "array",
          "min_items": 1,
          "max_items": 6,
          "item_type": "ingredient",
          "description": "烹饪材料列表（1-6种）"
        },
        "result": {
          "required": true,
          "type": "item_stack",
          "description": "输出物品"
        },
        "cookingtime": {
          "required": false,
          "type": "integer",
          "default": 200,
          "range": [1, 72000],
          "unit": "ticks",
          "description": "烹饪时间（游戏刻，20 ticks = 1秒）"
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
          "default": null,
          "description": "容器物品（如碗、瓶子）",
          "common_values": [
            "minecraft:bowl",
            "minecraft:glass_bottle"
          ]
        }
      },
      
      "suitable_for": {
        "item_categories": [
          "food",
          "consumable",
          "cooked_food",
          "meal",
          "soup",
          "stew"
        ],
        "keywords": [
          "soup", "stew", "meal", "dish", "cooked",
          "汤", "炖菜", "料理", "熟食", "煮"
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
          "需要加热或烹饪的食物",
          "汤类或炖菜类食物",
          "使用碗或瓶子作为容器的食物"
        ]
      },
      
      "incompatible_with": {
        "output_categories": [
          "tool",
          "weapon",
          "armor",
          "block",
          "raw_material"
        ],
        "reasons": [
          "烹饪锅仅用于制作食物",
          "不支持非消耗品输出",
          "不适合制作工具、武器或装备"
        ]
      },
      
      "examples": [
        {
          "name": "蔬菜汤",
          "description": "使用多种蔬菜制作的汤",
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
        },
        {
          "name": "南瓜汤",
          "description": "简单的南瓜汤配方",
          "recipe": {
            "type": "farmersdelight:cooking",
            "ingredients": [
              {"item": "minecraft:pumpkin"}
            ],
            "result": {
              "item": "farmersdelight:pumpkin_soup"
            },
            "container": {"item": "minecraft:bowl"},
            "cookingtime": 200,
            "experience": 0.35
          }
        }
      ],
      
      "conversion_hints": {
        "from_crafting": {
          "description": "从工作台合成转换时的建议",
          "conditions": [
            "输出物品是食物",
            "材料数量在 1-6 之间",
            "食物名称包含汤、炖菜等关键词"
          ],
          "default_values": {
            "cookingtime": 200,
            "experience": 0.35,
            "container": "minecraft:bowl"
          }
        }
      }
    },
    
    {
      "recipe_type_id": "farmersdelight:cutting",
      "display_name": "切割 / Cutting",
      "description": "使用切菜板切割物品",
      "icon": "farmersdelight:cutting_board",
      
      "template": {
        "type": "farmersdelight:cutting",
        "ingredients": [],
        "tool": {"tag": "forge:tools/knives"},
        "result": []
      },
      
      "field_specs": {
        "type": {
          "required": true,
          "type": "string",
          "constant": "farmersdelight:cutting"
        },
        "ingredients": {
          "required": true,
          "type": "array",
          "min_items": 1,
          "max_items": 1,
          "description": "要切割的物品"
        },
        "tool": {
          "required": true,
          "type": "ingredient",
          "description": "使用的工具（通常是刀）",
          "default": {"tag": "forge:tools/knives"}
        },
        "result": {
          "required": true,
          "type": "array",
          "min_items": 1,
          "description": "切割结果（可以有多个输出）"
        },
        "sound": {
          "required": false,
          "type": "string",
          "description": "切割时的声音"
        }
      },
      
      "suitable_for": {
        "item_categories": [
          "food",
          "ingredient",
          "raw_food",
          "vegetable",
          "meat"
        ],
        "keywords": [
          "cut", "slice", "chop", "dice",
          "切", "切片", "切块", "切碎"
        ],
        "input_count": {
          "min": 1,
          "max": 1
        },
        "output_count": {
          "min": 1,
          "max": 4
        },
        "typical_patterns": [
          "将大块食材切成小块",
          "处理原料食材",
          "获得多个输出物品"
        ]
      },
      
      "examples": [
        {
          "name": "切割胡萝卜",
          "recipe": {
            "type": "farmersdelight:cutting",
            "ingredients": [
              {"item": "minecraft:carrot"}
            ],
            "tool": {"tag": "forge:tools/knives"},
            "result": [
              {"item": "farmersdelight:carrot_slices", "count": 3}
            ]
          }
        }
      ]
    }
  ]
}
```

#### 2.2 Create 完整示例

`config/recipe_types/builtin/create.json`

```json
{
  "mod_info": {
    "mod_id": "create",
    "mod_name": "Create",
    "version": "1.0.0",
    "description": "机械动力模组配方类型定义"
  },
  
  "recipe_types": [
    {
      "recipe_type_id": "create:crushing",
      "display_name": "粉碎 / Crushing",
      "description": "使用粉碎轮粉碎物品",
      "icon": "create:crushing_wheel",
      
      "template": {
        "type": "create:crushing",
        "ingredients": [],
        "results": [],
        "processingTime": 100
      },
      
      "field_specs": {
        "type": {
          "required": true,
          "type": "string",
          "constant": "create:crushing"
        },
        "ingredients": {
          "required": true,
          "type": "array",
          "min_items": 1,
          "max_items": 1,
          "description": "要粉碎的物品"
        },
        "results": {
          "required": true,
          "type": "array",
          "min_items": 1,
          "max_items": 7,
          "description": "粉碎结果（可以包含概率）",
          "item_format": {
            "item": "string",
            "count": "integer (optional, default: 1)",
            "chance": "float (optional, 0.0-1.0)"
          }
        },
        "processingTime": {
          "required": false,
          "type": "integer",
          "default": 100,
          "range": [1, 1000],
          "unit": "ticks",
          "description": "处理时间（游戏刻）"
        }
      },
      
      "suitable_for": {
        "item_categories": [
          "ore",
          "raw_material",
          "stone",
          "mineral",
          "gravel",
          "recyclable"
        ],
        "keywords": [
          "ore", "stone", "gravel", "crush", "grind",
          "矿石", "石头", "砂砾", "粉碎", "研磨"
        ],
        "input_count": {
          "min": 1,
          "max": 1
        },
        "output_count": {
          "min": 1,
          "max": 7
        },
        "typical_patterns": [
          "矿石加工获得粉末",
          "石头类物品粉碎",
          "回收物品获得原料",
          "一个输入多个输出（主产物+副产物）"
        ]
      },
      
      "examples": [
        {
          "name": "粉碎铁矿石",
          "recipe": {
            "type": "create:crushing",
            "ingredients": [
              {"item": "minecraft:iron_ore"}
            ],
            "results": [
              {"item": "create:crushed_iron", "count": 1},
              {"item": "create:crushed_iron", "count": 2, "chance": 0.75},
              {"item": "minecraft:cobblestone", "count": 1, "chance": 0.12}
            ],
            "processingTime": 150
          }
        }
      ]
    },
    
    {
      "recipe_type_id": "create:milling",
      "display_name": "研磨 / Milling",
      "description": "使用磨粉机研磨物品",
      "icon": "create:millstone",
      
      "template": {
        "type": "create:milling",
        "ingredients": [],
        "results": [],
        "processingTime": 100
      },
      
      "field_specs": {
        "type": {
          "required": true,
          "type": "string",
          "constant": "create:milling"
        },
        "ingredients": {
          "required": true,
          "type": "array",
          "min_items": 1,
          "max_items": 1,
          "description": "要研磨的物品"
        },
        "results": {
          "required": true,
          "type": "array",
          "min_items": 1,
          "description": "研磨结果"
        },
        "processingTime": {
          "required": false,
          "type": "integer",
          "default": 100
        }
      },
      
      "suitable_for": {
        "item_categories": [
          "grain",
          "seed",
          "plant",
          "mineral",
          "powder"
        ],
        "keywords": [
          "grain", "wheat", "seed", "flour", "powder",
          "谷物", "小麦", "种子", "面粉", "粉末"
        ],
        "typical_patterns": [
          "谷物研磨成粉末",
          "种子加工",
          "获得粉末类产物"
        ]
      },
      
      "examples": [
        {
          "name": "研磨小麦",
          "recipe": {
            "type": "create:milling",
            "ingredients": [
              {"item": "minecraft:wheat"}
            ],
            "results": [
              {"item": "create:wheat_flour", "count": 1}
            ],
            "processingTime": 50
          }
        }
      ]
    },
    
    {
      "recipe_type_id": "create:mixing",
      "display_name": "搅拌 / Mixing",
      "description": "使用搅拌器混合物品",
      "icon": "create:mechanical_mixer",
      
      "template": {
        "type": "create:mixing",
        "ingredients": [],
        "results": [],
        "heatRequirement": "none"
      },
      
      "field_specs": {
        "ingredients": {
          "required": true,
          "type": "array",
          "min_items": 1,
          "max_items": 9,
          "description": "混合材料"
        },
        "results": {
          "required": true,
          "type": "array",
          "description": "混合结果"
        },
        "heatRequirement": {
          "required": false,
          "type": "string",
          "enum": ["none", "heated", "superheated"],
          "default": "none",
          "description": "热量需求"
        }
      },
      
      "suitable_for": {
        "item_categories": [
          "alloy",
          "compound",
          "mixture",
          "dough",
          "liquid"
        ],
        "keywords": [
          "mix", "blend", "combine", "alloy",
          "混合", "搅拌", "合金", "组合"
        ],
        "typical_patterns": [
          "多种材料混合",
          "制作合金或化合物",
          "液体混合"
        ]
      },
      
      "examples": [
        {
          "name": "混合安山合金",
          "recipe": {
            "type": "create:mixing",
            "ingredients": [
              {"item": "minecraft:andesite"},
              {"item": "minecraft:iron_nugget"}
            ],
            "results": [
              {"item": "create:andesite_alloy", "count": 1}
            ],
            "heatRequirement": "heated"
          }
        }
      ]
    }
  ]
}
```

#### 2.3 Minecraft 原版示例

`config/recipe_types/builtin/minecraft.json`

```json
{
  "mod_info": {
    "mod_id": "minecraft",
    "mod_name": "Minecraft",
    "version": "1.0.0",
    "description": "Minecraft 原版配方类型定义"
  },
  
  "recipe_types": [
    {
      "recipe_type_id": "minecraft:crafting_shaped",
      "display_name": "有序合成 / Shaped Crafting",
      "description": "工作台有序合成",
      "icon": "minecraft:crafting_table",
      
      "template": {
        "type": "minecraft:crafting_shaped",
        "pattern": [],
        "key": {},
        "result": {}
      },
      
      "suitable_for": {
        "item_categories": ["tool", "weapon", "armor", "block", "item"],
        "keywords": ["craft", "shape", "pattern", "合成", "工作台"],
        "typical_patterns": [
          "需要特定摆放位置的合成",
          "工具、武器、装备制作",
          "建筑方块制作"
        ]
      }
    },
    {
      "recipe_type_id": "minecraft:crafting_shapeless",
      "display_name": "无序合成 / Shapeless Crafting",
      "description": "工作台无序合成",
      "icon": "minecraft:crafting_table",
      
      "suitable_for": {
        "item_categories": ["dye", "simple_item", "food"],
        "keywords": ["combine", "mix", "组合", "混合"],
        "typical_patterns": [
          "不需要特定摆放的简单组合",
          "染料制作",
          "简单物品转换"
        ]
      }
    },
    {
      "recipe_type_id": "minecraft:smelting",
      "display_name": "熔炼 / Smelting",
      "description": "熔炉熔炼",
      "icon": "minecraft:furnace",
      
      "suitable_for": {
        "item_categories": ["ore", "raw_food", "material"],
        "keywords": ["smelt", "cook", "熔炼", "烧制"],
        "typical_patterns": [
          "矿石熔炼成锭",
          "生食烹饪",
          "材料加工"
        ]
      }
    }
  ]
}
```

#### 2.4 自定义配方类型模板

`config/recipe_types/custom/template.json`

```json
{
  "mod_info": {
    "mod_id": "your_mod_id",
    "mod_name": "Your Mod Name",
    "version": "1.0.0",
    "description": "您的模组配方类型定义"
  },
  
  "recipe_types": [
    {
      "recipe_type_id": "your_mod:your_recipe_type",
      "display_name": "显示名称",
      "description": "详细描述",
      "icon": "your_mod:icon_item",
      
      "template": {
        "type": "your_mod:your_recipe_type",
        // 在这里定义配方模板字段
      },
      
      "field_specs": {
        // 定义每个字段的规范
      },
      
      "suitable_for": {
        "item_categories": [],
        "keywords": [],
        "input_count": {"min": 1, "max": 9},
        "output_count": {"min": 1, "max": 1},
        "typical_patterns": []
      },
      
      "incompatible_with": {
        "output_categories": [],
        "reasons": []
      },
      
      "examples": []
    }
  ]
}
```

### 3. 输出配置

#### 3.1 输出配置文件

`config/output_config.json`

```json
{
  "output_profiles": {
    "default": {
      "format": "kubejs_script",
      "grouping": "by_type",
      "include_metadata": true,
      "mark_suspicious": true,
      "base_path": "output/",
      "filename_pattern": "{mod_id}_{recipe_type}.js",
      "header_template": "// Generated by Delightify\n// Date: {date}\n// Total Recipes: {count}\n\n",
      "sorting": {
        "enabled": true,
        "by": "recipe_type"
      }
    },
    
    "datapack": {
      "format": "datapack_json",
      "grouping": "individual_files",
      "include_metadata": false,
      "mark_suspicious": false,
      "base_path": "output/datapack/data/",
      "filename_pattern": "{namespace}/recipes/{recipe_id}.json",
      "include_pack_mcmeta": true,
      "pack_format": 10
    },
    
    "kubejs_json": {
      "format": "kubejs_json",
      "grouping": "by_type",
      "include_metadata": false,
      "base_path": "output/kubejs/data/",
      "filename_pattern": "{namespace}/recipes/{recipe_type}/{recipe_id}.json"
    },
    
    "review_mode": {
      "format": "kubejs_script",
      "grouping": "single_file",
      "include_metadata": true,
      "mark_suspicious": true,
      "only_suspicious": true,
      "base_path": "output/review/",
      "filename_pattern": "needs_review_{timestamp}.js"
    }
  },
  
  "active_profile": "default"
}
```

#### 3.2 配置选项说明

| 选项 | 类型 | 说明 | 可选值 |
|------|------|------|--------|
| `format` | string | 输出格式 | kubejs_script, kubejs_json, datapack_json |
| `grouping` | string | 分组方式 | by_type, single_file, individual_files |
| `include_metadata` | boolean | 包含转换元数据 | true, false |
| `mark_suspicious` | boolean | 标记可疑配方 | true, false |
| `base_path` | string | 输出基础路径 | 任意路径 |
| `filename_pattern` | string | 文件名模板 | 支持变量：{mod_id}, {recipe_type}, {recipe_id}, {namespace}, {date}, {timestamp}, {count} |

---

## English

This document details all configuration file formats and options for the Delightify system.

### 1. LLM Configuration

#### 1.1 Configuration File Location

`config/llm_config.json`

#### 1.2 Complete Configuration Example

See the Chinese section above for the complete JSON configuration example.

#### 1.3 Configuration Explanation

**Provider Configuration**:
- `name`: Unique provider identifier
- `type`: Provider type (ollama, openai, anthropic, custom)
- `enabled`: Whether this provider is enabled
- `priority`: Priority (lower number = higher priority)
- `config`: Provider-specific configuration

**Batch Processing Modes**:
- `sequential`: Process one at a time (stable but slow)
- `parallel`: Process multiple simultaneously (fast but may hit API limits)
- `adaptive`: Dynamically adjust parallelism based on success rate

**Cache Configuration**:
Enabling cache can significantly improve processing speed for duplicate recipes and reduce API costs.

#### 1.4 Environment Variables

Set API keys in `.env` file:

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
CUSTOM_API_KEY=your-key
```

### 2. Recipe Type Metadata Configuration

See the Chinese section for complete examples of:
- Farmer's Delight configuration
- Create mod configuration
- Minecraft vanilla configuration
- Custom recipe type template

### 3. Output Configuration

#### 3.1 Output Profiles

The system supports multiple output profiles for different use cases:
- `default`: Standard KubeJS script output with metadata
- `datapack`: Vanilla datapack format
- `kubejs_json`: KubeJS JSON format for datapacks
- `review_mode`: Only outputs recipes that need review

#### 3.2 Configuration Options

| Option | Type | Description | Values |
|--------|------|-------------|--------|
| `format` | string | Output format | kubejs_script, kubejs_json, datapack_json |
| `grouping` | string | File grouping method | by_type, single_file, individual_files |
| `include_metadata` | boolean | Include conversion metadata | true, false |
| `mark_suspicious` | boolean | Mark suspicious recipes | true, false |
| `base_path` | string | Output base path | Any path |
| `filename_pattern` | string | Filename template | Supports variables: {mod_id}, {recipe_type}, {recipe_id}, {namespace}, {date}, {timestamp}, {count} |

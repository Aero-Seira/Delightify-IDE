# 自定义配方类型 / Custom Recipe Types

[中文](#中文) | [English](#english)

---

## 中文

### 概述

此目录用于存放用户自定义的配方类型定义。您可以通过添加 JSON 文件来扩展 Delightify 支持的配方类型。

### 如何添加自定义配方类型

#### 1. 创建配方类型定义文件

在此目录下创建一个 JSON 文件，例如 `my_mod.json`：

```json
{
  "mod_info": {
    "mod_id": "mymod",
    "mod_name": "My Awesome Mod",
    "version": "1.0.0",
    "description": "我的模组配方类型定义"
  },
  "recipe_types": [
    {
      "recipe_type_id": "mymod:custom_processor",
      "display_name": "自定义处理器",
      "description": "使用自定义处理器加工物品",
      "icon": "mymod:custom_processor",
      
      "template": {
        "type": "mymod:custom_processor",
        "input": {},
        "output": {},
        "processing_time": 100
      },
      
      "field_specs": {
        "type": {
          "required": true,
          "type": "string",
          "constant": "mymod:custom_processor"
        },
        "input": {
          "required": true,
          "type": "ingredient",
          "description": "输入物品"
        },
        "output": {
          "required": true,
          "type": "item_stack",
          "description": "输出物品"
        },
        "processing_time": {
          "required": false,
          "type": "integer",
          "default": 100,
          "range": [1, 1000],
          "description": "处理时间"
        }
      },
      
      "suitable_for": {
        "item_categories": ["raw_material", "ore"],
        "keywords": ["process", "加工"],
        "input_count": {"min": 1, "max": 1},
        "output_count": {"min": 1, "max": 1},
        "typical_patterns": [
          "原材料加工",
          "矿物处理"
        ]
      },
      
      "incompatible_with": {
        "output_categories": ["food"],
        "reasons": ["此处理器不用于食物加工"]
      },
      
      "prompt_template": {
        "description": "LLM提示词模板，帮助模型理解此配方类型 / LLM prompt template to help model understand this recipe type",
        "template": "这是自定义处理器配方类型。用于加工原材料和矿物。\n\n关键特征：\n- 单个输入，单个输出\n- 处理时间可配置\n- 适用于原材料和矿石加工\n\n判断标准：\n1. 如果是原材料加工，考虑使用此类型\n2. 如果输入输出都是单个物品，此类型可能合适\n\n注意事项：\n- 不适用于食物制作\n- 处理时间应该合理（建议100-200游戏刻）\n\nThis is a custom processor recipe type for processing raw materials and ores.\n\nKey features:\n- Single input, single output\n- Configurable processing time\n- Suitable for raw material and ore processing\n\nJudgment criteria:\n1. If processing raw materials, consider this type\n2. If both input and output are single items, this type may be suitable\n\nNotes:\n- Not suitable for food making\n- Processing time should be reasonable (recommend 100-200 ticks)"
      },
      
      "examples": [
        {
          "name": "处理铁矿石",
          "recipe": {
            "type": "mymod:custom_processor",
            "input": {"item": "minecraft:iron_ore"},
            "output": {"item": "minecraft:iron_ingot", "count": 2},
            "processing_time": 150
          }
        }
      ]
    }
  ]
}
```

#### 2. 字段说明

**必需字段**：

- `mod_info`: 模组信息
  - `mod_id`: 模组 ID
  - `mod_name`: 模组显示名称
  - `version`: 版本号
  - `description`: 描述

- `recipe_types`: 配方类型数组
  - `recipe_type_id`: 配方类型 ID（格式：`modid:type_name`）
  - `display_name`: 显示名称
  - `description`: 描述
  - `template`: 配方模板结构
  - `field_specs`: 字段规范定义

**推荐字段**：

- `icon`: 图标物品 ID
- `suitable_for`: 适用场景
  - `item_categories`: 适用的物品类别
  - `keywords`: 关键词列表
  - `input_count`: 输入数量范围
  - `output_count`: 输出数量范围
  - `typical_patterns`: 典型使用模式
- `incompatible_with`: 不兼容的情况
- `examples`: 示例配方
- **`prompt_template`**: LLM 提示词模板（**强烈推荐**）
  - `description`: 模板说明
  - `template`: 提供给 LLM 的详细指导文本

**prompt_template 详细说明**：

`prompt_template` 是一个**强烈推荐**的字段，用于为 LLM 提供该配方类型的详细上下文信息。当 LLM 处理配方转换时，系统会将此模板内容注入到提示词中，帮助 LLM 更准确地：

- 理解配方类型的特点和用途
- 判断何时应该使用此配方类型
- 正确设置字段的默认值和范围
- 避免常见的转换错误

推荐在模板中包含：
1. **关键特征**：配方类型的核心属性
2. **判断标准**：如何判断配方是否适合此类型
3. **典型应用场景**：具体的使用示例
4. **注意事项**：转换时的特殊规则和限制
5. **中英文双语**：更好地支持多语言环境

示例模板结构：
```
这是XXX配方类型。用于...

关键特征：
- 特征1
- 特征2

判断标准：
1. 标准1
2. 标准2

注意事项：
- 注意事项1
- 注意事项2

[English translation...]
```

#### 3. 字段类型说明

在 `field_specs` 中可以使用以下类型：

- `string`: 字符串
- `integer`: 整数
- `float`: 浮点数
- `boolean`: 布尔值
- `array`: 数组
- `object`: 对象
- `ingredient`: 配方材料（物品或标签）
- `item`: 物品 ID
- `item_stack`: 物品堆（包含数量）

**字段属性**：

- `required`: 是否必需
- `type`: 字段类型
- `default`: 默认值
- `range`: 数值范围（用于 integer 和 float）
- `enum`: 枚举值列表
- `min_items` / `max_items`: 数组长度限制
- `description`: 字段描述

#### 4. 验证和测试

创建完配方类型定义后：

1. 检查 JSON 格式是否正确
2. 确保所有必需字段都已定义
3. 在 Delightify 中加载并测试
4. 验证 LLM 能否正确识别和推荐此配方类型

#### 5. 最佳实践

- **清晰的命名**: 使用描述性的名称和 ID
- **完整的文档**: 提供详细的描述和示例
- **关键词丰富**: 添加足够的关键词帮助 LLM 识别
- **示例充足**: 提供多个不同场景的示例配方
- **类别准确**: 正确设置适用和不适用的物品类别
- **提供 prompt_template**: 为 LLM 提供详细的配方类型指导，这将显著提高转换准确率和置信度

### 参考示例

请参考 `../builtin/` 目录下的内置配方类型定义：

- `minecraft.json` - Minecraft 原版配方
- `farmers_delight.json` - Farmer's Delight 模组
- `create.json` - Create 模组

这些文件展示了完整的配方类型定义结构。

### 常见问题

**Q: 我的自定义配方类型会自动加载吗？**

A: 是的，所有放在此目录下的有效 JSON 文件都会自动加载。

**Q: 我可以覆盖内置配方类型吗？**

A: 不建议。请使用不同的 `recipe_type_id` 来创建新的配方类型。

**Q: 如何调试我的配方类型定义？**

A: 运行 Delightify 时，系统会验证所有配方类型定义并输出错误信息。检查日志文件以获取详细的验证结果。

**Q: 我可以为同一个模组定义多个配方类型吗？**

A: 可以。在 `recipe_types` 数组中添加多个配方类型定义即可。

---

## English

### Overview

This directory is for user-defined custom recipe type definitions. You can extend Delightify's supported recipe types by adding JSON files.

### How to Add Custom Recipe Types

#### 1. Create Recipe Type Definition File

Create a JSON file in this directory, for example `my_mod.json`:

See the Chinese section above for a complete example.

#### 2. Field Description

**Required Fields**:
- `mod_info`: Mod information
- `recipe_types`: Array of recipe type definitions
  - `recipe_type_id`: Recipe type ID (format: `modid:type_name`)
  - `display_name`: Display name
  - `description`: Description
  - `template`: Recipe template structure
  - `field_specs`: Field specification definitions

**Recommended Fields**:
- `icon`: Icon item ID
- `suitable_for`: Suitable scenarios
- `incompatible_with`: Incompatible situations
- `examples`: Example recipes

#### 3. Field Types

Available types in `field_specs`:
- `string`, `integer`, `float`, `boolean`
- `array`, `object`
- `ingredient`, `item`, `item_stack`

**Field Attributes**:
- `required`, `type`, `default`
- `range`, `enum`
- `min_items`, `max_items`
- `description`

#### 4. Validation and Testing

After creating your recipe type definition:
1. Verify JSON format is correct
2. Ensure all required fields are defined
3. Load and test in Delightify
4. Verify LLM can correctly identify and recommend this recipe type

#### 5. Best Practices

- **Clear naming**: Use descriptive names and IDs
- **Complete documentation**: Provide detailed descriptions and examples
- **Rich keywords**: Add sufficient keywords to help LLM identification
- **Sufficient examples**: Provide multiple example recipes for different scenarios
- **Accurate categories**: Correctly set suitable and incompatible item categories

### Reference Examples

Please refer to built-in recipe type definitions in `../builtin/`:
- `minecraft.json` - Minecraft vanilla recipes
- `farmers_delight.json` - Farmer's Delight mod
- `create.json` - Create mod

These files demonstrate the complete recipe type definition structure.

### FAQ

**Q: Will my custom recipe type be automatically loaded?**

A: Yes, all valid JSON files in this directory will be automatically loaded.

**Q: Can I override built-in recipe types?**

A: Not recommended. Use a different `recipe_type_id` to create new recipe types.

**Q: How to debug my recipe type definition?**

A: When running Delightify, the system validates all recipe type definitions and outputs error messages. Check the log files for detailed validation results.

**Q: Can I define multiple recipe types for the same mod?**

A: Yes. Add multiple recipe type definitions to the `recipe_types` array.

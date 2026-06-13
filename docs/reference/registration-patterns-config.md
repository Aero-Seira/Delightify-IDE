# 配置驱动的注册模式识别

## 问题分析

不同 Minecraft 版本和加载器的注册方式差异巨大：

| 版本/加载器 | 注册方式 | 示例 |
|------------|---------|------|
| Forge 1.12.2 | GameRegistry.register | `GameRegistry.register(new Item(), new ResourceLocation("modid", "item"))` |
| Forge 1.16+ | DeferredRegister | `ITEMS.register("item", () -> new Item())` |
| Fabric | Registry.register | `Registry.register(Registry.ITEM, new Identifier("modid", "item"), item)` |
| Forge 1.7.10 | 静态注册 | `public static final Item item = new Item().setUnlocalizedName("item")` |
| NeoForge 1.20+ | DeferredRegister变种 | 类似 Forge 但有 API 差异 |

硬编码每种组合不可行，需要配置驱动的解决方案。

## 解决方案：RegistrationPattern 配置系统

### 核心思想

1. **模式定义**：用 JSON 描述不同注册方式的 ASM 特征
2. **运行时匹配**：根据字节码特征自动选择匹配的模式
3. **可扩展**：用户可自定义模式，无需修改代码

### 配置结构

```json
{
  "id": "forge_1.16_deferred_register",
  "name": "Forge 1.16+ DeferredRegister",
  "appliesTo": {
    "loader": ["forge", "neoforge"],
    "minecraftVersion": ["1.16", "1.17", "1.18", "1.19", "1.20", "1.21"]
  },
  "priority": 100,
  "bytecodeSignatures": {
    "fieldTypes": ["DeferredRegister", "RegistryObject"],
    "methodCalls": [
      {
        "owner": "DeferredRegister",
        "name": "register",
        "descriptor": "(Ljava/lang/String;Ljava/util/function/Supplier;)"
      }
    ]
  },
  "extractionRules": {
    "registryField": {
      "type": "DeferredRegister",
      "extractGenericType": true
    },
    "registerCall": {
      "methodName": "register",
      "paramIndex": {
        "id": 0,
        "factory": 1
      },
      "factoryType": "supplier_lambda"
    }
  }
}
```

### 模式匹配流程

```
1. 扫描类文件，提取所有可能的注册相关特征
   ├── 字段类型（DeferredRegister, RegistryObject）
   ├── 方法调用（register, create）
   └── 类继承关系

2. 对每个预定义模式计算匹配分数
   ├── 匹配字段类型 +10分
   ├── 匹配方法签名 +20分
   ├── 匹配字符串常量 +5分
   └── ...

3. 选择最高分的模式，或提示用户选择

4. 使用选中模式的 extractionRules 提取注册信息
```

## 实施计划

### Phase 1: 基础架构
1. 创建 RegistrationPattern 类加载 JSON 配置
2. 实现 PatternMatcher 计算匹配分数
3. 支持从 `config/registration_patterns/` 加载自定义模式

### Phase 2: 核心模式库
为最常见的组合提供内置模式：
- forge_1.16_plus (DeferredRegister)
- fabric_any (Registry.register)
- forge_1.12 (GameRegistry)
- forge_1.7_10 (静态字段)

### Phase 3: 运行时适配
1. 分析前检测 mods.toml / fabric.mod.json 确定加载器
2. 优先匹配对应加载器的模式
3. 支持模式组合（一个类可能使用多种注册方式）

## 优势

1. **无需代码修改**：新增版本支持只需添加 JSON 配置
2. **社区驱动**：用户可以分享自己的模式配置
3. **向后兼容**：旧版本模组也能正确分析
4. **混合支持**：一个模组可能使用多种注册方式（如 Forge + Mixin）

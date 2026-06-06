# 版本兼容性解决方案

## 问题

不同 Minecraft 版本和加载器的注册方式差异巨大：

```
Forge 1.16+:  DeferredRegister<Item> ITEMS = DeferredRegister.create(...)
Forge 1.12:   GameRegistry.register(new Item().setRegistryName(...))
Fabric:       Registry.register(Registry.ITEM, new Identifier(...), item)
1.7.10:       public static final Item item = new Item()
```

为每种组合硬编码是不现实的。

## 解决方案：配置驱动的模式识别

### 核心架构

```
┌─────────────────────────────────────────────────────────────┐
│                    JarAnalyzer                               │
│                        │                                     │
│                        ▼                                     │
│              ┌─────────────────┐                            │
│              │  PatternMatcher  │                            │
│              └────────┬────────┘                            │
│                       │                                      │
│           ┌───────────┼───────────┐                        │
│           ▼           ▼           ▼                        │
│    ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│    │ Forge 1.16│ │Forge 1.12│ │  Fabric  │ ... 其他模式    │
│    │   JSON   │ │   JSON   │ │   JSON   │                 │
│    └──────────┘ └──────────┘ └──────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

### 工作流程

1. **自动检测**：扫描 JAR 文件，根据 `mods.toml`/`fabric.mod.json` 确定加载器和版本
2. **模式匹配**：计算所有预定义模式的匹配分数
3. **动态选择**：使用最佳匹配的模式进行分析
4. **多模式支持**：一个模组可能使用多种注册方式

### 模式配置格式

位于 `config/registration_patterns/*.json`：

```json
{
  "id": "forge_1.16_plus",
  "name": "Forge 1.16+ DeferredRegister",
  "appliesTo": {
    "loaders": ["forge", "neoforge"],
    "minecraftVersions": ["1.16", "1.17", "1.18", "1.19", "1.20", "1.21"]
  },
  "priority": 100,
  "bytecodeSignatures": {
    "fieldTypes": [
      { "type": "DeferredRegister", "registryType": "item", "score": 10 }
    ],
    "methodCalls": [
      { "owner": "DeferredRegister", "name": "register", "score": 20 }
    ]
  },
  "extractionRules": { ... }
}
```

### 内置模式

| 模式 ID | 适用版本/加载器 | 状态 |
|---------|----------------|------|
| forge_1.16_plus | Forge/NeoForge 1.16+ | ✅ 已实现 |
| fabric_any | Fabric/Quilt 全版本 | 📋 配置已创建 |
| forge_1.12 | Forge 1.12.2 | 📋 配置已创建 |

### 添加新模式

用户可以在不修改代码的情况下添加对新版本的支持：

1. 创建 `config/registration_patterns/my_pattern.json`
2. 定义字节码特征（字段类型、方法调用等）
3. 定义提取规则
4. 重启应用即可生效

示例：为 Quilt 添加支持

```json
{
  "id": "quilt_any",
  "name": "Quilt Registry",
  "appliesTo": {
    "loaders": ["quilt"],
    "minecraftVersions": ["1.18", "1.19", "1.20", "1.21"]
  },
  "bytecodeSignatures": {
    "imports": ["org.quiltmc.qsl"]
  }
}
```

### 运行时 API

```java
// 加载所有模式
PatternMatcher matcher = PatternMatcher.loadFromDirectory("config/registration_patterns");

// 检测 JAR 使用的模式
PatternDetectionResult result = matcher.detectPattern("mod.jar");
System.out.println("Detected: " + result.detectedPatternId);

// 获取匹配的模式列表
List<RegistrationPattern> patterns = matcher.findBestMatches(
    "mod.jar", 
    "forge",     // 检测到的加载器
    "1.20.1"     // 检测到的版本
);

// 使用模式进行分析
for (RegistrationPattern pattern : patterns) {
    // 根据 pattern.extractionRules 提取注册信息
}
```

### 优势

1. **无需代码修改**：新增版本支持只需添加 JSON 配置
2. **社区驱动**：用户可以分享模式配置
3. **混合支持**：自动处理使用多种注册方式的模组
4. **向后兼容**：支持旧版本模组
5. **可调试**：提供匹配分数和投票详情

### 下一步实现

1. 集成 Gson 库用于 JSON 解析
2. 修改 JarAnalyzer 使用 PatternMatcher
3. 添加更多内置模式（Forge 1.7.10, Fabric 等）
4. 创建模式编辑器 UI（可选）

### 技术细节

**匹配算法**：
- 字段类型匹配：+10 分
- 方法调用匹配：+20 分
- 字符串常量匹配：+5 分
- 低于 20 分的模式会被忽略

**版本检测**：
- Forge: 检查 `mods.toml` 中的 `modLoader` 和 `loaderVersion`
- Fabric: 检查 `fabric.mod.json` 中的 `schemaVersion`
- NeoForge: 检查 `neoforge.mods.toml`

这个架构让系统能够灵活适应 Minecraft 生态的不断变化。

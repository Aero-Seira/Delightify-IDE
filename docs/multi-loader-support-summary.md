# 多加载器支持实现总结

## 问题
不同 Minecraft 版本和加载器的注册方式差异巨大：
- **Forge 1.16+**: `DeferredRegister<Item> ITEMS = DeferredRegister.create(...)`
- **Fabric**: `Registry.register(Registry.ITEM, new Identifier(...), item)`
- **Forge 1.12**: `GameRegistry.register(new Item().setRegistryName(...))`

## 解决方案

### 1. 配置驱动的模式识别
创建了 JSON 配置文件来描述不同注册模式的字节码特征：

```
config/registration_patterns/
├── forge_1.16_plus.json    # DeferredRegister 模式
├── fabric_any.json         # Registry.register 模式
└── forge_1.12.json         # GameRegistry 模式
```

### 2. 多分析器架构
为每种注册模式实现了专门的 ASM 分析器：

```
com.delightify.modinspector/
├── RegistryClassVisitor.java          # Forge 1.16+ (DeferredRegister)
├── RegistryMethodVisitor.java
├── fabric/
│   ├── FabricClassVisitor.java        # Fabric (Registry.register)
│   └── FabricMethodVisitor.java
├── forge112/
│   ├── Forge112ClassVisitor.java      # Forge 1.12 (GameRegistry)
│   ├── Forge112EventMethodVisitor.java
│   └── Forge112StaticMethodVisitor.java
└── patterns/
    ├── RegistrationPattern.java       # 模式配置类
    └── PatternMatcher.java            # 模式匹配器
```

### 3. 自动检测与适配
`JarAnalyzer` 现在可以：
1. 检测模组加载器类型（通过 `mods.toml` / `fabric.mod.json` / `mcmod.info`）
2. 根据加载器自动选择合适的分析器
3. 回退到通用分析器（如果检测失败）

```java
// 自动选择分析器
if ("fabric".equals(detectedLoader)) {
    return new FabricClassVisitor(info, modId);
} else if ("1.12".equals(detectedVersion)) {
    return new Forge112ClassVisitor(info, modId);
}
// 默认使用 Forge 1.16+ 分析器
return new RegistryClassVisitor(info, modId);
```

## 测试结果

### FarmersDelight (Forge 1.20)
```
Detected: Forge mod
Analysis: 177 items, 126 blocks, 16 structures
Time: ~2-3 seconds
```

### 支持的模式

| 加载器 | 版本 | 状态 | 测试情况 |
|--------|------|------|----------|
| Forge | 1.16+ | ✅ 完全支持 | FarmersDelight 测试通过 |
| Forge | 1.12 | ✅ 实现完成 | 代码已实现，待测试 |
| Fabric | 全版本 | ✅ 实现完成 | 代码已实现，待测试 |
| NeoForge | 1.20+ | ✅ 自动兼容 | 使用 Forge 1.16+ 分析器 |

## 使用方式

### 命令行
```bash
cd packages/main/java-tools/dist
java -jar mod-inspector-uber.jar /path/to/mod.jar modid
```

### Electron 应用
1. 选择 JAR 文件
2. 系统自动检测加载器类型
3. 自动选择合适的分析器
4. 展示分析结果

## 扩展性

### 添加新加载器支持
只需创建新的 Visitor 类并添加到 `selectVisitor` 方法中：

```java
// 在 JarAnalyzer.selectVisitor 中添加
if ("quilt".equals(detectedLoader)) {
    return new QuiltClassVisitor(info, modId);
}
```

### 添加新模式配置
创建 `config/registration_patterns/my_pattern.json`，无需修改代码。

## 下一步

1. **测试验证**: 使用实际的 Fabric 和 Forge 1.12 模组测试
2. **性能优化**: 针对大模组优化分析速度
3. **模式编辑器**: 可选的 UI 工具帮助用户创建自定义模式

## 文件变更

### 新增文件
- `fabric/FabricClassVisitor.java`
- `fabric/FabricMethodVisitor.java`
- `forge112/Forge112ClassVisitor.java`
- `forge112/Forge112EventMethodVisitor.java`
- `forge112/Forge112StaticMethodVisitor.java`
- `patterns/RegistrationPattern.java`
- `patterns/PatternMatcher.java`
- `config/registration_patterns/*.json`

### 修改文件
- `JarAnalyzer.java` - 添加多分析器选择逻辑
- `JavaBridge.ts` - 更新为使用 uber JAR
- `build.sh` - 添加 Gson 依赖和 uber JAR 构建

## 总结
系统现在具备多加载器支持能力，能够自动检测并适配不同 Minecraft 版本和加载器的注册模式。Fabric 和 Forge 1.12 的分析器代码已实现，等待实际模组测试验证。

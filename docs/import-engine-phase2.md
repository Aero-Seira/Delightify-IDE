# Import Engine Phase 2 - 字节码分析架构设计

## 概述

Phase 2 的目标是通过 Java 字节码分析（ASM）提取真实的物品/方块注册信息，而非依赖命名推断。

## 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                    ImportEngine (TypeScript)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ JarInspector │  │ JsonResolver │  │   RegistryProbe      │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                                              │                   │
└──────────────────────────────────────────────┼───────────────────┘
                                               │
                                               ▼ spawn java process
┌─────────────────────────────────────────────────────────────────┐
│                      JavaBridge (Node.js)                        │
│         spawns: java -cp ... com.delightify.modinspector.Main    │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      mod-inspector.jar (Java)                    │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │ JarAnalyzer │→│ RegistryClassVisitor │→│ RegistryMethodVisitor│ │
│  └─────────────┘  └─────────────────┘  └─────────────────────┘  │
│                                               │                  │
│                                               ▼                  │
│                                       extract register() calls   │
└─────────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. TypeScript 层

#### JavaBridge.ts
- **职责**: 管理 Java 进程生命周期，解析 JSON 输出
- **关键方法**:
  - `checkJavaEnvironment()`: 验证 Java 可用性
  - `analyze(targetPath, modId)`: 执行字节码分析
  - `parseResult(output)`: 解析 Java stdout 中的 JSON

#### RegistryProbe.ts
- **职责**: 注册表探测器，调用 JavaBridge 并转换结果
- **关键方法**:
  - `probe(targetPath, modId)`: 完整探测流程
  - `convertItems()`: 将 Java 结果转为 ItemDefinition
  - `convertBlocks()`: 将 Java 结果转为 BlockDefinition
  - `detectMultiBlockStructures()`: 识别多方块结构

### 2. Java 层

#### JarAnalyzer.java
- **职责**: JAR 文件遍历和过滤
- **流程**:
  1. 遍历所有 .class 文件
  2. 过滤包含注册相关字符串的类（优化）
  3. 使用 ASM ClassReader 分析
  4. 收集 RegistrationInfo

#### RegistryClassVisitor.java
- **职责**: ASM ClassVisitor，识别 DeferredRegister 字段
- **字段分析**: 识别 `DeferredRegister<Item>`, `DeferredRegister<Block>` 等
- **方法分析**: 为每个方法创建 RegistryMethodVisitor

#### RegistryMethodVisitor.java（待实现）
- **职责**: 检测 `DeferredRegister.register()` 调用
- **目标模式**:
  ```java
  public static final RegistryObject<Item> LEMON = 
      ITEMS.register("lemon", () -> new Item(new Item.Properties()));
  ```
- **ASM 指令序列**:
  ```
  GETSTATIC com/example/mod/ModItems.ITEMS : LDeferredRegister;
  LDC "lemon"                    // 物品 ID
  INVOKEDYNAMIC apply()...       // Lambda 工厂
  INVOKEVIRTUAL DeferredRegister.register : (String, Supplier)RegistryObject
  PUTSTATIC com/example/mod/ModItems.LEMON : LRegistryObject;
  ```

## 目标代码模式

### Forge DeferredRegister 模式

```java
public class ModItems {
    // 1. 创建 DeferredRegister
    public static final DeferredRegister<Item> ITEMS = 
        DeferredRegister.create(ForgeRegistries.ITEMS, MOD_ID);
    
    // 2. 注册物品
    public static final RegistryObject<Item> LEMON = 
        ITEMS.register("lemon", () -> new Item(new Item.Properties()));
    
    public static final RegistryObject<Item> LEMONADE = 
        ITEMS.register("lemonade", () -> new DrinkableItem(...));
}
```

### 需要提取的信息

| 字段 | 来源 | 说明 |
|------|------|------|
| `id` | `register()` 第一个参数 | 如 `"lemon"` → `farmersdelight:lemon` |
| `className` | Lambda 体或构造调用 | 如 `Item`, `DrinkableItem` |
| `maxStackSize` | Item.Properties 链式调用 | `stacksTo(64)` |
| `durability` | Item.Properties | `durability(256)` |
| `isFireResistant` | Item.Properties | `fireResistant()` |
| `rarity` | Item.Properties | `rarity(Rarity.EPIC)` |

## ASM 分析策略

### 1. 字段识别（RegistryClassVisitor）

```java
@Override
public FieldVisitor visitField(int access, String name, String descriptor, 
                                String signature, Object value) {
    // 检查 descriptor 是否包含 DeferredRegister
    if (descriptor.contains("DeferredRegister")) {
        // 从 signature 提取泛型参数
        // LDeferredRegister<Lnet/minecraft/world/item/Item;>;
        // → registryType = "item"
    }
}
```

### 2. 方法指令分析（RegistryMethodVisitor）

```java
@Override
public void visitMethodInsn(int opcode, String owner, String name, 
                            String descriptor, boolean isInterface) {
    // 检测 INVOKEVIRTUAL DeferredRegister.register
    if (opcode == Opcodes.INVOKEVIRTUAL 
        && owner.contains("DeferredRegister")
        && name.equals("register")) {
        // 栈顶第二个元素是 ID 字符串
        // 从栈状态提取参数
    }
}

@Override
public void visitLdcInsn(Object value) {
    // 捕获字符串常量（可能是物品 ID）
    if (value instanceof String) {
        // 暂存，可能是 register 的第一个参数
    }
}

@Override
public void visitInvokeDynamicInsn(String name, String descriptor, 
                                    Handle bootstrapMethodHandle,
                                    Object... bootstrapMethodArguments) {
    // 检测 Lambda 表达式
    // name="apply", descriptor="()Ljava/util/function/Supplier;"
    // 从 bootstrapMethodArguments 提取实现方法
}
```

### 3. 栈模拟（简化方案）

对于简单的注册模式，可以使用轻量级栈追踪：

```java
private final Deque<Object> stack = new ArrayDeque<>();

@Override
public void visitLdcInsn(Object value) {
    stack.push(value);  // 字符串常量入栈
}

@Override
public void visitMethodInsn(int opcode, String owner, String name, 
                            String descriptor, boolean isInterface) {
    if (isRegisterCall(owner, name)) {
        // register(String, Supplier) 需要 2 个参数
        Object supplier = stack.pop();  // Lambda/Supplier
        Object id = stack.pop();        // 字符串 ID
        
        registerItem((String) id, supplier);
    }
}
```

## 输出格式

Java 工具输出 JSON 到 stdout：

```json
{
  "modId": "farmersdelight",
  "items": [
    {
      "id": "farmersdelight:lemon",
      "className": "net.minecraft.world.item.Item",
      "maxStackSize": 64,
      "durability": null,
      "isBlockItem": false,
      "properties": {
        "foodProperties": { "nutrition": 2, "saturation": 0.2 }
      }
    },
    {
      "id": "farmersdelight:lemonade",
      "className": "com.nhoryzon.mc.farmersdelight.item.DrinkableItem",
      "maxStackSize": 16,
      "properties": { ... }
    }
  ],
  "blocks": [
    {
      "id": "farmersdelight:lemon_tree",
      "className": "com.nhoryzon.mc.farmersdelight.block.LemonTreeBlock",
      "hardness": 0.0,
      "material": "plant"
    }
  ],
  "errors": []
}
```

## 渐进式实现计划

### Phase 2.1: 基础提取
- [x] 项目结构搭建
- [x] ASM 库集成
- [ ] RegistryMethodVisitor 基础实现
- [ ] 支持简单 DeferredRegister.register(String, Supplier)

### Phase 2.2: 属性提取
- [ ] 识别 Item.Properties 链式调用
- [ ] 提取 maxStackSize, durability 等基础属性
- [ ] 支持 Block 注册分析

### Phase 2.3: 复杂模式
- [ ] 支持直接 new Item() 而非 Lambda
- [ ] 支持 RegistryObject.get() 引用
- [ ] 处理静态初始化块中的注册

### Phase 2.4: 验证与优化
- [ ] 与 FarmersDelight 实际数据对比验证
- [ ] 性能优化（类过滤、并行分析）
- [ ] 错误处理和回退机制

## 调试技巧

### 查看 ASM 指令序列

```bash
# 使用 ASMifier 查看类的 ASM 表示
cd packages/main/java-tools
cp libs/asm-util-9.6.jar dist/
cd dist
java -cp "asm-util-9.6.jar:asm-9.6.jar" \
  org.objectweb.asm.util.ASMifier \
  com/example/mod/ModItems.class
```

### 验证 Java 工具

```bash
# 构建并运行
cd packages/main/java-tools
./build.sh
cd dist
java -cp "mod-inspector.jar:asm-9.6.jar:..." \
  com.delightify.modinspector.Main \
  /path/to/mod.jar modid
```

## 与 Phase 3 的衔接

Phase 3 的 FusionEngine 将接收：

1. **RegistryProbe 输出**: Bytecode 分析结果（高优先级）
2. **JsonResolver 输出**: 配方中的物品引用（中优先级）
3. **LangProbe 输出**: 翻译文件中的物品键（低优先级）

冲突消解示例：
- Bytecode 说 `lemon` 是 `Item`（confidence=1.0）
- JSON 配方引用 `#farmersdelight:lemons`（可能是 tag）
- 结论: `lemon` 是基础物品，tag 包含它和其他变体

## 参考资源

- [ASM 4 Guide](https://asm.ow2.io/asm4-guide.pdf)
- [ASM Javadoc](https://asm.ow2.io/javadoc/)
- Forge DeferredRegister 源码
- Minecraft Item/Block 注册机制文档

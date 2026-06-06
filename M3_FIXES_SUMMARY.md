# M3 阶段问题修复总结

## 修复的问题

### 1. Client Closed 问题

**原因**: IPC 处理器中每次查询后都调用 `await closeProjectDbClient(dbPath)`，导致连接被立即关闭。

**解决方案**:
- 移除 IPC 处理器中的 `closeProjectDbClient` 调用
- 依赖 `createProjectDbClient` 的连接缓存机制
- 连接缓存时间从 30 秒延长到 5 分钟

**修改文件**:
- `packages/main/src/ipc/items.ts` - 移除所有 `closeProjectDbClient` 调用
- `packages/main/src/ipc/recipes.ts` - 移除所有 `closeProjectDbClient` 调用
- `packages/main/src/services/database/client.ts` - 延长缓存时间

### 2. 材质丢失问题

**原因**: 物品 ID 可能是 `tag:` 前缀格式，数据库中存储的是实际物品 ID。

**解决方案**:
- 在 `items:get-texture` 处理器中处理 `tag:` 前缀
- 移除前缀后再查询数据库

**修改代码**:
```typescript
// 处理 tag: 前缀的物品ID
const actualItemId = itemId.startsWith('tag:') ? itemId.slice(4) : itemId;
```

### 3. 配方显示不完整问题

**原因**: RecipeCard 组件只显示部分输入物品，省略了多余的物品。

**解决方案**:
- **有序合成 (crafting_shaped)**: 显示完整的 3x3 网格，包含空槽位
- **无序合成 (crafting_shapeless)**: 显示所有 ingredients，不省略
- **熔炼类**: 显示单一输入槽位

**新增组件**:
- `ShapedCraftingGrid` - 3x3 网格显示有序合成
- `ShapelessInputs` - 显示所有无序合成物品
- `SmeltingInput` - 单一输入显示

**修改文件**:
- `packages/renderer/src/components/RecipeCard/index.tsx` - 重写配方解析和显示逻辑
- `packages/renderer/src/components/RecipeCard/style.module.css` - 添加 3x3 网格样式

## 界面改进

### 有序合成配方显示
```
┌─────────────┐
│ 有序合成     │
├─────────────┤
│ ┌─┬─┬─┐  →  │
│ │ │ │ │     │
│ ├─┼─┼─┤     │
│ │ │木│ │  → │
│ ├─┼─┼─┤     │
│ │ │ │ │     │
│ └─┴─┴─┘     │
├─────────────┤
│ minecraft   │
└─────────────┘
```

### 无序合成配方显示
```
┌─────────────┐
│ 无序合成     │
├─────────────┤
│ 输入:       │
│ [蛋][糖][奶] → [蛋糕]
│ [小麦]      │
├─────────────┤
│ minecraft   │
└─────────────┘
```

### 熔炼配方显示
```
┌─────────────┐
│ 熔炼        │
├─────────────┤
│ [铁矿石]  → [铁锭]
├─────────────┤
│ minecraft   │
└─────────────┘
```

## 性能优化

### 数据库连接管理
- 连接缓存时间: 5 分钟（之前 30 秒）
- 刷新间隔: 1 分钟更新使用时间戳
- 不再频繁创建/关闭连接

### 配方解析优化
- 使用 `useMemo` 缓存解析结果
- 避免重复解析 JSON

## 待后续优化

1. **材质预加载**: 对于显示在配方中的物品，可以批量预加载材质
2. **配方缩略图**: 对于复杂的 3x3 配方，可以考虑生成缩略图
3. **配方搜索**: 支持按输入/输出物品搜索配方

## 测试建议

1. 打开配方浏览器，检查各种配方类型是否正确显示
2. 观察控制台是否还有 "Client Closed" 错误
3. 检查物品图标是否正确加载（不再显示紫黑格子）
4. 测试有序合成配方是否显示完整的 3x3 网格
5. 测试无序合成配方是否显示所有物品

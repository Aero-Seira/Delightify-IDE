# 物品纹理缺失问题 - Agent 处理指南

## 问题描述

数据验证界面显示正常，但物品浏览器中约 **48%** 的物品显示为紫黑格子（缺失纹理），包括：
- `minecraft:oak_log` 等原版原木
- `quark:hollow_*_log` 等空心原木
- 其他引用 `block/*` 模型的物品

## 根本原因

**数据导出不完整**，不是渲染代码问题。

数据库统计：
```sql
-- 有纹理的物品
SELECT COUNT(DISTINCT item_id) FROM item_resources WHERE resource_type = 'texture';
-- 结果: 3679

-- 总物品数
SELECT COUNT(*) FROM items;
-- 结果: 6986

-- 覆盖率: 52.7%
```

**数据对比示例**：

| 物品 | model 内容 | texture 记录 | 显示状态 |
|------|-----------|-------------|---------|
| `biomeswevegone:mahogany_log` | 完整（含 textures 字段） | ✅ 有 base64 | 正常 |
| `minecraft:oak_log` | 仅 `{parent: "block/oak_log"}` | ❌ 无 | 紫黑格子 |

## 修复方案

需要修改**附属 Mod**（数据导出 Mod）的代码，确保：

1. **遍历所有物品时导出纹理**
   - 当前可能只导出了有 `textures` 字段的模型
   - 需要处理仅引用 `parent` 的模型（如 `block/oak_log`）

2. **解析 parent 模型链**
   - 对于 `{"parent": "minecraft:block/oak_log"}`
   - 需要递归解析 parent 直到找到包含 `textures` 的模型
   - 然后导出对应的纹理文件

3. **确保纹理 base64 编码正确**
   - 检查 `item_resources.content` 字段是否包含有效的 base64 PNG 数据

## 验证修复

修复后重新导出数据，验证：

```sql
-- 应接近 100% 覆盖率
SELECT 
  (SELECT COUNT(DISTINCT item_id) FROM item_resources WHERE resource_type = 'texture') * 100.0 / 
  (SELECT COUNT(*) FROM items) as coverage_percent;
```

## 临时缓解方案（如需）

如需在 Mod 修复前临时缓解，可添加纹理回退机制：

1. 在 `items:get-texture` IPC 中，当直接查询无结果时：
   - 查询 `model` / `model_parent` 字段
   - 尝试在同模组中查找相似物品的纹理
   - 或使用通用方块纹理作为占位

2. 前端 `ItemIcon` 组件增强：
   - 添加更智能的占位符（按物品类型显示不同颜色/图案）

## 相关文件

- 纹理查询: `packages/main/src/ipc/items.ts` (items:get-texture)
- 物品显示: `packages/renderer/src/components/ItemIcon/index.tsx`
- 数据导入: `packages/main/src/services/mod-data-importer/importer.ts`

## 优先级

**高** - 影响核心功能（物品浏览器可用性）

---
*生成时间: 2026-03-25*

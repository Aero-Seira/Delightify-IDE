# M3 阶段配方浏览器实现总结

## 概述
本实现完成了 Delightify M3 阶段（v0.4）的核心功能：配方浏览器 + 配方类型元数据可视化。

## 实现内容

### 1. 新增组件：RecipeCard
**路径**: `packages/renderer/src/components/RecipeCard/`

#### 功能特性：
- **智能 JSON 解析**：自动解析配方 JSON，提取输入/输出物品
  - 支持 crafting_shaped (有序合成，key + pattern)
  - 支持 crafting_shapeless (无序合成，ingredients 数组)
  - 支持熔炼类配方 (smelting, blasting, smoking)
  - 支持自定义配方类型
  
- **三种展示模式**：
  - RecipeCard - 网格视图卡片
  - RecipeListRow - 紧凑列表行
  - RecipeDetailCard - 详情卡片（含 JSON 查看器）

- **配方类型可视化**：
  - 不同类型显示不同颜色标签
  - Minecraft 原版配方类型预设颜色
  - 模组配方类型自动分配颜色

- **物品槽位显示**：
  - 显示物品图标
  - 显示数量角标
  - 支持标签引用

### 2. 重构页面：RecipeBrowser
**路径**: `packages/renderer/src/pages/RecipeBrowser/`

#### 功能特性：
- **搜索功能**：按配方 ID 或内容搜索
- **多维度筛选**：
  - 模组筛选（支持搜索）
  - 配方类型筛选（动态加载）
- **三种视图模式**：
  - 网格视图：卡片式展示
  - 列表视图：紧凑列表
  - 详情视图：展开显示完整信息
- **分页功能**：支持每页 20/50/100 条
- **详情面板**：右侧滑出式详情面板
- **状态持久化**：视图模式保存到 localStorage

### 3. 样式文件
- 与 ItemBrowser 一致的视觉风格
- 支持浅色/深色主题自动切换
- 响应式布局适配
- 配方类型颜色区分

### 4. i18n 翻译更新
新增翻译键：
- searchPlaceholder, noRecipes, noResults
- clearFilters, gridView, listView, detailView
- recipeCount, pageInfo, inputs, outputs
- viewJson, hideJson

### 5. Mock 数据增强
- 生成更丰富的示例配方数据
- 包含 6 种配方类型
- 真实的配方 JSON 结构
- 20 种不同的物品

## 技术亮点

### 配方 JSON 解析
支持多种配方格式的智能解析：
- crafting_shaped: 解析 pattern 和 key
- crafting_shapeless: 解析 ingredients 数组
- smelting/blasting/smoking: 解析 ingredient 和 result
- 自定义配方类型: 通用解析逻辑

### 配方类型颜色映射
```typescript
const colorMap: Record<string, string> = {
  'minecraft:crafting_shaped': '#4dabf7',   // 蓝色
  'minecraft:crafting_shapeless': '#69db7c', // 绿色
  'minecraft:smelting': '#ff8787',          // 红色
  'minecraft:blasting': '#ffa94d',          // 橙色
  'minecraft:stonecutting': '#adb5bd',      // 灰色
  'minecraft:smithing': '#9775fa',          // 紫色
};
```

## 文件变更列表

### 新增文件
1. `packages/renderer/src/components/RecipeCard/index.tsx` - 配方卡片组件
2. `packages/renderer/src/components/RecipeCard/style.module.css` - 配方卡片样式

### 修改文件
1. `packages/renderer/src/pages/RecipeBrowser/index.tsx` - 配方浏览器页面（完全重写）
2. `packages/renderer/src/pages/RecipeBrowser/style.module.css` - 配方浏览器样式
3. `packages/renderer/src/i18n/locales/zh-CN.ts` - 中文翻译
4. `packages/renderer/src/i18n/locales/en.ts` - 英文翻译
5. `packages/renderer/src/ipc/mock.ts` - Mock 数据增强

## 与参考数据的兼容性

本实现基于 `reference_sql/export_2026-04-10_06-08-58.sqlite` 的数据结构设计：

- **recipes 表**: 使用 recipe_id, type_id, modid, hash, raw_json 字段
- **配方查询**: 支持按 recipe_id 和 raw_json 内容搜索
- **类型统计**: 动态从数据库统计配方类型分布

## 后续优化建议

1. **配方编辑集成**：点击配方可直接跳转到编辑器
2. **输入/输出反向搜索**：点击物品显示所有使用/产出该物品的配方
3. **批量操作**：支持多选配方进行批量导出
4. **配方收藏**：支持收藏常用配方
5. **配方比较**：并排比较两个配方的差异
6. **配方树**：展示配方的依赖关系图

## 构建与测试

由于当前环境缺少 Node.js 运行时，请在本地执行：

```bash
# 安装依赖
pnpm install

# 构建项目
pnpm build

# 运行类型检查
pnpm typecheck

# 启动开发模式
pnpm dev
```

## 截图预览

（由于文本环境限制，请本地运行后查看实际效果）

配方浏览器提供以下视图：
- 网格视图：卡片式展示，适合浏览大量配方
- 列表视图：紧凑列表，快速定位配方
- 详情视图：完整信息 + JSON 查看器

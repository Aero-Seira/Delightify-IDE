# M3 阶段进展报告

## 完成状态：基础框架已搭建 ✅

## 新增功能

### 1. 配方类型元数据系统

**类型定义** (`packages/shared/src/types/recipe.ts`):
- `RecipeTypeMetadata` - 配方类型完整元数据
- `FieldSpec` - 字段定义（类型、必填、默认值等）
- `SlotSpec` - 槽位定义（输入/输出/催化剂/流体）
- `SuitableFor` - 适用场景描述

**配置加载服务** (`packages/main/src/services/recipe-types/loader.ts`):
- 支持 `config/recipe_types/builtin/*.json` 和 `custom/*.json`
- 5秒缓存机制
- 热重载支持（clearRecipeTypeCache）

**IPC 接口**:
- `recipe-types:get-all` - 获取所有配方类型
- `recipe-types:get` - 获取单个配方类型
- `recipe-types:get-by-mod` - 按模组获取
- `recipe-types:clear-cache` - 清除缓存（热重载）
- `recipe-types:get-stats` - 获取统计信息

### 2. 配方浏览器页面

**页面** (`packages/renderer/src/pages/RecipeBrowser/`):
- 搜索框（按配方ID搜索）
- 配方类型筛选下拉框
- 配方卡片列表展示
- 显示配方ID、类型、所属模组

### 3. 性能优化

**数据库连接优化** (`packages/main/src/services/database/client.ts`):
- 连接缓存（30秒有效期）
- 延迟关闭（100ms，给并发请求复用机会）
- 解决 "client is closed" 错误

## 文件变更

### 新增文件
```
packages/main/src/services/recipe-types/loader.ts  # 配方类型加载服务
packages/main/src/ipc/recipe-types.ts              # 配方类型 IPC
packages/renderer/src/pages/RecipeBrowser/         # 配方浏览器页面
packages/renderer/src/pages/RecipeBrowser/index.tsx
packages/renderer/src/pages/RecipeBrowser/style.module.css
docs/M3-recipe-browser.md                          # M3 开发计划
docs/M3-progress.md                                # 本文件
```

### 修改文件
```
packages/shared/src/types/recipe.ts               # 新增配方类型元数据类型
packages/main/src/ipc/index.ts                    # 注册配方类型 IPC
packages/main/src/ipc/recipes.ts                  # 修复 db.close()
packages/main/src/ipc/items.ts                    # 修复 db.close()
packages/main/src/services/database/client.ts     # 连接缓存优化
packages/main/src/services/database/index.ts      # 导出 closeProjectDbClient
packages/renderer/src/ipc/index.ts                # 添加 RecipeTypeMetadata 类型
packages/renderer/src/ipc/browser-api.ts          # 添加配方类型 mock 方法
docs/roadmap.md                                   # 更新 M3 进度
```

## 下一步工作

1. **RecipeSlot 组件** - 显示单个物品/流体槽位
2. **RecipeGrid 组件** - 有序合成网格展示
3. **配方类型渲染器** - 根据 field_specs 动态渲染不同布局
4. **按物品查询配方** - 查找物品作为输入/输出的所有配方
5. **配方详情面板** - 显示完整配方信息

## 如何测试

1. 启动应用并导入数据
2. 点击左侧菜单「配方浏览器」
3. 验证配方列表加载
4. 验证配方类型筛选
5. 验证搜索功能

## 相关配置

配方类型配置文件位于：
- `config/recipe_types/builtin/minecraft.json` - 原版配方类型
- `config/recipe_types/builtin/create.json` - Create 模组
- `config/recipe_types/builtin/farmers_delight.json` - 农夫乐事

新增配方类型只需在 `config/recipe_types/custom/` 添加 JSON 文件。

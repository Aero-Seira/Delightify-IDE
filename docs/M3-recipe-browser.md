# M3: 配方浏览器 + 配方类型元数据系统

## 目标
用户能浏览配方，且 UI 按"配方类型"组织展示。

## 任务清单

### 1. 配方类型元数据系统
- [ ] 创建 RecipeType 类型定义（shared）
- [ ] 创建配方类型配置加载服务（main）
- [ ] 支持 builtin + custom 配方类型热加载
- [ ] 配方类型缓存管理

### 2. 配方查询 IPC 完善
- [ ] 按物品查询相关配方（作为输入/输出）
- [ ] 配方类型筛选优化
- [ ] 配方分页与搜索

### 3. 配方浏览器前端
- [ ] RecipeBrowser 页面框架
- [ ] 配方类型侧边栏/筛选
- [ ] 配方列表展示（适配不同配方类型）
- [ ] 配方搜索与筛选

### 4. 配方展示组件
- [ ] RecipeSlot 组件（物品槽位）
- [ ] RecipeGrid 组件（有序合成网格）
- [ ] 配方类型特定渲染器（根据 field_specs）
- [ ] RecipeCard 组件（配方卡片）

### 5. 配方详情
- [ ] RecipeDetail 页面/面板
- [ ] 显示配方完整信息（输入/输出/属性）
- [ ] 关联物品跳转

## 数据模型

### RecipeType 元数据
```typescript
interface RecipeTypeMetadata {
  recipeTypeId: string;        // 如 "minecraft:crafting_shaped"
  displayName: string;         // 显示名称
  description?: string;        // 描述
  icon?: string;               // 图标物品ID
  template: object;            // 配方模板
  fieldSpecs: FieldSpecMap;    // 字段定义
  inputSlots: SlotSpec[];      // 输入槽位定义
  outputSlots: SlotSpec[];     // 输出槽位定义
}
```

### FieldSpec 字段定义
```typescript
interface FieldSpec {
  required: boolean;
  type: 'string' | 'integer' | 'float' | 'array' | 'object' | 'ingredient' | 'item_stack';
  default?: any;
  description?: string;
  minItems?: number;      // 数组最小长度
  maxItems?: number;      // 数组最大长度
  range?: [number, number]; // 数值范围
}
```

## 验收标准
- [ ] 能看到某个物品相关配方（输入/输出）
- [ ] 能按配方类型分组展示
- [ ] 配方类型 JSON 修改后可快速生效
- [ ] 配方展示符合 field_specs 定义的布局

## 参考
- 配方类型配置：`config/recipe_types/builtin/*.json`
- 参考 SQL：`reference_sql/export.sqlite` (recipes 表)

/**
 * Config types
 * 
 * 配置相关的类型定义
 */

// ============================================================================
// 配方类型配置
// ============================================================================

/** 配方类型定义 */
export interface RecipeTypeDefinition {
  /** 类型ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 输入槽位数量 */
  inputSlots: number;
  /** 输出槽位数量 */
  outputSlots: number;
  /** 图标 */
  icon?: string;
}

/** 配方类型文件 */
export interface RecipeTypesFile {
  /** 版本 */
  version: string;
  /** 配方类型列表 */
  recipeTypes: RecipeTypeDefinition[];
}

// ============================================================================
// 物品分类配置
// ============================================================================

/** 单个物品分类 */
export interface ItemCategory {
  /** 分类ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 图标 */
  icon?: string;
  /** 颜色 */
  color?: string;
}

/** 物品分类配置文件 */
export interface ItemCategoryConfig {
  /** 分类映射表 */
  categories: Record<string, ItemCategory>;
  /** 物品到分类的映射 */
  item_mapping: Record<string, string>;
}

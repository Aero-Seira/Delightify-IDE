/**
 * Mod Data Importer - 类型定义
 * 
 * 根据 reference_sql/export.sqlite 样例定义
 */

// ============================================================================
// 导入进度和结果
// ============================================================================

export interface ImportProgress {
  phase: 'detecting' | 'reading' | 'validating' | 'importing' | 'completed' | 'error';
  percent: number;
  message: string;
  currentTable?: string;
  processedCount?: number;
  totalCount?: number;
}

export interface ImportResult {
  success: boolean;
  importId?: string;
  sourceKind?: DataSourceKind;
  capabilities?: ProjectCapabilities;
  stats?: {
    modCount: number;
    itemCount: number;
    recipeCount: number;
    tagCount: number;
  };
  error?: string;
}

export interface ModDataImportOptions {
  projectPath: string;
  dataFilePath?: string;
  onProgress?: (progress: ImportProgress) => void;
}

// ============================================================================
// 验证相关
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  version?: string;
  schemaVersion?: string;
  sourceKind?: DataSourceKind;
  capabilities?: ProjectCapabilities;
  loader?: string;
  mcVersion?: string;
  modlistHash?: string;
  exportedAt?: string;
  minecraftVersion?: string;
  forgeVersion?: string;
  modCount?: number;
  itemCount?: number;
  recipeCount?: number;
  tagCount?: number;
  error?: string;
}

export type DataSourceKind = 'exporter_v1' | 'legacy_exporter';

export interface ProjectCapabilities {
  browse: boolean;
  mvp0Unify: boolean;
  reason?: string;
}

export const EXPORTER_V1_CAPABILITIES: ProjectCapabilities = {
  browse: true,
  mvp0Unify: true,
};

export const LEGACY_EXPORTER_CAPABILITIES: ProjectCapabilities = {
  browse: true,
  mvp0Unify: false,
  reason: 'legacy_export_without_structured_recipes',
};

// ============================================================================
// 附属Mod数据结构（与 export.sqlite 一致）
// ============================================================================

/**
 * 清单条目
 */
export interface ManifestEntry {
  key: string;
  value: string;
}

/**
 * 模组条目
 */
export interface ModEntry {
  modid: string;
  version?: string;
  name?: string;
}

/**
 * 物品条目
 */
export interface ItemEntry {
  item_id: string;
  modid: string;
  translation_key?: string | null;
  is_block?: number;
  max_stack?: number;
  max_damage?: number;
  is_damageable?: number;
  is_fire_resistant?: number;
  rarity?: string | null;
  enchant_value?: number | null;
  food_nutrition?: number | null;
  food_saturation?: number | null;
  food_always_eat?: number | null;
  default_components_json?: string | null;
}

/**
 * 标签条目
 */
export interface ItemTagEntry {
  tag_id: string;
  item_id: string;
}

/**
 * 配方条目
 */
export interface RecipeEntry {
  recipe_id: string;
  type_id: string;
  modid: string;
  hash: string;
  raw_json?: string;
  unparsed: boolean;
  group?: string | null;
}

// ============================================================================
// 检测相关
// ============================================================================

export interface DetectedDataFile {
  filePath: string;
  size: number;
  modifiedAt: Date;
}

// 数据文件预期路径（相对于整合包根目录）
export const EXPORTER_V1_DATA_FILE_PATHS = [
  'delightify/export.sqlite',
  '.delightify/export.sqlite',
];

export const LEGACY_DATA_FILE_PATHS = [
  'delightify-exporter/export.sqlite',
  '.delightify-exporter/export.sqlite',
  'config/delightify-exporter/export.sqlite',
];

export const DATA_FILE_PATHS = [
  ...EXPORTER_V1_DATA_FILE_PATHS,
  ...LEGACY_DATA_FILE_PATHS,
];

export const LEGACY_REQUIRED_TABLES = [
  'manifest',
  'mods',
  'items',
  'item_tags',
  'recipes',
];

export const EXPORTER_V1_REQUIRED_TABLES = [
  ...LEGACY_REQUIRED_TABLES,
  'recipe_inputs',
  'recipe_outputs',
  'translations',
];

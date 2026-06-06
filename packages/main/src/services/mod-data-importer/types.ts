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
  exportedAt?: string;
  minecraftVersion?: string;
  forgeVersion?: string;
  modCount?: number;
  itemCount?: number;
  recipeCount?: number;
  tagCount?: number;
  error?: string;
}

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
export const DATA_FILE_PATHS = [
  'delightify-exporter/export.sqlite',
  '.delightify-exporter/export.sqlite',
  'config/delightify-exporter/export.sqlite',
];

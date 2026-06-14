/**
 * Electron API Interface - v2.1
 * 
 * 根据 reference_sql/export.sqlite 样例调整
 */

import type { 
  Project, 
  CreateProjectData,
  UpdateProjectData,
  Item,
  ItemQueryParams,
  ItemQueryResult,
  Recipe,
  RecipeDetail,
  RecipeQueryParams,
  RecipeTypeInfo,
  RecipeTypeMetadata,
  TagInfo,
  ModDataImportResult,
  ModDataImportProgress,
  DataImportHistory,
  ManifestEntry,
  ValidationResult,
  UnifyDryRunParams,
  UnifyDryRunResult,
  UnifyQueryParams,
  UnifyQueryResult,
  KubeJsExportParams,
  KubeJsExportResult,
  KubeJsRevertResult,
} from '@delightify/shared';
import { mockElectronAPI } from './mock';

export interface ElectronAPI {
  // ========== 项目管理 ==========
  projectList: () => Promise<{ success: boolean; data?: Project[]; error?: string }>;
  projectOpen: (projectId?: string) => Promise<{ success: boolean; data?: Project | null; error?: string; canceled?: boolean }>;
  projectCreate: (data: CreateProjectData) => Promise<{ success: boolean; data?: Project; error?: string }>;
  projectGetCurrent: () => Promise<{ success: boolean; data?: Project | null; error?: string }>;
  projectUpdate: (projectId: string, data: UpdateProjectData) => Promise<{ success: boolean; data?: Project; error?: string }>;
  projectDelete: (projectId: string) => Promise<{ success: boolean; error?: string }>;
  selectDirectory: () => Promise<{ canceled: boolean; filePaths?: string[] }>;
  projectGetStats: (projectPath: string) => Promise<{ success: boolean; data?: { modCount: number; itemCount: number; recipeCount: number; tagCount: number; needsReimport: boolean }; error?: string }>;

  // ========== Mod数据导入 ==========
  modDataDetect: (projectPath: string) => Promise<{ success: boolean; data?: { filePath: string | null; found: boolean }; error?: string }>;
  modDataValidate: (filePath: string) => Promise<{ success: boolean; data?: ValidationResult; error?: string }>;
  modDataImport: (projectPath: string, dataFilePath?: string) => Promise<{ success: boolean; data?: ModDataImportResult; error?: string }>;
  onModDataImportProgress: (callback: (progress: ModDataImportProgress) => void) => () => void;
  modDataGetImportHistory: (projectPath: string) => Promise<{ success: boolean; data?: DataImportHistory[]; error?: string }>;

  // ========== 物品查询 ==========
  itemsQuery: (projectPath: string, params: ItemQueryParams) => Promise<{ success: boolean; data?: ItemQueryResult; error?: string }>;
  itemsGetByMod: (projectPath: string, modid: string) => Promise<{ success: boolean; data?: Item[]; error?: string }>;
  itemsGetDetail: (projectPath: string, itemId: string) => Promise<{ success: boolean; data?: (Item & { tags: string[] }) | null; error?: string }>;
  itemsGetTexture: (projectPath: string, itemId: string) => Promise<{ success: boolean; data?: { base64: string; mimeType: string } | null; error?: string }>;

  // ========== 标签和模组查询 ==========
  tagsQuery: (projectPath: string) => Promise<{ success: boolean; data?: TagInfo[]; error?: string }>;
  modsQuery: (projectPath: string) => Promise<{ success: boolean; data?: { modid: string; version?: string; name?: string }[]; error?: string }>;

  // ========== 配方查询 ==========
  recipesQuery: (projectPath: string, params: RecipeQueryParams) => Promise<{ success: boolean; data?: { recipes: Recipe[]; total: number }; error?: string }>;
  recipesGetTypes: (projectPath: string) => Promise<{ success: boolean; data?: RecipeTypeInfo[]; error?: string }>;
  recipesGetDetail: (projectPath: string, recipeId: string) => Promise<{ success: boolean; data?: RecipeDetail | null; error?: string }>;

  // ========== Unify 查询 ==========
  unifyQuery: (projectPath: string, params: UnifyQueryParams) => Promise<{ success: boolean; data?: UnifyQueryResult; error?: string }>;
  unifyDryRun: (projectPath: string, params: UnifyDryRunParams) => Promise<{ success: boolean; data?: UnifyDryRunResult; error?: string }>;

  // ========== 导出 ==========
  exportKubeJs: (projectPath: string, params: KubeJsExportParams) => Promise<{ success: boolean; data?: KubeJsExportResult; error?: string }>;
  revertKubeJs: (projectPath: string) => Promise<{ success: boolean; data?: KubeJsRevertResult; error?: string }>;

  // ========== 配方类型元数据 ==========
  recipeTypesGetAll: () => Promise<{ success: boolean; data?: RecipeTypeMetadata[]; error?: string }>;
  recipeTypesGet: (recipeTypeId: string) => Promise<{ success: boolean; data?: RecipeTypeMetadata | null; error?: string }>;
  recipeTypesGetByMod: (modId: string) => Promise<{ success: boolean; data?: RecipeTypeMetadata[]; error?: string }>;
  recipeTypesClearCache: () => Promise<{ success: boolean; error?: string }>;

  // ========== 通用工具 ==========
  openExternal: (url: string) => Promise<void>;

  // ========== 调试 ==========
  debugDbTables: (projectPath: string) => Promise<{ success: boolean; data?: Array<{ name: string; rowCount: number }>; error?: string }>;
  debugDbQuery: (projectPath: string, sql: string, args?: unknown[]) => Promise<{ success: boolean; data?: unknown[]; error?: string }>;
  debugClearData: (projectPath: string) => Promise<{ success: boolean; data?: { cleared: boolean }; error?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

function isElectron(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.electronAPI) return true;
  return navigator.userAgent.toLowerCase().includes('electron');
}

export const electronAPI = (): ElectronAPI => {
  if (window.electronAPI) {
    return window.electronAPI;
  }
  
  console.warn('[IPC] Using mock API');
  return mockElectronAPI as unknown as ElectronAPI;
};

export function checkElectronEnvironment(): boolean {
  return isElectron();
}

export function getRuntimeMode(): { 
  mode: 'electron' | 'browser-mock';
  description: string;
} {
  return isElectron() 
    ? { mode: 'electron', description: 'Electron 桌面应用' }
    : { mode: 'browser-mock', description: '浏览器（模拟数据）' };
}

export { browserElectronAPI, mockElectronAPI } from './mock';

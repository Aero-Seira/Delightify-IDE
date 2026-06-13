/**
 * 浏览器模式 API - v2.1
 * 
 * 简化版本：仅支持基础项目管理和模拟数据
 */

import { browserDB, initBrowserDB } from './browser-db';
import { selectDirectory, supportsFileSystemAccess } from './browser-fs';
import type { Project, Item, ItemQueryResult, Mod } from '@delightify/shared';

/**
 * 浏览器模式 API 实现
 */
export const browserElectronAPI = {
  // ========== 初始化 ==========
  async init() {
    await initBrowserDB();
    console.log('[BrowserAPI] Initialized');
  },

  // ========== 项目管理 ==========
  projectList: async () => {
    return { success: true, data: [], total: 0 };
  },

  projectOpen: async () => {
    return { success: true, data: null, canceled: true };
  },

  projectCreate: async () => {
    return { success: true, data: null };
  },

  projectGetCurrent: async () => {
    return { success: true, data: null };
  },

  projectUpdate: async () => ({ success: true }),
  projectDelete: async () => ({ success: true }),

  selectDirectory: async () => {
    if (supportsFileSystemAccess()) {
      return await selectDirectory();
    }
    return { canceled: true };
  },

  projectGetStats: async () => ({
    success: true,
    data: { modCount: 0, itemCount: 0, recipeCount: 0, tagCount: 0, needsReimport: true },
  }),

  // ========== Mod 数据导入 (v2.1) ==========
  modDataDetect: async () => ({ success: true, data: { filePath: null, found: false } }),
  modDataValidate: async () => ({ success: true, data: { valid: false } }),
  modDataImport: async () => ({
    success: true,
    data: { modCount: 0, itemCount: 0, recipeCount: 0, tagCount: 0 },
  }),
  onModDataImportProgress: () => () => {},
  modDataGetImportHistory: async () => ({ success: true, data: [] }),

  // ========== 物品查询 (简化) ==========
  itemsQuery: async (_projectPath: string, params: any) => {
    const { page = 1, pageSize = 50 } = params;
    return {
      success: true,
      data: {
        items: [] as Item[],
        total: 0,
        page,
        pageSize,
      } as ItemQueryResult,
    };
  },

  itemsGetByMod: async () => ({ success: true, data: [] as Item[] }),

  itemsGetDetail: async () => ({ success: true, data: null }),

  itemsGetTexture: async () => ({ success: true, data: null }),

  // ========== 标签和模组查询 ==========
  tagsQuery: async () => ({ success: true, data: [] }),

  modsQuery: async () => ({ success: true, data: [] as Mod[] }),

  // ========== 配方查询 ==========
  recipesQuery: async () => ({ success: true, data: { recipes: [], total: 0 } }),
  recipesGetTypes: async () => ({ success: true, data: [] }),
  recipesGetDetail: async () => ({ success: true, data: null }),

  // ========== Unify 查询 ==========
  unifyQuery: async () => ({
    success: false,
    error: '浏览器模式不支持 unify 查询',
  }),
  unifyDryRun: async () => ({
    success: false,
    error: '浏览器模式不支持 unify dry-run',
  }),

  // ========== 导出 ==========
  exportKubeJs: async () => ({
    success: false,
    error: '浏览器模式不支持 KubeJS 导出',
  }),
  revertKubeJs: async () => ({
    success: false,
    error: '浏览器模式不支持 KubeJS 生成文件撤销',
  }),

  // ========== 配方类型元数据 ==========
  recipeTypesGetAll: async () => ({ success: true, data: [] }),
  recipeTypesGet: async () => ({ success: true, data: null }),
  recipeTypesGetByMod: async () => ({ success: true, data: [] }),
  recipeTypesClearCache: async () => ({ success: true }),

  // ========== 通用工具 ==========
  openExternal: async (url: string) => {
    window.open(url, '_blank');
  },

  // ========== 调试 ==========
  debugDbTables: async () => ({ success: true, data: [] }),
  debugDbQuery: async () => ({ success: true, data: [] }),
  debugClearData: async () => ({ success: true, data: { cleared: true } }),
};

// 自动初始化
if (typeof window !== 'undefined') {
  browserElectronAPI.init().catch(console.error);
}

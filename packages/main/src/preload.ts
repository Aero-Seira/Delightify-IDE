/**
 * Preload Script - v2.1
 * 
 * 根据 reference_sql/export.sqlite 样例调整
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

console.log('[Preload] v2.1 starting...');

const IPC_CHANNELS = {
  // Project
  PROJECT_LIST: 'project:list',
  PROJECT_OPEN: 'project:open',
  PROJECT_CREATE: 'project:create',
  PROJECT_GET_CURRENT: 'project:get-current',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  PROJECT_SELECT_DIRECTORY: 'project:select-directory',
  PROJECT_GET_STATS: 'project:get-stats',

  // Mod data
  MOD_DATA_DETECT: 'mod-data:detect',
  MOD_DATA_VALIDATE: 'mod-data:validate',
  MOD_DATA_IMPORT: 'mod-data:import',
  MOD_DATA_IMPORT_PROGRESS: 'mod-data:import:progress',
  MOD_DATA_GET_IMPORT_HISTORY: 'mod-data:get-import-history',

  // Items
  ITEMS_QUERY: 'items:query',
  ITEMS_GET_BY_MOD: 'items:get-by-mod',
  ITEMS_GET_DETAIL: 'items:get-detail',

  // Tags & Mods
  TAGS_QUERY: 'tags:query',
  MODS_QUERY: 'mods:query',

  // Recipes
  RECIPES_QUERY: 'recipes:query',
  RECIPES_GET_TYPES: 'recipes:get-types',
  RECIPES_GET_DETAIL: 'recipes:get-detail',

  // Unify
  UNIFY_QUERY: 'unify:query',
  UNIFY_DRY_RUN: 'unify:dry-run',

  // Debug
  DEBUG_DB_TABLES: 'debug:db-tables',
  DEBUG_DB_QUERY: 'debug:db-query',
  DEBUG_CLEAR_DATA: 'debug:clear-data',

  // Export
  EXPORT_KUBEJS: 'export:kubejs',
  EXPORT_KUBEJS_REVERT: 'export:kubejs:revert',
} as const;

contextBridge.exposeInMainWorld('electronAPI', {
  // ========== 项目管理 ==========
  projectList: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST),
  projectOpen: (projectId?: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_OPEN, projectId),
  projectCreate: (data: unknown) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, data),
  projectGetCurrent: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GET_CURRENT),
  projectUpdate: (projectId: string, data: unknown) => 
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_UPDATE, projectId, data),
  projectDelete: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DELETE, projectId),
  selectDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SELECT_DIRECTORY),
  projectGetStats: (projectPath: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GET_STATS, projectPath),

  // ========== 物品纹理 ==========
  itemsGetTexture: (projectPath: string, itemId: string) => 
    ipcRenderer.invoke('items:get-texture', projectPath, itemId),

  // ========== Mod数据导入 ==========
  modDataDetect: (projectPath: string) => ipcRenderer.invoke(IPC_CHANNELS.MOD_DATA_DETECT, projectPath),
  modDataValidate: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.MOD_DATA_VALIDATE, filePath),
  modDataImport: (projectPath: string, dataFilePath?: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.MOD_DATA_IMPORT, projectPath, dataFilePath),
  onModDataImportProgress: (callback: (progress: unknown) => void) => {
    const listener = (_event: IpcRendererEvent, progress: unknown) => callback(progress);
    ipcRenderer.on(IPC_CHANNELS.MOD_DATA_IMPORT_PROGRESS, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MOD_DATA_IMPORT_PROGRESS, listener);
  },
  modDataGetImportHistory: (projectPath: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.MOD_DATA_GET_IMPORT_HISTORY, projectPath),

  // ========== 物品查询 ==========
  itemsQuery: (projectPath: string, params: unknown) => 
    ipcRenderer.invoke(IPC_CHANNELS.ITEMS_QUERY, projectPath, params),
  itemsGetByMod: (projectPath: string, modid: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.ITEMS_GET_BY_MOD, projectPath, modid),
  itemsGetDetail: (projectPath: string, itemId: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.ITEMS_GET_DETAIL, projectPath, itemId),

  // ========== 标签和模组查询 ==========
  tagsQuery: (projectPath: string) => ipcRenderer.invoke(IPC_CHANNELS.TAGS_QUERY, projectPath),
  modsQuery: (projectPath: string) => ipcRenderer.invoke(IPC_CHANNELS.MODS_QUERY, projectPath),

  // ========== 配方查询 ==========
  recipesQuery: (projectPath: string, params: unknown) => 
    ipcRenderer.invoke(IPC_CHANNELS.RECIPES_QUERY, projectPath, params),
  recipesGetTypes: (projectPath: string) => ipcRenderer.invoke(IPC_CHANNELS.RECIPES_GET_TYPES, projectPath),
  recipesGetDetail: (projectPath: string, recipeId: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.RECIPES_GET_DETAIL, projectPath, recipeId),

  // ========== Unify 查询 ==========
  unifyQuery: (projectPath: string, params: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.UNIFY_QUERY, projectPath, params),
  unifyDryRun: (projectPath: string, params: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.UNIFY_DRY_RUN, projectPath, params),

  // ========== 导出 ==========
  exportKubeJs: (projectPath: string, params: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_KUBEJS, projectPath, params),
  revertKubeJs: (projectPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_KUBEJS_REVERT, projectPath),

  // ========== 通用工具 ==========
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),

  // ========== 调试 ==========
  debugDbTables: (projectPath: string) => ipcRenderer.invoke(IPC_CHANNELS.DEBUG_DB_TABLES, projectPath),
  debugDbQuery: (projectPath: string, sql: string, args?: unknown[]) => 
    ipcRenderer.invoke(IPC_CHANNELS.DEBUG_DB_QUERY, projectPath, sql, args),
  debugClearData: (projectPath: string) => ipcRenderer.invoke(IPC_CHANNELS.DEBUG_CLEAR_DATA, projectPath),
});

console.log('[Preload] v2.1 electronAPI exposed successfully');

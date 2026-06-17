/**
 * Preload Script - v2.1
 * 
 * 根据 reference_sql/export.sqlite 样例调整
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { IPC_CHANNELS as SharedIpcChannels } from '@delightify/shared';

console.log('[Preload] v2.1 starting...');

const IPC_CHANNELS = {
  // Project management
  PROJECT_LIST: 'project:list',
  PROJECT_OPEN: 'project:open',
  PROJECT_CREATE: 'project:create',
  PROJECT_GET_CURRENT: 'project:get-current',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  PROJECT_SELECT_DIRECTORY: 'project:select-directory',
  PROJECT_SELECT_DATA_FILE: 'project:select-data-file',
  PROJECT_GET_STATS: 'project:get-stats',

  // Mod data import
  MOD_DATA_DETECT: 'mod-data:detect',
  MOD_DATA_VALIDATE: 'mod-data:validate',
  MOD_DATA_IMPORT: 'mod-data:import',
  MOD_DATA_IMPORT_PROGRESS: 'mod-data:import:progress',
  MOD_DATA_GET_IMPORT_HISTORY: 'mod-data:get-import-history',

  // Item queries
  ITEMS_QUERY: 'items:query',
  ITEMS_GET_BY_MOD: 'items:get-by-mod',
  ITEMS_GET_DETAIL: 'items:get-detail',
  ITEMS_GET_TEXTURE: 'items:get-texture',

  // Tag & Mod queries
  TAGS_QUERY: 'tags:query',
  MODS_QUERY: 'mods:query',

  // Recipe queries
  RECIPES_QUERY: 'recipes:query',
  RECIPES_GET_TYPES: 'recipes:get-types',
  RECIPES_GET_DETAIL: 'recipes:get-detail',

  // Unify queries
  UNIFY_QUERY: 'unify:query',
  UNIFY_DRY_RUN: 'unify:dry-run',

  // Engine queries
  ENGINE_DRY_RUN: 'engine:dry-run',
  ENGINE_BLAST: 'engine:blast',

  // Recipe editing
  // reserved：配方编辑二期
  RECIPE_EDIT_CREATE: 'recipe-edit:create',
  // reserved：配方编辑二期
  RECIPE_EDIT_UPDATE: 'recipe-edit:update',
  // reserved：配方编辑二期
  RECIPE_EDIT_DELETE: 'recipe-edit:delete',
  // reserved：配方编辑二期
  RECIPE_EDIT_LIST: 'recipe-edit:list',

  // Export
  EXPORT_KUBEJS_PREVIEW: 'export:kubejs:preview',
  EXPORT_KUBEJS: 'export:kubejs',
  EXPORT_KUBEJS_REVERT: 'export:kubejs:revert',
  // reserved：输出层
  EXPORT_DATAPACK: 'export:datapack',

  // Script workspace
  SCRIPT_WORKSPACE_LIST: 'script-workspace:list',
  SCRIPT_WORKSPACE_READ: 'script-workspace:read',
  SCRIPT_WORKSPACE_SAVE: 'script-workspace:save',
  SCRIPT_WORKSPACE_CREATE_MANAGED: 'script-workspace:create-managed',
  SCRIPT_WORKSPACE_CREATE_USER: 'script-workspace:create-user',
  SCRIPT_WORKSPACE_CREATE_DIRECTORY: 'script-workspace:create-directory',
  SCRIPT_WORKSPACE_RENAME: 'script-workspace:rename',
  SCRIPT_WORKSPACE_COPY_AS_MANAGED: 'script-workspace:copy-as-managed',

  // Shell
  SHELL_OPEN_EXTERNAL: 'shell:open-external',

  // Debug
  DEBUG_DB_TABLES: 'debug:db-tables',
  DEBUG_DB_QUERY: 'debug:db-query',
  DEBUG_CLEAR_DATA: 'debug:clear-data',
} as const;

type AssertEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
// preload 本地 IPC_CHANNELS 必须与 @delightify/shared 双向全等，漂移即编译失败
const _assertChannelsInSync: AssertEqual<typeof IPC_CHANNELS, typeof SharedIpcChannels> = true;
void _assertChannelsInSync;

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
  selectDataFile: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SELECT_DATA_FILE),
  projectGetStats: (projectPath: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GET_STATS, projectPath),

  // ========== 物品纹理 ==========
  itemsGetTexture: (projectPath: string, itemId: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.ITEMS_GET_TEXTURE, projectPath, itemId),

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

  // ========== Engine 查询 ==========
  engineDryRun: (projectPath: string, req: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.ENGINE_DRY_RUN, projectPath, req),
  engineBlast: (projectPath: string, target: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.ENGINE_BLAST, projectPath, target),

  // ========== 导出 ==========
  previewKubeJs: (params: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_KUBEJS_PREVIEW, params),
  exportKubeJs: (projectPath: string, params: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_KUBEJS, projectPath, params),
  revertKubeJs: (projectPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_KUBEJS_REVERT, projectPath),

  // ========== 脚本工作区 ==========
  scriptWorkspaceList: (projectPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SCRIPT_WORKSPACE_LIST, projectPath),
  scriptWorkspaceRead: (projectPath: string, relativePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SCRIPT_WORKSPACE_READ, projectPath, relativePath),
  scriptWorkspaceSave: (projectPath: string, relativePath: string, content: string, options?: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.SCRIPT_WORKSPACE_SAVE, projectPath, relativePath, content, options),
  scriptWorkspaceCreateManaged: (projectPath: string, relativePath?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SCRIPT_WORKSPACE_CREATE_MANAGED, projectPath, relativePath),
  scriptWorkspaceCreateUser: (projectPath: string, relativePath?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SCRIPT_WORKSPACE_CREATE_USER, projectPath, relativePath),
  scriptWorkspaceCreateDirectory: (projectPath: string, relativePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SCRIPT_WORKSPACE_CREATE_DIRECTORY, projectPath, relativePath),
  scriptWorkspaceRename: (
    projectPath: string,
    sourceRelativePath: string,
    targetRelativePath: string,
    options?: unknown
  ) => ipcRenderer.invoke(
    IPC_CHANNELS.SCRIPT_WORKSPACE_RENAME,
    projectPath,
    sourceRelativePath,
    targetRelativePath,
    options
  ),
  scriptWorkspaceCopyAsManaged: (projectPath: string, sourceRelativePath: string, targetRelativePath?: string) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.SCRIPT_WORKSPACE_COPY_AS_MANAGED,
      projectPath,
      sourceRelativePath,
      targetRelativePath
    ),

  // ========== 通用工具 ==========
  openExternal: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, url),

  // ========== 调试 ==========
  debugDbTables: (projectPath: string) => ipcRenderer.invoke(IPC_CHANNELS.DEBUG_DB_TABLES, projectPath),
  debugDbQuery: (projectPath: string, sql: string, args?: unknown[]) => 
    ipcRenderer.invoke(IPC_CHANNELS.DEBUG_DB_QUERY, projectPath, sql, args),
  debugClearData: (projectPath: string) => ipcRenderer.invoke(IPC_CHANNELS.DEBUG_CLEAR_DATA, projectPath),
});

console.log('[Preload] v2.1 electronAPI exposed successfully');

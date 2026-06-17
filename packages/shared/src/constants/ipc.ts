// IPC channel constants - v2.1
// 根据 reference_sql/export.sqlite 样例调整

export const IPC_CHANNELS = {
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
  SCRIPT_WORKSPACE_DELETE: 'script-workspace:delete',
  SCRIPT_WORKSPACE_COPY_AS_MANAGED: 'script-workspace:copy-as-managed',

  // Shell
  SHELL_OPEN_EXTERNAL: 'shell:open-external',

  // Debug
  DEBUG_DB_TABLES: 'debug:db-tables',
  DEBUG_DB_QUERY: 'debug:db-query',
  DEBUG_CLEAR_DATA: 'debug:clear-data',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

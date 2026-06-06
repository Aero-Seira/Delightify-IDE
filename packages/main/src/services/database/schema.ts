/**
 * Delightify Database Schema - v2.1
 * 
 * 根据 reference_sql/export.sqlite 样例调整的数据库设计
 * 与附属Mod生成的数据结构保持一致
 */

import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

// ============================================================================
// 元数据表
// ============================================================================

/**
 * Schema 版本表
 */
export const schemaVersion = sqliteTable('schema_version', {
  version: integer('version').primaryKey(),
});

/**
 * 清单表 - 存储导出元数据
 */
export const manifest = sqliteTable('manifest', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// ============================================================================
// 核心数据表（与附属Mod导出的结构一致）
// ============================================================================

/**
 * 模组信息表
 */
export const mods = sqliteTable('mods', {
  modid: text('modid').primaryKey(),
  version: text('version'),
  name: text('name'),
});

/**
 * 物品/方块表
 */
export const items = sqliteTable('items', {
  itemId: text('item_id').primaryKey(),
  modid: text('modid').notNull().references(() => mods.modid),
});

/**
 * 物品标签关联表
 */
export const itemTags = sqliteTable('item_tags', {
  tagId: text('tag_id').notNull(),
  itemId: text('item_id').notNull().references(() => items.itemId),
}, (table) => ({
  pk: primaryKey({ columns: [table.tagId, table.itemId] }),
}));

/**
 * 配方表
 */
export const recipes = sqliteTable('recipes', {
  recipeId: text('recipe_id').primaryKey(),
  typeId: text('type_id').notNull(),
  modid: text('modid').notNull().references(() => mods.modid),
  hash: text('hash').notNull(),
  rawJson: text('raw_json'),
  unparsed: integer('unparsed', { mode: 'boolean' }).notNull().default(false),
});

// ============================================================================
// 项目工作区数据（用户编辑内容）
// ============================================================================

/**
 * 配方类型显示名称映射（用于覆盖或补充）
 */
export const recipeTypeDisplayNames = sqliteTable('recipe_type_display_names', {
  typeId: text('type_id').primaryKey(),
  displayName: text('display_name').notNull(),
  icon: text('icon'),
  inputSlotCount: integer('input_slot_count').default(1),
  outputSlotCount: integer('output_slot_count').default(1),
});

/**
 * 配方编辑历史 - 用户对配方的修改记录
 */
export const recipeEdits = sqliteTable('recipe_edits', {
  editId: text('edit_id').primaryKey(),
  recipeId: text('recipe_id').notNull(),
  editType: text('edit_type', { enum: ['create', 'modify', 'disable', 'delete', 'restore'] }).notNull(),
  originalRecipe: text('original_recipe'),
  editedRecipe: text('edited_recipe').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  isExported: integer('is_exported', { mode: 'boolean' }).notNull().default(false),
  exportedAt: text('exported_at'),
});

/**
 * 导出历史
 */
export const exportHistory = sqliteTable('export_history', {
  exportId: text('export_id').primaryKey(),
  exportType: text('export_type', { enum: ['kubejs', 'datapack'] }).notNull(),
  targetPath: text('target_path').notNull(),
  exportedEditIds: text('exported_edit_ids'),
  exportedFiles: text('exported_files'),
  exportedAt: text('exported_at').notNull(),
  isSuccess: integer('is_success', { mode: 'boolean' }).notNull().default(true),
  errorMessage: text('error_message'),
});

/**
 * 数据导入历史
 */
export const dataImports = sqliteTable('data_imports', {
  importId: text('import_id').primaryKey(),
  sourceFilePath: text('source_file_path').notNull(),
  dataVersion: text('data_version').notNull(),
  exportedAt: text('exported_at'),
  modCount: integer('mod_count').notNull().default(0),
  itemCount: integer('item_count').notNull().default(0),
  recipeCount: integer('recipe_count').notNull().default(0),
  tagCount: integer('tag_count').notNull().default(0),
  importedAt: text('imported_at').notNull(),
  isSuccess: integer('is_success', { mode: 'boolean' }).notNull().default(true),
  errorMessage: text('error_message'),
});

// ============================================================================
// Type Exports
// ============================================================================

export type SchemaVersion = typeof schemaVersion.$inferSelect;
export type Manifest = typeof manifest.$inferSelect;
export type Mod = typeof mods.$inferSelect;
export type Item = typeof items.$inferSelect;
export type ItemTag = typeof itemTags.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type RecipeTypeDisplayName = typeof recipeTypeDisplayNames.$inferSelect;
export type RecipeEdit = typeof recipeEdits.$inferSelect;
export type ExportHistory = typeof exportHistory.$inferSelect;
export type DataImport = typeof dataImports.$inferSelect;

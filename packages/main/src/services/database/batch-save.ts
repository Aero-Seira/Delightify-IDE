/**
 * 数据库批量保存优化工具
 * 
 * 提供高性能的批量插入和事务管理
 * 特别优化 JAR 导入时的数据库写入性能
 */

import type { Client } from '@libsql/client';

/**
 * 批量插入配置
 */
interface BatchInsertConfig {
  /** 每批插入的记录数 */
  batchSize?: number;
  /** 是否使用事务 */
  useTransaction?: boolean;
  /** 是否显示进度回调 */
  onProgress?: (inserted: number, total: number) => void;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<BatchInsertConfig> = {
  batchSize: 500,
  useTransaction: true,
  onProgress: () => {},
};

/**
 * 优化的批量插入物品
 * 
 * 使用单一事务 + 批量 VALUES 子句，避免逐条插入的开销
 * 
 * @param db 数据库客户端
 * @param items 物品列表
 * @param config 配置选项
 */
export async function batchInsertItems(
  db: Client,
  items: Array<{
    itemId: string;
    modId: string;
    translationKey?: string;
    name: string;
    category: string;
    texturePath?: string;
    textureCacheName?: string | null;
    textureType: string;
    isBlock: boolean;
    createdAt: string;
  }>,
  config: BatchInsertConfig = {}
): Promise<{ inserted: number; errors: number }> {
  const { batchSize, useTransaction, onProgress } = { ...DEFAULT_CONFIG, ...config };
  
  if (items.length === 0) {
    return { inserted: 0, errors: 0 };
  }

  let inserted = 0;
  let errors = 0;

  // 准备 SQL 模板
  const baseSql = `INSERT INTO items (item_id, mod_id, display_name_key, display_name, category, texture_path, texture_cache_name, texture_type, is_block, created_at)
    VALUES `;
  
  const updateClause = ` ON CONFLICT(item_id) DO UPDATE SET
    display_name_key = excluded.display_name_key,
    display_name = excluded.display_name,
    category = excluded.category,
    texture_path = excluded.texture_path,
    texture_cache_name = excluded.texture_cache_name,
    texture_type = excluded.texture_type,
    is_block = excluded.is_block`;

  // 分批处理
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    // 构建 VALUES 子句
    const placeholders: string[] = [];
    const args: (string | number | null)[] = [];
    
    for (const item of batch) {
      placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      args.push(
        item.itemId,
        item.modId,
        item.translationKey ?? null,
        item.name,
        item.category,
        item.texturePath || null,
        item.textureCacheName || null,
        item.textureType,
        item.isBlock ? 1 : 0,
        item.createdAt
      );
    }

    const sql = baseSql + placeholders.join(', ') + updateClause;

    try {
      if (useTransaction) {
        // 在事务中执行
        await db.execute({ sql: 'BEGIN IMMEDIATE', args: [] });
        try {
          await db.execute({ sql, args });
          await db.execute({ sql: 'COMMIT', args: [] });
        } catch (error) {
          await db.execute({ sql: 'ROLLBACK', args: [] });
          throw error;
        }
      } else {
        await db.execute({ sql, args });
      }
      
      inserted += batch.length;
      onProgress(inserted, items.length);
    } catch (error) {
      console.error(`[BatchInsert] Failed to insert batch ${i / batchSize + 1}:`, error);
      errors += batch.length;
      
      // 如果批量失败，尝试逐条插入
      if (batch.length > 1) {
        console.log(`[BatchInsert] Retrying batch ${i / batchSize + 1} individually...`);
        for (const item of batch) {
          try {
            await db.execute({
              sql: baseSql + '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)' + updateClause,
              args: [
                item.itemId, item.modId, item.translationKey ?? null, item.name,
                item.category, item.texturePath || null, item.textureCacheName || null,
                item.textureType, item.isBlock ? 1 : 0, item.createdAt
              ],
            });
            inserted++;
          } catch (e) {
            errors++;
            console.warn(`[BatchInsert] Failed to insert item ${item.itemId}:`, e);
          }
        }
      }
    }
  }

  return { inserted, errors };
}

/**
 * 批量插入标签
 */
export async function batchInsertTags(
  db: Client,
  tags: Array<{ tagId: string; items: string[] }>,
  modId: string,
  validItemIds?: Set<string>,
  config: BatchInsertConfig = {}
): Promise<{ inserted: number; errors: number }> {
  const { batchSize, useTransaction, onProgress } = { ...DEFAULT_CONFIG, ...config };
  
  // 扁平化标签数据
  const tagRelations: Array<{ tagId: string; itemId: string }> = [];
  for (const tag of tags) {
    for (const itemId of tag.items) {
      if (!validItemIds || validItemIds.has(itemId)) {
        tagRelations.push({ tagId: tag.tagId, itemId });
      }
    }
  }

  if (tagRelations.length === 0) {
    return { inserted: 0, errors: 0 };
  }

  let inserted = 0;
  let errors = 0;

  const baseSql = `INSERT INTO item_tags (tag_id, item_id, source_mod_id) VALUES `;
  const updateClause = ` ON CONFLICT(tag_id, item_id) DO UPDATE SET source_mod_id = excluded.source_mod_id`;

  for (let i = 0; i < tagRelations.length; i += batchSize) {
    const batch = tagRelations.slice(i, i + batchSize);
    
    const placeholders: string[] = [];
    const args: (string)[] = [];
    
    for (const rel of batch) {
      placeholders.push('(?, ?, ?)');
      args.push(rel.tagId, rel.itemId, modId);
    }

    const sql = baseSql + placeholders.join(', ') + updateClause;

    try {
      if (useTransaction) {
        await db.execute({ sql: 'BEGIN IMMEDIATE', args: [] });
        try {
          await db.execute({ sql, args });
          await db.execute({ sql: 'COMMIT', args: [] });
        } catch (error) {
          await db.execute({ sql: 'ROLLBACK', args: [] });
          throw error;
        }
      } else {
        await db.execute({ sql, args });
      }
      
      inserted += batch.length;
      onProgress(inserted, tagRelations.length);
    } catch (error) {
      console.error(`[BatchInsert] Failed to insert tag batch:`, error);
      errors += batch.length;
    }
  }

  return { inserted, errors };
}

/**
 * 批量插入配方
 */
export async function batchInsertRecipes(
  db: Client,
  recipes: Array<{
    recipeId: string;
    recipeType: string;
    rawJson: string;
    inputs: Array<{ id: string; isTag: boolean; slot: number }>;
    outputs: Array<{ itemId: string; slot: number; count: number }>;
  }>,
  modId: string,
  parsedAt: string,
  config: BatchInsertConfig = {}
): Promise<{ inserted: number; errors: number }> {
  const { batchSize, useTransaction, onProgress } = { ...DEFAULT_CONFIG, ...config };
  
  if (recipes.length === 0) {
    return { inserted: 0, errors: 0 };
  }

  let inserted = 0;
  let errors = 0;

  const baseSql = `INSERT INTO recipes (recipe_id, mod_id, recipe_type_id, raw_json, input_slots, output_slots, parsed_at) VALUES `;
  const updateClause = ` ON CONFLICT(recipe_id) DO UPDATE SET
    mod_id = excluded.mod_id,
    recipe_type_id = excluded.recipe_type_id,
    raw_json = excluded.raw_json,
    input_slots = excluded.input_slots,
    output_slots = excluded.output_slots,
    parsed_at = excluded.parsed_at`;

  for (let i = 0; i < recipes.length; i += batchSize) {
    const batch = recipes.slice(i, i + batchSize);
    
    const placeholders: string[] = [];
    const args: (string | null)[] = [];
    
    for (const recipe of batch) {
      placeholders.push('(?, ?, ?, ?, ?, ?, ?)');
      args.push(
        recipe.recipeId,
        modId,
        recipe.recipeType,
        recipe.rawJson,
        JSON.stringify(recipe.inputs),
        JSON.stringify(recipe.outputs),
        parsedAt
      );
    }

    const sql = baseSql + placeholders.join(', ') + updateClause;

    try {
      if (useTransaction) {
        await db.execute({ sql: 'BEGIN IMMEDIATE', args: [] });
        try {
          await db.execute({ sql, args });
          await db.execute({ sql: 'COMMIT', args: [] });
        } catch (error) {
          await db.execute({ sql: 'ROLLBACK', args: [] });
          throw error;
        }
      } else {
        await db.execute({ sql, args });
      }
      
      inserted += batch.length;
      onProgress(inserted, recipes.length);
    } catch (error) {
      console.error(`[BatchInsert] Failed to insert recipe batch:`, error);
      errors += batch.length;
    }
  }

  return { inserted, errors };
}

/**
 * 批量插入翻译
 */
export async function batchInsertTranslations(
  db: Client,
  translations: Map<string, Map<string, string>>,
  modId: string,
  config: BatchInsertConfig = {}
): Promise<{ inserted: number; errors: number }> {
  const { batchSize, useTransaction, onProgress } = { ...DEFAULT_CONFIG, ...config };
  
  // 扁平化翻译数据
  const translationList: Array<{ key: string; lang: string; value: string }> = [];
  for (const [key, langMap] of translations) {
    for (const [lang, value] of langMap) {
      translationList.push({ key, lang, value });
    }
  }

  if (translationList.length === 0) {
    return { inserted: 0, errors: 0 };
  }

  let inserted = 0;
  let errors = 0;

  const baseSql = `INSERT INTO translations (key, lang, value, mod_id) VALUES `;
  const updateClause = ` ON CONFLICT(key, lang) DO UPDATE SET
    value = excluded.value,
    mod_id = excluded.mod_id`;

  for (let i = 0; i < translationList.length; i += batchSize) {
    const batch = translationList.slice(i, i + batchSize);
    
    const placeholders: string[] = [];
    const args: string[] = [];
    
    for (const trans of batch) {
      placeholders.push('(?, ?, ?, ?)');
      args.push(trans.key, trans.lang, trans.value, modId);
    }

    const sql = baseSql + placeholders.join(', ') + updateClause;

    try {
      if (useTransaction) {
        await db.execute({ sql: 'BEGIN IMMEDIATE', args: [] });
        try {
          await db.execute({ sql, args });
          await db.execute({ sql: 'COMMIT', args: [] });
        } catch (error) {
          await db.execute({ sql: 'ROLLBACK', args: [] });
          throw error;
        }
      } else {
        await db.execute({ sql, args });
      }
      
      inserted += batch.length;
      onProgress(inserted, translationList.length);
    } catch (error) {
      console.error(`[BatchInsert] Failed to insert translation batch:`, error);
      errors += batch.length;
    }
  }

  return { inserted, errors };
}

/**
 * 批量插入材质元数据
 */
export async function batchInsertTextures(
  db: Client,
  textures: Array<{
    textureId: string;
    modId: string;
    originalPath: string;
    cacheName: string;
    fileHash?: string;
    width?: number;
    height?: number;
    cachedAt: string;
  }>,
  config: BatchInsertConfig = {}
): Promise<{ inserted: number; errors: number }> {
  const { batchSize, useTransaction, onProgress } = { ...DEFAULT_CONFIG, ...config };
  
  if (textures.length === 0) {
    return { inserted: 0, errors: 0 };
  }

  let inserted = 0;
  let errors = 0;

  const baseSql = `INSERT INTO textures (texture_id, mod_id, original_path, cache_name, file_hash, width, height, cached_at) VALUES `;
  const updateClause = ` ON CONFLICT(texture_id) DO UPDATE SET
    cache_name = excluded.cache_name,
    file_hash = excluded.file_hash,
    cached_at = excluded.cached_at`;

  for (let i = 0; i < textures.length; i += batchSize) {
    const batch = textures.slice(i, i + batchSize);
    
    const placeholders: string[] = [];
    const args: (string | number | null)[] = [];
    
    for (const tex of batch) {
      placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?)');
      args.push(
        tex.textureId,
        tex.modId,
        tex.originalPath,
        tex.cacheName,
        tex.fileHash || null,
        tex.width || null,
        tex.height || null,
        tex.cachedAt
      );
    }

    const sql = baseSql + placeholders.join(', ') + updateClause;

    try {
      if (useTransaction) {
        await db.execute({ sql: 'BEGIN IMMEDIATE', args: [] });
        try {
          await db.execute({ sql, args });
          await db.execute({ sql: 'COMMIT', args: [] });
        } catch (error) {
          await db.execute({ sql: 'ROLLBACK', args: [] });
          throw error;
        }
      } else {
        await db.execute({ sql, args });
      }
      
      inserted += batch.length;
      onProgress(inserted, textures.length);
    } catch (error) {
      console.error(`[BatchInsert] Failed to insert texture batch:`, error);
      errors += batch.length;
    }
  }

  return { inserted, errors };
}

/**
 * 优化数据库写入性能（临时设置）
 * 
 * 在批量导入前调用，禁用一些安全特性以换取性能
 */
export async function optimizeForBulkInsert(db: Client): Promise<void> {
  // PRAGMA 优化
  await db.execute({ sql: 'PRAGMA synchronous = OFF', args: [] });
  await db.execute({ sql: 'PRAGMA journal_mode = MEMORY', args: [] });
  await db.execute({ sql: 'PRAGMA cache_size = 10000', args: [] });
  await db.execute({ sql: 'PRAGMA locking_mode = EXCLUSIVE', args: [] });
  await db.execute({ sql: 'PRAGMA temp_store = MEMORY', args: [] });
}

/**
 * 恢复数据库安全设置
 * 
 * 在批量导入完成后调用，恢复数据安全
 */
export async function restoreSafetySettings(db: Client): Promise<void> {
  await db.execute({ sql: 'PRAGMA synchronous = NORMAL', args: [] });
  await db.execute({ sql: 'PRAGMA journal_mode = DELETE', args: [] });
  await db.execute({ sql: 'PRAGMA locking_mode = NORMAL', args: [] });
}

/**
 * 在事务中执行多个操作
 */
export async function withTransaction<T>(
  db: Client,
  operations: () => Promise<T>
): Promise<T> {
  await db.execute({ sql: 'BEGIN IMMEDIATE', args: [] });
  try {
    const result = await operations();
    await db.execute({ sql: 'COMMIT', args: [] });
    return result;
  } catch (error) {
    await db.execute({ sql: 'ROLLBACK', args: [] });
    throw error;
  }
}

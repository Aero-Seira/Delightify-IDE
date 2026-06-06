/**
 * Mod Data Validator
 * 
 * 根据 reference_sql/export.sqlite 样例实现
 */

import { createClient } from '@libsql/client';
import type { ValidationResult } from './types';

// 附属Mod数据文件预期路径
export const DATA_FILE_PATHS = [
  'delightify-exporter/export.sqlite',
  '.delightify-exporter/export.sqlite',
  'config/delightify-exporter/export.sqlite',
];

/**
 * 验证数据文件
 * @param filePath 数据文件路径
 * @returns 验证结果
 */
export async function validateModDataFile(filePath: string): Promise<ValidationResult> {
  let client: ReturnType<typeof createClient> | null = null;
  
  try {
    const fs = await import('fs/promises');
    try {
      await fs.access(filePath);
    } catch {
      return { valid: false, error: '数据文件不存在' };
    }

    // 尝试连接数据库
    client = createClient({
      url: `file:${filePath}`,
    });

    // 检查必需的表是否存在
    const requiredTables = ['manifest', 'mods', 'items', 'item_tags', 'recipes'];
    for (const table of requiredTables) {
      const result = await client.execute({
        sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
        args: [table],
      });
      if (result.rows.length === 0) {
        return { valid: false, error: `数据文件缺少必需的表: ${table}` };
      }
    }

    // 读取 manifest 获取元数据
    let minecraftVersion: string | undefined;
    let forgeVersion: string | undefined;
    let exportedAt: string | undefined;
    let modCount = 0;

    try {
      const manifestResult = await client.execute('SELECT * FROM manifest');
      for (const row of manifestResult.rows) {
        const key = row.key as string;
        const value = row.value as string;
        
        switch (key) {
          case 'minecraft_version':
            minecraftVersion = value;
            break;
          case 'forge_version':
            forgeVersion = value;
            break;
          case 'exported_at_utc':
            exportedAt = value;
            break;
          case 'mod_count':
            modCount = parseInt(value, 10) || 0;
            break;
        }
      }
    } catch {
      // manifest 读取失败不影响验证
    }

    // 统计各项数量
    const [itemsResult, recipesResult, tagsResult] = await Promise.all([
      client.execute('SELECT COUNT(*) as count FROM items'),
      client.execute('SELECT COUNT(*) as count FROM recipes'),
      client.execute('SELECT COUNT(*) as count FROM item_tags'),
    ]);

    return {
      valid: true,
      version: '1.0',
      minecraftVersion,
      forgeVersion,
      exportedAt,
      modCount,
      itemCount: Number(itemsResult.rows[0]?.count || 0),
      recipeCount: Number(recipesResult.rows[0]?.count || 0),
      tagCount: Number(tagsResult.rows[0]?.count || 0),
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : '验证数据文件失败',
    };
  } finally {
    // 确保连接被关闭
    if (client) {
      try { await client.close(); } catch {}
    }
  }
}

/**
 * 快速验证数据文件
 * @param filePath 数据文件路径
 * @returns 是否有效
 */
export async function quickValidate(filePath: string): Promise<boolean> {
  let client: ReturnType<typeof createClient> | null = null;
  
  try {
    const fs = await import('fs/promises');
    const stats = await fs.stat(filePath);
    
    if (!stats.isFile() || stats.size === 0) {
      return false;
    }

    client = createClient({
      url: `file:${filePath}`,
    });

    const result = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='manifest'"
    );
    
    return result.rows.length > 0;
  } catch {
    return false;
  } finally {
    // 确保连接被关闭
    if (client) {
      try { await client.close(); } catch {}
    }
  }
}

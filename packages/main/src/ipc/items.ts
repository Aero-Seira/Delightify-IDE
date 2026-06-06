/**
 * Items IPC Handlers - v2.2
 * 
 * 优化数据库连接管理，不再每次查询后关闭连接
 * 依赖 createProjectDbClient 的连接缓存机制
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';
import type { 
  IpcResponse, 
  ItemQueryParams, 
  ItemQueryResult,
  Item,
  TagInfo,
} from '@delightify/shared';
import { createProjectDbClient } from '../services/database';
import { appPaths } from '../services/paths';

export function registerItemsHandlers(): void {
  // ITEMS_QUERY: 查询物品
  ipcMain.handle(IPC_CHANNELS.ITEMS_QUERY, async (
    _event,
    projectPath: string,
    params: ItemQueryParams
  ): Promise<IpcResponse<ItemQueryResult>> => {
    const dbPath = appPaths.projectDb(projectPath);
    try {
      const { search, searchField = 'all', modid, tagId, page = 1, pageSize = 50 } = params;
      
      const db = createProjectDbClient(dbPath);
      
      // 构建查询条件
      const countConditions: string[] = [];
      const queryConditions: string[] = [];
      const args: (string | number)[] = [];
      
      // 搜索条件处理
      if (search) {
        const searchPattern = `%${search}%`;
        
        switch (searchField) {
          case 'id':
            // 仅搜索物品ID
            countConditions.push('items.item_id LIKE ?');
            queryConditions.push('i.item_id LIKE ?');
            args.push(searchPattern);
            break;
            
          case 'name':
            // 仅搜索翻译名（需要JOIN item_resources）
            countConditions.push('items.item_id IN (SELECT item_id FROM item_resources WHERE resource_type = \'lang_name\' AND content LIKE ?)');
            queryConditions.push('ir.content LIKE ?');
            args.push(searchPattern);
            break;
            
          case 'tag':
            // 搜索标签ID（在item_tags表中查找）
            countConditions.push('items.item_id IN (SELECT item_id FROM item_tags WHERE tag_id LIKE ?)');
            queryConditions.push('i.item_id IN (SELECT item_id FROM item_tags WHERE tag_id LIKE ?)');
            args.push(searchPattern);
            break;
            
          case 'all':
          default:
            // 搜索所有字段（ID OR 翻译名 OR 标签）
            countConditions.push(`(
              items.item_id LIKE ? OR 
              items.item_id IN (SELECT item_id FROM item_resources WHERE resource_type = 'lang_name' AND content LIKE ?) OR
              items.item_id IN (SELECT item_id FROM item_tags WHERE tag_id LIKE ?)
            )`);
            queryConditions.push(`(
              i.item_id LIKE ? OR 
              ir.content LIKE ? OR
              i.item_id IN (SELECT item_id FROM item_tags WHERE tag_id LIKE ?)
            )`);
            args.push(searchPattern, searchPattern, searchPattern);
            break;
        }
      }
      
      // 模组筛选
      if (modid) {
        countConditions.push('items.modid = ?');
        queryConditions.push('i.modid = ?');
        args.push(modid);
      }
      
      // 标签精确筛选
      if (tagId) {
        countConditions.push('items.item_id IN (SELECT item_id FROM item_tags WHERE tag_id = ?)');
        queryConditions.push('i.item_id IN (SELECT item_id FROM item_tags WHERE tag_id = ?)');
        args.push(tagId);
      }
      
      const countWhereClause = countConditions.length > 0 ? `WHERE ${countConditions.join(' AND ')}` : '';
      const queryWhereClause = queryConditions.length > 0 ? `WHERE ${queryConditions.join(' AND ')}` : '';
      
      // 获取总数
      const countResult = await db.execute({
        sql: `SELECT COUNT(*) as count FROM items ${countWhereClause}`,
        args: args.slice(),
      });
      const total = Number(countResult.rows[0]?.count || 0);
      
      // 获取数据 - LEFT JOIN item_resources 获取中文名称
      const queryArgs = [...args, pageSize, (page - 1) * pageSize];
      const query = `
        SELECT 
          i.item_id,
          i.modid,
          ir.content as display_name
        FROM items i
        LEFT JOIN item_resources ir ON i.item_id = ir.item_id AND ir.resource_type = 'lang_name'
        ${queryWhereClause}
        ORDER BY i.item_id
        LIMIT ? OFFSET ?
      `;
      
      const result = await db.execute({ sql: query, args: queryArgs });
      
      const items: Item[] = result.rows.map((row: any) => ({
        itemId: row.item_id,
        modid: row.modid,
        displayName: row.display_name || undefined,
      }));
      
      // 注意：不再关闭连接，依赖连接缓存机制
      // createProjectDbClient 会自动管理连接生命周期
      
      return {
        success: true,
        data: { items, total, page, pageSize },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '查询失败';
      return { success: false, error: errorMessage };
    }
  });

  // ITEMS_GET_BY_MOD: 获取模组的所有物品
  ipcMain.handle(IPC_CHANNELS.ITEMS_GET_BY_MOD, async (
    _event,
    projectPath: string,
    modid: string
  ): Promise<IpcResponse<Item[]>> => {
    const dbPath = appPaths.projectDb(projectPath);
    try {
      const db = createProjectDbClient(dbPath);
      
      const result = await db.execute({
        sql: `
          SELECT 
            i.item_id,
            i.modid,
            ir.content as display_name
          FROM items i
          LEFT JOIN item_resources ir ON i.item_id = ir.item_id AND ir.resource_type = 'lang_name'
          WHERE i.modid = ?
          ORDER BY i.item_id
        `,
        args: [modid],
      });
      
      const items: Item[] = result.rows.map((row: any) => ({
        itemId: row.item_id,
        modid: row.modid,
        displayName: row.display_name || undefined,
      }));
      
      return { success: true, data: items };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取失败';
      return { success: false, error: errorMessage };
    }
  });

  // ITEMS_GET_DETAIL: 获取物品详情（包含标签）
  ipcMain.handle(IPC_CHANNELS.ITEMS_GET_DETAIL, async (
    _event,
    projectPath: string,
    itemId: string
  ): Promise<IpcResponse<Item & { tags: string[] } | null>> => {
    const dbPath = appPaths.projectDb(projectPath);
    try {
      const db = createProjectDbClient(dbPath);
      
      const [itemResult, tagsResult] = await Promise.all([
        db.execute({
          sql: `
            SELECT 
              i.item_id,
              i.modid,
              ir.content as display_name
            FROM items i
            LEFT JOIN item_resources ir ON i.item_id = ir.item_id AND ir.resource_type = 'lang_name'
            WHERE i.item_id = ?
          `,
          args: [itemId],
        }),
        db.execute({
          sql: 'SELECT tag_id FROM item_tags WHERE item_id = ?',
          args: [itemId],
        }),
      ]);
      
      const row = itemResult.rows[0] as any;
      if (!row) {
        return { success: true, data: null };
      }
      
      const tags = tagsResult.rows.map((r: any) => r.tag_id as string);
      
      return {
        success: true,
        data: {
          itemId: row.item_id,
          modid: row.modid,
          displayName: row.display_name || undefined,
          tags,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取详情失败';
      return { success: false, error: errorMessage };
    }
  });

  // ITEMS_GET_TEXTURE: 获取物品纹理（base64）
  ipcMain.handle('items:get-texture', async (
    _event,
    projectPath: string,
    itemId: string
  ): Promise<IpcResponse<{ base64: string; mimeType: string } | null>> => {
    const dbPath = appPaths.projectDb(projectPath);

    try {
      const db = createProjectDbClient(dbPath);
      
      // 处理 tag: 前缀的物品ID
      const actualItemId = itemId.startsWith('tag:') ? itemId.slice(4) : itemId;
      
      // 查询 texture 类型的资源
      const result = await db.execute({
        sql: `SELECT content FROM item_resources 
              WHERE item_id = ? AND resource_type = 'texture'
              LIMIT 1`,
        args: [actualItemId],
      });
      
      const row = result.rows[0] as any;
      if (!row || !row.content) {
        return { success: true, data: null };
      }
      
      // 检测 MIME 类型（base64 图片通常以 data:image/xxx;base64, 开头）
      let base64 = row.content as string;
      let mimeType = 'image/png'; // 默认
      
      if (base64.startsWith('data:image/')) {
        // 已经是完整的 data URL
        const match = base64.match(/^data:image\/([^;]+);base64,/);
        if (match) {
          mimeType = `image/${match[1]}`;
        }
      } else if (base64.startsWith('iVBORw0KGgo')) {
        // PNG 格式
        mimeType = 'image/png';
      } else if (base64.startsWith('/9j/')) {
        // JPEG 格式
        mimeType = 'image/jpeg';
      }
      
      return {
        success: true,
        data: { base64, mimeType },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取纹理失败';
      return { success: false, error: errorMessage };
    }
  });

  // TAGS_QUERY: 获取所有标签
  ipcMain.handle(IPC_CHANNELS.TAGS_QUERY, async (
    _event,
    projectPath: string
  ): Promise<IpcResponse<TagInfo[]>> => {
    const dbPath = appPaths.projectDb(projectPath);

    try {
      const db = createProjectDbClient(dbPath);
      
      const result = await db.execute(`
        SELECT tag_id, COUNT(*) as count 
        FROM item_tags 
        GROUP BY tag_id 
        ORDER BY count DESC
      `);
      
      const tags: TagInfo[] = result.rows.map((row: any) => ({
        tagId: row.tag_id,
        itemCount: Number(row.count),
      }));
      
      return { success: true, data: tags };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取标签失败';
      return { success: false, error: errorMessage };
    }
  });

  // MODS_QUERY: 获取所有模组
  ipcMain.handle(IPC_CHANNELS.MODS_QUERY, async (
    _event,
    projectPath: string
  ): Promise<IpcResponse<{ modid: string; version?: string; name?: string }[]>> => {
    const dbPath = appPaths.projectDb(projectPath);

    try {
      const db = createProjectDbClient(dbPath);
      
      const result = await db.execute('SELECT * FROM mods ORDER BY modid');
      
      const mods = result.rows.map((row: any) => ({
        modid: row.modid,
        version: row.version,
        name: row.name,
      }));
      
      return { success: true, data: mods };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取模组失败';
      return { success: false, error: errorMessage };
    }
  });
}

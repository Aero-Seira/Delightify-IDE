/**
 * Recipes IPC Handlers - v2.2
 * 
 * 优化数据库连接管理，不再每次查询后关闭连接
 * 依赖 createProjectDbClient 的连接缓存机制
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';
import type { 
  IpcResponse, 
  Recipe,
  RecipeQueryParams,
  RecipeTypeInfo,
} from '@delightify/shared';
import { createProjectDbClient, closeProjectDbClient } from '../services/database';
import { appPaths } from '../services/paths';

export function registerRecipesHandlers(): void {
  // RECIPES_QUERY: 查询配方
  ipcMain.handle(IPC_CHANNELS.RECIPES_QUERY, async (
    _event,
    projectPath: string,
    params: RecipeQueryParams
  ): Promise<IpcResponse<{ recipes: Recipe[]; total: number }>> => {
    const dbPath = appPaths.projectDb(projectPath);
    try {
      const { search, modid, typeId, page = 1, pageSize = 50 } = params;
      
      const db = createProjectDbClient(dbPath);
      
      // 构建查询
      const conditions: string[] = [];
      const args: (string | number)[] = [];
      
      if (search) {
        conditions.push('(recipe_id LIKE ? OR raw_json LIKE ?)');
        args.push(`%${search}%`, `%${search}%`);
      }
      
      if (modid) {
        conditions.push('modid = ?');
        args.push(modid);
      }
      
      if (typeId) {
        conditions.push('type_id = ?');
        args.push(typeId);
      }
      
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      // 获取总数
      const countResult = await db.execute({
        sql: `SELECT COUNT(*) as count FROM recipes ${whereClause}`,
        args: [...args],
      });
      const total = Number(countResult.rows[0]?.count || 0);
      
      // 获取数据
      const result = await db.execute({
        sql: `SELECT * FROM recipes ${whereClause} ORDER BY recipe_id LIMIT ? OFFSET ?`,
        args: [...args, pageSize, (page - 1) * pageSize],
      });
      
      const recipes: Recipe[] = result.rows.map((row: any) => ({
        recipeId: row.recipe_id,
        typeId: row.type_id,
        modid: row.modid,
        hash: row.hash,
        rawJson: row.raw_json,
        unparsed: Boolean(row.unparsed),
      }));
      
      // 注意：不再关闭连接，依赖连接缓存机制
      
      return { success: true, data: { recipes, total } };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '查询失败';
      return { success: false, error: errorMessage };
    }
  });

  // RECIPES_GET_TYPES: 获取配方类型列表
  ipcMain.handle(IPC_CHANNELS.RECIPES_GET_TYPES, async (
    _event,
    projectPath: string
  ): Promise<IpcResponse<RecipeTypeInfo[]>> => {
    try {
      const dbPath = appPaths.projectDb(projectPath);
      const db = createProjectDbClient(dbPath);
      
      const result = await db.execute(`
        SELECT type_id, COUNT(*) as count 
        FROM recipes 
        GROUP BY type_id 
        ORDER BY count DESC
      `);
      

      const types: RecipeTypeInfo[] = result.rows.map((row: any) => ({
        typeId: row.type_id,
        displayName: row.type_id.split(':').pop() || row.type_id, // 默认显示名称
        recipeCount: Number(row.count),
      }));
      
      return { success: true, data: types };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取类型失败';
      return { success: false, error: errorMessage };
    }
  });

  // RECIPES_GET_DETAIL: 获取配方详情
  ipcMain.handle(IPC_CHANNELS.RECIPES_GET_DETAIL, async (
    _event,
    projectPath: string,
    recipeId: string
  ): Promise<IpcResponse<Recipe | null>> => {
    try {
      const dbPath = appPaths.projectDb(projectPath);
      const db = createProjectDbClient(dbPath);
      
      const result = await db.execute({
        sql: 'SELECT * FROM recipes WHERE recipe_id = ?',
        args: [recipeId],
      });
      

      const row = result.rows[0] as any;
      if (!row) {
        return { success: true, data: null };
      }
      
      return {
        success: true,
        data: {
          recipeId: row.recipe_id,
          typeId: row.type_id,
          modid: row.modid,
          hash: row.hash,
          rawJson: row.raw_json,
          unparsed: Boolean(row.unparsed),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取详情失败';
      return { success: false, error: errorMessage };
    }
  });
}

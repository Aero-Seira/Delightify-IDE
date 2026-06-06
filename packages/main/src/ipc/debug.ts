/**
 * Debug IPC Handlers - v2.1
 * 
 * 根据 reference_sql/export.sqlite 样例调整
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';
import type { IpcResponse } from '@delightify/shared';
import { createProjectDbClient } from '../services/database';
import { appPaths } from '../services/paths';

export function registerDebugHandlers(): void {
  // DEBUG_DB_TABLES: 获取数据库表信息
  ipcMain.handle(IPC_CHANNELS.DEBUG_DB_TABLES, async (
    _event,
    projectPath: string
  ): Promise<IpcResponse<Array<{ name: string; rowCount: number }>>> => {
    try {
      const dbPath = appPaths.projectDb(projectPath);
      const db = createProjectDbClient(dbPath);
      
      const tablesResult = await db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      );
      
      const tables: Array<{ name: string; rowCount: number }> = [];
      
      for (const row of tablesResult.rows) {
        const tableName = row.name as string;
        const countResult = await db.execute({
          sql: `SELECT COUNT(*) as count FROM "${tableName}"`,
        });
        tables.push({
          name: tableName,
          rowCount: Number(countResult.rows[0]?.count || 0),
        });
      }
      
      return { success: true, data: tables };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取失败';
      return { success: false, error: errorMessage };
    }
  });

  // DEBUG_DB_QUERY: 执行 SQL 查询（只读）
  ipcMain.handle(IPC_CHANNELS.DEBUG_DB_QUERY, async (
    _event,
    projectPath: string,
    sql: string,
    args?: unknown[]
  ): Promise<IpcResponse<unknown[]>> => {
    try {
      // 安全检查
      const normalizedSql = sql.trim().toLowerCase();
      if (!normalizedSql.startsWith('select')) {
        return { success: false, error: '只允许 SELECT 查询' };
      }
      
      const dbPath = appPaths.projectDb(projectPath);
      const db = createProjectDbClient(dbPath);
      
      const result = await db.execute({
        sql,
        args: (args || []) as string[],
      });
      
      return { success: true, data: result.rows };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '查询失败';
      return { success: false, error: errorMessage };
    }
  });

  // DEBUG_CLEAR_DATA: 清空项目数据
  ipcMain.handle(IPC_CHANNELS.DEBUG_CLEAR_DATA, async (
    _event,
    projectPath: string
  ): Promise<IpcResponse<{ cleared: boolean }>> => {
    try {
      const dbPath = appPaths.projectDb(projectPath);
      const db = createProjectDbClient(dbPath);
      
      // 清空核心数据表（保留结构和编辑历史）
      const tablesToClear = ['recipes', 'item_tags', 'items', 'mods', 'manifest'];
      
      for (const table of tablesToClear) {
        await db.execute(`DELETE FROM ${table}`);
      }
      
      return { success: true, data: { cleared: true } };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '清空失败';
      return { success: false, error: errorMessage };
    }
  });
}

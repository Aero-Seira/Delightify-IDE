/**
 * Recipe Types IPC Handlers
 * 
 * 配方类型元数据相关的 IPC 接口
 */

import { ipcMain } from 'electron';
import type { IpcResponse, RecipeTypeMetadata } from '@delightify/shared';
import {
  loadAllRecipeTypes,
  getRecipeType,
  getRecipeTypesByMod,
  clearRecipeTypeCache,
  getRecipeTypeStats,
} from '../services/recipe-types/loader';

export function registerRecipeTypesHandlers(): void {
  // RECIPE_TYPES_GET_ALL: 获取所有配方类型
  ipcMain.handle('recipe-types:get-all', async (): Promise<IpcResponse<RecipeTypeMetadata[]>> => {
    try {
      const types = await loadAllRecipeTypes();
      return { success: true, data: types };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '加载失败';
      return { success: false, error: errorMessage };
    }
  });

  // RECIPE_TYPES_GET: 获取单个配方类型
  ipcMain.handle('recipe-types:get', async (
    _event,
    recipeTypeId: string
  ): Promise<IpcResponse<RecipeTypeMetadata | null>> => {
    try {
      const type = await getRecipeType(recipeTypeId);
      return { success: true, data: type };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取失败';
      return { success: false, error: errorMessage };
    }
  });

  // RECIPE_TYPES_GET_BY_MOD: 按模组获取配方类型
  ipcMain.handle('recipe-types:get-by-mod', async (
    _event,
    modId: string
  ): Promise<IpcResponse<RecipeTypeMetadata[]>> => {
    try {
      const types = await getRecipeTypesByMod(modId);
      return { success: true, data: types };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取失败';
      return { success: false, error: errorMessage };
    }
  });

  // RECIPE_TYPES_CLEAR_CACHE: 清除缓存（热重载）
  ipcMain.handle('recipe-types:clear-cache', async (): Promise<IpcResponse<void>> => {
    try {
      clearRecipeTypeCache();
      return { success: true, data: undefined };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '清除失败';
      return { success: false, error: errorMessage };
    }
  });

  // RECIPE_TYPES_GET_STATS: 获取统计信息
  ipcMain.handle('recipe-types:get-stats', async (): Promise<IpcResponse<{
    total: number;
    byMod: Record<string, number>;
  }>> => {
    try {
      const stats = await getRecipeTypeStats();
      return { success: true, data: stats };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取失败';
      return { success: false, error: errorMessage };
    }
  });
}

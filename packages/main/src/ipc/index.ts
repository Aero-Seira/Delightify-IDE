/**
 * IPC Handlers Registration - v2.0
 * 
 * 注册所有 IPC 处理器
 */

import { ipcMain, shell } from 'electron';
import { registerProjectHandlers } from './project';
import { registerModDataHandlers } from './mod-data';
import { registerItemsHandlers } from './items';
import { registerRecipesHandlers } from './recipes';
import { registerRecipeTypesHandlers } from './recipe-types';
import { registerUnifyHandlers } from './unify';
import { registerDebugHandlers } from './debug';

export function registerAllHandlers(): void {
  registerProjectHandlers();
  registerModDataHandlers();
  registerItemsHandlers();
  registerRecipesHandlers();
  registerRecipeTypesHandlers();
  registerUnifyHandlers();
  registerDebugHandlers();
  
  // 通用工具处理器
  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    await shell.openExternal(url);
  });
  
  console.log('[IPC] All handlers registered (v2.0)');
}

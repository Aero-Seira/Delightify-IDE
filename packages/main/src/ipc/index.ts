/**
 * IPC Handlers Registration - v2.0
 * 
 * 注册所有 IPC 处理器
 */

import { ipcMain, shell } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';
import { registerProjectHandlers } from './project';
import { registerModDataHandlers } from './mod-data';
import { registerItemsHandlers } from './items';
import { registerRecipesHandlers } from './recipes';
import { registerRecipeTypesHandlers } from './recipe-types';
import { registerUnifyHandlers } from './unify';
import { registerExportHandlers } from './export';
import { registerDebugHandlers } from './debug';
import { registerEngineHandlers } from './engine';
import { registerScriptWorkspaceHandlers } from './script-workspace';

export function registerAllHandlers(): void {
  registerProjectHandlers();
  registerModDataHandlers();
  registerItemsHandlers();
  registerRecipesHandlers();
  registerRecipeTypesHandlers();
  registerUnifyHandlers();
  registerEngineHandlers();
  registerExportHandlers();
  registerScriptWorkspaceHandlers();
  registerDebugHandlers();
  
  // 通用工具处理器
  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, async (_event, url: string) => {
    await shell.openExternal(url);
  });
  
  console.log('[IPC] All handlers registered (v2.0)');
}

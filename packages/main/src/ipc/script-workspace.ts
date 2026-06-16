import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';
import type {
  IpcResponse,
  ScriptWorkspaceListResult,
  ScriptWorkspaceReadResult,
  ScriptWorkspaceSaveResult,
} from '@delightify/shared';
import {
  listScriptWorkspaceFiles,
  readScriptWorkspaceFile,
  saveScriptWorkspaceFile,
} from '../services/script-workspace';

export function registerScriptWorkspaceHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SCRIPT_WORKSPACE_LIST, async (
    _event,
    projectPath: string
  ): Promise<IpcResponse<ScriptWorkspaceListResult>> => {
    try {
      const result = await listScriptWorkspaceFiles(projectPath);
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '脚本工作区文件列表读取失败';
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SCRIPT_WORKSPACE_READ, async (
    _event,
    projectPath: string,
    relativePath: string
  ): Promise<IpcResponse<ScriptWorkspaceReadResult>> => {
    try {
      const result = await readScriptWorkspaceFile(projectPath, relativePath);
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '脚本文件读取失败';
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SCRIPT_WORKSPACE_SAVE, async (
    _event,
    projectPath: string,
    relativePath: string,
    content: string
  ): Promise<IpcResponse<ScriptWorkspaceSaveResult>> => {
    try {
      const result = await saveScriptWorkspaceFile(projectPath, relativePath, content);
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '脚本文件保存失败';
      return { success: false, error: errorMessage };
    }
  });
}

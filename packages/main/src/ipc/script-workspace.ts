import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';
import type {
  IpcResponse,
  ScriptWorkspaceCopyAsManagedResult,
  ScriptWorkspaceCreateDirectoryResult,
  ScriptWorkspaceCreateManagedResult,
  ScriptWorkspaceCreateUserResult,
  ScriptWorkspaceListResult,
  ScriptWorkspaceReadResult,
  ScriptWorkspaceRenameOptions,
  ScriptWorkspaceRenameResult,
  ScriptWorkspaceSaveOptions,
  ScriptWorkspaceSaveResult,
} from '@delightify/shared';
import {
  copyScriptWorkspaceFileAsManaged,
  createScriptWorkspaceDirectory,
  createManagedScriptWorkspaceFile,
  createUserScriptWorkspaceFile,
  listScriptWorkspaceFiles,
  readScriptWorkspaceFile,
  renameScriptWorkspaceFile,
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
    content: string,
    options?: ScriptWorkspaceSaveOptions
  ): Promise<IpcResponse<ScriptWorkspaceSaveResult>> => {
    try {
      const result = await saveScriptWorkspaceFile(projectPath, relativePath, content, options);
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '脚本文件保存失败';
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SCRIPT_WORKSPACE_CREATE_MANAGED, async (
    _event,
    projectPath: string,
    relativePath?: string
  ): Promise<IpcResponse<ScriptWorkspaceCreateManagedResult>> => {
    try {
      const result = await createManagedScriptWorkspaceFile(projectPath, relativePath);
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '受管脚本创建失败';
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SCRIPT_WORKSPACE_CREATE_USER, async (
    _event,
    projectPath: string,
    relativePath?: string
  ): Promise<IpcResponse<ScriptWorkspaceCreateUserResult>> => {
    try {
      const result = await createUserScriptWorkspaceFile(projectPath, relativePath);
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '用户文件创建失败';
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SCRIPT_WORKSPACE_CREATE_DIRECTORY, async (
    _event,
    projectPath: string,
    relativePath: string
  ): Promise<IpcResponse<ScriptWorkspaceCreateDirectoryResult>> => {
    try {
      const result = await createScriptWorkspaceDirectory(projectPath, relativePath);
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '目录创建失败';
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SCRIPT_WORKSPACE_RENAME, async (
    _event,
    projectPath: string,
    sourceRelativePath: string,
    targetRelativePath: string,
    options?: ScriptWorkspaceRenameOptions
  ): Promise<IpcResponse<ScriptWorkspaceRenameResult>> => {
    try {
      const result = await renameScriptWorkspaceFile(projectPath, sourceRelativePath, targetRelativePath, options);
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '文件重命名失败';
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SCRIPT_WORKSPACE_COPY_AS_MANAGED, async (
    _event,
    projectPath: string,
    sourceRelativePath: string,
    targetRelativePath?: string
  ): Promise<IpcResponse<ScriptWorkspaceCopyAsManagedResult>> => {
    try {
      const result = await copyScriptWorkspaceFileAsManaged(projectPath, sourceRelativePath, targetRelativePath);
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '复制为 managed 失败';
      return { success: false, error: errorMessage };
    }
  });
}

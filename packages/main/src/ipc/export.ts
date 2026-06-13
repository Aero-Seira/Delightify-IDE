import { ipcMain } from 'electron';
import type { IpcResponse } from '@delightify/shared';
import {
  exportKubeJs,
  revertKubeJs,
  type KubeJsExportParams,
  type KubeJsExportResult,
  type KubeJsRevertResult,
} from '../services/export';

const EXPORT_KUBEJS_CHANNEL = 'export:kubejs';
const EXPORT_KUBEJS_REVERT_CHANNEL = 'export:kubejs:revert';

export function registerExportHandlers(): void {
  ipcMain.handle(EXPORT_KUBEJS_CHANNEL, async (
    _event,
    projectPath: string,
    params: KubeJsExportParams
  ): Promise<IpcResponse<KubeJsExportResult>> => {
    try {
      const result = await exportKubeJs(projectPath, params);
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'KubeJS 导出失败';
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle(EXPORT_KUBEJS_REVERT_CHANNEL, async (
    _event,
    projectPath: string
  ): Promise<IpcResponse<KubeJsRevertResult>> => {
    try {
      const result = await revertKubeJs(projectPath);
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'KubeJS 生成文件撤销失败';
      return { success: false, error: errorMessage };
    }
  });
}

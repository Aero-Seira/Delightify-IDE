import { ipcMain } from 'electron';
import type { IpcResponse } from '@delightify/shared';
import {
  queryUnifyCandidates,
  UnifyUnavailableError,
  type UnifyQueryParams,
  type UnifyQueryResult,
} from '../services/unify';

const UNIFY_QUERY_CHANNEL = 'unify:query';

export function registerUnifyHandlers(): void {
  ipcMain.handle(UNIFY_QUERY_CHANNEL, async (
    _event,
    projectPath: string,
    params: UnifyQueryParams
  ): Promise<IpcResponse<UnifyQueryResult>> => {
    try {
      const result = await queryUnifyCandidates(projectPath, params);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof UnifyUnavailableError) {
        return { success: false, error: error.message };
      }

      const errorMessage = error instanceof Error ? error.message : 'unify 查询失败';
      return { success: false, error: errorMessage };
    }
  });
}

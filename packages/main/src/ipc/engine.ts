import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';
import type {
  EngineActionRequest,
  EngineBlastSummary,
  EngineDryRunResult,
  IpcResponse,
} from '@delightify/shared';
import { planEngineAction, planEngineBlast } from '../services/engine/dispatch';
import type { BlastRadiusTarget } from '../services/engine/blast-radius';

function normalizeBlastTarget(target: BlastRadiusTarget): BlastRadiusTarget {
  if (
    !target ||
    (target.kind !== 'item' && target.kind !== 'tag') ||
    typeof target.ref !== 'string' ||
    target.ref.length === 0
  ) {
    throw new Error('engine:blast target 必须是 { kind:"item"|"tag", ref:string }。');
  }
  return target;
}

export function registerEngineHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.ENGINE_DRY_RUN, async (
    _event,
    projectPath: string,
    req: EngineActionRequest
  ): Promise<IpcResponse<EngineDryRunResult>> => {
    try {
      const result = await planEngineAction(projectPath, req);
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'engine dry-run 失败';
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle(IPC_CHANNELS.ENGINE_BLAST, async (
    _event,
    projectPath: string,
    target: BlastRadiusTarget
  ): Promise<IpcResponse<EngineBlastSummary>> => {
    try {
      const result = await planEngineBlast(projectPath, normalizeBlastTarget(target));
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'engine blast 查询失败';
      return { success: false, error: errorMessage };
    }
  });
}

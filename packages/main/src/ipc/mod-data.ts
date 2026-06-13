/**
 * Mod Data IPC Handlers - v2.1
 * 
 * 根据 reference_sql/export.sqlite 样例调整
 */

import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';
import type { 
  IpcResponse, 
  ModDataImportResult, 
  ModDataImportProgress,
  DataImportHistory,
  ManifestEntry,
  ValidationResult,
} from '@delightify/shared';
import { appPaths } from '../services/paths';
import { createProjectDbClient } from '../services/database';
import { 
  importModData, 
  detectModDataFile, 
  validateModDataFile,
} from '../services/mod-data-importer';

const activeImports = new Map<string, { cancel: boolean }>();

interface IpcProjectCapabilities {
  browse: boolean;
  mvp0Unify: boolean;
  reason?: string;
}

interface ValidationResultWithCapabilities extends ValidationResult {
  schemaVersion?: string;
  sourceKind?: 'exporter_v1' | 'legacy_exporter';
  capabilities?: IpcProjectCapabilities;
  loader?: string;
  mcVersion?: string;
  modlistHash?: string;
}

interface DataImportHistoryWithCapabilities extends DataImportHistory {
  sourceKind?: 'exporter_v1' | 'legacy_exporter';
  schemaVersion?: string;
  capabilities?: IpcProjectCapabilities;
  modlistHash?: string;
  errorMessage?: string;
}

function parseCapabilities(value: unknown): IpcProjectCapabilities | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as {
      browse?: unknown;
      mvp0Unify?: unknown;
      mvp0_unify?: unknown;
      reason?: unknown;
    };

    return {
      browse: Boolean(parsed.browse),
      mvp0Unify: Boolean(parsed.mvp0Unify ?? parsed.mvp0_unify),
      reason: typeof parsed.reason === 'string' ? parsed.reason : undefined,
    };
  } catch {
    return undefined;
  }
}

function sendProgress(
  win: BrowserWindow | null,
  progress: ModDataImportProgress
): void {
  if (!win) return;
  win.webContents.send(IPC_CHANNELS.MOD_DATA_IMPORT_PROGRESS, progress);
}

export function registerModDataHandlers(): void {
  // MOD_DATA_DETECT: 检测数据文件
  ipcMain.handle(IPC_CHANNELS.MOD_DATA_DETECT, async (
    _event,
    projectPath: string
  ): Promise<IpcResponse<{ filePath: string | null; found: boolean }>> => {
    console.log('[IPC] MOD_DATA_DETECT called with path:', projectPath);
    try {
      const filePath = await detectModDataFile(projectPath);
      console.log('[IPC] MOD_DATA_DETECT result:', filePath);
      return {
        success: true,
        data: { filePath, found: filePath !== null },
      };
    } catch (error) {
      console.error('[IPC] MOD_DATA_DETECT error:', error);
      const errorMessage = error instanceof Error ? error.message : '检测失败';
      return { success: false, error: errorMessage };
    }
  });

  // MOD_DATA_VALIDATE: 验证数据文件
  ipcMain.handle(IPC_CHANNELS.MOD_DATA_VALIDATE, async (
    _event,
    filePath: string
  ): Promise<IpcResponse<ValidationResultWithCapabilities>> => {
    try {
      const result = await validateModDataFile(filePath);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '验证失败';
      return { success: false, error: errorMessage };
    }
  });

  // MOD_DATA_IMPORT: 导入数据
  ipcMain.handle(IPC_CHANNELS.MOD_DATA_IMPORT, async (
    event,
    projectPath: string,
    dataFilePath?: string
  ): Promise<IpcResponse<ModDataImportResult>> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const importId = `import_${Date.now()}`;
    
    try {
      const importTask = { cancel: false };
      activeImports.set(importId, importTask);

      const result = await importModData({
        projectPath,
        dataFilePath,
        onProgress: (progress) => {
          if (importTask.cancel) return;
          sendProgress(win, progress);
        },
      });

      activeImports.delete(importId);

      return {
        success: result.success,
        data: result,
        error: result.error,
      };
    } catch (error) {
      activeImports.delete(importId);
      const errorMessage = error instanceof Error ? error.message : '导入失败';
      return { success: false, error: errorMessage };
    }
  });

  // MOD_DATA_GET_IMPORT_HISTORY: 获取导入历史
  ipcMain.handle(IPC_CHANNELS.MOD_DATA_GET_IMPORT_HISTORY, async (
    _event,
    projectPath: string
  ): Promise<IpcResponse<DataImportHistoryWithCapabilities[]>> => {
    try {
      const dbPath = appPaths.projectDb(projectPath);
      const client = createProjectDbClient(dbPath);

      const result = await client.execute(
        'SELECT * FROM data_imports ORDER BY imported_at DESC'
      );

      const history: DataImportHistoryWithCapabilities[] = result.rows.map((row: any) => ({
        importId: row.import_id,
        sourceFilePath: row.source_file_path,
        sourceKind: row.source_kind,
        dataVersion: row.data_version,
        schemaVersion: row.schema_version,
        capabilities: parseCapabilities(row.capabilities_json),
        modlistHash: row.modlist_hash,
        exportedAt: row.exported_at,
        modCount: row.mod_count,
        itemCount: row.item_count,
        recipeCount: row.recipe_count,
        tagCount: row.tag_count,
        importedAt: row.imported_at,
        isSuccess: Boolean(row.is_success),
        errorMessage: row.error_message,
      }));

      return { success: true, data: history };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取历史失败';
      return { success: false, error: errorMessage };
    }
  });

  // MOD_DATA_GET_MANIFEST: 获取清单数据
  ipcMain.handle('mod-data:get-manifest', async (
    _event,
    projectPath: string
  ): Promise<IpcResponse<ManifestEntry[]>> => {
    try {
      const dbPath = appPaths.projectDb(projectPath);
      const client = createProjectDbClient(dbPath);

      const result = await client.execute('SELECT * FROM manifest');
      const manifest: ManifestEntry[] = result.rows.map((row: any) => ({
        key: row.key,
        value: row.value,
      }));

      return { success: true, data: manifest };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取清单失败';
      return { success: false, error: errorMessage };
    }
  });
}

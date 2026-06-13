/**
 * Export backend types - MVP-0
 */

import type { UnifyDiffOperation } from './unify';

export interface KubeJsExportParams {
  changeSet: UnifyDiffOperation[];
}

export interface KubeJsExportResult {
  filePath: string;
  operationCount: number;
  generatedCode: string;
  writtenAt: string;
}

export interface KubeJsRevertResult {
  filePath: string;
  deleted: boolean;
}

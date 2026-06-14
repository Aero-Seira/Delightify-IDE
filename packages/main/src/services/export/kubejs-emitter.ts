import * as fs from 'fs/promises';
import * as path from 'path';

export interface UnifyDiffOperation {
  operationId: string;
  decisionId: string;
  kind: string;
  recipeId: string;
  typeId: string;
  modid: string;
  slot?: number;
  before: Record<string, unknown>;
  after?: Record<string, unknown>;
  includedInChangeSet: boolean;
  reason?: string;
}

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

const GENERATED_MARKER = '@delightify-generated';
const GENERATED_RELATIVE_PATH = path.join('kubejs', 'server_scripts', 'zzz_delightify_generated.js');

function generatedFilePath(projectPath: string): string {
  return path.join(projectPath, GENERATED_RELATIVE_PATH);
}

function jsString(value: string): string {
  return JSON.stringify(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function recipeFilter(operation: UnifyDiffOperation): string {
  return `{ id: ${jsString(operation.recipeId)} }`;
}

function itemRefFromBefore(operation: UnifyDiffOperation): string {
  const ref = optionalString(operation.before.ref) || optionalString(operation.before.itemId);
  if (!ref) {
    throw new Error(`Change operation ${operation.operationId} 缺少 before item ref`);
  }
  return ref;
}

function itemRefFromAfter(operation: UnifyDiffOperation): string {
  const ref = optionalString(operation.after?.ref) || optionalString(operation.after?.itemId);
  if (!ref) {
    throw new Error(`Change operation ${operation.operationId} 缺少 after item ref`);
  }
  return ref;
}

function emitOperation(operation: UnifyDiffOperation): string {
  if (!operation.includedInChangeSet) {
    throw new Error(`Change operation ${operation.operationId} 未被纳入 change set`);
  }

  switch (operation.kind) {
    case 'replace_recipe_input_item':
      return `  event.replaceInput(${recipeFilter(operation)}, ${jsString(itemRefFromBefore(operation))}, ${jsString(itemRefFromAfter(operation))})`;
    // TODO: replaceOutput 语义/版本兼容未验证，MVP-0 不纳入 change set
    case 'replace_recipe_output_item':
      return `  event.replaceOutput(${recipeFilter(operation)}, ${jsString(itemRefFromBefore(operation))}, ${jsString(itemRefFromAfter(operation))})`;
    default:
      throw new Error(`KubeJS emitter 暂不支持操作类型: ${operation.kind}`);
  }
}

export function generateKubeJs(changeSet: UnifyDiffOperation[], generatedAt = new Date().toISOString()): string {
  if (changeSet.length === 0) {
    throw new Error('change set 为空，没有可导出的 KubeJS 操作');
  }

  const operations = changeSet.map(emitOperation);
  return [
    `// ${GENERATED_MARKER}`,
    '// Do not edit by hand. Regenerate from Delightify.',
    `// Generated at: ${generatedAt}`,
    '',
    'ServerEvents.recipes(event => {',
    ...operations,
    '})',
    '',
  ].join('\n');
}

async function readExistingFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function assertGeneratedFileIsOwned(filePath: string): Promise<void> {
  const existing = await readExistingFile(filePath);
  if (existing === null) {
    return;
  }

  if (!existing.includes(GENERATED_MARKER)) {
    throw new Error(`拒绝覆盖非 Delightify 生成文件: ${filePath}`);
  }
}

export async function exportKubeJs(
  projectPath: string,
  params: KubeJsExportParams
): Promise<KubeJsExportResult> {
  const filePath = generatedFilePath(projectPath);
  const writtenAt = new Date().toISOString();
  const generatedCode = generateKubeJs(params.changeSet, writtenAt);

  await assertGeneratedFileIsOwned(filePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, generatedCode, 'utf8');

  return {
    filePath,
    operationCount: params.changeSet.length,
    generatedCode,
    writtenAt,
  };
}

export async function revertKubeJs(projectPath: string): Promise<KubeJsRevertResult> {
  const filePath = generatedFilePath(projectPath);
  const existing = await readExistingFile(filePath);
  if (existing === null) {
    return { filePath, deleted: false };
  }

  if (!existing.includes(GENERATED_MARKER)) {
    throw new Error(`拒绝删除非 Delightify 生成文件: ${filePath}`);
  }

  await fs.unlink(filePath);
  return { filePath, deleted: true };
}

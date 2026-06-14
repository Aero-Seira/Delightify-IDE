import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  ChangeOperation,
  KubeJsExportParams,
  KubeJsExportResult,
  KubeJsRevertResult,
} from '@delightify/shared';

export type {
  KubeJsExportParams,
  KubeJsExportResult,
  KubeJsRevertResult,
};

export interface GeneratedFile {
  relativePath: string;
  content: string;
  marker: string;
}

const GENERATED_MARKER = '@delightify-generated';
const RECIPES_RELATIVE_PATH = 'kubejs/server_scripts/zzz_delightify_generated.js';
const GENERATED_MANIFEST_RELATIVE_PATH = 'kubejs/.delightify-generated.json';

function generatedFilePath(projectPath: string): string {
  return path.join(projectPath, RECIPES_RELATIVE_PATH);
}

function generatedManifestPath(projectPath: string): string {
  return path.join(projectPath, GENERATED_MANIFEST_RELATIVE_PATH);
}

function absoluteGeneratedPath(projectPath: string, relativePath: string): string {
  return path.join(projectPath, relativePath);
}

function jsString(value: string): string {
  return JSON.stringify(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function recipeFilter(operation: ChangeOperation): string {
  if (!operation.recipeId) {
    throw new Error(`Change operation ${operation.operationId} 缺少 recipeId`);
  }
  return `{ id: ${jsString(operation.recipeId)} }`;
}

function itemRefFromBefore(operation: ChangeOperation): string {
  const ref = optionalString(operation.before.ref) || optionalString(operation.before.itemId);
  if (!ref) {
    throw new Error(`Change operation ${operation.operationId} 缺少 before item ref`);
  }
  return ref;
}

function itemRefFromAfter(operation: ChangeOperation): string {
  const ref = optionalString(operation.after?.ref) || optionalString(operation.after?.itemId);
  if (!ref) {
    throw new Error(`Change operation ${operation.operationId} 缺少 after item ref`);
  }
  return ref;
}

function emitRecipeOperation(operation: ChangeOperation): string {
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

function isRecipeOperation(operation: ChangeOperation): boolean {
  return operation.kind === 'replace_recipe_input_item' || operation.kind === 'replace_recipe_output_item';
}

function emitRecipesFile(recipeOperations: ChangeOperation[], generatedAt: string): GeneratedFile {
  const operations = recipeOperations.map(emitRecipeOperation);
  return {
    relativePath: RECIPES_RELATIVE_PATH,
    marker: GENERATED_MARKER,
    content: [
      `// ${GENERATED_MARKER}`,
      '// Do not edit by hand. Regenerate from Delightify.',
      `// Generated at: ${generatedAt}`,
      '',
      'ServerEvents.recipes(event => {',
      ...operations,
      '})',
      '',
    ].join('\n'),
  };
}

export function emitChangeSet(changeSet: ChangeOperation[], generatedAt = new Date().toISOString()): GeneratedFile[] {
  if (changeSet.length === 0) {
    return [];
  }

  const unsupportedOperations = changeSet.filter(operation => !isRecipeOperation(operation));
  if (unsupportedOperations.length > 0) {
    const kinds = Array.from(new Set(unsupportedOperations.map(operation => operation.kind))).join(', ');
    throw new Error(`KubeJS emitter 暂不支持操作类型: ${kinds}`);
  }

  const recipeOperations = changeSet.filter(isRecipeOperation);
  if (recipeOperations.length === 0) {
    return [];
  }

  return [emitRecipesFile(recipeOperations, generatedAt)];
}

export function generateKubeJs(changeSet: ChangeOperation[], generatedAt = new Date().toISOString()): string {
  if (changeSet.length === 0) {
    throw new Error('change set 为空，没有可导出的 KubeJS 操作');
  }

  return emitRecipesFile(changeSet, generatedAt).content;
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

async function assertGeneratedFileIsOwned(filePath: string, marker: string): Promise<void> {
  const existing = await readExistingFile(filePath);
  if (existing === null) {
    return;
  }

  if (!existing.includes(marker)) {
    throw new Error(`拒绝覆盖非 Delightify 生成文件: ${filePath}`);
  }
}

interface GeneratedManifestEntry {
  relativePath: string;
  marker: string;
}

interface GeneratedManifest {
  marker: string;
  generatedAt?: string;
  files: GeneratedManifestEntry[];
}

function fileOperationCount(relativePath: string, changeSet: ChangeOperation[]): number {
  if (relativePath === RECIPES_RELATIVE_PATH) {
    return changeSet.filter(isRecipeOperation).length;
  }

  return 0;
}

function makeManifest(files: GeneratedFile[], generatedAt: string): GeneratedManifest {
  return {
    marker: GENERATED_MARKER,
    generatedAt,
    files: files.map(file => ({
      relativePath: file.relativePath,
      marker: file.marker,
    })),
  };
}

function manifestContent(manifest: GeneratedManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

async function writeGeneratedManifest(projectPath: string, files: GeneratedFile[], generatedAt: string): Promise<void> {
  const filePath = generatedManifestPath(projectPath);
  const manifest = makeManifest(files, generatedAt);

  await assertGeneratedFileIsOwned(filePath, GENERATED_MARKER);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, manifestContent(manifest), 'utf8');
}

async function readGeneratedManifest(projectPath: string): Promise<GeneratedManifest | null> {
  const filePath = generatedManifestPath(projectPath);
  const existing = await readExistingFile(filePath);
  if (existing === null) {
    return null;
  }

  if (!existing.includes(GENERATED_MARKER)) {
    throw new Error(`拒绝读取非 Delightify 生成清单: ${filePath}`);
  }

  try {
    const parsed = JSON.parse(existing) as Partial<GeneratedManifest>;
    const files = Array.isArray(parsed.files) ? parsed.files : [];
    return {
      marker: typeof parsed.marker === 'string' ? parsed.marker : GENERATED_MARKER,
      generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : undefined,
      files: files
        .filter((entry): entry is GeneratedManifestEntry => (
          typeof entry?.relativePath === 'string' && typeof entry?.marker === 'string'
        )),
    };
  } catch {
    return {
      marker: GENERATED_MARKER,
      files: [],
    };
  }
}

function isAllowedGeneratedRelativePath(relativePath: string): boolean {
  if (relativePath === RECIPES_RELATIVE_PATH) {
    return true;
  }

  return (
    relativePath.startsWith('kubejs/assets/') &&
    relativePath.includes('/lang/') &&
    relativePath.endsWith('.json')
  ) || (
    relativePath === 'kubejs/client_scripts/zzz_delightify_generated.js'
  );
}

function canUseManifestOwnership(relativePath: string): boolean {
  return (
    relativePath.startsWith('kubejs/assets/') &&
    relativePath.includes('/lang/') &&
    relativePath.endsWith('.json')
  );
}

async function deleteOwnedFile(
  projectPath: string,
  entry: GeneratedManifestEntry,
  allowManifestOwnership: boolean
): Promise<boolean> {
  if (!isAllowedGeneratedRelativePath(entry.relativePath)) {
    throw new Error(`拒绝删除不在 Delightify 生成路径白名单内的文件: ${entry.relativePath}`);
  }

  const filePath = absoluteGeneratedPath(projectPath, entry.relativePath);
  const existing = await readExistingFile(filePath);
  if (existing === null) {
    return false;
  }

  if (!existing.includes(entry.marker) && !(allowManifestOwnership && canUseManifestOwnership(entry.relativePath))) {
    throw new Error(`拒绝删除非 Delightify 生成文件: ${filePath}`);
  }

  await fs.unlink(filePath);
  return true;
}

export async function exportKubeJs(
  projectPath: string,
  params: KubeJsExportParams
): Promise<KubeJsExportResult> {
  const filePath = generatedFilePath(projectPath);
  const writtenAt = new Date().toISOString();
  const files = emitChangeSet(params.changeSet, writtenAt);
  const recipesFile = files.find(file => file.relativePath === RECIPES_RELATIVE_PATH);

  for (const file of files) {
    await assertGeneratedFileIsOwned(absoluteGeneratedPath(projectPath, file.relativePath), file.marker);
  }

  if (files.length > 0) {
    await assertGeneratedFileIsOwned(generatedManifestPath(projectPath), GENERATED_MARKER);
  }

  for (const file of files) {
    const targetPath = absoluteGeneratedPath(projectPath, file.relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, file.content, 'utf8');
  }

  if (files.length > 0) {
    await writeGeneratedManifest(projectPath, files, writtenAt);
  }

  return {
    filePath,
    operationCount: params.changeSet.length,
    generatedCode: recipesFile?.content ?? '',
    writtenAt,
    files: files.map(file => ({
      filePath: absoluteGeneratedPath(projectPath, file.relativePath),
      operationCount: fileOperationCount(file.relativePath, params.changeSet),
    })),
  };
}

export async function revertKubeJs(projectPath: string): Promise<KubeJsRevertResult> {
  const filePath = generatedFilePath(projectPath);
  const manifest = await readGeneratedManifest(projectPath);
  const entries = new Map<string, GeneratedManifestEntry>();

  entries.set(RECIPES_RELATIVE_PATH, {
    relativePath: RECIPES_RELATIVE_PATH,
    marker: GENERATED_MARKER,
  });

  for (const entry of manifest?.files ?? []) {
    entries.set(entry.relativePath, entry);
  }

  let deleted = false;
  for (const entry of entries.values()) {
    const isManifestListed = Boolean(manifest?.files.some(file => file.relativePath === entry.relativePath));
    const didDelete = await deleteOwnedFile(projectPath, entry, isManifestListed);
    deleted = deleted || didDelete;
  }

  const manifestPath = generatedManifestPath(projectPath);
  const manifestContentText = await readExistingFile(manifestPath);
  if (manifestContentText !== null) {
    if (!manifestContentText.includes(GENERATED_MARKER)) {
      throw new Error(`拒绝删除非 Delightify 生成清单: ${manifestPath}`);
    }
    await fs.unlink(manifestPath);
    deleted = true;
  }

  return { filePath, deleted };
}

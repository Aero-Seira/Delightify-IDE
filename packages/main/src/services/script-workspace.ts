import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  ScriptWorkspaceDirectory,
  ScriptWorkspaceFile,
  ScriptWorkspaceCopyAsManagedResult,
  ScriptWorkspaceCreateDirectoryResult,
  ScriptWorkspaceCreateManagedResult,
  ScriptWorkspaceCreateUserResult,
  ScriptWorkspaceDeleteOptions,
  ScriptWorkspaceDeleteResult,
  ScriptWorkspaceListResult,
  ScriptWorkspaceReadResult,
  ScriptWorkspaceRenameOptions,
  ScriptWorkspaceRenameResult,
  ScriptWorkspaceSaveOptions,
  ScriptWorkspaceSaveResult,
} from '@delightify/shared';

interface GeneratedManifestEntry {
  relativePath: string;
  marker: string;
}

interface GeneratedManifest {
  marker: string;
  generatedAt?: string;
  files: GeneratedManifestEntry[];
}

const GENERATED_MARKER = '@delightify-generated';
const GENERATED_MANIFEST_RELATIVE_PATH = 'kubejs/.delightify-generated.json';
const LEGACY_SERVER_SCRIPT_RELATIVE_PATH = 'kubejs/server_scripts/zzz_delightify_generated.js';
const DEFAULT_MANUAL_SCRIPT_RELATIVE_PATH = 'kubejs/server_scripts/zzz_delightify_manual.js';
const DEFAULT_USER_SCRIPT_RELATIVE_PATH = 'kubejs/server_scripts/user_script.js';
const TRASH_ROOT_RELATIVE_PATH = '.delightify/script-workspace-trash';
const MAX_EDITABLE_TEXT_FILE_BYTES = 1024 * 1024;
const SCRIPT_FILE_ROOTS = [
  'kubejs/server_scripts',
  'kubejs/client_scripts',
  'kubejs/startup_scripts',
];
const SAFE_TEXT_ROOTS = [
  {
    root: 'kubejs/server_scripts',
    extensions: new Set(['.js']),
  },
  {
    root: 'kubejs/client_scripts',
    extensions: new Set(['.js']),
  },
  {
    root: 'kubejs/startup_scripts',
    extensions: new Set(['.js']),
  },
  {
    root: 'kubejs/assets',
    extensions: new Set(['.json', '.json5', '.mcmeta']),
  },
  {
    root: 'kubejs/data',
    extensions: new Set(['.json', '.json5', '.mcfunction', '.mcmeta']),
  },
  {
    root: 'config',
    extensions: new Set(['.cfg', '.conf', '.json', '.json5', '.properties', '.toml', '.txt', '.yaml', '.yml']),
  },
  {
    root: 'datapacks',
    extensions: new Set(['.json', '.json5', '.mcfunction', '.mcmeta']),
  },
  {
    root: 'resourcepacks',
    extensions: new Set(['.json', '.json5', '.lang', '.mcmeta', '.properties', '.txt']),
  },
];
const SAFE_TEXT_EXTENSIONS = new Set(SAFE_TEXT_ROOTS.flatMap(root => [...root.extensions]));
const DENIED_PATH_PREFIXES = [
  '.git',
  '.delightify',
  'mods',
  'libraries',
  'versions',
];

function toPosixPath(value: string): string {
  return value.replaceAll(path.sep, '/');
}

function normalizeRelativePath(relativePath: string): string {
  const normalized = path.posix.normalize(relativePath.replaceAll('\\', '/'));
  if (
    normalized === '.' ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    path.posix.isAbsolute(normalized)
  ) {
    throw new Error(`非法脚本路径: ${relativePath}`);
  }
  return normalized;
}

function absolutePath(projectPath: string, relativePath: string): string {
  return path.join(projectPath, normalizeRelativePath(relativePath));
}

function isPathUnderRoot(relativePath: string, root: string): boolean {
  return relativePath === root || relativePath.startsWith(`${root}/`);
}

function isDeniedWorkspacePath(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  return DENIED_PATH_PREFIXES.some(prefix => isPathUnderRoot(normalized, prefix));
}

function isSafeTextWorkspacePath(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  if (normalized === GENERATED_MANIFEST_RELATIVE_PATH) {
    return true;
  }
  if (isDeniedWorkspacePath(normalized)) {
    return false;
  }

  const extension = path.posix.extname(normalized);
  return SAFE_TEXT_ROOTS.some(root => (
    root.extensions.has(extension) && isPathUnderRoot(normalized, root.root)
  ));
}

function isSafeWorkspaceDirectoryPath(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  if (normalized === GENERATED_MANIFEST_RELATIVE_PATH || isDeniedWorkspacePath(normalized)) {
    return false;
  }
  return SAFE_TEXT_ROOTS.some(root => isPathUnderRoot(normalized, root.root));
}

function languageFor(relativePath: string): ScriptWorkspaceFile['language'] {
  const extension = path.posix.extname(relativePath);
  if (extension === '.js') {
    return 'javascript';
  }
  if (extension === '.json') {
    return 'json';
  }
  if (extension === '.json5' || extension === '.mcmeta') {
    return 'json';
  }
  if (extension === '.yaml' || extension === '.yml') {
    return 'yaml';
  }
  return 'plaintext';
}

function isJavaScriptWorkspaceScript(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  return (
    path.posix.extname(normalized) === '.js' &&
    SCRIPT_FILE_ROOTS.some(root => normalized.startsWith(`${root}/`))
  );
}

async function readTextIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function statIfExists(filePath: string): Promise<{ size: number; modifiedAt: string } | null> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return null;
    }
    return {
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function statDirectoryIfExists(filePath: string): Promise<{ modifiedAt: string } | null> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isDirectory()) {
      return null;
    }
    return {
      modifiedAt: stat.mtime.toISOString(),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function readGeneratedManifest(projectPath: string): Promise<GeneratedManifest | null> {
  const manifestPath = absolutePath(projectPath, GENERATED_MANIFEST_RELATIVE_PATH);
  const content = await readTextIfExists(manifestPath);
  if (content === null) {
    return null;
  }
  if (!content.includes(GENERATED_MARKER)) {
    throw new Error(`拒绝读取非 Delightify 生成清单: ${manifestPath}`);
  }

  try {
    const parsed = JSON.parse(content) as Partial<GeneratedManifest>;
    const files = Array.isArray(parsed.files) ? parsed.files : [];
    return {
      marker: typeof parsed.marker === 'string' ? parsed.marker : GENERATED_MARKER,
      generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : undefined,
      files: files.filter((entry): entry is GeneratedManifestEntry => (
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

async function isMarkerOwned(projectPath: string, relativePath: string): Promise<boolean> {
  const content = await readTextIfExists(absolutePath(projectPath, relativePath));
  return content !== null && content.includes(GENERATED_MARKER);
}

function manifestRelativePaths(manifest: GeneratedManifest | null): Set<string> {
  return new Set((manifest?.files ?? []).map(entry => normalizeRelativePath(entry.relativePath)));
}

async function classifyFile(
  projectPath: string,
  relativePath: string,
  manifestPaths: Set<string>
): Promise<ScriptWorkspaceFile> {
  const normalized = normalizeRelativePath(relativePath);
  if (!isSafeTextWorkspacePath(normalized)) {
    throw new Error(`文件路径不在脚本工作区允许范围内: ${relativePath}`);
  }

  const filePath = absolutePath(projectPath, normalized);
  const stat = await statIfExists(filePath);
  const isManifest = normalized === GENERATED_MANIFEST_RELATIVE_PATH;
  const isTooLarge = stat !== null && stat.size > MAX_EDITABLE_TEXT_FILE_BYTES;
  const markerOwned = !isTooLarge && isJavaScriptWorkspaceScript(normalized) && await isMarkerOwned(projectPath, normalized);
  const isManaged = !isManifest && (
    manifestPaths.has(normalized) ||
    markerOwned ||
    normalized === LEGACY_SERVER_SCRIPT_RELATIVE_PATH && markerOwned
  );
  const kind: ScriptWorkspaceFile['kind'] = isManifest
    ? 'manifest'
    : isTooLarge
      ? 'readonly'
      : isManaged
        ? 'managed'
        : 'user';

  return {
    relativePath: normalized,
    filePath,
    kind,
    language: languageFor(normalized),
    editable: kind === 'managed' || kind === 'user',
    requiresSaveConfirmation: kind === 'user',
    readOnlyReason: isManifest
      ? '生成清单只读，用于判断 Delightify managed 文件归属。'
      : isTooLarge
        ? `文件超过 ${(MAX_EDITABLE_TEXT_FILE_BYTES / 1024 / 1024).toFixed(0)} MB，暂不允许在工作区直接编辑。`
        : undefined,
    exists: stat !== null,
    size: stat?.size,
    modifiedAt: stat?.modifiedAt,
  };
}

async function classifyDirectory(projectPath: string, relativePath: string): Promise<ScriptWorkspaceDirectory> {
  const normalized = normalizeRelativePath(relativePath);
  if (!isSafeWorkspaceDirectoryPath(normalized)) {
    throw new Error(`目录路径不在脚本工作区允许范围内: ${relativePath}`);
  }

  const filePath = absolutePath(projectPath, normalized);
  const stat = await statDirectoryIfExists(filePath);
  return {
    relativePath: normalized,
    filePath,
    exists: stat !== null,
    modifiedAt: stat?.modifiedAt,
  };
}

async function walkWorkspace(rootPath: string, rootRelativePath: string): Promise<{
  files: string[];
  directories: string[];
}> {
  try {
    const entries = await fs.readdir(rootPath, { withFileTypes: true });
    const files: string[] = [];
    const directories: string[] = [];

    for (const entry of entries) {
      const childPath = path.join(rootPath, entry.name);
      const childRelativePath = path.posix.join(rootRelativePath, entry.name);
      if (entry.isDirectory()) {
        if (isSafeWorkspaceDirectoryPath(childRelativePath)) {
          directories.push(childRelativePath);
          const child = await walkWorkspace(childPath, childRelativePath);
          files.push(...child.files);
          directories.push(...child.directories);
        }
      } else if (
        entry.isFile() &&
        SAFE_TEXT_EXTENSIONS.has(path.posix.extname(childRelativePath)) &&
        isSafeTextWorkspacePath(childRelativePath)
      ) {
        files.push(childRelativePath);
      }
    }

    return { files, directories };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { files: [], directories: [] };
    }
    throw error;
  }
}

function sortFiles(left: ScriptWorkspaceFile, right: ScriptWorkspaceFile): number {
  const rank: Record<ScriptWorkspaceFile['kind'], number> = {
    managed: 1,
    user: 2,
    readonly: 3,
    manifest: 4,
  };
  const rankDiff = rank[left.kind] - rank[right.kind];
  if (rankDiff !== 0) {
    return rankDiff;
  }
  return left.relativePath.localeCompare(right.relativePath);
}

export async function listScriptWorkspaceFiles(projectPath: string): Promise<ScriptWorkspaceListResult> {
  const manifest = await readGeneratedManifest(projectPath);
  const manifestPaths = manifestRelativePaths(manifest);
  const relativePaths = new Set<string>();
  const directoryPaths = new Set<string>();

  if (manifest) {
    relativePaths.add(GENERATED_MANIFEST_RELATIVE_PATH);
  }
  for (const relativePath of manifestPaths) {
    relativePaths.add(relativePath);
  }
  if (await isMarkerOwned(projectPath, LEGACY_SERVER_SCRIPT_RELATIVE_PATH)) {
    relativePaths.add(LEGACY_SERVER_SCRIPT_RELATIVE_PATH);
  }

  for (const { root } of SAFE_TEXT_ROOTS) {
    const rootPath = path.join(projectPath, root);
    if (await statDirectoryIfExists(rootPath)) {
      directoryPaths.add(root);
    }
    const walked = await walkWorkspace(rootPath, root);
    for (const relativePath of walked.files) {
      relativePaths.add(toPosixPath(relativePath));
    }
    for (const relativePath of walked.directories) {
      directoryPaths.add(toPosixPath(relativePath));
    }
  }

  const files = await Promise.all([...relativePaths].map(relativePath => (
    classifyFile(projectPath, relativePath, manifestPaths)
  )));
  const directories = await Promise.all([...directoryPaths].map(relativePath => (
    classifyDirectory(projectPath, relativePath)
  )));

  return {
    files: files.sort(sortFiles),
    directories: directories.sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
  };
}

export async function readScriptWorkspaceFile(
  projectPath: string,
  relativePath: string
): Promise<ScriptWorkspaceReadResult> {
  const manifest = await readGeneratedManifest(projectPath);
  const file = await classifyFile(projectPath, relativePath, manifestRelativePaths(manifest));
  if (file.kind === 'readonly' && file.size !== undefined && file.size > MAX_EDITABLE_TEXT_FILE_BYTES) {
    throw new Error(file.readOnlyReason ?? `文件过大，暂不允许在工作区打开: ${file.relativePath}`);
  }
  const content = await readTextIfExists(file.filePath);
  if (content === null) {
    throw new Error(`文件不存在: ${file.relativePath}`);
  }

  return { file, content };
}

export async function saveScriptWorkspaceFile(
  projectPath: string,
  relativePath: string,
  content: string,
  options: ScriptWorkspaceSaveOptions = {}
): Promise<ScriptWorkspaceSaveResult> {
  const manifest = await readGeneratedManifest(projectPath);
  const manifestPaths = manifestRelativePaths(manifest);
  const file = await classifyFile(projectPath, relativePath, manifestPaths);
  if (!file.editable) {
    throw new Error(`拒绝保存只读文件: ${file.relativePath}`);
  }
  if (!file.exists) {
    throw new Error(`拒绝通过保存创建文件，请先使用新建文件入口: ${file.relativePath}`);
  }

  if (file.kind === 'user') {
    if (!options.confirmUserFileWrite) {
      throw new Error(`保存用户文件需要显式确认: ${file.relativePath}`);
    }

    await fs.writeFile(file.filePath, content, 'utf8');
    return {
      file: await classifyFile(projectPath, relativePath, manifestPaths),
      savedAt: new Date().toISOString(),
    };
  }

  const isJsFile = path.posix.extname(file.relativePath) === '.js';
  if (isJsFile && !content.includes(GENERATED_MARKER)) {
    throw new Error(`拒绝保存缺少 ${GENERATED_MARKER} 标记的受管脚本: ${file.relativePath}`);
  }

  const currentContent = await readTextIfExists(file.filePath);
  const isManifestOwned = manifestPaths.has(file.relativePath);
  const isMarkerOwnedFile = currentContent !== null && currentContent.includes(GENERATED_MARKER);
  if (!isManifestOwned && !isMarkerOwnedFile) {
    throw new Error(`拒绝覆盖非 Delightify managed 文件: ${file.relativePath}`);
  }

  await fs.mkdir(path.dirname(file.filePath), { recursive: true });
  await fs.writeFile(file.filePath, content, 'utf8');

  const savedFile = await classifyFile(projectPath, relativePath, manifestPaths);
  return {
    file: savedFile,
    savedAt: new Date().toISOString(),
  };
}

function managedManualScriptTemplate(): string {
  return [
    `// ${GENERATED_MARKER}`,
    '// Delightify managed manual script. Safe to edit in Script Workspace.',
    '// This file is not regenerated by Action Workbench.',
    '',
    'ServerEvents.recipes(event => {',
    '  // Add manual KubeJS changes here.',
    '})',
    '',
  ].join('\n');
}

function userFileTemplate(relativePath: string): string {
  const extension = path.posix.extname(relativePath);
  if (extension === '.js') {
    return [
      'ServerEvents.recipes(event => {',
      '  // Add manual KubeJS changes here.',
      '})',
      '',
    ].join('\n');
  }
  if (extension === '.json' || extension === '.json5' || extension === '.mcmeta') {
    return '{\n  \n}\n';
  }
  return '';
}

async function nextAvailableRelativePath(projectPath: string, relativePath: string): Promise<string> {
  const normalized = normalizeRelativePath(relativePath);
  const extension = path.posix.extname(normalized);
  const directory = path.posix.dirname(normalized);
  const baseName = path.posix.basename(normalized, extension);

  for (let index = 1; index < 1000; index += 1) {
    const candidate = index === 1
      ? normalized
      : path.posix.join(directory, `${baseName}_${index}${extension}`);
    if (await readTextIfExists(absolutePath(projectPath, candidate)) === null) {
      return candidate;
    }
  }

  throw new Error(`无法找到可用文件名: ${relativePath}`);
}

function assertCreatableUserWorkspacePath(relativePath: string): string {
  const normalized = normalizeRelativePath(relativePath);
  if (normalized === GENERATED_MANIFEST_RELATIVE_PATH || !isSafeTextWorkspacePath(normalized)) {
    throw new Error(`用户文件必须位于安全文本工作区内: ${relativePath}`);
  }
  return normalized;
}

function defaultManagedCopyPath(sourceRelativePath: string): string {
  const normalized = normalizeRelativePath(sourceRelativePath);
  const directory = path.posix.dirname(normalized);
  const sourceBaseName = path.posix.basename(normalized, '.js').replaceAll(/[^a-zA-Z0-9_-]/g, '_');
  return path.posix.join(directory, `zzz_delightify_${sourceBaseName}.js`);
}

function trashRelativePathFor(relativePath: string): string {
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  return path.posix.join(TRASH_ROOT_RELATIVE_PATH, timestamp, normalizeRelativePath(relativePath));
}

export async function createManagedScriptWorkspaceFile(
  projectPath: string,
  relativePath = DEFAULT_MANUAL_SCRIPT_RELATIVE_PATH
): Promise<ScriptWorkspaceCreateManagedResult> {
  const normalized = normalizeRelativePath(relativePath);
  if (!isJavaScriptWorkspaceScript(normalized)) {
    throw new Error(`受管手动脚本必须位于 KubeJS script 目录并使用 .js 后缀: ${relativePath}`);
  }

  const manifest = await readGeneratedManifest(projectPath);
  const manifestPaths = manifestRelativePaths(manifest);
  const filePath = absolutePath(projectPath, normalized);
  const existingContent = await readTextIfExists(filePath);

  if (existingContent !== null) {
    const existingFile = await classifyFile(projectPath, normalized, manifestPaths);
    if (!existingFile.editable) {
      throw new Error(`拒绝覆盖非 Delightify managed 文件: ${normalized}`);
    }
    return {
      file: existingFile,
      content: existingContent,
      created: false,
    };
  }

  const content = managedManualScriptTemplate();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');

  return {
    file: await classifyFile(projectPath, normalized, manifestPaths),
    content,
    created: true,
  };
}

export async function createUserScriptWorkspaceFile(
  projectPath: string,
  relativePath = DEFAULT_USER_SCRIPT_RELATIVE_PATH
): Promise<ScriptWorkspaceCreateUserResult> {
  const requestedPath = assertCreatableUserWorkspacePath(relativePath);
  const normalized = relativePath === DEFAULT_USER_SCRIPT_RELATIVE_PATH
    ? await nextAvailableRelativePath(projectPath, requestedPath)
    : requestedPath;
  const filePath = absolutePath(projectPath, normalized);
  const existingContent = await readTextIfExists(filePath);

  if (existingContent !== null) {
    throw new Error(`拒绝覆盖已有用户文件: ${normalized}`);
  }

  const manifest = await readGeneratedManifest(projectPath);
  const manifestPaths = manifestRelativePaths(manifest);
  const content = userFileTemplate(normalized);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');

  return {
    file: await classifyFile(projectPath, normalized, manifestPaths),
    content,
    created: true,
  };
}

export async function createScriptWorkspaceDirectory(
  projectPath: string,
  relativePath: string
): Promise<ScriptWorkspaceCreateDirectoryResult> {
  const normalized = normalizeRelativePath(relativePath);
  if (!isSafeWorkspaceDirectoryPath(normalized)) {
    throw new Error(`目录必须位于安全文本工作区内: ${relativePath}`);
  }

  const directoryPath = absolutePath(projectPath, normalized);
  const existingDirectory = await statDirectoryIfExists(directoryPath);
  if (existingDirectory) {
    return {
      directory: await classifyDirectory(projectPath, normalized),
      created: false,
    };
  }

  const existingFile = await statIfExists(directoryPath);
  if (existingFile) {
    throw new Error(`拒绝用目录覆盖已有文件: ${normalized}`);
  }

  await fs.mkdir(directoryPath, { recursive: true });
  return {
    directory: await classifyDirectory(projectPath, normalized),
    created: true,
  };
}

export async function renameScriptWorkspaceFile(
  projectPath: string,
  sourceRelativePath: string,
  targetRelativePath: string,
  options: ScriptWorkspaceRenameOptions = {}
): Promise<ScriptWorkspaceRenameResult> {
  const manifest = await readGeneratedManifest(projectPath);
  const manifestPaths = manifestRelativePaths(manifest);
  const sourceFile = await classifyFile(projectPath, sourceRelativePath, manifestPaths);
  if (sourceFile.kind !== 'user' || !sourceFile.exists) {
    throw new Error(`当前阶段仅允许重命名已存在的用户文件: ${sourceFile.relativePath}`);
  }
  if (!options.confirmUserFileWrite) {
    throw new Error(`重命名用户文件需要显式确认: ${sourceFile.relativePath}`);
  }

  const normalizedTarget = assertCreatableUserWorkspacePath(targetRelativePath);
  if (normalizedTarget === sourceFile.relativePath) {
    return {
      file: sourceFile,
      previousRelativePath: sourceFile.relativePath,
    };
  }

  const targetPath = absolutePath(projectPath, normalizedTarget);
  if (await statIfExists(targetPath) || await statDirectoryIfExists(targetPath)) {
    throw new Error(`拒绝覆盖已有路径: ${normalizedTarget}`);
  }

  const targetDirectory = path.posix.dirname(normalizedTarget);
  if (!isSafeWorkspaceDirectoryPath(targetDirectory)) {
    throw new Error(`目标目录不在安全文本工作区内: ${targetDirectory}`);
  }
  if (!await statDirectoryIfExists(absolutePath(projectPath, targetDirectory))) {
    throw new Error(`目标目录不存在: ${targetDirectory}`);
  }

  await fs.rename(sourceFile.filePath, targetPath);

  return {
    file: await classifyFile(projectPath, normalizedTarget, manifestPaths),
    previousRelativePath: sourceFile.relativePath,
  };
}

export async function deleteScriptWorkspaceFile(
  projectPath: string,
  relativePath: string,
  options: ScriptWorkspaceDeleteOptions = {}
): Promise<ScriptWorkspaceDeleteResult> {
  const manifest = await readGeneratedManifest(projectPath);
  const sourceFile = await classifyFile(projectPath, relativePath, manifestRelativePaths(manifest));
  if (sourceFile.kind !== 'user' || !sourceFile.exists) {
    throw new Error(`当前阶段仅允许删除已存在的用户文件: ${sourceFile.relativePath}`);
  }
  if (!options.confirmUserFileWrite) {
    throw new Error(`删除用户文件需要显式确认: ${sourceFile.relativePath}`);
  }

  const backupRelativePath = trashRelativePathFor(sourceFile.relativePath);
  const backupPath = path.join(projectPath, backupRelativePath);
  if (await statIfExists(backupPath) || await statDirectoryIfExists(backupPath)) {
    throw new Error(`内部回收路径已存在: ${backupRelativePath}`);
  }

  await fs.mkdir(path.dirname(backupPath), { recursive: true });
  await fs.rename(sourceFile.filePath, backupPath);

  return {
    previousRelativePath: sourceFile.relativePath,
    backupRelativePath,
    deletedAt: new Date().toISOString(),
  };
}

export async function copyScriptWorkspaceFileAsManaged(
  projectPath: string,
  sourceRelativePath: string,
  targetRelativePath?: string
): Promise<ScriptWorkspaceCopyAsManagedResult> {
  const manifest = await readGeneratedManifest(projectPath);
  const manifestPaths = manifestRelativePaths(manifest);
  const sourceFile = await classifyFile(projectPath, sourceRelativePath, manifestPaths);
  if (sourceFile.kind !== 'user' || !sourceFile.exists) {
    throw new Error(`只能将已存在的用户 KubeJS 脚本复制为 managed: ${sourceFile.relativePath}`);
  }
  if (!isJavaScriptWorkspaceScript(sourceFile.relativePath)) {
    throw new Error(`复制为 managed 当前仅支持 KubeJS .js 脚本: ${sourceFile.relativePath}`);
  }

  const requestedTarget = targetRelativePath
    ? normalizeRelativePath(targetRelativePath)
    : defaultManagedCopyPath(sourceFile.relativePath);
  if (!isJavaScriptWorkspaceScript(requestedTarget)) {
    throw new Error(`managed 副本必须位于 KubeJS script 目录并使用 .js 后缀: ${requestedTarget}`);
  }
  const target = targetRelativePath
    ? requestedTarget
    : await nextAvailableRelativePath(projectPath, requestedTarget);
  const targetPath = absolutePath(projectPath, target);
  const existingTargetContent = await readTextIfExists(targetPath);
  if (existingTargetContent !== null) {
    throw new Error(`拒绝覆盖已有文件: ${target}`);
  }

  const sourceContent = await readTextIfExists(sourceFile.filePath);
  if (sourceContent === null) {
    throw new Error(`源文件不存在: ${sourceFile.relativePath}`);
  }
  const content = sourceContent.includes(GENERATED_MARKER)
    ? sourceContent
    : [
      `// ${GENERATED_MARKER}`,
      `// Copied from ${sourceFile.relativePath}.`,
      '',
      sourceContent,
    ].join('\n');

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, 'utf8');

  return {
    file: await classifyFile(projectPath, target, manifestPaths),
    content,
    created: true,
    sourceRelativePath: sourceFile.relativePath,
  };
}

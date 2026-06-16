import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  ScriptWorkspaceFile,
  ScriptWorkspaceCreateManagedResult,
  ScriptWorkspaceListResult,
  ScriptWorkspaceReadResult,
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
const SCRIPT_ROOTS = [
  'kubejs/server_scripts',
  'kubejs/client_scripts',
  'kubejs/startup_scripts',
  'kubejs/assets',
];
const FILE_EXTENSIONS = new Set(['.js', '.json']);
const SCRIPT_FILE_ROOTS = [
  'kubejs/server_scripts',
  'kubejs/client_scripts',
  'kubejs/startup_scripts',
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

function isAllowedScriptPath(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  if (normalized === GENERATED_MANIFEST_RELATIVE_PATH) {
    return true;
  }

  const extension = path.posix.extname(normalized);
  return FILE_EXTENSIONS.has(extension) && SCRIPT_ROOTS.some(root => (
    normalized === root || normalized.startsWith(`${root}/`)
  ));
}

function languageFor(relativePath: string): ScriptWorkspaceFile['language'] {
  const extension = path.posix.extname(relativePath);
  if (extension === '.js') {
    return 'javascript';
  }
  if (extension === '.json') {
    return 'json';
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
  if (!isAllowedScriptPath(normalized)) {
    throw new Error(`脚本路径不在允许范围内: ${relativePath}`);
  }

  const filePath = absolutePath(projectPath, normalized);
  const stat = await statIfExists(filePath);
  const isManifest = normalized === GENERATED_MANIFEST_RELATIVE_PATH;
  const markerOwned = isJavaScriptWorkspaceScript(normalized) && await isMarkerOwned(projectPath, normalized);
  const isManaged = !isManifest && (
    manifestPaths.has(normalized) ||
    markerOwned ||
    normalized === LEGACY_SERVER_SCRIPT_RELATIVE_PATH && markerOwned
  );

  return {
    relativePath: normalized,
    filePath,
    kind: isManifest ? 'manifest' : isManaged ? 'managed' : 'user',
    language: languageFor(normalized),
    editable: isManaged,
    exists: stat !== null,
    size: stat?.size,
    modifiedAt: stat?.modifiedAt,
  };
}

async function walkFiles(rootPath: string, rootRelativePath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(rootPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const childPath = path.join(rootPath, entry.name);
      const childRelativePath = path.posix.join(rootRelativePath, entry.name);
      if (entry.isDirectory()) {
        files.push(...await walkFiles(childPath, childRelativePath));
      } else if (entry.isFile() && FILE_EXTENSIONS.has(path.posix.extname(childRelativePath))) {
        files.push(childRelativePath);
      }
    }

    return files;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function sortFiles(left: ScriptWorkspaceFile, right: ScriptWorkspaceFile): number {
  const rank: Record<ScriptWorkspaceFile['kind'], number> = {
    managed: 1,
    manifest: 2,
    user: 3,
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

  if (manifest) {
    relativePaths.add(GENERATED_MANIFEST_RELATIVE_PATH);
  }
  for (const relativePath of manifestPaths) {
    relativePaths.add(relativePath);
  }
  if (await isMarkerOwned(projectPath, LEGACY_SERVER_SCRIPT_RELATIVE_PATH)) {
    relativePaths.add(LEGACY_SERVER_SCRIPT_RELATIVE_PATH);
  }

  for (const root of SCRIPT_ROOTS) {
    const rootPath = path.join(projectPath, root);
    for (const relativePath of await walkFiles(rootPath, root)) {
      relativePaths.add(toPosixPath(relativePath));
    }
  }

  const files = await Promise.all([...relativePaths].map(relativePath => (
    classifyFile(projectPath, relativePath, manifestPaths)
  )));

  return {
    files: files.sort(sortFiles),
  };
}

export async function readScriptWorkspaceFile(
  projectPath: string,
  relativePath: string
): Promise<ScriptWorkspaceReadResult> {
  const manifest = await readGeneratedManifest(projectPath);
  const file = await classifyFile(projectPath, relativePath, manifestRelativePaths(manifest));
  const content = await readTextIfExists(file.filePath);
  if (content === null) {
    throw new Error(`文件不存在: ${file.relativePath}`);
  }

  return { file, content };
}

export async function saveScriptWorkspaceFile(
  projectPath: string,
  relativePath: string,
  content: string
): Promise<ScriptWorkspaceSaveResult> {
  const manifest = await readGeneratedManifest(projectPath);
  const manifestPaths = manifestRelativePaths(manifest);
  const file = await classifyFile(projectPath, relativePath, manifestPaths);
  if (!file.editable) {
    throw new Error(`拒绝保存非 Delightify managed 文件: ${file.relativePath}`);
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

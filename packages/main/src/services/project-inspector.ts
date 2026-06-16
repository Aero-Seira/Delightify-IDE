import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { access, readdir, readFile, stat } from 'fs/promises';
import type {
  ProjectExporterSnapshotStatus,
  ProjectGeneratedStatus,
  ProjectGitStatus,
  ProjectInstanceDirectories,
  ProjectInstanceHealth,
} from '@delightify/shared';
import { DATA_FILE_PATHS } from './mod-data-importer/types';

const execFileAsync = promisify(execFile);

const GENERATED_MANIFEST_RELATIVE_PATH = 'kubejs/.delightify-generated.json';
const GENERATED_SERVER_SCRIPT_RELATIVE_PATH = 'kubejs/server_scripts/zzz_delightify_generated.js';

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(filePath: string): Promise<boolean> {
  try {
    const stats = await stat(filePath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function readDirectories(projectPath: string): Promise<ProjectInstanceDirectories> {
  const [
    minecraftRoot,
    mods,
    config,
    kubejs,
    saves,
    resourcepacks,
    delightify,
  ] = await Promise.all([
    isDirectory(path.join(projectPath, '.minecraft')),
    isDirectory(path.join(projectPath, 'mods')),
    isDirectory(path.join(projectPath, 'config')),
    isDirectory(path.join(projectPath, 'kubejs')),
    isDirectory(path.join(projectPath, 'saves')),
    isDirectory(path.join(projectPath, 'resourcepacks')),
    isDirectory(path.join(projectPath, '.delightify')),
  ]);

  return {
    minecraftRoot,
    mods,
    config,
    kubejs,
    saves,
    resourcepacks,
    delightify,
  };
}

async function countModJars(projectPath: string): Promise<number> {
  const modsPath = path.join(projectPath, 'mods');
  try {
    const entries = await readdir(modsPath, { withFileTypes: true });
    return entries.filter(entry => (
      entry.isFile() && entry.name.toLowerCase().endsWith('.jar')
    )).length;
  } catch {
    return 0;
  }
}

async function findExporterSnapshot(projectPath: string): Promise<ProjectExporterSnapshotStatus> {
  for (const relativePath of DATA_FILE_PATHS) {
    const filePath = path.join(projectPath, relativePath);
    try {
      const stats = await stat(filePath);
      if (!stats.isFile()) {
        continue;
      }
      return {
        found: true,
        relativePath,
        filePath,
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
      };
    } catch {
      // Try next known location.
    }
  }

  return { found: false };
}

async function inspectGit(projectPath: string): Promise<ProjectGitStatus> {
  try {
    const inside = await execFileAsync('git', ['-C', projectPath, 'rev-parse', '--is-inside-work-tree'], {
      timeout: 2000,
    });
    if (inside.stdout.trim() !== 'true') {
      return { isRepo: false };
    }

    const [branchResult, statusResult] = await Promise.all([
      execFileAsync('git', ['-C', projectPath, 'branch', '--show-current'], { timeout: 2000 }).catch(() => ({ stdout: '' })),
      execFileAsync('git', ['-C', projectPath, 'status', '--porcelain'], { timeout: 3000 }).catch(() => ({ stdout: '' })),
    ]);
    const changedFiles = statusResult.stdout
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean).length;

    return {
      isRepo: true,
      branch: branchResult.stdout.trim() || undefined,
      dirty: changedFiles > 0,
      changedFiles,
    };
  } catch {
    return { isRepo: false };
  }
}

async function inspectGeneratedFiles(projectPath: string): Promise<ProjectGeneratedStatus> {
  const manifestPath = path.join(projectPath, GENERATED_MANIFEST_RELATIVE_PATH);
  const serverScriptPath = path.join(projectPath, GENERATED_SERVER_SCRIPT_RELATIVE_PATH);
  const [manifestExists, serverScriptExists] = await Promise.all([
    exists(manifestPath),
    exists(serverScriptPath),
  ]);

  if (!manifestExists) {
    return {
      manifestExists,
      serverScriptExists,
      managedFiles: serverScriptExists ? 1 : 0,
    };
  }

  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { files?: unknown };
    const files = Array.isArray(manifest.files) ? manifest.files : [];
    return {
      manifestExists,
      serverScriptExists,
      managedFiles: files.length,
    };
  } catch {
    return {
      manifestExists,
      serverScriptExists,
      managedFiles: serverScriptExists ? 1 : 0,
    };
  }
}

function buildWarnings(health: Omit<ProjectInstanceHealth, 'warnings'>): string[] {
  const warnings: string[] = [];

  if (!health.pathExists) {
    warnings.push('项目路径不存在。');
    return warnings;
  }
  if (!health.directories.mods) {
    warnings.push('未检测到 mods 目录。');
  }
  if (!health.exporterSnapshot.found) {
    warnings.push('未检测到 exporter 快照。');
  }
  if (!health.git.isRepo) {
    warnings.push('当前实例目录不是 Git 仓库。');
  } else if (health.git.dirty) {
    warnings.push(`Git 工作区有 ${health.git.changedFiles ?? 0} 个未提交变更。`);
  }
  if (!health.directories.kubejs) {
    warnings.push('未检测到 kubejs 目录，导出时会自动创建。');
  }

  return warnings;
}

export async function inspectProjectInstance(projectPath: string): Promise<ProjectInstanceHealth> {
  const pathExists = await exists(projectPath);
  const [directories, modJarCount, exporterSnapshot, git, generated] = await Promise.all([
    readDirectories(projectPath),
    countModJars(projectPath),
    findExporterSnapshot(projectPath),
    inspectGit(projectPath),
    inspectGeneratedFiles(projectPath),
  ]);

  const healthWithoutWarnings = {
    path: projectPath,
    pathExists,
    directories,
    modJarCount,
    exporterSnapshot,
    git,
    generated,
  };

  return {
    ...healthWithoutWarnings,
    warnings: buildWarnings(healthWithoutWarnings),
  };
}

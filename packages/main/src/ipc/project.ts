/**
 * Project IPC Handlers - v2.0
 * 
 * 项目管理相关的 IPC 处理器
 */

import { ipcMain, dialog } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';
import type { 
  Project, 
  CreateProjectData, 
  UpdateProjectData,
  ProjectListResult, 
  ProjectResult,
  ProjectDeleteResult,
  ProjectStatsResult,
  ProjectStats,
  ModLoader,
} from '@delightify/shared';
import { appPaths } from '../services/paths';
import { createProjectDbClient } from '../services/database';
import { readFile, writeFile, access, mkdir, rm } from 'fs/promises';
import * as path from 'path';

// 内存中存储当前项目
let currentProject: Project | null = null;

/**
 * 从 projects.json 读取项目列表
 */
async function readProjects(): Promise<Project[]> {
  try {
    await access(appPaths.projectsJson);
    const content = await readFile(appPaths.projectsJson, 'utf-8');
    const data = JSON.parse(content);
    const projects = Array.isArray(data) ? data : data.projects;
    return Array.isArray(projects) ? projects : [];
  } catch {
    return [];
  }
}

/**
 * 写入项目列表到 projects.json
 */
async function writeProjects(projects: Project[]): Promise<void> {
  await mkdir(path.dirname(appPaths.projectsJson), { recursive: true });
  await writeFile(
    appPaths.projectsJson, 
    JSON.stringify({ projects }, null, 2), 
    'utf-8'
  );
}

/**
 * 生成唯一项目 ID
 */
function generateProjectId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * 验证 Minecraft 版本格式
 */
function validateMcVersion(version: string): boolean {
  return /^1\.\d+(\.\d+)?$/.test(version);
}

/**
 * 探测模组加载器
 */
async function detectModLoader(projectPath: string): Promise<{ modLoader?: ModLoader; modLoaderVersion?: string }> {
  try {
    // 检查 version.json
    const versionJsonPath = path.join(projectPath, 'version.json');
    const versionContent = await readFile(versionJsonPath, 'utf-8').catch(() => null);
    
    if (versionContent) {
      const versionData = JSON.parse(versionContent);
      if (versionData.id) {
        if (versionData.id.includes('forge')) {
          const match = versionData.id.match(/forge-([\d.]+)/);
          return { modLoader: 'forge', modLoaderVersion: match?.[1] };
        }
        if (versionData.id.includes('fabric')) {
          return { modLoader: 'fabric' };
        }
        if (versionData.id.includes('neoforge')) {
          return { modLoader: 'neoforge' };
        }
      }
    }
    
    return {};
  } catch {
    return {};
  }
}

/**
 * 获取项目统计信息
 */
async function getProjectStats(projectPath: string): Promise<ProjectStats | null> {
  try {
    const dbPath = appPaths.projectDb(projectPath);
    await access(dbPath);
    
    const db = createProjectDbClient(dbPath);
    
    // 查询各项统计（使用正确的表名）
    const [modsResult, itemsResult, recipesResult, tagsResult, typesResult, importResult] = await Promise.all([
      db.execute('SELECT COUNT(*) as count FROM mods').catch(() => ({ rows: [{ count: 0 }] })),
      db.execute('SELECT COUNT(*) as count FROM items').catch(() => ({ rows: [{ count: 0 }] })),
      db.execute('SELECT COUNT(*) as count FROM recipes').catch(() => ({ rows: [{ count: 0 }] })),
      db.execute('SELECT COUNT(DISTINCT tag_id) as count FROM item_tags').catch(() => ({ rows: [{ count: 0 }] })),
      db.execute('SELECT COUNT(DISTINCT type_id) as count FROM recipes').catch(() => ({ rows: [{ count: 0 }] })),
      db.execute('SELECT imported_at FROM data_imports WHERE is_success = 1 ORDER BY imported_at DESC LIMIT 1').catch(() => ({ rows: [] })),
    ]);
    
    const lastImportedAt = importResult.rows[0]?.imported_at as string | undefined;
    
    // 判断是否需要重新导入（超过7天或没有导入记录）
    let needsReimport = true;
    if (lastImportedAt) {
      const lastImport = new Date(lastImportedAt);
      const daysSinceImport = (Date.now() - lastImport.getTime()) / (1000 * 60 * 60 * 24);
      needsReimport = daysSinceImport > 7;
    }
    
    return {
      modCount: Number(modsResult.rows[0]?.count || 0),
      itemCount: Number(itemsResult.rows[0]?.count || 0),
      recipeCount: Number(recipesResult.rows[0]?.count || 0),
      tagCount: Number(tagsResult.rows[0]?.count || 0),
      recipeTypeCount: Number(typesResult.rows[0]?.count || 0),
      lastImportedAt,
      needsReimport,
    };
  } catch {
    return null;
  }
}

/**
 * 注册项目相关的 IPC 处理器
 */
export function registerProjectHandlers(): void {
  // PROJECT_LIST: 获取项目列表
  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, async (): Promise<ProjectListResult> => {
    try {
      const projects = await readProjects();
      
      // 为每个项目获取统计信息
      const projectsWithStats = await Promise.all(
        projects.map(async (project) => {
          const stats = await getProjectStats(project.path);
          return {
            ...project,
            totalMods: stats?.modCount || 0,
            totalItems: stats?.itemCount || 0,
            totalRecipes: stats?.recipeCount || 0,
            lastImportedAt: stats?.lastImportedAt,
            status: (stats?.needsReimport ? 'needs_import' : stats ? 'ready' : 'needs_import') as Project['status'],
          };
        })
      );
      
      return { success: true, data: projectsWithStats, total: projectsWithStats.length };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '读取项目列表失败';
      console.error('PROJECT_LIST 错误:', error);
      return { success: false, error: errorMessage };
    }
  });

  // PROJECT_OPEN: 打开/选择项目
  ipcMain.handle(IPC_CHANNELS.PROJECT_OPEN, async (_event, projectId?: string): Promise<ProjectResult & { canceled?: boolean }> => {
    try {
      if (projectId) {
        const projects = await readProjects();
        const project = projects.find(p => p.id === projectId);
        
        if (!project) {
          return { success: false, error: '项目不存在' };
        }
        
        // 更新最后打开时间
        project.lastOpenedAt = new Date().toISOString();
        await writeProjects(projects);
        
        // 获取统计信息
        const stats = await getProjectStats(project.path);
        
        currentProject = {
          ...project,
          totalMods: stats?.modCount || 0,
          totalItems: stats?.itemCount || 0,
          totalRecipes: stats?.recipeCount || 0,
          lastImportedAt: stats?.lastImportedAt,
          status: stats?.needsReimport ? 'needs_import' : stats ? 'ready' : 'needs_import',
        };
        
        return { success: true, data: currentProject };
      }
      
      // 显示目录选择对话框
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: '选择 Minecraft 整合包目录',
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true, data: null };
      }

      const selectedPath = result.filePaths[0];
      const projects = await readProjects();
      
      // 检查该路径是否已有项目
      const existingProject = projects.find(p => p.path === selectedPath);
      if (existingProject) {
        existingProject.lastOpenedAt = new Date().toISOString();
        await writeProjects(projects);
        
        const stats = await getProjectStats(existingProject.path);
        currentProject = {
          ...existingProject,
          totalMods: stats?.modCount || 0,
          totalItems: stats?.itemCount || 0,
          totalRecipes: stats?.recipeCount || 0,
          lastImportedAt: stats?.lastImportedAt,
          status: stats?.needsReimport ? 'needs_import' : stats ? 'ready' : 'needs_import',
        };
        
        return { success: true, data: currentProject };
      }

      return { success: true, data: null, error: '该目录尚未创建项目，请先创建项目' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '打开项目失败';
      console.error('PROJECT_OPEN 错误:', error);
      return { success: false, error: errorMessage };
    }
  });

  // PROJECT_CREATE: 创建新项目
  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, async (_event, data: CreateProjectData): Promise<ProjectResult> => {
    try {
      const { name, path: projectPath, mcVersion, modLoader, modLoaderVersion, description } = data;

      if (!name?.trim()) {
        return { success: false, error: '项目名称不能为空' };
      }
      
      if (!projectPath?.trim()) {
        return { success: false, error: '项目路径不能为空' };
      }

      if (!mcVersion?.trim()) {
        return { success: false, error: 'Minecraft 版本不能为空' };
      }

      if (!validateMcVersion(mcVersion)) {
        return { success: false, error: 'Minecraft 版本格式无效（例如：1.20.1）' };
      }

      if (!modLoader) {
        return { success: false, error: '请选择模组加载器' };
      }

      // 确保项目目录存在
      try {
        await access(projectPath);
      } catch {
        await mkdir(projectPath, { recursive: true });
      }

      const projects = await readProjects();

      // 检查路径是否已存在项目
      if (projects.some(p => p.path === projectPath)) {
        return { success: false, error: '该路径已存在项目' };
      }

      // 检查项目名称是否重复
      if (projects.some(p => p.name === name)) {
        return { success: false, error: '项目名称已存在' };
      }

      // 创建 Delightify 项目目录
      const delightifyDir = path.join(projectPath, '.delightify');
      await mkdir(delightifyDir, { recursive: true });

      // 初始化项目数据库
      const dbPath = appPaths.projectDb(projectPath);
      const db = createProjectDbClient(dbPath);
      // 注意：不要关闭连接，让连接缓存机制管理
      console.log(`[Project] Database initialized: ${dbPath}`);

      // 尝试自动探测模组加载器版本
      let detectedLoaderVersion = modLoaderVersion;
      if (!detectedLoaderVersion) {
        const detected = await detectModLoader(projectPath);
        detectedLoaderVersion = detected.modLoaderVersion;
      }

      const now = new Date().toISOString();
      const newProject: Project = {
        id: generateProjectId(),
        name: name.trim(),
        description: description?.trim() || '',
        path: projectPath,
        mcVersion: mcVersion.trim(),
        modLoader,
        modLoaderVersion: detectedLoaderVersion,
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
        isFavorite: false,
        status: 'needs_import',
        totalMods: 0,
        totalItems: 0,
        totalRecipes: 0,
      };

      projects.push(newProject);
      await writeProjects(projects);
      
      currentProject = newProject;

      console.log(`项目创建成功: ${newProject.name} (${newProject.id})`);
      return { success: true, data: newProject };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '创建项目失败';
      console.error('PROJECT_CREATE 错误:', error);
      return { success: false, error: errorMessage };
    }
  });

  // PROJECT_UPDATE: 更新项目
  ipcMain.handle(IPC_CHANNELS.PROJECT_UPDATE, async (_event, projectId: string, data: UpdateProjectData): Promise<ProjectResult> => {
    try {
      const projects = await readProjects();
      const projectIndex = projects.findIndex(p => p.id === projectId);
      
      if (projectIndex === -1) {
        return { success: false, error: '项目不存在' };
      }

      const project = projects[projectIndex];

      // 检查新名称是否与其他项目重复
      if (data.name && data.name !== project.name) {
        if (projects.some(p => p.name === data.name && p.id !== projectId)) {
          return { success: false, error: '项目名称已存在' };
        }
      }

      // 更新字段
      const updatedProject: Project = {
        ...project,
        ...(data.name && { name: data.name.trim() }),
        ...(data.description !== undefined && { description: data.description.trim() }),
        ...(data.mcVersion && { mcVersion: data.mcVersion.trim() }),
        ...(data.modLoader && { modLoader: data.modLoader }),
        ...(data.modLoaderVersion !== undefined && { modLoaderVersion: data.modLoaderVersion }),
        ...(data.isFavorite !== undefined && { isFavorite: data.isFavorite }),
        ...(data.icon !== undefined && { icon: data.icon }),
        updatedAt: new Date().toISOString(),
      };

      projects[projectIndex] = updatedProject;
      await writeProjects(projects);

      // 如果更新的是当前项目，同步更新
      if (currentProject?.id === projectId) {
        currentProject = updatedProject;
      }

      return { success: true, data: updatedProject };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '更新项目失败';
      console.error('PROJECT_UPDATE 错误:', error);
      return { success: false, error: errorMessage };
    }
  });

  // PROJECT_DELETE: 删除项目
  ipcMain.handle(IPC_CHANNELS.PROJECT_DELETE, async (_event, projectId: string): Promise<ProjectDeleteResult> => {
    try {
      const projects = await readProjects();
      const projectIndex = projects.findIndex(p => p.id === projectId);
      
      if (projectIndex === -1) {
        return { success: false, error: '项目不存在' };
      }

      const project = projects[projectIndex];

      // 从列表中移除
      projects.splice(projectIndex, 1);
      await writeProjects(projects);

      // 如果删除的是当前项目，清空
      if (currentProject?.id === projectId) {
        currentProject = null;
      }

      // 删除项目配置目录
      try {
        const delightifyDir = path.join(project.path, '.delightify');
        await rm(delightifyDir, { recursive: true, force: true });
      } catch {
        // 忽略删除错误
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '删除项目失败';
      console.error('PROJECT_DELETE 错误:', error);
      return { success: false, error: errorMessage };
    }
  });

  // PROJECT_GET_CURRENT: 获取当前项目
  ipcMain.handle(IPC_CHANNELS.PROJECT_GET_CURRENT, async (): Promise<ProjectResult> => {
    try {
      return { success: true, data: currentProject };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取当前项目失败';
      return { success: false, error: errorMessage };
    }
  });

  // PROJECT_GET_STATS: 获取项目统计信息
  ipcMain.handle(IPC_CHANNELS.PROJECT_GET_STATS, async (_event, projectPath: string): Promise<ProjectStatsResult> => {
    try {
      const stats = await getProjectStats(projectPath);
      if (!stats) {
        return { success: true, data: { modCount: 0, itemCount: 0, recipeCount: 0, tagCount: 0, recipeTypeCount: 0, needsReimport: true } };
      }
      return { success: true, data: stats };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取项目统计失败';
      return { success: false, error: errorMessage };
    }
  });

  // PROJECT_SELECT_DIRECTORY: 选择目录对话框
  ipcMain.handle(IPC_CHANNELS.PROJECT_SELECT_DIRECTORY, async (): Promise<{ canceled: boolean; filePaths?: string[] }> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择项目目录',
    });
    return {
      canceled: result.canceled,
      filePaths: result.filePaths,
    };
  });
}

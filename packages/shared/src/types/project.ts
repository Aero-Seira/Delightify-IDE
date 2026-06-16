/**
 * Project types - v2.0
 * 
 * 项目管理相关类型定义
 */

import type { ModLoader } from '../constants/minecraft';

export type { ModLoader };

/** 项目状态 */
export type ProjectStatus = 'loading' | 'ready' | 'error' | 'closed' | 'needs_import';

/**
 * 项目类型 - 代表一个 Minecraft 整合包项目
 */
export interface Project {
  /** 唯一标识符 */
  id: string;
  /** 项目名称 */
  name: string;
  /** 项目描述 */
  description?: string;
  /** 项目路径（整合包根目录） */
  path: string;
  /** Minecraft 版本 */
  mcVersion: string;
  /** 模组加载器 */
  modLoader: ModLoader;
  /** 模组加载器版本 */
  modLoaderVersion?: string;
  /** 创建时间 */
  createdAt: string;
  /** 最后更新时间 */
  updatedAt: string;
  /** 最后打开时间 */
  lastOpenedAt?: string;
  /** 是否收藏 */
  isFavorite?: boolean;
  /** 项目图标路径 */
  icon?: string;
  /** 项目状态 */
  status?: ProjectStatus;
  // 统计信息（从数据库实时获取）
  totalMods?: number;
  totalRecipes?: number;
  totalItems?: number;
  /** 最后数据导入时间 */
  lastImportedAt?: string;
}

/**
 * 项目统计信息
 */
export interface ProjectStats {
  /** 模组数量 */
  modCount: number;
  /** 物品数量 */
  itemCount: number;
  /** 配方数量 */
  recipeCount: number;
  /** 标签数量 */
  tagCount: number;
  /** 配方类型数量 */
  recipeTypeCount: number;
  /** 最后导入时间 */
  lastImportedAt?: string;
  /** 是否需要重新导入 */
  needsReimport: boolean;
  /** Minecraft 实例体检信息 */
  instance?: ProjectInstanceHealth;
}

/** 项目实例目录状态 */
export interface ProjectInstanceDirectories {
  /** 是否存在 .minecraft 目录 */
  minecraftRoot: boolean;
  /** 是否存在 mods 目录 */
  mods: boolean;
  /** 是否存在 config 目录 */
  config: boolean;
  /** 是否存在 kubejs 目录 */
  kubejs: boolean;
  /** 是否存在 saves 目录 */
  saves: boolean;
  /** 是否存在 resourcepacks 目录 */
  resourcepacks: boolean;
  /** 是否存在 .delightify 目录 */
  delightify: boolean;
}

/** exporter 快照状态 */
export interface ProjectExporterSnapshotStatus {
  found: boolean;
  relativePath?: string;
  filePath?: string;
  size?: number;
  modifiedAt?: string;
}

/** Git 工作区状态 */
export interface ProjectGitStatus {
  isRepo: boolean;
  branch?: string;
  dirty?: boolean;
  changedFiles?: number;
}

/** Delightify 生成产物状态 */
export interface ProjectGeneratedStatus {
  manifestExists: boolean;
  serverScriptExists: boolean;
  managedFiles: number;
}

/** Minecraft 实例体检信息 */
export interface ProjectInstanceHealth {
  path: string;
  pathExists: boolean;
  directories: ProjectInstanceDirectories;
  modJarCount: number;
  exporterSnapshot: ProjectExporterSnapshotStatus;
  git: ProjectGitStatus;
  generated: ProjectGeneratedStatus;
  warnings: string[];
}

/**
 * 创建项目请求数据
 */
export interface CreateProjectData {
  /** 项目名称 */
  name: string;
  /** 项目描述 */
  description?: string;
  /** 项目路径 */
  path: string;
  /** Minecraft 版本 */
  mcVersion: string;
  /** 模组加载器 */
  modLoader: ModLoader;
  /** 模组加载器版本 */
  modLoaderVersion?: string;
}

/**
 * 更新项目请求数据
 */
export interface UpdateProjectData {
  /** 项目名称 */
  name?: string;
  /** 项目描述 */
  description?: string;
  /** Minecraft 版本 */
  mcVersion?: string;
  /** 模组加载器 */
  modLoader?: ModLoader;
  /** 模组加载器版本 */
  modLoaderVersion?: string;
  /** 是否收藏 */
  isFavorite?: boolean;
  /** 项目图标路径 */
  icon?: string;
}

/**
 * 项目列表查询参数
 */
export interface ProjectListParams {
  /** 搜索关键词 */
  search?: string;
  /** 按 Minecraft 版本筛选 */
  mcVersion?: string;
  /** 按模组加载器筛选 */
  modLoader?: ModLoader;
  /** 只显示收藏 */
  favoriteOnly?: boolean;
  /** 排序字段 */
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'lastOpenedAt';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 项目列表结果
 */
export interface ProjectListResult {
  /** 是否成功 */
  success: boolean;
  /** 项目列表 */
  data?: Project[];
  /** 总数 */
  total?: number;
  /** 错误信息 */
  error?: string;
}

/**
 * 单个项目操作结果
 */
export interface ProjectResult {
  /** 是否成功 */
  success: boolean;
  /** 项目数据 */
  data?: Project | null;
  /** 错误信息 */
  error?: string;
}

/**
 * 项目删除结果
 */
export interface ProjectDeleteResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 项目统计结果
 */
export interface ProjectStatsResult {
  /** 是否成功 */
  success: boolean;
  /** 统计信息 */
  data?: ProjectStats;
  /** 错误信息 */
  error?: string;
}

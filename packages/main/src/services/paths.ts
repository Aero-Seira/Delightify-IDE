import { app } from 'electron';
import * as path from 'path';
import { mkdir } from 'fs/promises';

/**
 * AppPaths - 应用路径管理器
 *
 * 参考 PCL2CE 的多层路径分离设计，将路径分为三个独立体系：
 * - userData: 应用全局数据根目录 (%AppData%/Delightify/)
 * - globalDb: 全局模组知识库 (跨项目共享)
 * - projectDb: 单个整合包的项目私有库
 *
 * 三个路径体系互不耦合，支持灵活部署与迁移。
 */
export class AppPaths {
  /** 用户数据目录 (%AppData%/Delightify/) */
  private _userData: string | null = null;

  /**
   * 初始化路径（必须在 app.whenReady() 之后调用）
   */
  initialize(): void {
    this._userData = app.getPath('userData');
  }

  /** 用户数据目录 (%AppData%/Delightify/) */
  get userData(): string {
    if (!this._userData) {
      throw new Error('AppPaths not initialized. Call initialize() after app.whenReady()');
    }
    return this._userData;
  }

  /** 全局数据库路径 (userData/global.db) */
  get globalDb(): string {
    return path.join(this.userData, 'global.db');
  }

  /** 材质缓存目录 (userData/cache/textures/) */
  get textureCache(): string {
    return path.join(this.userData, 'cache', 'textures');
  }

  /** 项目注册表路径 (userData/projects.json) */
  get projectsJson(): string {
    return path.join(this.userData, 'projects.json');
  }

  /**
   * 获取项目私有数据库路径
   * @param projectPath - 整合包项目根目录路径
   * @returns project.db 完整路径 (<modpack>/.delightify/project.db)
   */
  projectDb(projectPath: string): string {
    return path.join(projectPath, '.delightify', 'project.db');
  }

  /**
   * 确保必要的目录结构存在
   * 自动创建以下目录（如果不存在）：
   * - userData/cache/textures/
   */
  async ensureDirectories(): Promise<void> {
    await mkdir(this.textureCache, { recursive: true });
  }
}

/** 全局 AppPaths 实例 */
export const appPaths = new AppPaths();

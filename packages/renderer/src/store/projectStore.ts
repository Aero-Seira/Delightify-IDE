/**
 * Project Store - 项目状态管理
 * 使用 Zustand 管理项目相关的状态和操作
 */

import { create } from 'zustand';
import type { 
  Project, 
  CreateProjectData, 
  UpdateProjectData, 
  ProjectListParams,
  ModLoader
} from '@delightify/shared';
import { electronAPI } from '../ipc';

/**
 * 项目状态接口
 */
interface ProjectState {
  // ========== 当前项目 ==========
  /** 当前打开的项目 */
  currentProject: Project | null;
  /** 当前项目状态 */
  projectStatus: 'closed' | 'loading' | 'ready' | 'error';
  /** 当前项目错误信息 */
  projectError: string | null;

  // ========== 项目列表 ==========
  /** 项目列表 */
  projects: Project[];
  /** 是否正在加载项目列表 */
  isLoadingProjects: boolean;
  /** 项目列表错误信息 */
  projectsError: string | null;
  /** 列表查询参数 */
  listParams: ProjectListParams;

  // ========== 操作状态 ==========
  /** 是否正在创建项目 */
  isCreating: boolean;
  /** 创建项目的错误信息 */
  createError: string | null;

  // ========== Actions ==========
  /** 加载项目列表 */
  loadProjects: (params?: ProjectListParams) => Promise<void>;
  /** 创建新项目 */
  createProject: (data: CreateProjectData) => Promise<Project | null>;
  /** 打开项目 */
  openProject: (projectId: string) => Promise<void>;
  /** 打开目录选择对话框 */
  openDirectoryDialog: () => Promise<string | null>;
  /** 更新项目 */
  updateProject: (projectId: string, data: UpdateProjectData) => Promise<void>;
  /** 删除项目 */
  deleteProject: (projectId: string) => Promise<void>;
  /** 设置收藏状态 */
  setFavorite: (projectId: string, isFavorite: boolean) => Promise<void>;
  /** 设置列表查询参数 */
  setListParams: (params: Partial<ProjectListParams>) => void;
  /** 清除错误 */
  clearErrors: () => void;
}

/**
 * 项目 Store
 */
export const useProjectStore = create<ProjectState>((set, get) => ({
  // ========== 初始状态 ==========
  currentProject: null,
  projectStatus: 'closed',
  projectError: null,
  
  projects: [],
  isLoadingProjects: false,
  projectsError: null,
  listParams: {
    sortBy: 'lastOpenedAt',
    sortOrder: 'desc',
  },
  
  isCreating: false,
  createError: null,

  // ========== Actions ==========

  /**
   * 加载项目列表
   */
  loadProjects: async (params?: ProjectListParams) => {
    set({ isLoadingProjects: true, projectsError: null });
    
    try {
      // 更新查询参数
      if (params) {
        set({ listParams: { ...get().listParams, ...params } });
      }
      
      const result = await electronAPI().projectList();
      
      if (result.success && result.data) {
        let projects = result.data;
        const currentParams = params || get().listParams;
        
        // 客户端筛选
        if (currentParams.search) {
          const search = currentParams.search.toLowerCase();
          projects = projects.filter(p => 
            p.name.toLowerCase().includes(search) || 
            (p.description?.toLowerCase().includes(search))
          );
        }
        
        if (currentParams.mcVersion) {
          projects = projects.filter(p => p.mcVersion === currentParams.mcVersion);
        }
        
        if (currentParams.modLoader) {
          projects = projects.filter(p => p.modLoader === currentParams.modLoader);
        }
        
        if (currentParams.favoriteOnly) {
          projects = projects.filter(p => p.isFavorite);
        }
        
        // 客户端排序
        if (currentParams.sortBy) {
          projects.sort((a, b) => {
            const aVal = a[currentParams.sortBy!];
            const bVal = b[currentParams.sortBy!];
            const order = currentParams.sortOrder === 'asc' ? 1 : -1;
            
            if (typeof aVal === 'string' && typeof bVal === 'string') {
              return aVal.localeCompare(bVal) * order;
            }
            return 0;
          });
        }
        
        set({ projects, isLoadingProjects: false });
      } else {
        set({ 
          projectsError: result.error || '加载项目列表失败', 
          isLoadingProjects: false 
        });
      }
    } catch (error) {
      set({ 
        projectsError: error instanceof Error ? error.message : '加载项目列表失败',
        isLoadingProjects: false 
      });
    }
  },

  /**
   * 创建新项目
   */
  createProject: async (data: CreateProjectData): Promise<Project | null> => {
    set({ isCreating: true, createError: null });
    
    try {
      const result = await electronAPI().projectCreate(data);
      
      if (result.success && result.data) {
        // 刷新项目列表
        await get().loadProjects();
        set({ isCreating: false });
        return result.data;
      } else {
        set({ 
          createError: result.error || '创建项目失败',
          isCreating: false 
        });
        return null;
      }
    } catch (error) {
      set({ 
        createError: error instanceof Error ? error.message : '创建项目失败',
        isCreating: false 
      });
      return null;
    }
  },

  /**
   * 打开项目
   */
  openProject: async (projectId: string) => {
    set({ projectStatus: 'loading', projectError: null });
    
    try {
      const result = await electronAPI().projectOpen(projectId);
      
      if (result.canceled) {
        set({ projectStatus: 'closed' });
        return;
      }
      
      if (result.success && result.data) {
        set({ 
          currentProject: result.data,
          projectStatus: 'ready' 
        });
        // 刷新项目列表以更新最后打开时间
        await get().loadProjects();
      } else {
        set({ 
          projectError: result.error || '打开项目失败',
          projectStatus: 'error' 
        });
      }
    } catch (error) {
      set({ 
        projectError: error instanceof Error ? error.message : '打开项目失败',
        projectStatus: 'error' 
      });
    }
  },

  /**
   * 打开目录选择对话框
   */
  openDirectoryDialog: async (): Promise<string | null> => {
    try {
      // 尝试使用专门的目录选择方法
      const result = await electronAPI().selectDirectory();
      if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
        return result.filePaths[0];
      }
      return null;
    } catch (error) {
      console.error('选择目录失败:', error);
      return null;
    }
  },

  /**
   * 更新项目
   */
  updateProject: async (projectId: string, data: UpdateProjectData) => {
    try {
      const result = await electronAPI().projectUpdate(projectId, data);
      
      if (result.success && result.data) {
        // 更新本地列表
        const projects = get().projects.map(p => 
          p.id === projectId ? { ...p, ...result.data } : p
        );
        
        // 如果当前项目被更新，也更新 currentProject
        const currentProject = get().currentProject;
        if (currentProject?.id === projectId) {
          set({ currentProject: { ...currentProject, ...result.data } });
        }
        
        set({ projects });
      } else {
        throw new Error(result.error || '更新项目失败');
      }
    } catch (error) {
      throw error;
    }
  },

  /**
   * 删除项目
   */
  deleteProject: async (projectId: string) => {
    try {
      const result = await electronAPI().projectDelete(projectId);
      
      if (result.success) {
        // 从列表中移除
        const projects = get().projects.filter(p => p.id !== projectId);
        
        // 如果删除的是当前项目，关闭它
        if (get().currentProject?.id === projectId) {
          set({ 
            currentProject: null,
            projectStatus: 'closed' 
          });
        }
        
        set({ projects });
      } else {
        throw new Error(result.error || '删除项目失败');
      }
    } catch (error) {
      throw error;
    }
  },

  /**
   * 设置收藏状态
   */
  setFavorite: async (projectId: string, isFavorite: boolean) => {
    await get().updateProject(projectId, { isFavorite });
  },

  /**
   * 设置列表查询参数
   */
  setListParams: (params: Partial<ProjectListParams>) => {
    set({ listParams: { ...get().listParams, ...params } });
  },

  /**
   * 清除错误
   */
  clearErrors: () => {
    set({ 
      projectError: null,
      projectsError: null,
      createError: null
    });
  },
}));

export default useProjectStore;

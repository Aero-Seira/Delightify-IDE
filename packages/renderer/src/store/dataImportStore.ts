/**
 * Data Import Store - 数据导入状态管理
 * 
 * 管理从附属Mod导入数据的状态和流程
 */

import { create } from 'zustand';
import type { 
  ModDataImportProgress, 
  ModDataImportResult,
  DataImportHistory,
  ValidationResult,
} from '@delightify/shared';

interface DataImportState {
  // ========== 检测状态 ==========
  isDetecting: boolean;
  detectedFilePath: string | null;
  detectionError: string | null;

  // ========== 验证状态 ==========
  isValidating: boolean;
  validationResult: ValidationResult | null;
  validationError: string | null;

  // ========== 导入状态 ==========
  isImporting: boolean;
  importProgress: ModDataImportProgress | null;
  importResult: ModDataImportResult | null;
  importError: string | null;
  unsubscribeProgress: (() => void) | null;

  // ========== 导入历史 ==========
  importHistory: DataImportHistory[];
  isLoadingHistory: boolean;

  // ========== Actions ==========
  detectDataFile: (projectPath: string) => Promise<string | null>;
  validateDataFile: (filePath: string) => Promise<ValidationResult | null>;
  startImport: (projectPath: string, filePath?: string) => Promise<boolean>;
  loadImportHistory: (projectPath: string) => Promise<void>;
  resetState: () => void;
  clearErrors: () => void;
}

const electronAPI = () => {
  if (typeof window === 'undefined' || !window.electronAPI) {
    throw new Error('Electron API not available');
  }
  return window.electronAPI;
};

export const useDataImportStore = create<DataImportState>((set, get) => ({
  // ========== 初始状态 ==========
  isDetecting: false,
  detectedFilePath: null,
  detectionError: null,

  isValidating: false,
  validationResult: null,
  validationError: null,

  isImporting: false,
  importProgress: null,
  importResult: null,
  importError: null,
  unsubscribeProgress: null,

  importHistory: [],
  isLoadingHistory: false,

  // ========== Actions ==========

  /**
   * 检测数据文件
   */
  detectDataFile: async (projectPath: string) => {
    console.log('[DataImportStore] detectDataFile called with path:', projectPath);
    set({ isDetecting: true, detectionError: null, detectedFilePath: null });
    
    try {
      console.log('[DataImportStore] Calling electronAPI.modDataDetect...');
      const result = await electronAPI().modDataDetect(projectPath);
      console.log('[DataImportStore] modDataDetect result:', result);
      
      if (result.success && result.data) {
        set({ 
          detectedFilePath: result.data.filePath,
          isDetecting: false 
        });
        return result.data.filePath;
      } else {
        set({ 
          detectionError: result.error || '检测数据文件失败',
          isDetecting: false 
        });
        return null;
      }
    } catch (error) {
      console.error('[DataImportStore] detectDataFile error:', error);
      set({ 
        detectionError: error instanceof Error ? error.message : '检测数据文件失败',
        isDetecting: false 
      });
      return null;
    }
  },

  /**
   * 验证数据文件
   */
  validateDataFile: async (filePath: string) => {
    set({ isValidating: true, validationError: null, validationResult: null });
    
    try {
      const result = await electronAPI().modDataValidate(filePath);
      
      if (result.success && result.data) {
        set({ 
          validationResult: result.data,
          isValidating: false 
        });
        return result.data;
      } else {
        set({ 
          validationError: result.error || '验证数据文件失败',
          isValidating: false 
        });
        return null;
      }
    } catch (error) {
      set({ 
        validationError: error instanceof Error ? error.message : '验证数据文件失败',
        isValidating: false 
      });
      return null;
    }
  },

  /**
   * 开始导入
   */
  startImport: async (projectPath: string, filePath?: string) => {
    set({ 
      isImporting: true, 
      importError: null, 
      importResult: null,
      importProgress: null 
    });

    // 订阅进度更新
    const unsubscribe = electronAPI().onModDataImportProgress((progress: ModDataImportProgress) => {
      set({ importProgress: progress });
    });

    set({ unsubscribeProgress: unsubscribe });
    
    try {
      const result = await electronAPI().modDataImport(projectPath, filePath);
      
      // 取消订阅
      unsubscribe();
      set({ unsubscribeProgress: null });
      
      if (result.success && result.data) {
        set({ 
          importResult: result.data,
          isImporting: false 
        });
        return true;
      } else {
        set({ 
          importError: result.error || '导入数据失败',
          isImporting: false 
        });
        return false;
      }
    } catch (error) {
      unsubscribe();
      set({ unsubscribeProgress: null });
      set({ 
        importError: error instanceof Error ? error.message : '导入数据失败',
        isImporting: false 
      });
      return false;
    }
  },

  /**
   * 加载导入历史
   */
  loadImportHistory: async (projectPath: string) => {
    set({ isLoadingHistory: true });
    
    try {
      const result = await electronAPI().modDataGetImportHistory(projectPath);
      
      if (result.success && result.data) {
        set({ importHistory: result.data, isLoadingHistory: false });
      } else {
        set({ isLoadingHistory: false });
      }
    } catch (error) {
      console.error('加载导入历史失败:', error);
      set({ isLoadingHistory: false });
    }
  },

  /**
   * 重置状态
   */
  resetState: () => {
    const { unsubscribeProgress } = get();
    if (unsubscribeProgress) {
      unsubscribeProgress();
    }
    set({
      isDetecting: false,
      detectedFilePath: null,
      detectionError: null,
      isValidating: false,
      validationResult: null,
      validationError: null,
      isImporting: false,
      importProgress: null,
      importResult: null,
      importError: null,
      unsubscribeProgress: null,
    });
  },

  /**
   * 清除错误
   */
  clearErrors: () => {
    set({
      detectionError: null,
      validationError: null,
      importError: null,
    });
  },
}));

export default useDataImportStore;

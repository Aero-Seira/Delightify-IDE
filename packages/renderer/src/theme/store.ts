import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ThemeState, ThemeMode } from '@delightify/shared';

const STORAGE_KEY = 'delightify-theme';

// 获取系统主题偏好
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// 更新文档主题属性
const updateDocumentTheme = (resolvedMode: 'light' | 'dark') => {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', resolvedMode);
  }
};

// 计算实际应用的主题模式
const resolveThemeMode = (mode: ThemeMode): 'light' | 'dark' => {
  if (mode === 'system') {
    return getSystemTheme();
  }
  return mode;
};

// 监听系统主题变化
let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;

const setupSystemThemeListener = (callback: () => void) => {
  if (typeof window === 'undefined') return;

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  // 移除旧的监听器
  if (mediaQueryListener) {
    mediaQuery.removeEventListener('change', mediaQueryListener);
  }
  
  // 创建新的监听器
  mediaQueryListener = () => {
    callback();
  };
  
  mediaQuery.addEventListener('change', mediaQueryListener);
};

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      resolvedMode: 'light',

      setMode: (mode: ThemeMode) => {
        const resolvedMode = resolveThemeMode(mode);
        
        set({ mode, resolvedMode });
        updateDocumentTheme(resolvedMode);
        
        // 如果是 system 模式，设置系统主题监听
        if (mode === 'system') {
          setupSystemThemeListener(() => {
            const newResolvedMode = getSystemTheme();
            set({ resolvedMode: newResolvedMode });
            updateDocumentTheme(newResolvedMode);
          });
        } else if (mediaQueryListener) {
          // 移除系统主题监听
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          mediaQuery.removeEventListener('change', mediaQueryListener);
          mediaQueryListener = null;
        }
      },

      toggleMode: () => {
        const { mode, resolvedMode } = get();
        let newMode: ThemeMode;
        
        if (mode === 'system') {
          // 从 system 切换到明确的主题
          newMode = resolvedMode === 'light' ? 'dark' : 'light';
        } else {
          // 在 light 和 dark 之间切换
          newMode = mode === 'light' ? 'dark' : 'light';
        }
        
        get().setMode(newMode);
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ mode: state.mode }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // 恢复时重新解析并应用主题
          const resolvedMode = resolveThemeMode(state.mode);
          setTimeout(() => {
            updateDocumentTheme(resolvedMode);
            
            // 如果是 system 模式，设置监听
            if (state.mode === 'system') {
              setupSystemThemeListener(() => {
                const newResolvedMode = getSystemTheme();
                useTheme.setState({ resolvedMode: newResolvedMode });
                updateDocumentTheme(newResolvedMode);
              });
            }
          }, 0);
        }
      },
    }
  )
);

// 初始化主题（在应用启动时调用）
export const initializeTheme = () => {
  const state = useTheme.getState();
  const resolvedMode = resolveThemeMode(state.mode);
  
  useTheme.setState({ resolvedMode });
  updateDocumentTheme(resolvedMode);
  
  // 如果是 system 模式，设置监听
  if (state.mode === 'system') {
    setupSystemThemeListener(() => {
      const newResolvedMode = getSystemTheme();
      useTheme.setState({ resolvedMode: newResolvedMode });
      updateDocumentTheme(newResolvedMode);
    });
  }
};

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { I18nState, Language, TranslationData, TranslateFunction } from '@delightify/shared';
import zhCN from './locales/zh-CN';
import en from './locales/en';

const STORAGE_KEY = 'delightify-language';

const resources: Record<Language, TranslationData> = {
  'zh-CN': zhCN,
  'en': en,
};

const resolveLanguage = (lang: unknown): Language => {
  return lang === 'en' || lang === 'zh-CN' ? lang : 'zh-CN';
};

// 实现嵌套 key 的翻译函数（如 "common.loading"）
const createT = (data: TranslationData): TranslateFunction => {
  return (key: string, params?: Record<string, string>) => {
    // 支持点号访问嵌套属性
    const value = key.split('.').reduce((obj, k) => {
      if (obj && typeof obj === 'object') {
        return (obj as Record<string, unknown>)[k];
      }
      return undefined;
    }, data as unknown);

    let text = typeof value === 'string' ? value : key;

    // 替换参数 {{param}}
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
      });
    }

    return text;
  };
};

export const useI18n = create<I18nState>()(
  persist(
    (set) => ({
      currentLanguage: 'zh-CN', // 默认中文
      setLanguage: (lang: Language) => {
        set({
          currentLanguage: lang,
          t: createT(resources[lang]),
        });
      },
      t: createT(zhCN), // 初始中文
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ currentLanguage: state.currentLanguage }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<Pick<I18nState, 'currentLanguage'>>;
        const lang = resolveLanguage(persisted.currentLanguage);

        return {
          ...currentState,
          currentLanguage: lang,
          t: createT(resources[lang]),
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          // t 是函数，不能持久化；恢复语言后需要重建翻译函数。
          const lang = resolveLanguage(state.currentLanguage);
          useI18n.setState({
            currentLanguage: lang,
            t: createT(resources[lang]),
          });
        }
      },
    }
  )
);

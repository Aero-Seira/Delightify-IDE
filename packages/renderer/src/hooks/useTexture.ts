/**
 * 纹理加载 Hook - v2.1
 * 
 * 从 item_resources 表加载 base64 图像
 */

import { useState, useEffect, useCallback } from 'react';
import { electronAPI } from '../ipc';
import { useProjectStore } from '../store/projectStore';

interface TextureState {
  /** 纹理数据 (data URL) */
  data: string | null;
  /** 是否加载中 */
  loading: boolean;
  /** 是否出错 */
  error: boolean;
}

interface UseTextureOptions {
  /** 是否启用缓存 */
  enableCache?: boolean;
}

// 全局纹理缓存
const textureCache = new Map<string, string>();

/**
 * 使用纹理 Hook
 * 
 * @param itemId 物品ID
 * @param options 选项
 * @returns 纹理状态
 */
export function useTexture(
  itemId: string | null | undefined,
  options: UseTextureOptions = {}
): TextureState {
  const { enableCache = true } = options;
  const { currentProject } = useProjectStore();
  
  const [state, setState] = useState<TextureState>({
    data: null,
    loading: false,
    error: false,
  });

  const loadTexture = useCallback(async () => {
    if (!itemId || !currentProject) {
      setState({ data: null, loading: false, error: false });
      return;
    }

    // 检查缓存
    const cacheKey = `${currentProject.path}:${itemId}`;
    if (enableCache && textureCache.has(cacheKey)) {
      setState({
        data: textureCache.get(cacheKey)!,
        loading: false,
        error: false,
      });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: false }));

    try {
      const api = electronAPI();
      const result = await api.itemsGetTexture(currentProject.path, itemId);

      if (result.success && result.data) {
        const { base64, mimeType } = result.data;
        
        // 构建 data URL
        let dataUrl: string;
        if (base64.startsWith('data:')) {
          dataUrl = base64;
        } else {
          dataUrl = `data:${mimeType};base64,${base64}`;
        }

        // 存入缓存
        if (enableCache) {
          textureCache.set(cacheKey, dataUrl);
        }

        setState({
          data: dataUrl,
          loading: false,
          error: false,
        });
      } else {
        // 没有纹理数据
        setState({
          data: null,
          loading: false,
          error: true,
        });
      }
    } catch (err) {
      console.warn(`[useTexture] Failed to load texture for ${itemId}:`, err);
      setState({
        data: null,
        loading: false,
        error: true,
      });
    }
  }, [itemId, currentProject, enableCache]);

  useEffect(() => {
    loadTexture();
  }, [loadTexture]);

  return state;
}

/**
 * 批量预加载纹理
 * 
 * @param itemIds 物品ID数组
 */
export async function preloadTextures(itemIds: string[]): Promise<void> {
  // v2.1: 暂不支持批量预加载
  console.log('[useTexture] preloadTextures not implemented in v2.1');
}

/**
 * 清除纹理缓存
 */
export function clearTextureCache(): void {
  textureCache.clear();
}

/**
 * 获取缓存统计
 */
export function getTextureCacheStats(): { size: number; keys: string[] } {
  return {
    size: textureCache.size,
    keys: Array.from(textureCache.keys()),
  };
}

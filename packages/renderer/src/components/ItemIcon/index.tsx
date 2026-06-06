/**
 * 改进的物品图标组件 - v2.1
 * 
 * 特性：
 * 1. 使用 useTexture hook 进行智能纹理加载
 * 2. 材质缺失时显示物品ID文字（而非紫黑格子）
 * 3. 平滑的加载动画
 * 4. 支持像素完美渲染
 */

import React, { useMemo } from 'react';
import { useTexture } from '../../hooks/useTexture';
import styles from './style.module.css';

interface ItemIconProps {
  /** 物品ID */
  itemId: string;
  /** 显示名称（用于 fallback） */
  displayName?: string;
  /** 尺寸 */
  size?: number;
  /** 额外的 CSS 类 */
  className?: string;
  /** 是否启用缓存 */
  enableCache?: boolean;
  /** 是否显示调试信息（物品ID） */
  showDebug?: boolean;
}

/**
 * 生成稳定的颜色
 */
function useStableColor(itemId: string): string {
  return useMemo(() => {
    const colors = [
      '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
      '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
      '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
    ];
    let hash = 0;
    for (let i = 0; i < itemId.length; i++) {
      hash = itemId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }, [itemId]);
}

/**
 * 获取显示文本（简短版本）
 */
function useDisplayText(itemId: string, displayName?: string): { text: string; fullId: string } {
  return useMemo(() => {
    const fullId = displayName || itemId;
    
    // 如果是 tag: 前缀，显示标签名
    if (itemId.startsWith('tag:')) {
      const tagName = itemId.slice(4).split(':').pop() || '?';
      return { text: `#${tagName.substring(0, 3)}`, fullId };
    }
    
    // 获取物品名（去掉命名空间）
    const parts = fullId.split(':');
    const name = parts[1] || parts[0] || '?';
    
    // 取前3个字符
    const shortName = name.substring(0, 3).toUpperCase();
    
    return { text: shortName, fullId };
  }, [itemId, displayName]);
}

export default function ItemIcon({
  itemId,
  displayName,
  size = 32,
  className = '',
  enableCache = true,
  showDebug = false,
}: ItemIconProps): React.ReactElement {
  const { data, loading, error } = useTexture(itemId, { enableCache });
  const color = useStableColor(itemId);
  const { text, fullId } = useDisplayText(itemId, displayName);

  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    backgroundColor: error || !data ? `${color}20` : undefined,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  // 加载状态
  if (loading) {
    return (
      <div
        className={`${styles.container} ${styles.loading} ${className}`}
        style={containerStyle}
        title={fullId}
      >
        <div 
          className={styles.skeleton}
          style={{ width: size * 0.7, height: size * 0.7 }}
        />
      </div>
    );
  }

  // 错误/缺失状态 - 显示彩色背景 + 文字
  if (error || !data) {
    const fontSize = Math.min(size * 0.35, 10);
    
    return (
      <div
        className={`${styles.container} ${styles.fallback} ${className}`}
        style={{
          ...containerStyle,
          backgroundColor: `${color}30`,
          border: `1px solid ${color}50`,
        }}
        title={fullId}
      >
        <span
          style={{
            fontSize,
            fontWeight: 600,
            color: color,
            lineHeight: 1,
            textAlign: 'center',
            wordBreak: 'break-all',
            padding: 2,
          }}
        >
          {text}
        </span>
        {showDebug && (
          <span
            style={{
              position: 'absolute',
              bottom: 0,
              right: 2,
              fontSize: 6,
              color: color,
              opacity: 0.7,
            }}
          >
            ?
          </span>
        )}
      </div>
    );
  }

  // 正常显示纹理
  return (
    <div
      className={`${styles.container} ${className}`}
      style={containerStyle}
      title={fullId}
    >
      <img
        src={data}
        alt={fullId}
        className={styles.texture}
        style={{
          width: size,
          height: size,
          imageRendering: 'pixelated',
        }}
        draggable={false}
      />
    </div>
  );
}

/**
 * 小型图标变体
 */
export function ItemIconSmall(props: Omit<ItemIconProps, 'size'>): React.ReactElement {
  return <ItemIcon {...props} size={16} />;
}

/**
 * 中型图标变体
 */
export function ItemIconMedium(props: Omit<ItemIconProps, 'size'>): React.ReactElement {
  return <ItemIcon {...props} size={32} />;
}

/**
 * 大型图标变体
 */
export function ItemIconLarge(props: Omit<ItemIconProps, 'size'>): React.ReactElement {
  return <ItemIcon {...props} size={64} />;
}

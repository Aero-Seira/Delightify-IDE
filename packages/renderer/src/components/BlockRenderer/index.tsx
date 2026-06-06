import React, { useState } from 'react';
import styles from './style.module.css';

interface BlockRendererProps {
  textureUrl: string;
  size?: number;
  fallbackChar?: string;
  onError?: () => void;
}

/**
 * 3D 等距方块渲染器
 * 
 * 使用 CSS 3D 变换渲染方块的三个面（顶、左、右）
 * 参考 Minecraft 物品栏中的方块显示效果
 */
export function BlockRenderer3D({
  textureUrl,
  size = 64,
  fallbackChar = '?',
  onError,
}: BlockRendererProps): React.ReactElement {
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  if (hasError) {
    return (
      <div
        className={styles.fallback}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {fallbackChar}
      </div>
    );
  }

  // 面的尺寸（缩放因子）
  const faceSize = size * 0.55;
  const offset = faceSize / 2;

  return (
    <div 
      className={styles.block3d} 
      style={{ width: size, height: size }}
    >
      <div 
        className={styles.cube}
        style={{
          width: faceSize,
          height: faceSize,
          transform: `rotateX(60deg) rotateZ(45deg)`,
        }}
      >
        {/* 顶面 - 最亮 */}
        <div 
          className={`${styles.face} ${styles.faceTop}`}
          style={{
            width: faceSize,
            height: faceSize,
            transform: `translateZ(${offset}px)`,
          }}
        >
          <img 
            src={textureUrl} 
            alt=""
            width={faceSize}
            height={faceSize}
            onError={handleError}
            style={{ 
              filter: 'brightness(0.95)',
              imageRendering: 'pixelated',
            }}
          />
        </div>
        
        {/* 左面 - 中等亮度 */}
        <div 
          className={`${styles.face} ${styles.faceLeft}`}
          style={{
            width: faceSize,
            height: faceSize,
            transform: `rotateY(-90deg) translateZ(${offset}px)`,
          }}
        >
          <img 
            src={textureUrl} 
            alt=""
            width={faceSize}
            height={faceSize}
            onError={handleError}
            style={{ 
              filter: 'brightness(0.7)',
              imageRendering: 'pixelated',
            }}
          />
        </div>
        
        {/* 右面 - 最暗 */}
        <div 
          className={`${styles.face} ${styles.faceRight}`}
          style={{
            width: faceSize,
            height: faceSize,
            transform: `rotateX(90deg) translateZ(${offset}px)`,
          }}
        >
          <img 
            src={textureUrl} 
            alt=""
            width={faceSize}
            height={faceSize}
            onError={handleError}
            style={{ 
              filter: 'brightness(0.5)',
              imageRendering: 'pixelated',
            }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * 2D 平面方块渲染器
 * 仅显示正面纹理，性能更好
 */
export function BlockRenderer2D({
  textureUrl,
  size = 64,
  fallbackChar = '?',
  onError,
}: BlockRendererProps): React.ReactElement {
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  if (hasError) {
    return (
      <div
        className={styles.fallback}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {fallbackChar}
      </div>
    );
  }

  return (
    <div
      className={styles.block2d}
      style={{ width: size, height: size }}
    >
      <img
        src={textureUrl}
        alt=""
        width={size}
        height={size}
        onError={handleError}
        className={styles.texture2d}
      />
    </div>
  );
}

/**
 * 通用方块渲染器
 * 根据 mode 自动选择 3D 或 2D 渲染
 */
interface UniversalBlockRendererProps extends BlockRendererProps {
  mode?: '3d' | '2d';
}

export default function BlockRenderer({
  mode = '2d',
  ...props
}: UniversalBlockRendererProps): React.ReactElement {
  if (mode === '3d') {
    return <BlockRenderer3D {...props} />;
  }
  return <BlockRenderer2D {...props} />;
}

/**
 * 改进的物品卡片组件 - v2.3
 * 
 * 四种视图模式 + 多选支持 + 双击复制
 */

import React from 'react';
import type { Item } from '@delightify/shared';
import ItemIcon from '../ItemIcon';
import styles from './style.module.css';

interface ItemCardProps {
  item: Item;
  size?: number;
  selected?: boolean;
  isMultiSelected?: boolean;
  isMultiSelectMode?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

/**
 * 从 itemId 解析显示名称
 * 例如: "minecraft:stone" -> "stone"
 */
function getItemName(itemId: string): string {
  const parts = itemId.split(':');
  return parts[1] || parts[0] || itemId;
}

/**
 * 格式化显示名称（首字母大写，下划线替换为空格）
 */
function formatDisplayName(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * 物品卡片组件 - 网格视图
 */
export default function ItemCard({
  item,
  size = 64,
  selected = false,
  isMultiSelected = false,
  isMultiSelectMode = false,
  onClick,
  onDoubleClick,
}: ItemCardProps): React.ReactElement {
  const itemName = getItemName(item.itemId);
  const displayName = item.displayName || formatDisplayName(itemName);
  
  // 多选模式下优先使用多选状态
  const isActive = isMultiSelectMode ? isMultiSelected : selected;

  return (
    <div
      className={`${styles.card} ${isActive ? styles.selected : ''} ${isMultiSelectMode ? styles.multiSelect : ''}`}
      onClick={onClick}
    >
      {/* 多选复选框 */}
      {isMultiSelectMode && (
        <div className={styles.checkbox}>
          <input 
            type="checkbox" 
            checked={isMultiSelected} 
            readOnly 
            tabIndex={-1}
          />
        </div>
      )}
      
      <div 
        className={styles.imageContainer} 
        style={{ width: size, height: size }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClick?.();
        }}
        title="双击复制ID"
      >
        <ItemIcon
          itemId={item.itemId}
          displayName={displayName}
          size={size}
        />
      </div>
      
      <div className={styles.info}>
        <span className={styles.name} title={displayName}>
          {displayName}
        </span>
        <span className={styles.meta} title={item.itemId}>
          {item.itemId}
        </span>
      </div>
    </div>
  );
}

/**
 * 紧凑行组件 - 介于网格和列表之间
 */
export function ItemCompactRow({
  item,
  selected = false,
  isMultiSelected = false,
  isMultiSelectMode = false,
  onClick,
  onDoubleClick,
}: Omit<ItemCardProps, 'size'>): React.ReactElement {
  const itemName = getItemName(item.itemId);
  const displayName = item.displayName || formatDisplayName(itemName);
  const modName = item.modid;
  
  const isActive = isMultiSelectMode ? isMultiSelected : selected;

  return (
    <div
      className={`${styles.compactRow} ${isActive ? styles.selected : ''} ${isMultiSelectMode ? styles.multiSelect : ''}`}
      onClick={onClick}
    >
      {/* 多选复选框 */}
      {isMultiSelectMode && (
        <div className={styles.checkboxSmall}>
          <input 
            type="checkbox" 
            checked={isMultiSelected} 
            readOnly 
            tabIndex={-1}
          />
        </div>
      )}
      
      <div 
        className={styles.compactImage}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClick?.();
        }}
        title="双击复制ID"
      >
        <ItemIcon
          itemId={item.itemId}
          displayName={displayName}
          size={40}
        />
      </div>
      
      <div className={styles.compactInfo}>
        <span className={styles.compactName} title={displayName}>
          {displayName}
        </span>
        <span className={styles.compactId} title={item.itemId}>
          {item.itemId}
        </span>
        <span className={styles.compactMod} title={modName}>
          {modName}
        </span>
      </div>
    </div>
  );
}

/**
 * 详细列表行组件 - 单行显示完整信息
 */
export function ItemListRow({
  item,
  selected = false,
  isMultiSelected = false,
  isMultiSelectMode = false,
  onClick,
  onDoubleClick,
}: Omit<ItemCardProps, 'size'>): React.ReactElement {
  const itemName = getItemName(item.itemId);
  const displayName = item.displayName || formatDisplayName(itemName);
  
  const isActive = isMultiSelectMode ? isMultiSelected : selected;

  return (
    <div
      className={`${styles.listRow} ${isActive ? styles.selected : ''} ${isMultiSelectMode ? styles.multiSelect : ''}`}
      onClick={onClick}
    >
      {/* 多选复选框 */}
      {isMultiSelectMode && (
        <div className={styles.checkboxSmall}>
          <input 
            type="checkbox" 
            checked={isMultiSelected} 
            readOnly 
            tabIndex={-1}
          />
        </div>
      )}
      
      <div 
        className={styles.listImage}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClick?.();
        }}
        title="双击复制ID"
      >
        <ItemIcon
          itemId={item.itemId}
          displayName={displayName}
          size={24}
        />
      </div>
      
      <div className={styles.listInfo}>
        <span className={styles.listName} title={displayName}>
          {displayName}
        </span>
        <code className={styles.listId} title={item.itemId}>
          {item.itemId}
        </code>
        <span className={styles.listMod} title={item.modid}>
          {item.modid}
        </span>
      </div>

      <div className={styles.listMeta}>
        <span className={styles.listType}>物品</span>
      </div>
    </div>
  );
}

/**
 * 物品详情卡片
 */
export function ItemDetailCard({
  item,
}: {
  item: Item;
}): React.ReactElement {
  const size = 128;
  const itemName = getItemName(item.itemId);
  const displayName = item.displayName || formatDisplayName(itemName);

  return (
    <div className={styles.detailCard}>
      <div className={styles.detailImageContainer}>
        <ItemIcon
          itemId={item.itemId}
          displayName={displayName}
          size={size}
        />
      </div>
      
      <div className={styles.detailInfo}>
        <h3 className={styles.detailName}>{displayName}</h3>
        <p className={styles.detailId}>{item.itemId}</p>
        <p className={styles.detailMod}>模组: {item.modid}</p>
      </div>
    </div>
  );
}

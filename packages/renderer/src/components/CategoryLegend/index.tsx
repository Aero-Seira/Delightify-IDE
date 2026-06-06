import React, { useState } from 'react';
import styles from './style.module.css';

export type ItemCategory = 'food' | 'tool' | 'weapon' | 'armor' | 'block' | 'material' | 'misc';

interface CategoryInfo {
  id: ItemCategory;
  name: string;
  color: string;
  description: string;
}

const CATEGORIES: CategoryInfo[] = [
  { id: 'food', name: '食物', color: '#ff6b6b', description: '可食用的物品' },
  { id: 'tool', name: '工具', color: '#4dabf7', description: '工具和器械' },
  { id: 'weapon', name: '武器', color: '#fa5252', description: '武器和战斗装备' },
  { id: 'armor', name: '护甲', color: '#7950f2', description: '防具和护甲' },
  { id: 'block', name: '方块', color: '#82c91e', description: '可放置的方块' },
  { id: 'material', name: '材料', color: '#fab005', description: '原材料和合成材料' },
  { id: 'misc', name: '杂项', color: '#adb5bd', description: '其他物品' },
];

interface CategoryLegendProps {
  compact?: boolean;
  onCategoryClick?: (category: ItemCategory | null) => void;
  selectedCategory?: ItemCategory | null;
}

/**
 * 类别图例组件
 * 显示不同颜色圆点代表的物品类别
 */
export default function CategoryLegend({
  compact = false,
  onCategoryClick,
  selectedCategory,
}: CategoryLegendProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCategoryClick = (categoryId: ItemCategory) => {
    if (onCategoryClick) {
      // 如果点击已选中的类别，则取消选择
      onCategoryClick(selectedCategory === categoryId ? null : categoryId);
    }
  };

  // 紧凑模式 - 只显示一个小按钮，点击展开
  if (compact) {
    return (
      <div className={styles.compactContainer}>
        <button
          className={`${styles.legendToggle} ${isExpanded ? styles.active : ''}`}
          onClick={() => setIsExpanded(!isExpanded)}
          title="类别图例"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" fill="currentColor" />
          </svg>
          <span>类别</span>
        </button>

        {isExpanded && (
          <div className={styles.dropdown}>
            <div className={styles.dropdownHeader}>
              <span>点击筛选类别</span>
              {selectedCategory && (
                <button
                  className={styles.clearBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCategoryClick?.(null);
                  }}
                >
                  清除
                </button>
              )}
            </div>
            <div className={styles.dropdownList}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  className={`${styles.dropdownItem} ${selectedCategory === cat.id ? styles.selected : ''}`}
                  onClick={() => handleCategoryClick(cat.id)}
                >
                  <span
                    className={styles.dot}
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className={styles.name}>{cat.name}</span>
                  <span className={styles.desc}>{cat.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 完整模式 - 显示所有类别
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>类别图例</span>
        {selectedCategory && (
          <button
            className={styles.clearBtn}
            onClick={() => onCategoryClick?.(null)}
          >
            清除筛选
          </button>
        )}
      </div>
      <div className={styles.grid}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`${styles.item} ${selectedCategory === cat.id ? styles.selected : ''}`}
            onClick={() => handleCategoryClick(cat.id)}
            title={cat.description}
          >
            <span
              className={styles.dot}
              style={{ backgroundColor: cat.color }}
            />
            <span className={styles.name}>{cat.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * 内联类别标签
 * 用于在物品卡片等位置显示单个类别
 */
export function CategoryTag({
  category,
  size = 'small',
}: {
  category: ItemCategory;
  size?: 'small' | 'medium';
}): React.ReactElement {
  const catInfo = CATEGORIES.find((c) => c.id === category);
  if (!catInfo) return <></>;

  return (
    <span
      className={`${styles.tag} ${size === 'medium' ? styles.medium : ''}`}
      style={{ backgroundColor: `${catInfo.color}20`, color: catInfo.color }}
    >
      <span
        className={styles.tagDot}
        style={{ backgroundColor: catInfo.color }}
      />
      {catInfo.name}
    </span>
  );
}

/**
 * 类别筛选栏
 * 横向排列的类别按钮，用于快速筛选
 */
export function CategoryFilterBar({
  selectedCategory,
  onSelect,
}: {
  selectedCategory: ItemCategory | null;
  onSelect: (category: ItemCategory | null) => void;
}): React.ReactElement {
  return (
    <div className={styles.filterBar}>
      <button
        className={`${styles.filterBtn} ${selectedCategory === null ? styles.active : ''}`}
        onClick={() => onSelect(null)}
      >
        全部
      </button>
      {CATEGORIES.map((cat) => (
        <button
          key={cat.id}
          className={`${styles.filterBtn} ${selectedCategory === cat.id ? styles.active : ''}`}
          onClick={() => onSelect(cat.id)}
        >
          <span
            className={styles.filterDot}
            style={{ backgroundColor: cat.color }}
          />
          {cat.name}
        </button>
      ))}
    </div>
  );
}

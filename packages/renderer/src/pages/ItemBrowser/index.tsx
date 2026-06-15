import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Item, SearchField } from '@delightify/shared';
import ItemCard, { ItemListRow, ItemCompactRow, ItemDetailCard } from '../../components/ItemCard';
import CategoryLegend from '../../components/CategoryLegend';
import SearchableSelect from '../../components/SearchableSelect';
import ErrorBoundary from '../../components/ErrorBoundary';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import { electronAPI } from '../../ipc';
import { useProjectStore } from '../../store/projectStore';
import styles from './style.module.css';

interface QueryFilters {
  search: string;
  searchField: SearchField;
  modId: string;
  tag: string;
}

const SEARCH_FIELD_OPTIONS: { value: SearchField; label: string; icon: string }[] = [
  { value: 'all', label: '全部', icon: '🔍' },
  { value: 'id', label: 'ID', icon: '🆔' },
  { value: 'name', label: '名称', icon: '📝' },
  { value: 'tag', label: '标签', icon: '🏷️' },
];

const ITEMS_PER_PAGE_OPTIONS = [20, 50, 100, 200];
const VIEW_MODES = ['grid', 'compact', 'list', 'detail'] as const;
type ViewMode = typeof VIEW_MODES[number];

export default function ItemBrowser(): React.ReactElement {
  const { currentProject } = useProjectStore();
  
  // 数据状态
  const [items, setItems] = useState<Item[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  // 过滤状态
  const [filters, setFilters] = useState<QueryFilters>({
    search: '',
    searchField: 'all',
    modId: '',
    tag: '',
  });
  const [lang, setLang] = useState('zh_cn');
  
  // 视图状态
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [itemSize, setItemSize] = useState(64);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  
  // 多选状态
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showSelectedPanel, setShowSelectedPanel] = useState(false);
  
  // 可用选项
  const [mods, setMods] = useState<Array<{ modid: string; name?: string }>>([]);
  const [tags, setTags] = useState<Array<{ tagId: string; itemCount: number }>>([]);

  // 加载物品数据
  const loadItems = useCallback(async () => {
    if (!currentProject) {
      setError('请先打开一个项目');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const api = electronAPI();
      const response = await api.itemsQuery(currentProject.path, {
        page: currentPage,
        pageSize,
        lang,
        search: filters.search || undefined,
        searchField: filters.searchField,
        modid: filters.modId || undefined,
        tagId: filters.tag || undefined,
      });
      
      if (response.success && response.data) {
        setItems(response.data.items);
        setTotalCount(response.data.total);
      } else {
        setError(response.error || '加载失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [currentProject, currentPage, pageSize, filters, lang]);

  // 加载可用选项
  const loadOptions = useCallback(async () => {
    if (!currentProject) return;
    
    try {
      const api = electronAPI();
      const [modsResult, tagsResult] = await Promise.all([
        api.modsQuery(currentProject.path),
        api.tagsQuery(currentProject.path),
      ]);
      
      if (modsResult.success && modsResult.data) {
        setMods(modsResult.data);
      }
      
      if (tagsResult.success && tagsResult.data) {
        setTags(tagsResult.data);
      }
    } catch {
      // 静默失败，不影响主功能
    }
  }, [currentProject]);

  // 存储计算出的数量
  const [modCounts, setModCounts] = useState<Map<string, number>>(new Map());
  const [tagCounts, setTagCounts] = useState<Map<string, number>>(new Map());
  
  // 使用 ref 存储待处理的更新，用于防抖
  const updateCountsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 计算模组在当前搜索条件下的匹配数量（排除模组筛选本身）
  const updateModCounts = useCallback(async () => {
    if (!currentProject || mods.length === 0) return;
    
    const counts = new Map<string, number>();
    
    try {
      const api = electronAPI();
      
      // 分批处理，每批10个，减少并发压力
      const batchSize = 10;
      for (let i = 0; i < mods.length; i += batchSize) {
        const batch = mods.slice(i, i + batchSize);
        await Promise.all(batch.map(async (mod) => {
          const response = await api.itemsQuery(currentProject.path, {
            page: 1,
            pageSize: 1,
            lang,
            search: filters.search || undefined,
            searchField: filters.searchField,
            modid: mod.modid,
            tagId: filters.tag || undefined,
          });
          
          if (response.success && response.data) {
            counts.set(mod.modid, response.data.total);
          }
        }));
      }
      
      setModCounts(counts);
    } catch {
      // 静默失败
    }
  }, [currentProject, filters.search, filters.searchField, filters.tag, lang, mods]);

  // 计算标签在当前搜索条件下的匹配数量（排除标签筛选本身）
  const updateTagCounts = useCallback(async () => {
    if (!currentProject || tags.length === 0) return;
    
    const counts = new Map<string, number>();
    
    try {
      const api = electronAPI();
      
      // 分批处理，每批10个
      const batchSize = 10;
      for (let i = 0; i < tags.length; i += batchSize) {
        const batch = tags.slice(i, i + batchSize);
        await Promise.all(batch.map(async (tag) => {
          const response = await api.itemsQuery(currentProject.path, {
            page: 1,
            pageSize: 1,
            lang,
            search: filters.search || undefined,
            searchField: filters.searchField,
            modid: filters.modId || undefined,
            tagId: tag.tagId,
          });
          
          if (response.success && response.data) {
            counts.set(tag.tagId, response.data.total);
          }
        }));
      }
      
      setTagCounts(counts);
    } catch {
      // 静默失败
    }
  }, [currentProject, filters.search, filters.searchField, filters.modId, lang, tags]);

  // 当筛选条件变化时重新计算数量（防抖）
  useEffect(() => {
    // 清除之前的定时器
    if (updateCountsTimeoutRef.current) {
      clearTimeout(updateCountsTimeoutRef.current);
    }
    
    // 延迟500ms后更新，避免频繁请求
    updateCountsTimeoutRef.current = setTimeout(() => {
      updateModCounts();
      updateTagCounts();
    }, 500);
    
    return () => {
      if (updateCountsTimeoutRef.current) {
        clearTimeout(updateCountsTimeoutRef.current);
      }
    };
  }, [updateModCounts, updateTagCounts]);

  // 初始化加载
  useEffect(() => {
    loadItems();
    loadOptions();
  }, [loadItems, loadOptions]);

  // 从 localStorage 恢复设置
  useEffect(() => {
    const savedViewMode = localStorage.getItem('itemBrowser.viewMode') as ViewMode | null;
    const savedItemSize = localStorage.getItem('itemBrowser.itemSize');
    
    if (savedViewMode && VIEW_MODES.includes(savedViewMode)) setViewMode(savedViewMode);
    if (savedItemSize) setItemSize(parseInt(savedItemSize, 10));
  }, []);

  // 保存设置到 localStorage
  useEffect(() => {
    localStorage.setItem('itemBrowser.viewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('itemBrowser.itemSize', itemSize.toString());
  }, [itemSize]);

  // 计算总页数
  const totalPages = useMemo(() => Math.ceil(totalCount / pageSize), [totalCount, pageSize]);

  // 过滤条件改变时重置到第一页
  const updateFilter = (key: keyof QueryFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  // 清除所有过滤
  const clearFilters = () => {
    setFilters({
      search: '',
      searchField: 'all',
      modId: '',
      tag: '',
    });
    setCurrentPage(1);
  };

  // 获取当前搜索字段的显示文本
  const currentSearchFieldLabel = SEARCH_FIELD_OPTIONS.find(opt => opt.value === filters.searchField)?.label || '全部';

  // ========== 多选功能 ==========
  
  // 切换多选模式
  const toggleMultiSelectMode = () => {
    setIsMultiSelectMode(prev => !prev);
    if (isMultiSelectMode) {
      // 退出多选模式时清空选择
      setSelectedItems(new Set());
    }
  };
  
  // 切换单个物品的选中状态
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };
  
  // 全选当前页
  const selectAllOnPage = () => {
    const allIds = items.map(item => item.itemId);
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      allIds.forEach(id => newSet.add(id));
      return newSet;
    });
  };
  
  // 清空选择
  const clearSelection = () => {
    setSelectedItems(new Set());
  };
  
  // 生成JSON列表
  const generateJSON = () => {
    const list = Array.from(selectedItems);
    const json = JSON.stringify(list, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      alert(`已复制 ${list.length} 个物品ID到剪贴板`);
    }).catch(() => {
      // 降级方案
      const textarea = document.createElement('textarea');
      textarea.value = json;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert(`已复制 ${list.length} 个物品ID到剪贴板`);
    });
  };
  
  // 复制单个ID
  const copyItemId = (itemId: string) => {
    navigator.clipboard.writeText(itemId).then(() => {
      // 可以显示一个轻量提示
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = itemId;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    });
  };

  // 渲染物品卡片
  const renderItem = (item: Item) => {
    // 使用 itemId 作为唯一标识
    const itemKey = item.itemId;
    const isSingleSelected = selectedItem?.itemId === item.itemId;
    const isMultiSelected = selectedItems.has(item.itemId);
    
    // 确保 item 有必要的字段
    if (!item.itemId) {
      console.warn('Item missing itemId:', item);
      return null;
    }
    
    // 处理点击 - 多选模式或单选模式
    const handleClick = () => {
      if (isMultiSelectMode) {
        toggleItemSelection(item.itemId);
      } else {
        setSelectedItem(item);
      }
    };
    
    // 处理双击图标 - 复制ID
    const handleDoubleClick = () => {
      copyItemId(item.itemId);
    };
    
    switch (viewMode) {
      case 'list':
        return (
          <ItemListRow
            key={itemKey}
            item={item}
            selected={isSingleSelected}
            isMultiSelected={isMultiSelected}
            isMultiSelectMode={isMultiSelectMode}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
          />
        );
      case 'compact':
        return (
          <ItemCompactRow
            key={itemKey}
            item={item}
            selected={isSingleSelected}
            isMultiSelected={isMultiSelected}
            isMultiSelectMode={isMultiSelectMode}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
          />
        );
      case 'detail':
        if (isSingleSelected) {
          return (
            <div key={itemKey} className={styles.detailItemWrapper}>
              <ItemDetailCard item={item} />
            </div>
          );
        }
        return (
          <ItemListRow
            key={itemKey}
            item={item}
            selected={isSingleSelected}
            isMultiSelected={isMultiSelected}
            isMultiSelectMode={isMultiSelectMode}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
          />
        );
      default: // grid
        return (
          <ItemCard
            key={itemKey}
            item={item}
            size={itemSize}
            selected={isSingleSelected}
            isMultiSelected={isMultiSelected}
            isMultiSelectMode={isMultiSelectMode}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
          />
        );
    }
  };

  // 检查是否有过滤条件
  const hasFilters = filters.search || filters.modId || filters.tag;

  // 如果没有项目，显示提示
  if (!currentProject) {
    return (
      <div className={styles.container}>
        <EmptyState
          icon={(
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" />
            </svg>
          )}
          title="请先打开一个项目"
          description="需要先打开一个整合包项目才能浏览物品"
        />
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <div className={styles.container}>
      {/* 工具栏 - 使用 Flexbox 重新布局 */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          {/* 专业搜索栏 */}
          <div className={`${styles.searchBar} ${searchFocused ? styles.focused : ''}`}>
            {/* 搜索字段选择器 */}
            <div className={styles.searchFieldSelector}>
              <select
                value={filters.searchField}
                onChange={(e) => updateFilter('searchField', e.target.value as SearchField)}
                title="选择搜索字段"
              >
                {SEARCH_FIELD_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.icon} {opt.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* 分隔线 */}
            <div className={styles.searchDivider} />
            
            {/* 搜索输入框 */}
            <div className={styles.searchInputWrapper}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder={
                  filters.searchField === 'id' ? '搜索物品ID...' :
                  filters.searchField === 'name' ? '搜索显示名称...' :
                  filters.searchField === 'tag' ? '搜索标签ID...' :
                  '搜索ID、名称或标签...'
                }
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              {filters.search && (
                <button 
                  className={styles.clearSearch}
                  onClick={() => updateFilter('search', '')}
                  title="清除搜索"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* 模组筛选 - 可搜索 */}
          <SearchableSelect
            value={filters.modId}
            options={[
              { value: '', label: '所有模组', count: totalCount },
              ...mods.map(mod => ({
                value: mod.modid,
                label: mod.name || mod.modid,
                description: mod.name ? mod.modid : undefined,
                count: modCounts.get(mod.modid) ?? 0,
              })),
            ]}
            placeholder="📦 所有模组"
            onChange={(value) => updateFilter('modId', value)}
            className={styles.filterSelect}
            title="筛选模组"
            hideEmpty={true}
          />

          {/* 标签筛选 - 可搜索 */}
          <SearchableSelect
            value={filters.tag}
            options={[
              { value: '', label: '所有标签', count: totalCount },
              ...tags.map(tag => ({
                value: tag.tagId,
                label: tag.tagId,
                description: `${tag.itemCount} 个物品`,
                count: tagCounts.get(tag.tagId) ?? 0,
              })),
            ]}
            placeholder="🏷️ 所有标签"
            onChange={(value) => updateFilter('tag', value)}
            className={styles.filterSelect}
            title="筛选标签"
            hideEmpty={true}
          />

          <select
            className={styles.languageSelect}
            value={lang}
            onChange={(e) => {
              setLang(e.target.value);
              setCurrentPage(1);
            }}
            title="显示语言"
          >
            <option value="zh_cn">简体中文</option>
            <option value="en_us">English</option>
          </select>

          {/* 清除过滤按钮 */}
          {hasFilters && (
            <button
              className={styles.clearFiltersBtn}
              onClick={clearFilters}
              title="清除所有过滤"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              清除
            </button>
          )}
        </div>

        <div className={styles.toolbarRight}>
          {/* 视图模式切换 */}
          <div className={styles.viewModeToggle}>
            {VIEW_MODES.map(mode => (
              <button
                key={mode}
                className={`${styles.viewModeBtn} ${viewMode === mode ? styles.active : ''}`}
                onClick={() => setViewMode(mode)}
                title={
                  mode === 'grid' ? '网格视图' : 
                  mode === 'compact' ? '紧凑视图' : 
                  mode === 'list' ? '列表视图' : 
                  '详情视图'
                }
              >
                {mode === 'grid' && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z"/>
                  </svg>
                )}
                {mode === 'compact' && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 5h6v4H3V5zm0 6h6v4H3v-4zm0 6h6v4H3v-4zm9-12h6v4h-6V5zm0 6h6v4h-6v-4zm0 6h6v4h-6v-4z"/>
                  </svg>
                )}
                {mode === 'list' && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z"/>
                  </svg>
                )}
                {mode === 'detail' && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 4h18v2H3V4zm0 7h12v2H3v-2zm0 7h18v2H3v-2z"/>
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* 图标大小切换 */}
          <div className={styles.sizeToggle}>
            {[32, 48, 64].map(size => (
              <button
                key={size}
                className={`${styles.sizeBtn} ${itemSize === size ? styles.active : ''}`}
                onClick={() => setItemSize(size)}
                title={`${size}px`}
              >
                {size}
              </button>
            ))}
          </div>

          {/* 类别图例 */}
          <CategoryLegend compact />
          
          {/* 多选模式切换 */}
          <button
            className={`${styles.multiSelectBtn} ${isMultiSelectMode ? styles.active : ''}`}
            onClick={toggleMultiSelectMode}
            title={isMultiSelectMode ? '退出多选' : '多选模式'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="6" height="6" rx="1" />
              <rect x="15" y="3" width="6" height="6" rx="1" />
              <rect x="3" y="15" width="6" height="6" rx="1" />
              <rect x="15" y="15" width="6" height="6" rx="1" />
            </svg>
            {isMultiSelectMode && <span>{selectedItems.size}</span>}
          </button>
        </div>
      </div>
      
      {/* 多选工具栏 */}
      {isMultiSelectMode && (
        <div className={styles.multiSelectToolbar}>
          <div className={styles.multiSelectLeft}>
            <span className={styles.selectedCount}>
              已选择 <strong>{selectedItems.size}</strong> 个物品
            </span>
            <button className={styles.actionBtn} onClick={selectAllOnPage}>
              全选本页
            </button>
            <button className={styles.actionBtn} onClick={clearSelection}>
              清空
            </button>
          </div>
          <div className={styles.multiSelectRight}>
            <button 
              className={`${styles.actionBtn} ${styles.primary}`} 
              onClick={generateJSON}
              disabled={selectedItems.size === 0}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              复制ID列表 (JSON)
            </button>
            <button 
              className={styles.actionBtn}
              onClick={() => setShowSelectedPanel(!showSelectedPanel)}
            >
              {showSelectedPanel ? '隐藏' : '显示'}已选列表
            </button>
          </div>
        </div>
      )}

      {/* 结果统计 */}
      <div className={styles.stats}>
        <span className={styles.count}>共 {totalCount.toLocaleString()} 个物品</span>
        {filters.search && (
          <span className={styles.filterTag}>
            {SEARCH_FIELD_OPTIONS.find(o => o.value === filters.searchField)?.label}:
            <strong>{filters.search}</strong>
            <button onClick={() => updateFilter('search', '')}>×</button>
          </span>
        )}
        {filters.modId && (
          <span className={styles.filterTag}>
            模组: <strong>{filters.modId}</strong>
            <button onClick={() => updateFilter('modId', '')}>×</button>
          </span>
        )}
        {filters.tag && (
          <span className={styles.filterTag}>
            标签: <strong>{filters.tag}</strong>
            <button onClick={() => updateFilter('tag', '')}>×</button>
          </span>
        )}
      </div>

      {/* 物品列表 */}
      <div className={`${styles.content} ${styles[viewMode]}`}>
        {isLoading ? (
          <LoadingState label="加载中..." />
        ) : error ? (
          <ErrorState message={`加载失败: ${error}`} onRetry={loadItems} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={(
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            )}
            title={
              mods.length === 0
                ? '还没有导入任何数据'
                : hasFilters
                  ? '没有找到匹配的物品'
                  : '该项目没有包含任何物品'
            }
            description={mods.length === 0 ? '请先前往「数据导入」导入数据' : undefined}
          >
            {mods.length > 0 && hasFilters && (
              <button onClick={clearFilters}>
                清除过滤条件
              </button>
            )}
          </EmptyState>
        ) : (
          items.map(renderItem)
        )}
      </div>

      {/* 分页 */}
      {!isLoading && items.length > 0 && (
        <div className={styles.pagination}>
          <div className={styles.pageInfo}>
            第 {currentPage} / {totalPages} 页
          </div>
          
          <div className={styles.pageButtons}>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
            >
              首页
            </button>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              上一页
            </button>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  className={currentPage === pageNum ? styles.activePage : ''}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
            
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              下一页
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
            >
              末页
            </button>
          </div>

          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(parseInt(e.target.value, 10));
              setCurrentPage(1);
            }}
            className={styles.pageSizeSelect}
          >
            {ITEMS_PER_PAGE_OPTIONS.map(size => (
              <option key={size} value={size}>{size} / 页</option>
            ))}
          </select>
        </div>
      )}
      
      {/* 已选列表面板 */}
      {isMultiSelectMode && showSelectedPanel && (
        <div className={styles.selectedPanel}>
          <div className={styles.selectedPanelHeader}>
            <h4>已选物品 ({selectedItems.size})</h4>
            <button 
              className={styles.closePanelBtn}
              onClick={() => setShowSelectedPanel(false)}
            >
              ×
            </button>
          </div>
          <div className={styles.selectedList}>
            {selectedItems.size === 0 ? (
              <p className={styles.emptyText}>暂无选中物品</p>
            ) : (
              Array.from(selectedItems).map(itemId => (
                <div key={itemId} className={styles.selectedItem}>
                  <code>{itemId}</code>
                  <button 
                    className={styles.removeItemBtn}
                    onClick={() => toggleItemSelection(itemId)}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}

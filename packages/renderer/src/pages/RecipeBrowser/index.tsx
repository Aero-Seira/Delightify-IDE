/**
 * 配方浏览器页面 - v2.0
 * 
 * M3 阶段核心功能：浏览、搜索、筛选配方
 * 支持多种视图模式和配方详情查看
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Recipe, RecipeDetail, RecipeTypeInfo, RecipeQueryParams } from '@delightify/shared';
import RecipeCard, { RecipeListRow, RecipeDetailCard } from '../../components/RecipeCard';
import SearchableSelect from '../../components/SearchableSelect';
import ErrorBoundary from '../../components/ErrorBoundary';
import { electronAPI } from '../../ipc';
import { useProjectStore } from '../../store/projectStore';
import styles from './style.module.css';

interface QueryFilters {
  search: string;
  modId: string;
  typeId: string;
}

const ITEMS_PER_PAGE_OPTIONS = [20, 50, 100];
const VIEW_MODES = ['grid', 'list', 'detail'] as const;
type ViewMode = typeof VIEW_MODES[number];

export default function RecipeBrowserPage(): React.ReactElement {
  const { currentProject } = useProjectStore();
  
  // 数据状态
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  // 过滤状态
  const [filters, setFilters] = useState<QueryFilters>({
    search: '',
    modId: '',
    typeId: '',
  });
  
  // 视图状态
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [selectedRecipeDetail, setSelectedRecipeDetail] = useState<RecipeDetail | null>(null);
  const [detailRecipeId, setDetailRecipeId] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  
  // 可用选项
  const [mods, setMods] = useState<Array<{ modid: string; name?: string }>>([]);
  const [recipeTypes, setRecipeTypes] = useState<RecipeTypeInfo[]>([]);
  
  // 加载配方数据
  const loadRecipes = useCallback(async () => {
    if (!currentProject) {
      setError('请先打开一个项目');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const api = electronAPI();
      const response = await api.recipesQuery(currentProject.path, {
        page: currentPage,
        pageSize,
        search: filters.search || undefined,
        modid: filters.modId || undefined,
        typeId: filters.typeId || undefined,
      });
      
      if (response.success && response.data) {
        setRecipes(response.data.recipes);
        setTotalCount(response.data.total);
      } else {
        setError(response.error || '加载失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [currentProject, currentPage, pageSize, filters]);

  // 加载可用选项
  const loadOptions = useCallback(async () => {
    if (!currentProject) return;
    
    try {
      const api = electronAPI();
      const [modsResult, typesResult] = await Promise.all([
        api.modsQuery(currentProject.path),
        api.recipesGetTypes(currentProject.path),
      ]);
      
      if (modsResult.success && modsResult.data) {
        setMods(modsResult.data);
      }
      
      if (typesResult.success && typesResult.data) {
        setRecipeTypes(typesResult.data);
      }
    } catch {
      // 静默失败，不影响主功能
    }
  }, [currentProject]);

  // 初始化加载
  useEffect(() => {
    loadRecipes();
    loadOptions();
  }, [loadRecipes, loadOptions]);

  // 从 localStorage 恢复设置
  useEffect(() => {
    const savedViewMode = localStorage.getItem('recipeBrowser.viewMode') as ViewMode | null;
    if (savedViewMode && VIEW_MODES.includes(savedViewMode)) {
      setViewMode(savedViewMode);
    }
  }, []);

  // 保存设置到 localStorage
  useEffect(() => {
    localStorage.setItem('recipeBrowser.viewMode', viewMode);
  }, [viewMode]);

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
      modId: '',
      typeId: '',
    });
    setCurrentPage(1);
  };

  const loadRecipeDetail = useCallback(async (recipeId: string) => {
    if (!currentProject) return;

    setIsDetailLoading(true);
    setDetailError(null);
    setDetailRecipeId(recipeId);
    try {
      const response = await electronAPI().recipesGetDetail(currentProject.path, recipeId);
      if (response.success) {
        setSelectedRecipeDetail(response.data ?? null);
      } else {
        setSelectedRecipeDetail(null);
        setDetailError(response.error || '加载配方详情失败');
      }
    } catch (err) {
      setSelectedRecipeDetail(null);
      setDetailError(err instanceof Error ? err.message : '加载配方详情失败');
    } finally {
      setIsDetailLoading(false);
    }
  }, [currentProject]);

  // 处理配方点击
  const handleRecipeClick = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setSelectedRecipeDetail(null);
    setDetailRecipeId(null);
    setDetailError(null);
    if (viewMode === 'detail') {
      setShowDetailPanel(true);
      void loadRecipeDetail(recipe.recipeId);
    }
  };

  useEffect(() => {
    if (
      viewMode === 'detail'
      && selectedRecipe
      && detailRecipeId !== selectedRecipe.recipeId
      && !isDetailLoading
    ) {
      void loadRecipeDetail(selectedRecipe.recipeId);
    }
  }, [detailRecipeId, isDetailLoading, loadRecipeDetail, selectedRecipe, viewMode]);

  // 关闭详情面板
  const closeDetailPanel = () => {
    setShowDetailPanel(false);
    setSelectedRecipe(null);
    setSelectedRecipeDetail(null);
    setDetailRecipeId(null);
    setDetailError(null);
  };

  // 渲染配方卡片
  const renderRecipe = (recipe: Recipe) => {
    const isSelected = selectedRecipe?.recipeId === recipe.recipeId;
    
    switch (viewMode) {
      case 'list':
        return (
          <RecipeListRow
            key={recipe.recipeId}
            recipe={recipe}
            selected={isSelected}
            onClick={() => handleRecipeClick(recipe)}
          />
        );
      case 'detail':
        if (isSelected) {
          const detail = selectedRecipeDetail?.recipe.recipeId === recipe.recipeId
            ? selectedRecipeDetail
            : undefined;
          return (
            <div key={recipe.recipeId} className={styles.detailItemWrapper}>
              <RecipeDetailCard
                recipe={recipe}
                detail={detail}
                isLoading={isDetailLoading}
                error={detailError}
              />
            </div>
          );
        }
        return (
          <RecipeListRow
            key={recipe.recipeId}
            recipe={recipe}
            selected={isSelected}
            onClick={() => handleRecipeClick(recipe)}
          />
        );
      default: // grid
        return (
          <RecipeCard
            key={recipe.recipeId}
            recipe={recipe}
            selected={isSelected}
            onClick={() => handleRecipeClick(recipe)}
          />
        );
    }
  };

  // 检查是否有过滤条件
  const hasFilters = filters.search || filters.modId || filters.typeId;

  // 如果没有项目，显示提示
  if (!currentProject) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" />
          </svg>
          <p>请先打开一个项目</p>
          <p className={styles.emptyHint}>需要先打开一个整合包项目才能浏览配方</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={styles.container}>
        {/* 工具栏 */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            {/* 搜索栏 */}
            <div className={styles.searchBar}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="搜索配方ID或内容..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
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

            {/* 模组筛选 */}
            <SearchableSelect
              value={filters.modId}
              options={[
                { value: '', label: '所有模组', count: totalCount },
                ...mods.map(mod => ({
                  value: mod.modid,
                  label: mod.name || mod.modid,
                  description: mod.name ? mod.modid : undefined,
                })),
              ]}
              placeholder="📦 所有模组"
              onChange={(value) => updateFilter('modId', value)}
              className={styles.filterSelect}
              title="筛选模组"
            />

            {/* 配方类型筛选 */}
            <SearchableSelect
              value={filters.typeId}
              options={[
                { value: '', label: '所有类型' },
                ...recipeTypes.map(type => ({
                  value: type.typeId,
                  label: type.displayName,
                  description: `${type.recipeCount} 个配方`,
                })),
              ]}
              placeholder="🔧 所有类型"
              onChange={(value) => updateFilter('typeId', value)}
              className={styles.filterSelect}
              title="筛选配方类型"
            />

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
                    mode === 'list' ? '列表视图' : 
                    '详情视图'
                  }
                >
                  {mode === 'grid' && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z"/>
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
          </div>
        </div>

        {/* 结果统计 */}
        <div className={styles.stats}>
          <span className={styles.count}>共 {totalCount.toLocaleString()} 个配方</span>
          {filters.search && (
            <span className={styles.filterTag}>
              搜索: <strong>{filters.search}</strong>
              <button onClick={() => updateFilter('search', '')}>×</button>
            </span>
          )}
          {filters.modId && (
            <span className={styles.filterTag}>
              模组: <strong>{filters.modId}</strong>
              <button onClick={() => updateFilter('modId', '')}>×</button>
            </span>
          )}
          {filters.typeId && (
            <span className={styles.filterTag}>
              类型: <strong>{filters.typeId.split(':').pop()}</strong>
              <button onClick={() => updateFilter('typeId', '')}>×</button>
            </span>
          )}
        </div>

        {/* 配方列表 */}
        <div className={`${styles.content} ${styles[viewMode]}`}>
          {isLoading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <p>加载中...</p>
            </div>
          ) : error ? (
            <div className={styles.error}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p>加载失败: {error}</p>
              <button onClick={loadRecipes}>重试</button>
            </div>
          ) : recipes.length === 0 ? (
            <div className={styles.empty}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              {hasFilters ? (
                <>
                  <p>没有找到匹配的配方</p>
                  <button
                    className={styles.clearFilters}
                    onClick={clearFilters}
                  >
                    清除过滤条件
                  </button>
                </>
              ) : (
                <>
                  <p>该项目没有包含任何配方</p>
                  <p className={styles.emptyHint}>请先前往「数据导入」导入配方数据</p>
                </>
              )}
            </div>
          ) : (
            recipes.map(renderRecipe)
          )}
        </div>

        {/* 分页 */}
        {!isLoading && recipes.length > 0 && (
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

        {/* 详情面板 */}
        {showDetailPanel && selectedRecipe && (
          <div className={styles.detailPanel}>
            <div className={styles.detailPanelHeader}>
              <h4>配方详情</h4>
              <button 
                className={styles.closePanelBtn}
                onClick={closeDetailPanel}
              >
                ×
              </button>
            </div>
            <div className={styles.detailPanelContent}>
              {(() => {
                const detail = selectedRecipeDetail?.recipe.recipeId === selectedRecipe.recipeId
                  ? selectedRecipeDetail
                  : undefined;
                return (
                  <RecipeDetailCard
                    recipe={detail?.recipe ?? selectedRecipe}
                    detail={detail}
                    isLoading={isDetailLoading}
                    error={detailError}
                  />
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

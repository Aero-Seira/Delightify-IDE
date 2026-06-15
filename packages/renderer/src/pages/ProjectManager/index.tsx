/**
 * Project Manager Page - 项目管理页面
 * 适配 v2.1 架构：显示数据导入状态
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { useProjectStore } from '../../store/projectStore';
import CreateProjectDialog from '../../components/CreateProjectDialog';
import { EmptyState, LoadingState } from '../../components/StateViews';
import type { Project, ModLoader } from '@delightify/shared';
import styles from './style.module.css';

// Icons
const SearchIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const PlusIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

const FolderIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
  </svg>
);

const StarIcon: React.FC<{ filled?: boolean }> = ({ filled }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill={filled ? 'currentColor' : 'none'} 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const GridIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const ListIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const MoreVerticalIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);

const ClockIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const PackageIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m7.5 4.27 9 5.15" />
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5" />
    <path d="M12 22V12" />
  </svg>
);

const TrashIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

const EditIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const ImportIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" x2="12" y1="3" y2="15" />
  </svg>
);

const AlertIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </svg>
);

// ModLoader 显示名称映射
const modLoaderLabels: Record<ModLoader, string> = {
  forge: 'Forge',
  fabric: 'Fabric',
  neoforge: 'NeoForge',
  quilt: 'Quilt',
};

/**
 * 项目卡片组件
 */
interface ProjectCardProps {
  project: Project;
  viewMode: 'grid' | 'list';
  onOpen: (project: Project) => void;
  onToggleFavorite: (project: Project) => void;
  onDelete: (project: Project) => void;
  onEdit: (project: Project) => void;
  onImport: (project: Project) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ 
  project, 
  viewMode, 
  onOpen, 
  onToggleFavorite, 
  onDelete,
  onEdit,
  onImport
}) => {
  const { t } = useI18n();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 格式化日期
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // 判断是否需要导入数据
  const needsImport = project.status === 'needs_import' || !project.lastImportedAt;
  const isReady = project.status === 'ready';

  if (viewMode === 'list') {
    return (
      <div className={styles.projectListItem}>
        <div className={styles.projectListIcon}>
          <FolderIcon />
        </div>
        <div className={styles.projectListInfo}>
          <h3 className={styles.projectListName}>{project.name}</h3>
          <p className={styles.projectListPath}>{project.path}</p>
          <div className={styles.projectListMeta}>
            <span className={styles.metaTag}>{project.mcVersion}</span>
            <span className={styles.metaTag}>{modLoaderLabels[project.modLoader]}</span>
            {(project.totalMods ?? 0) > 0 && (
              <span className={styles.metaTag}>{project.totalMods} mods</span>
            )}
            {needsImport && (
              <span className={`${styles.metaTag} ${styles.statusTagWarning}`}>
                <AlertIcon />
                需要导入数据
              </span>
            )}
            {isReady && (
              <span className={`${styles.metaTag} ${styles.statusTagSuccess}`}>
                已导入
              </span>
            )}
          </div>
        </div>
        <div className={styles.projectListActions}>
          <button 
            className={`${styles.iconButton} ${project.isFavorite ? styles.favoriteActive : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(project); }}
            title={t('projectManager.favorite')}
          >
            <StarIcon filled={project.isFavorite} />
          </button>
          <div className={styles.menuWrapper} ref={menuRef}>
            <button 
              className={styles.iconButton}
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            >
              <MoreVerticalIcon />
            </button>
            {showMenu && (
              <div className={styles.dropdownMenu}>
                <button
                  disabled
                  title="编辑功能开发中"
                  onClick={() => { onEdit(project); setShowMenu(false); }}
                >
                  <EditIcon />
                  {t('common.edit')}
                </button>
                {needsImport && (
                  <button onClick={() => { onImport(project); setShowMenu(false); }}>
                    <ImportIcon />
                    导入数据
                  </button>
                )}
                <button onClick={() => { onDelete(project); setShowMenu(false); }}>
                  <TrashIcon />
                  {t('common.delete')}
                </button>
              </div>
            )}
          </div>
          <button 
            className={styles.openButton}
            onClick={() => onOpen(project)}
          >
            {t('projectManager.open')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.projectCard}>
      <div className={styles.projectCardHeader}>
        <div className={styles.projectIcon}>
          <FolderIcon />
        </div>
        <button 
          className={`${styles.favoriteButton} ${project.isFavorite ? styles.favoriteActive : ''}`}
          onClick={() => onToggleFavorite(project)}
        >
          <StarIcon filled={project.isFavorite} />
        </button>
      </div>
      
      <div className={styles.projectCardBody}>
        <h3 className={styles.projectName}>{project.name}</h3>
        <p className={styles.projectPath} title={project.path}>{project.path}</p>
        
        {project.description && (
          <p className={styles.projectDescription}>{project.description}</p>
        )}
        
        <div className={styles.projectTags}>
          <span className={styles.tag}>{project.mcVersion}</span>
          <span className={styles.tag}>{modLoaderLabels[project.modLoader]}</span>
        </div>
        
        <div className={styles.projectStats}>
          <div className={styles.stat}>
            <PackageIcon />
            <span>{project.totalMods}</span>
          </div>
          <div className={styles.stat}>
            <ClockIcon />
            <span>{formatDate(project.lastOpenedAt || project.updatedAt)}</span>
          </div>
        </div>

        {/* 导入状态提示 */}
        {needsImport && (
          <div className={styles.importAlert}>
            <AlertIcon />
            <span>需要导入 Mod 数据</span>
          </div>
        )}
        {isReady && project.lastImportedAt && (
          <div className={styles.importInfo}>
            <span>上次导入: {formatDate(project.lastImportedAt)}</span>
          </div>
        )}
      </div>
      
      <div className={styles.projectCardFooter}>
        <button 
          className={styles.openButton}
          onClick={() => onOpen(project)}
        >
          {t('projectManager.open')}
        </button>
        <div className={styles.menuWrapper} ref={menuRef}>
          <button 
            className={styles.moreButton}
            onClick={() => setShowMenu(!showMenu)}
          >
            <MoreVerticalIcon />
          </button>
          {showMenu && (
            <div className={styles.dropdownMenu}>
              <button
                disabled
                title="编辑功能开发中"
                onClick={() => { onEdit(project); setShowMenu(false); }}
              >
                <EditIcon />
                {t('common.edit')}
              </button>
              {needsImport && (
                <button onClick={() => { onImport(project); setShowMenu(false); }}>
                  <ImportIcon />
                  导入数据
                </button>
              )}
              <button onClick={() => { onDelete(project); setShowMenu(false); }}>
                <TrashIcon />
                {t('common.delete')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * 项目管理页面主组件
 */
export default function ProjectManagerPage(): React.ReactElement {
  const { t } = useI18n();
  const navigate = useNavigate();
  const {
    projects,
    isLoadingProjects,
    projectsError,
    currentProject,
    listParams,
    loadProjects,
    openProject,
    setFavorite,
    deleteProject,
    setListParams,
    clearErrors,
  } = useProjectStore();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState(listParams.search || '');

  // 初始加载
  useEffect(() => {
    loadProjects();
  }, []);

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      setListParams({ search: searchQuery || undefined });
      loadProjects();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 筛选后的项目列表
  const filteredProjects = useMemo(() => {
    let result = [...projects];
    
    // 收藏优先排序
    result.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return 0;
    });
    
    return result;
  }, [projects]);

  // 处理打开项目
  const handleOpenProject = async (project: Project) => {
    await openProject(project.id);
  };

  // 处理切换收藏
  const handleToggleFavorite = async (project: Project) => {
    await setFavorite(project.id, !project.isFavorite);
  };

  // 处理删除项目
  const handleDeleteProject = async () => {
    if (!showDeleteConfirm) return;
    await deleteProject(showDeleteConfirm.id);
    setShowDeleteConfirm(null);
  };

  // 处理编辑项目
  const handleEditProject = () => {};

  // 处理导入数据 - 导航到数据导入页面
  const handleImportData = (project: Project) => {
    navigate('/mods', { state: { projectId: project.id, autoStart: true } });
  };

  return (
    <div className={styles.container}>
      {/* 页面头部 */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>{t('projectManager.title')}</h1>
          <p className={styles.description}>{t('projectManager.description')}</p>
        </div>
        <button 
          className={styles.createButton}
          onClick={() => setShowCreateDialog(true)}
        >
          <PlusIcon />
          {t('projectManager.createProject')}
        </button>
      </div>

      {/* 工具栏 */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <SearchIcon />
          <input
            type="text"
            placeholder={t('projectManager.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className={styles.toolbarRight}>
          <label className={styles.filterLabel}>
            <input
              type="checkbox"
              checked={listParams.favoriteOnly}
              onChange={(e) => {
                setListParams({ favoriteOnly: e.target.checked });
                loadProjects();
              }}
            />
            {t('projectManager.favoriteOnly')}
          </label>
          
          <div className={styles.viewToggle}>
            <button
              className={viewMode === 'grid' ? styles.active : ''}
              onClick={() => setViewMode('grid')}
              title={t('projectManager.gridView')}
            >
              <GridIcon />
            </button>
            <button
              className={viewMode === 'list' ? styles.active : ''}
              onClick={() => setViewMode('list')}
              title={t('projectManager.listView')}
            >
              <ListIcon />
            </button>
          </div>
        </div>
      </div>

      {/* 当前项目信息 */}
      {currentProject && (
        <div className={styles.currentProjectBanner}>
          <div className={styles.currentProjectInfo}>
            <FolderIcon />
            <div>
              <span className={styles.currentProjectLabel}>{t('projectManager.currentProject')}</span>
              <span className={styles.currentProjectName}>{currentProject.name}</span>
            </div>
          </div>
          <div className={styles.currentProjectMeta}>
            <span className={styles.tag}>{currentProject.mcVersion}</span>
            <span className={styles.tag}>{modLoaderLabels[currentProject.modLoader]}</span>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {projectsError && (
        <div className={styles.errorMessage}>
          {projectsError}
          <button onClick={clearErrors}>×</button>
        </div>
      )}

      {/* 项目列表 */}
      <div className={viewMode === 'grid' ? styles.projectGrid : styles.projectList}>
        {isLoadingProjects ? (
          <LoadingState label={t('common.loading')} />
        ) : filteredProjects.length === 0 ? (
          <EmptyState
            icon={<FolderIcon />}
            title={t('projectManager.noProjects')}
            description={searchQuery ? t('projectManager.noSearchResults') : t('projectManager.createFirst')}
          >
            {!searchQuery && (
              <button 
                className={styles.createButton}
                onClick={() => setShowCreateDialog(true)}
              >
                <PlusIcon />
                {t('projectManager.createProject')}
              </button>
            )}
          </EmptyState>
        ) : (
          filteredProjects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              viewMode={viewMode}
              onOpen={handleOpenProject}
              onToggleFavorite={handleToggleFavorite}
              onDelete={(p) => setShowDeleteConfirm(p)}
              onEdit={handleEditProject}
              onImport={handleImportData}
            />
          ))
        )}
      </div>

      {/* 创建项目对话框 */}
      {showCreateDialog && (
        <CreateProjectDialog
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            setShowCreateDialog(false);
            loadProjects();
          }}
        />
      )}

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>{t('projectManager.confirmDelete')}</h3>
            <p>{t('projectManager.confirmDeleteDesc', { name: showDeleteConfirm.name })}</p>
            <div className={styles.modalActions}>
              <button 
                className={styles.cancelButton}
                onClick={() => setShowDeleteConfirm(null)}
              >
                {t('common.cancel')}
              </button>
              <button 
                className={styles.deleteButton}
                onClick={handleDeleteProject}
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

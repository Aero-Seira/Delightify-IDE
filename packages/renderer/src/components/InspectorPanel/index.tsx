import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { ProjectStats } from '@delightify/shared';
import { useI18n } from '../../i18n';
import { electronAPI } from '../../ipc';
import { useProjectStore } from '../../store/projectStore';
import styles from './style.module.css';

function viewKind(pathname: string, t: (key: string) => string): string {
  if (pathname === '/') return t('inspector.viewProjectHub');
  if (pathname === '/actions') return t('inspector.viewActionWorkbench');
  if (pathname === '/scripts') return t('inspector.viewScriptWorkspace');
  if (pathname === '/items') return t('inspector.viewItemGraph');
  if (pathname === '/recipes') return t('inspector.viewRecipeGraph');
  if (pathname === '/data-import') return t('inspector.viewRuntimeSnapshot');
  if (pathname === '/projects') return t('inspector.viewProjectManager');
  return t('inspector.viewTool');
}

function gitText(stats: ProjectStats | null, t: (key: string, params?: Record<string, string>) => string): string {
  const git = stats?.instance?.git;
  if (!git?.isRepo) {
    return t('inspector.notGitRepo');
  }
  return git.dirty
    ? t('inspector.gitDirty', { branch: git.branch ?? '-', count: String(git.changedFiles ?? 0) })
    : t('inspector.gitClean', { branch: git.branch ?? '-' });
}

export default function InspectorPanel(): React.ReactElement {
  const { t } = useI18n();
  const location = useLocation();
  const { currentProject } = useProjectStore();
  const [stats, setStats] = useState<ProjectStats | null>(null);

  useEffect(() => {
    let canceled = false;

    if (!currentProject) {
      setStats(null);
      return;
    }

    const loadStats = async (): Promise<void> => {
      const result = await electronAPI().projectGetStats(currentProject.path);
      if (!canceled && result.success && result.data) {
        setStats(result.data);
      }
    };

    void loadStats();
    return () => {
      canceled = true;
    };
  }, [currentProject]);

  const warnings = stats?.instance?.warnings ?? [];
  const directories = stats?.instance?.directories;
  const directorySignals = useMemo(() => [
    ['mods', directories?.mods],
    ['config', directories?.config],
    ['kubejs', directories?.kubejs],
    ['saves', directories?.saves],
    ['resourcepacks', directories?.resourcepacks],
  ], [directories]);

  return (
    <aside className={styles.inspector}>
      <div className={styles.header}>
        <span>{t('inspector.title')}</span>
        <small>{viewKind(location.pathname, t)}</small>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>{t('inspector.project')}</div>
        <div className={styles.row}>
          <span>{t('inspector.name')}</span>
          <strong>{currentProject?.name ?? '-'}</strong>
        </div>
        <div className={styles.row}>
          <span>{t('inspector.runtime')}</span>
          <strong>{currentProject ? `${currentProject.mcVersion} / ${currentProject.modLoader}` : '-'}</strong>
        </div>
        <div className={styles.pathValue}>{currentProject?.path ?? t('inspector.noProjectOpened')}</div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>{t('inspector.workspaceState')}</div>
        <div className={styles.row}>
          <span>{t('inspector.import')}</span>
          <strong className={stats?.needsReimport ? styles.warn : styles.good}>
            {stats ? stats.needsReimport ? t('inspector.required') : t('inspector.ready') : '-'}
          </strong>
        </div>
        <div className={styles.row}>
          <span>{t('inspector.git')}</span>
          <strong>{gitText(stats, t)}</strong>
        </div>
        <div className={styles.row}>
          <span>{t('inspector.managed')}</span>
          <strong>{stats?.instance?.generated.managedFiles ?? 0}</strong>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>{t('inspector.dataGraph')}</div>
        <div className={styles.metricGrid}>
          <div><strong>{stats?.modCount ?? 0}</strong><span>{t('inspector.mods')}</span></div>
          <div><strong>{stats?.itemCount ?? 0}</strong><span>{t('inspector.items')}</span></div>
          <div><strong>{stats?.recipeCount ?? 0}</strong><span>{t('inspector.recipes')}</span></div>
          <div><strong>{stats?.tagCount ?? 0}</strong><span>{t('inspector.tags')}</span></div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>{t('inspector.instance')}</div>
        <div className={styles.signalList}>
          {directorySignals.map(([label, present]) => (
            <div key={String(label)} className={styles.signal}>
              <span className={`${styles.dot} ${present ? styles.dotOn : ''}`} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>{t('inspector.problems')}</div>
        {warnings.length === 0 ? (
          <div className={styles.empty}>{t('inspector.noWarnings')}</div>
        ) : (
          <div className={styles.problemList}>
            {warnings.slice(0, 4).map(warning => (
              <div key={warning} className={styles.problem}>{warning}</div>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}

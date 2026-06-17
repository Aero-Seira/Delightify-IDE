import React, { useEffect, useMemo, useState } from 'react';
import type { ProjectStats } from '@delightify/shared';
import { useI18n } from '../../i18n';
import { electronAPI } from '../../ipc';
import { useProjectStore } from '../../store/projectStore';
import styles from './style.module.css';

function shortPath(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length <= 2) {
    return path;
  }
  return `.../${parts.slice(-2).join('/')}`;
}

function formatGit(
  stats: ProjectStats | null,
  t: (key: string, params?: Record<string, string>) => string
): { text: string; tone: 'neutral' | 'good' | 'warn' } {
  const git = stats?.instance?.git;
  if (!git || !git.isRepo) {
    return { text: t('workbench.gitNone'), tone: 'neutral' };
  }
  if (git.dirty) {
    return {
      text: t('workbench.gitDirty', {
        branch: git.branch ?? '-',
        count: String(git.changedFiles ?? 0),
      }),
      tone: 'warn',
    };
  }
  return { text: t('workbench.gitBranch', { branch: git.branch ?? '-' }), tone: 'good' };
}

export default function StatusBar(): React.ReactElement {
  const { t } = useI18n();
  const { currentProject, projectStatus } = useProjectStore();
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    if (!currentProject) {
      setStats(null);
      setError(null);
      return;
    }

    const loadStats = async (): Promise<void> => {
      try {
        const result = await electronAPI().projectGetStats(currentProject.path);
        if (canceled) {
          return;
        }
        if (result.success && result.data) {
          setStats(result.data);
          setError(null);
        } else {
          setStats(null);
          setError(result.error || t('workbench.statusUnavailable'));
        }
      } catch (caught) {
        if (!canceled) {
          setStats(null);
          setError(caught instanceof Error ? caught.message : t('workbench.statusUnavailable'));
        }
      }
    };

    void loadStats();
    return () => {
      canceled = true;
    };
  }, [currentProject, t]);

  const git = useMemo(() => formatGit(stats, t), [stats, t]);
  const importText = stats
    ? stats.needsReimport
      ? t('workbench.importRequired')
      : t('workbench.importReady')
    : t('workbench.importUnknown');
  const generatedFiles = stats?.instance?.generated.managedFiles ?? 0;
  const warningCount = stats?.instance?.warnings.length ?? 0;

  return (
    <footer className={styles.statusBar}>
      <div className={styles.leftItems}>
        <span className={`${styles.item} ${projectStatus === 'ready' ? styles.good : styles.neutral}`}>
          {currentProject ? currentProject.name : t('sidebar.noProject')}
        </span>
        {currentProject && (
          <>
            <span className={styles.item}>{currentProject.mcVersion} / {currentProject.modLoader}</span>
            <span className={styles.pathItem}>{shortPath(currentProject.path)}</span>
          </>
        )}
      </div>

      <div className={styles.rightItems}>
        {error && <span className={`${styles.item} ${styles.warn}`}>{error}</span>}
        <span className={`${styles.item} ${styles[git.tone]}`}>{git.text}</span>
        <span className={`${styles.item} ${stats?.needsReimport ? styles.warn : styles.good}`}>{importText}</span>
        <span className={styles.item}>{t('workbench.mods', { count: String(stats?.modCount ?? 0) })}</span>
        <span className={styles.item}>{t('workbench.items', { count: String(stats?.itemCount ?? 0) })}</span>
        <span className={styles.item}>{t('workbench.recipes', { count: String(stats?.recipeCount ?? 0) })}</span>
        <span className={styles.item}>{t('workbench.managed', { count: String(generatedFiles) })}</span>
        {warningCount > 0 && (
          <span className={`${styles.item} ${styles.warn}`}>
            {t('workbench.warnings', { count: String(warningCount) })}
          </span>
        )}
      </div>
    </footer>
  );
}

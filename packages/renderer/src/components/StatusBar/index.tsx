import React, { useEffect, useMemo, useState } from 'react';
import type { ProjectStats } from '@delightify/shared';
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

function formatGit(stats: ProjectStats | null): { text: string; tone: 'neutral' | 'good' | 'warn' } {
  const git = stats?.instance?.git;
  if (!git || !git.isRepo) {
    return { text: 'Git: none', tone: 'neutral' };
  }
  if (git.dirty) {
    return { text: `Git: ${git.branch ?? '-'} +${git.changedFiles ?? 0}`, tone: 'warn' };
  }
  return { text: `Git: ${git.branch ?? '-'}`, tone: 'good' };
}

export default function StatusBar(): React.ReactElement {
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
          setError(result.error || 'status unavailable');
        }
      } catch (caught) {
        if (!canceled) {
          setStats(null);
          setError(caught instanceof Error ? caught.message : 'status unavailable');
        }
      }
    };

    void loadStats();
    return () => {
      canceled = true;
    };
  }, [currentProject]);

  const git = useMemo(() => formatGit(stats), [stats]);
  const importText = stats
    ? stats.needsReimport
      ? 'Import: required'
      : 'Import: ready'
    : 'Import: unknown';
  const generatedFiles = stats?.instance?.generated.managedFiles ?? 0;
  const warningCount = stats?.instance?.warnings.length ?? 0;

  return (
    <footer className={styles.statusBar}>
      <div className={styles.leftItems}>
        <span className={`${styles.item} ${projectStatus === 'ready' ? styles.good : styles.neutral}`}>
          {currentProject ? currentProject.name : 'No project'}
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
        <span className={styles.item}>Mods {stats?.modCount ?? 0}</span>
        <span className={styles.item}>Items {stats?.itemCount ?? 0}</span>
        <span className={styles.item}>Recipes {stats?.recipeCount ?? 0}</span>
        <span className={styles.item}>Managed {generatedFiles}</span>
        {warningCount > 0 && <span className={`${styles.item} ${styles.warn}`}>Warnings {warningCount}</span>}
      </div>
    </footer>
  );
}

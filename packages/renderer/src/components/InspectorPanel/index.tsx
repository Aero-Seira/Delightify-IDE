import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { ProjectStats } from '@delightify/shared';
import { electronAPI } from '../../ipc';
import { useProjectStore } from '../../store/projectStore';
import styles from './style.module.css';

function viewKind(pathname: string): string {
  if (pathname === '/') return 'Project Hub';
  if (pathname === '/actions') return 'Action Workbench';
  if (pathname === '/scripts') return 'Script Workspace';
  if (pathname === '/items') return 'Item Graph';
  if (pathname === '/recipes') return 'Recipe Graph';
  if (pathname === '/data-import') return 'Runtime Snapshot';
  if (pathname === '/projects') return 'Project Manager';
  return 'Tool View';
}

function gitText(stats: ProjectStats | null): string {
  const git = stats?.instance?.git;
  if (!git?.isRepo) {
    return 'Not a Git repo';
  }
  return git.dirty
    ? `${git.branch ?? '-'} dirty (${git.changedFiles ?? 0})`
    : `${git.branch ?? '-'} clean`;
}

export default function InspectorPanel(): React.ReactElement {
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
        <span>Inspector</span>
        <small>{viewKind(location.pathname)}</small>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Project</div>
        <div className={styles.row}>
          <span>Name</span>
          <strong>{currentProject?.name ?? '-'}</strong>
        </div>
        <div className={styles.row}>
          <span>Runtime</span>
          <strong>{currentProject ? `${currentProject.mcVersion} / ${currentProject.modLoader}` : '-'}</strong>
        </div>
        <div className={styles.pathValue}>{currentProject?.path ?? 'No project opened'}</div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Workspace State</div>
        <div className={styles.row}>
          <span>Import</span>
          <strong className={stats?.needsReimport ? styles.warn : styles.good}>
            {stats ? stats.needsReimport ? 'Required' : 'Ready' : '-'}
          </strong>
        </div>
        <div className={styles.row}>
          <span>Git</span>
          <strong>{gitText(stats)}</strong>
        </div>
        <div className={styles.row}>
          <span>Managed</span>
          <strong>{stats?.instance?.generated.managedFiles ?? 0}</strong>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Data Graph</div>
        <div className={styles.metricGrid}>
          <div><strong>{stats?.modCount ?? 0}</strong><span>Mods</span></div>
          <div><strong>{stats?.itemCount ?? 0}</strong><span>Items</span></div>
          <div><strong>{stats?.recipeCount ?? 0}</strong><span>Recipes</span></div>
          <div><strong>{stats?.tagCount ?? 0}</strong><span>Tags</span></div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Instance</div>
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
        <div className={styles.sectionTitle}>Problems</div>
        {warnings.length === 0 ? (
          <div className={styles.empty}>No workspace warnings.</div>
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

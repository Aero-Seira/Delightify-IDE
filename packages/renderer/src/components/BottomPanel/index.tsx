import React, { useEffect, useState } from 'react';
import type { ProjectStats } from '@delightify/shared';
import { electronAPI } from '../../ipc';
import { useProjectStore } from '../../store/projectStore';
import styles from './style.module.css';

type PanelTab = 'problems' | 'output';

export default function BottomPanel(): React.ReactElement {
  const { currentProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState<PanelTab>('problems');
  const [expanded, setExpanded] = useState(false);
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

  return (
    <section className={`${styles.panel} ${expanded ? styles.panelExpanded : ''}`}>
      <div className={styles.tabBar}>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'problems' ? styles.tabActive : ''}`}
          onClick={() => {
            setActiveTab('problems');
            setExpanded(true);
          }}
        >
          Problems {warnings.length > 0 ? warnings.length : ''}
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'output' ? styles.tabActive : ''}`}
          onClick={() => {
            setActiveTab('output');
            setExpanded(true);
          }}
        >
          Output
        </button>
        <button
          type="button"
          className={styles.toggleButton}
          onClick={() => setExpanded(previous => !previous)}
        >
          {expanded ? 'Collapse' : 'Panel'}
        </button>
      </div>

      {expanded && (
        <div className={styles.content}>
          {activeTab === 'problems' ? (
            warnings.length === 0 ? (
              <div className={styles.empty}>No workspace problems detected.</div>
            ) : (
              <div className={styles.problemList}>
                {warnings.map(warning => (
                  <div key={warning} className={styles.problem}>{warning}</div>
                ))}
              </div>
            )
          ) : (
            <div className={styles.output}>
              <div>Delightify workbench ready.</div>
              <div>Open Action Workbench to dry-run changes, or Script Workspace to inspect managed files.</div>
              {currentProject && <div>Project: {currentProject.name}</div>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

import React, { useEffect, useState } from 'react';
import type { ProjectStats } from '@delightify/shared';
import { useI18n } from '../../i18n';
import { electronAPI } from '../../ipc';
import { useProjectStore } from '../../store/projectStore';
import styles from './style.module.css';

type PanelTab = 'problems' | 'output';

export default function BottomPanel(): React.ReactElement {
  const { t } = useI18n();
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
          {t('bottomPanel.problems')} {warnings.length > 0 ? warnings.length : ''}
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'output' ? styles.tabActive : ''}`}
          onClick={() => {
            setActiveTab('output');
            setExpanded(true);
          }}
        >
          {t('bottomPanel.output')}
        </button>
        <button
          type="button"
          className={styles.toggleButton}
          onClick={() => setExpanded(previous => !previous)}
        >
          {expanded ? t('bottomPanel.collapse') : t('bottomPanel.panel')}
        </button>
      </div>

      {expanded && (
        <div className={styles.content}>
          {activeTab === 'problems' ? (
            warnings.length === 0 ? (
              <div className={styles.empty}>{t('bottomPanel.noProblems')}</div>
            ) : (
              <div className={styles.problemList}>
                {warnings.map(warning => (
                  <div key={warning} className={styles.problem}>{warning}</div>
                ))}
              </div>
            )
          ) : (
            <div className={styles.output}>
              <div>{t('bottomPanel.ready')}</div>
              <div>{t('bottomPanel.hint')}</div>
              {currentProject && <div>{t('bottomPanel.project', { name: currentProject.name })}</div>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

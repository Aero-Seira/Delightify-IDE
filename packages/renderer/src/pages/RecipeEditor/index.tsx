import React from 'react';
import { useI18n } from '../../i18n';
import styles from './style.module.css';

export default function RecipeEditorPage(): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div className={styles.titleSection}>
          <h1 className={styles.title}>{t('recipeEditor.title')}</h1>
          <p className={styles.description}>{t('recipeEditor.description')}</p>
        </div>
        <div className={styles.actionButtons}>
          <button className={styles.btnPrimary}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            {t('recipeEditor.newRecipe')}
          </button>
          <button className={styles.btnSecondary}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            {t('recipeEditor.exportKubeJS')}
          </button>
        </div>
      </div>

      <div className={styles.editorLayout}>
        <div className={styles.editorMain}>
          <p className={styles.placeholder}>
            功能开发中 — 配方编辑器将在第二阶段实现
          </p>
        </div>

        <div className={styles.editorSidebar}>
          <div className={styles.sidebarCard}>
            <h3 className={styles.sidebarCardTitle}>配方类型</h3>
            <p className={styles.placeholder}>选择配方类型</p>
          </div>
          <div className={styles.sidebarCard}>
            <h3 className={styles.sidebarCardTitle}>物品选择</h3>
            <p className={styles.placeholder}>选择物品</p>
          </div>
        </div>
      </div>
    </div>
  );
}

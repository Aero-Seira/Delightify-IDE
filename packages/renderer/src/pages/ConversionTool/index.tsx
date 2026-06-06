import React from 'react';
import { useI18n } from '../../i18n';
import styles from './style.module.css';

export default function ConversionToolPage(): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{t('conversionTool.title')}</h1>
        <p className={styles.description}>{t('conversionTool.description')}</p>
      </div>

      <div className={styles.content}>
        <div className={styles.conversionArea}>
          <div className={styles.sourceTargetRow}>
            <div className={styles.sourceBox}>
              <h3 className={styles.boxTitle}>源格式</h3>
              <p className={styles.boxHint}>选择或拖入源配方文件</p>
            </div>
            
            <svg className={styles.arrowIcon} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
            
            <div className={styles.targetBox}>
              <h3 className={styles.boxTitle}>目标格式</h3>
              <p className={styles.boxHint}>KubeJS / Datapack</p>
            </div>
          </div>

          <div className={styles.actionArea}>
            <button className={styles.convertButton}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4" />
                <path d="m5 5 2.83 2.83" />
                <path d="M19 5l-2.83 2.83" />
                <path d="M12 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                <path d="M12 18v4" />
                <path d="m5 19 2.83-2.83" />
                <path d="M19 19l-2.83-2.83" />
              </svg>
              {t('conversionTool.startConversion')}
            </button>
          </div>
        </div>

        <p className={styles.placeholder}>
          功能开发中 — 转换工具将在第二阶段实现
        </p>
      </div>
    </div>
  );
}

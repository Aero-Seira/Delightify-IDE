/**
 * Data Import Page - 数据导入页面
 * 
 * 从附属Mod导出的 SQLite 数据文件导入到项目中
 * 适配 v2.1 架构
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { useProjectStore } from '../../store/projectStore';
import { useDataImportStore } from '../../store/dataImportStore';
import type { ValidationResult } from '@delightify/shared';
import styles from './style.module.css';

// Icons
const DatabaseIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5V19A9 3 0 0 0 21 19V5" />
    <path d="M3 12A9 3 0 0 0 21 12" />
  </svg>
);

const CheckIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const AlertIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </svg>
);

const RefreshIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 21h5v-5" />
  </svg>
);

const FolderIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
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

const CubeIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21 16-9.3 5.4a1 1 0 0 1-1 0L2 16" />
    <path d="m3 11 8.5 5a1 1 0 0 0 1 0L21 11" />
    <path d="m3 6 8.5 5a1 1 0 0 0 1 0L21 6" />
  </svg>
);

const TagIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
    <circle cx="7" cy="7" r="1" />
  </svg>
);

const ChevronRightIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

/**
 * 步骤指示器组件
 */
interface StepIndicatorProps {
  currentStep: number;
  steps: string[];
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, steps }) => {
  return (
    <div className={styles.stepIndicator}>
      {steps.map((step, index) => (
        <div key={index} className={styles.stepItem}>
          <div className={`${styles.stepNumber} ${
            index < currentStep ? styles.stepCompleted :
            index === currentStep ? styles.stepActive : ''
          }`}>
            {index < currentStep ? <CheckIcon /> : index + 1}
          </div>
          <span className={styles.stepLabel}>{step}</span>
          {index < steps.length - 1 && (
            <div className={`${styles.stepLine} ${index < currentStep ? styles.stepLineCompleted : ''}`} />
          )}
        </div>
      ))}
    </div>
  );
};

/**
 * 数据预览卡片
 */
interface DataPreviewCardProps {
  icon: React.ReactNode;
  title: string;
  count: number;
  color: 'blue' | 'green' | 'orange' | 'purple';
}

const DataPreviewCard: React.FC<DataPreviewCardProps> = ({ icon, title, count, color }) => {
  return (
    <div className={`${styles.previewCard} ${styles[`color${color}`]}`}>
      <div className={styles.previewCardIcon}>{icon}</div>
      <div className={styles.previewCardContent}>
        <span className={styles.previewCardCount}>{count.toLocaleString()}</span>
        <span className={styles.previewCardTitle}>{title}</span>
      </div>
    </div>
  );
};

/**
 * 进度条组件
 */
interface ProgressBarProps {
  progress: { phase: string; percent: number; message: string } | null;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  if (!progress) return null;

  return (
    <div className={styles.progressContainer}>
      <div className={styles.progressInfo}>
        <span className={styles.progressPhase}>{progress.message}</span>
        <span className={styles.progressPercent}>{progress.percent}%</span>
      </div>
      <div className={styles.progressBar}>
        <div 
          className={styles.progressFill}
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  );
};

/**
 * 数据导入页面主组件
 */
export default function DataImportPage(): React.ReactElement {
  const { t } = useI18n();
  const location = useLocation();
  const { currentProject, loadProjects } = useProjectStore();
  const {
    isDetecting,
    detectedFilePath,
    detectionError,
    isValidating,
    validationResult,
    validationError,
    isImporting,
    importProgress,
    importResult,
    importError,
    detectDataFile,
    validateDataFile,
    startImport,
    resetState,
  } = useDataImportStore();

  const [currentStep, setCurrentStep] = useState(0);
  const steps = ['检测数据', '预览确认', '执行导入'];

  // 自动开始检测（如果通过导航传入参数）
  useEffect(() => {
    const state = location.state as { autoStart?: boolean; projectId?: string } | undefined;
    if (state?.autoStart && currentProject) {
      handleDetect();
      // 清除导航状态
      window.history.replaceState({}, document.title);
    }
  }, [location.state, currentProject]);

  // 检测数据文件
  const handleDetect = useCallback(async () => {
    console.log('[DataImport] handleDetect called, currentProject:', currentProject?.path);
    if (!currentProject) {
      console.log('[DataImport] No current project, returning');
      return;
    }
    
    resetState();
    console.log('[DataImport] Calling detectDataFile...');
    const filePath = await detectDataFile(currentProject.path);
    console.log('[DataImport] detectDataFile result:', filePath);
    
    if (filePath) {
      // 自动进入验证步骤
      console.log('[DataImport] File found, validating...');
      const result = await validateDataFile(filePath);
      console.log('[DataImport] validateDataFile result:', result);
      if (result?.valid) {
        setCurrentStep(1);
      }
    } else {
      console.log('[DataImport] File not found');
    }
  }, [currentProject, detectDataFile, validateDataFile, resetState]);

  // 开始导入
  const handleImport = useCallback(async () => {
    if (!currentProject) return;
    
    setCurrentStep(2);
    const success = await startImport(currentProject.path, detectedFilePath || undefined);
    
    if (success) {
      // 刷新项目列表以更新统计信息
      await loadProjects();
    }
  }, [currentProject, detectedFilePath, startImport, loadProjects]);

  // 重置并重新开始
  const handleReset = useCallback(() => {
    resetState();
    setCurrentStep(0);
  }, [resetState]);

  // 如果没有当前项目，显示提示
  if (!currentProject) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <FolderIcon />
          <h2>请先选择一个项目</h2>
          <p>数据导入需要在打开项目后进行。请先创建或选择一个整合包项目。</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 页面头部 */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>数据导入</h1>
          <p className={styles.description}>
            从附属Mod导出的数据文件导入到项目中
          </p>
        </div>
      </div>

      {/* 当前项目信息 */}
      <div className={styles.projectInfo}>
        <div className={styles.projectInfoIcon}>
          <FolderIcon />
        </div>
        <div className={styles.projectInfoContent}>
          <h3>{currentProject.name}</h3>
          <p>{currentProject.path}</p>
          <div className={styles.projectInfoTags}>
            <span className={styles.tag}>{currentProject.mcVersion}</span>
            <span className={styles.tag}>{currentProject.modLoader}</span>
          </div>
        </div>
      </div>

      {/* 步骤指示器 */}
      <StepIndicator currentStep={currentStep} steps={steps} />

      {/* 错误提示 */}
      {(detectionError || validationError || importError) && (
        <div className={styles.errorAlert}>
          <AlertIcon />
          <div>
            <strong>操作失败</strong>
            <p>{detectionError || validationError || importError}</p>
          </div>
        </div>
      )}

      {/* 步骤 1: 检测数据 */}
      {currentStep === 0 && (
        <div className={styles.stepContent}>
          {!isDetecting && !isValidating && !detectedFilePath && (
            <div className={styles.detectPrompt}>
              <DatabaseIcon />
              <h3>检测数据文件</h3>
              <p>
                点击下方按钮检测整合包目录中的数据文件。
                <br />
                预期路径：<code>delightify-exporter/export.sqlite</code>
              </p>
              <button className={styles.primaryButton} onClick={handleDetect}>
                <RefreshIcon />
                开始检测
              </button>
            </div>
          )}

          {(isDetecting || isValidating) && (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <p>{isDetecting ? '正在检测数据文件...' : '正在验证数据文件...'}</p>
            </div>
          )}

          {detectedFilePath && validationResult && !validationResult.valid && (
            <div className={styles.detectPrompt}>
              <AlertIcon />
              <h3>数据文件验证失败</h3>
              <p>{validationResult.error || '数据文件格式不正确或已损坏'}</p>
              <button className={styles.primaryButton} onClick={handleDetect}>
                <RefreshIcon />
                重新检测
              </button>
            </div>
          )}
        </div>
      )}

      {/* 步骤 2: 预览确认 */}
      {currentStep === 1 && validationResult && (
        <div className={styles.stepContent}>
          <div className={styles.previewSection}>
            <h3 className={styles.sectionTitle}>
              <CheckIcon />
              数据验证成功
            </h3>
            
            {/* 元信息 */}
            <div className={styles.metaInfo}>
              {validationResult.minecraftVersion && (
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Minecraft 版本</span>
                  <span className={styles.metaValue}>{validationResult.minecraftVersion}</span>
                </div>
              )}
              {validationResult.forgeVersion && (
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Forge 版本</span>
                  <span className={styles.metaValue}>{validationResult.forgeVersion}</span>
                </div>
              )}
              {validationResult.exportedAt && (
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>导出时间</span>
                  <span className={styles.metaValue}>
                    {new Date(validationResult.exportedAt).toLocaleString('zh-CN')}
                  </span>
                </div>
              )}
            </div>

            {/* 数据预览卡片 */}
            <div className={styles.previewCards}>
              <DataPreviewCard
                icon={<PackageIcon />}
                title="模组"
                count={validationResult.modCount || 0}
                color="blue"
              />
              <DataPreviewCard
                icon={<CubeIcon />}
                title="物品"
                count={validationResult.itemCount || 0}
                color="green"
              />
              <DataPreviewCard
                icon={<DatabaseIcon />}
                title="配方"
                count={validationResult.recipeCount || 0}
                color="orange"
              />
              <DataPreviewCard
                icon={<TagIcon />}
                title="标签关联"
                count={validationResult.tagCount || 0}
                color="purple"
              />
            </div>

            {/* 操作按钮 */}
            <div className={styles.actionButtons}>
              <button className={styles.secondaryButton} onClick={handleReset}>
                重新检测
              </button>
              <button className={styles.primaryButton} onClick={handleImport}>
                开始导入
                <ChevronRightIcon />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 步骤 3: 执行导入 */}
      {currentStep === 2 && (
        <div className={styles.stepContent}>
          {isImporting && (
            <div className={styles.importingState}>
              <DatabaseIcon />
              <h3>正在导入数据...</h3>
              <ProgressBar progress={importProgress} />
            </div>
          )}

          {!isImporting && importResult && (
            <div className={styles.importResult}>
              {importResult.success ? (
                <>
                  <div className={styles.successIcon}>
                    <CheckIcon />
                  </div>
                  <h3>导入成功！</h3>
                  <p>数据已成功导入到项目中</p>
                  
                  {importResult.stats && (
                    <div className={styles.resultStats}>
                      <div className={styles.resultStat}>
                        <span className={styles.resultStatValue}>{importResult.stats.modCount}</span>
                        <span className={styles.resultStatLabel}>模组</span>
                      </div>
                      <div className={styles.resultStat}>
                        <span className={styles.resultStatValue}>{importResult.stats.itemCount}</span>
                        <span className={styles.resultStatLabel}>物品</span>
                      </div>
                      <div className={styles.resultStat}>
                        <span className={styles.resultStatValue}>{importResult.stats.recipeCount}</span>
                        <span className={styles.resultStatLabel}>配方</span>
                      </div>
                      <div className={styles.resultStat}>
                        <span className={styles.resultStatValue}>{importResult.stats.tagCount}</span>
                        <span className={styles.resultStatLabel}>标签</span>
                      </div>
                    </div>
                  )}

                  <button className={styles.primaryButton} onClick={handleReset}>
                    <RefreshIcon />
                    再次导入
                  </button>
                </>
              ) : (
                <>
                  <div className={`${styles.successIcon} ${styles.errorIcon}`}>
                    <AlertIcon />
                  </div>
                  <h3>导入失败</h3>
                  <p>{importResult.error || '未知错误'}</p>
                  <button className={styles.primaryButton} onClick={handleImport}>
                    重试
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

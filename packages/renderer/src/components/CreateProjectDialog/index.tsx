/**
 * Create Project Dialog - 创建项目对话框
 * 用于创建新的 Minecraft 整合包项目
 */

import React, { useState, useCallback } from 'react';
import { useI18n } from '../../i18n';
import { useProjectStore } from '../../store/projectStore';
import type { CreateProjectData, ModLoader } from '@delightify/shared';
import styles from './style.module.css';

// Icons
const CloseIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const FolderIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
  </svg>
);

const AlertIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </svg>
);

// Minecraft 版本选项
const mcVersionOptions = [
  '1.21.1',
  '1.20.6',
  '1.20.4',
  '1.20.1',
  '1.19.4',
  '1.19.2',
  '1.18.2',
  '1.16.5',
  '1.12.2',
];

// 模组加载器选项
const modLoaderOptions: { value: ModLoader; label: string; description: string }[] = [
  { value: 'forge', label: 'Forge', description: '经典的 Minecraft 模组加载器' },
  { value: 'fabric', label: 'Fabric', description: '轻量级、现代的模组框架' },
  { value: 'neoforge', label: 'NeoForge', description: 'Forge 的分支，持续更新中' },
  { value: 'quilt', label: 'Quilt', description: 'Fabric 的继承者，注重兼容性' },
];

interface CreateProjectDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateProjectDialog({ onClose, onSuccess }: CreateProjectDialogProps): React.ReactElement {
  const { t } = useI18n();
  const { createProject, openDirectoryDialog, isCreating, createError, clearErrors } = useProjectStore();

  // 表单状态
  const [formData, setFormData] = useState<CreateProjectData>({
    name: '',
    description: '',
    path: '',
    mcVersion: '1.20.1',
    modLoader: 'forge',
    modLoaderVersion: '',
  });

  // 表单验证错误
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  // 提交错误
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 验证表单
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = t('projectManager.validation.nameRequired');
    } else if (formData.name.length > 50) {
      errors.name = t('projectManager.validation.nameTooLong');
    }

    if (!formData.path.trim()) {
      errors.path = t('projectManager.validation.pathRequired');
    }

    if (!formData.mcVersion.trim()) {
      errors.mcVersion = t('projectManager.validation.mcVersionRequired');
    }

    if (!formData.modLoader) {
      errors.modLoader = t('projectManager.validation.modLoaderRequired');
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, t]);

  // 处理输入变化
  const handleChange = (field: keyof CreateProjectData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // 清除对应字段的验证错误
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
    // 清除提交错误
    if (submitError) {
      setSubmitError(null);
    }
    if (createError) {
      clearErrors();
    }
  };

  // 处理选择目录
  const handleSelectDirectory = async () => {
    const selectedPath = await openDirectoryDialog();
    if (selectedPath) {
      handleChange('path', selectedPath);
      // 如果名称为空，使用目录名作为默认值
      if (!formData.name) {
        const dirName = selectedPath.split(/[/\\]/).pop() || '';
        handleChange('name', dirName);
      }
    }
  };

  // 处理提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const result = await createProject({
      ...formData,
      name: formData.name.trim(),
      description: formData.description?.trim() || '',
    });

    if (result) {
      onSuccess();
    } else {
      setSubmitError(createError || t('projectManager.createFailed'));
    }
  };

  // 阻止点击对话框内部时关闭
  const handleDialogClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={handleDialogClick}>
        {/* 头部 */}
        <div className={styles.header}>
          <h2>{t('projectManager.createProject')}</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className={styles.form}>
          {/* 项目名称 */}
          <div className={styles.formGroup}>
            <label htmlFor="projectName">
              {t('projectManager.projectName')}
              <span className={styles.required}>*</span>
            </label>
            <input
              id="projectName"
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder={t('projectManager.projectNamePlaceholder')}
              disabled={isCreating}
              className={validationErrors.name ? styles.error : ''}
            />
            {validationErrors.name && (
              <span className={styles.errorText}>{validationErrors.name}</span>
            )}
          </div>

          {/* 项目路径 */}
          <div className={styles.formGroup}>
            <label htmlFor="projectPath">
              {t('projectManager.projectPath')}
              <span className={styles.required}>*</span>
            </label>
            <div className={styles.pathInputGroup}>
              <input
                id="projectPath"
                type="text"
                value={formData.path}
                onChange={(e) => handleChange('path', e.target.value)}
                placeholder={t('projectManager.projectPathPlaceholder')}
                disabled={isCreating}
                className={validationErrors.path ? styles.error : ''}
              />
              <button
                type="button"
                className={styles.browseButton}
                onClick={handleSelectDirectory}
                disabled={isCreating}
              >
                <FolderIcon />
                {t('projectManager.browse')}
              </button>
            </div>
            {validationErrors.path && (
              <span className={styles.errorText}>{validationErrors.path}</span>
            )}
          </div>

          {/* Minecraft 版本 */}
          <div className={styles.formGroup}>
            <label htmlFor="mcVersion">
              {t('projectManager.mcVersion')}
              <span className={styles.required}>*</span>
            </label>
            <select
              id="mcVersion"
              value={formData.mcVersion}
              onChange={(e) => handleChange('mcVersion', e.target.value)}
              disabled={isCreating}
              className={validationErrors.mcVersion ? styles.error : ''}
            >
              {mcVersionOptions.map(version => (
                <option key={version} value={version}>
                  {version}
                </option>
              ))}
            </select>
            {validationErrors.mcVersion && (
              <span className={styles.errorText}>{validationErrors.mcVersion}</span>
            )}
          </div>

          {/* 模组加载器 */}
          <div className={styles.formGroup}>
            <label>
              {t('projectManager.modLoader')}
              <span className={styles.required}>*</span>
            </label>
            <div className={styles.modLoaderGrid}>
              {modLoaderOptions.map(loader => (
                <label
                  key={loader.value}
                  className={`${styles.modLoaderOption} ${
                    formData.modLoader === loader.value ? styles.selected : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="modLoader"
                    value={loader.value}
                    checked={formData.modLoader === loader.value}
                    onChange={(e) => handleChange('modLoader', e.target.value as ModLoader)}
                    disabled={isCreating}
                  />
                  <span className={styles.modLoaderName}>{loader.label}</span>
                  <span className={styles.modLoaderDesc}>{loader.description}</span>
                </label>
              ))}
            </div>
            {validationErrors.modLoader && (
              <span className={styles.errorText}>{validationErrors.modLoader}</span>
            )}
          </div>

          {/* 模组加载器版本（可选） */}
          <div className={styles.formGroup}>
            <label htmlFor="modLoaderVersion">
              {t('projectManager.modLoaderVersion')}
              <span className={styles.optional}>{t('common.optional')}</span>
            </label>
            <input
              id="modLoaderVersion"
              type="text"
              value={formData.modLoaderVersion}
              onChange={(e) => handleChange('modLoaderVersion', e.target.value)}
              placeholder={t('projectManager.modLoaderVersionPlaceholder')}
              disabled={isCreating}
            />
          </div>

          {/* 项目描述 */}
          <div className={styles.formGroup}>
            <label htmlFor="projectDescription">
              {t('projectManager.projectDescription')}
              <span className={styles.optional}>{t('common.optional')}</span>
            </label>
            <textarea
              id="projectDescription"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder={t('projectManager.projectDescriptionPlaceholder')}
              disabled={isCreating}
              rows={3}
            />
          </div>

          {/* 提交错误 */}
          {(submitError || createError) && (
            <div className={styles.submitError}>
              <AlertIcon />
              <span>{submitError || createError}</span>
            </div>
          )}

          {/* 底部操作按钮 */}
          <div className={styles.footer}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={isCreating}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <span className={styles.spinner} />
                  {t('projectManager.creating')}
                </>
              ) : (
                t('projectManager.create')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

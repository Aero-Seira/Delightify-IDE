import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution';
import 'monaco-editor/esm/vs/language/json/monaco.contribution';
import type { ScriptWorkspaceFile, ScriptWorkspaceReadResult } from '@delightify/shared';
import { electronAPI } from '../../ipc';
import { useProjectStore } from '../../store/projectStore';
import styles from './style.module.css';

loader.config({ monaco });

function kindLabel(kind: ScriptWorkspaceFile['kind']): string {
  switch (kind) {
    case 'managed':
      return 'Managed';
    case 'manifest':
      return 'Manifest';
    case 'user':
      return 'User';
  }
}

function formatSize(size: number | undefined): string {
  if (size === undefined) {
    return '-';
  }
  if (size < 1024) {
    return `${size} B`;
  }
  return `${(size / 1024).toFixed(1)} KB`;
}

function fileReadOnlyReason(file: ScriptWorkspaceFile | null): string {
  if (!file) {
    return '选择一个文件查看内容。';
  }
  if (file.editable) {
    return 'Delightify managed 文件，可在保存前审阅内容。';
  }
  if (file.kind === 'manifest') {
    return '生成清单只读，用于判断 Delightify managed 文件归属。';
  }
  return '用户脚本默认只读，当前阶段不会覆盖手写脚本。';
}

export default function ScriptWorkspacePage(): React.ReactElement {
  const { currentProject } = useProjectStore();
  const [files, setFiles] = useState<ScriptWorkspaceFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [readResult, setReadResult] = useState<ScriptWorkspaceReadResult | null>(null);
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const selectedFile = readResult?.file ?? files.find(file => file.relativePath === selectedPath) ?? null;
  const isDirty = content !== originalContent;

  const groupedFiles = useMemo(() => ({
    managed: files.filter(file => file.kind === 'managed'),
    manifest: files.filter(file => file.kind === 'manifest'),
    user: files.filter(file => file.kind === 'user'),
  }), [files]);

  const loadFiles = useCallback(async (): Promise<void> => {
    if (!currentProject) {
      setFiles([]);
      setSelectedPath(null);
      setReadResult(null);
      setContent('');
      setOriginalContent('');
      return;
    }

    setIsLoadingFiles(true);
    setError(null);
    setSaveMessage(null);

    try {
      const response = await electronAPI().scriptWorkspaceList(currentProject.path);
      if (!response.success || !response.data) {
        throw new Error(response.error || '脚本文件列表读取失败');
      }
      setFiles(response.data.files);
      setSelectedPath(previous => {
        if (previous && response.data?.files.some(file => file.relativePath === previous)) {
          return previous;
        }
        return response.data?.files[0]?.relativePath ?? null;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '脚本文件列表读取失败');
    } finally {
      setIsLoadingFiles(false);
    }
  }, [currentProject]);

  const loadFile = useCallback(async (relativePath: string): Promise<void> => {
    if (!currentProject) {
      return;
    }

    setIsLoadingFile(true);
    setError(null);
    setSaveMessage(null);

    try {
      const response = await electronAPI().scriptWorkspaceRead(currentProject.path, relativePath);
      if (!response.success || !response.data) {
        throw new Error(response.error || '脚本文件读取失败');
      }
      setReadResult(response.data);
      setContent(response.data.content);
      setOriginalContent(response.data.content);
    } catch (caught) {
      setReadResult(null);
      setContent('');
      setOriginalContent('');
      setError(caught instanceof Error ? caught.message : '脚本文件读取失败');
    } finally {
      setIsLoadingFile(false);
    }
  }, [currentProject]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    if (selectedPath) {
      void loadFile(selectedPath);
    }
  }, [loadFile, selectedPath]);

  const selectFile = (file: ScriptWorkspaceFile): void => {
    if (isDirty && !window.confirm('当前文件有未保存修改，切换文件会丢弃这些修改。继续？')) {
      return;
    }
    setSelectedPath(file.relativePath);
  };

  const saveFile = async (): Promise<void> => {
    if (!currentProject || !selectedFile || !selectedFile.editable) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      const response = await electronAPI().scriptWorkspaceSave(
        currentProject.path,
        selectedFile.relativePath,
        content
      );
      if (!response.success || !response.data) {
        throw new Error(response.error || '脚本文件保存失败');
      }
      setReadResult(previous => previous ? { ...previous, file: response.data!.file } : previous);
      setOriginalContent(content);
      setSaveMessage(`已保存 ${new Date(response.data.savedAt).toLocaleString()}`);
      await loadFiles();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '脚本文件保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const renderFileGroup = (
    title: string,
    groupFiles: ScriptWorkspaceFile[]
  ): React.ReactElement | null => {
    if (groupFiles.length === 0) {
      return null;
    }

    return (
      <div className={styles.fileGroup}>
        <div className={styles.groupTitle}>{title}</div>
        {groupFiles.map(file => (
          <button
            key={file.relativePath}
            type="button"
            className={`${styles.fileItem} ${selectedPath === file.relativePath ? styles.fileItemActive : ''}`}
            onClick={() => selectFile(file)}
          >
            <span className={styles.filePath}>{file.relativePath}</span>
            <span className={styles.fileMeta}>
              <span className={`${styles.kindBadge} ${styles[`kind-${file.kind}`]}`}>
                {kindLabel(file.kind)}
              </span>
              <span>{formatSize(file.size)}</span>
            </span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Script Workspace</h1>
          <p className={styles.description}>
            查看 KubeJS 受管产物和用户脚本；当前只允许保存 Delightify managed 文件。
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void loadFiles()}
            disabled={!currentProject || isLoadingFiles}
          >
            {isLoadingFiles ? '刷新中...' : '刷新'}
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={saveFile}
            disabled={!selectedFile?.editable || !isDirty || isSaving}
          >
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {!currentProject && (
        <div className={styles.notice}>请先在项目管理中打开或创建一个 Minecraft 实例项目。</div>
      )}

      <div className={styles.layout}>
        <aside className={styles.filePanel}>
          <div className={styles.panelHeader}>
            <h2>文件</h2>
            <span>{files.length}</span>
          </div>
          {files.length === 0 && (
            <div className={styles.emptyState}>
              {isLoadingFiles ? '正在读取文件...' : '未发现 KubeJS 脚本或 Delightify 生成文件。'}
            </div>
          )}
          {renderFileGroup('Delightify managed', groupedFiles.managed)}
          {renderFileGroup('Manifest', groupedFiles.manifest)}
          {renderFileGroup('User scripts', groupedFiles.user)}
        </aside>

        <section className={styles.editorPanel}>
          <div className={styles.editorHeader}>
            <div className={styles.fileTitle}>
              <strong>{selectedFile?.relativePath ?? '未选择文件'}</strong>
              <span>{fileReadOnlyReason(selectedFile)}</span>
            </div>
            <div className={styles.fileStatus}>
              {selectedFile && (
                <span className={`${styles.kindBadge} ${styles[`kind-${selectedFile.kind}`]}`}>
                  {kindLabel(selectedFile.kind)}
                </span>
              )}
              {isDirty && <span className={styles.dirtyBadge}>未保存</span>}
              {selectedFile && !selectedFile.editable && <span className={styles.readOnlyBadge}>只读</span>}
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}
          {saveMessage && <div className={styles.success}>{saveMessage}</div>}

          <div className={styles.editorShell}>
            {isLoadingFile ? (
              <div className={styles.emptyState}>正在读取文件...</div>
            ) : selectedFile ? (
              <Editor
                height="100%"
                language={selectedFile.language}
                value={content}
                theme="vs-dark"
                onChange={value => setContent(value ?? '')}
                options={{
                  readOnly: !selectedFile.editable,
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  automaticLayout: true,
                  tabSize: 2,
                }}
              />
            ) : (
              <div className={styles.emptyState}>选择一个文件开始查看。</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

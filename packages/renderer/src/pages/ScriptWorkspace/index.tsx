import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution';
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution';
import 'monaco-editor/esm/vs/language/json/monaco.contribution';
import type { ScriptWorkspaceDirectory, ScriptWorkspaceFile } from '@delightify/shared';
import { useI18n } from '../../i18n';
import { electronAPI } from '../../ipc';
import { useProjectStore } from '../../store/projectStore';
import styles from './style.module.css';

loader.config({ monaco });

interface OpenFileTab {
  file: ScriptWorkspaceFile;
  content: string;
  originalContent: string;
}

interface FileTreeNode {
  name: string;
  relativePath: string;
  type: 'directory' | 'file';
  children: FileTreeNode[];
  file?: ScriptWorkspaceFile;
  directory?: ScriptWorkspaceDirectory;
}

type OperationMode = 'create-file' | 'create-directory' | 'rename';

function kindLabel(kind: ScriptWorkspaceFile['kind'], t: (key: string) => string): string {
  switch (kind) {
    case 'managed':
      return t('scriptWorkspace.kindManaged');
    case 'manifest':
      return t('scriptWorkspace.kindManifest');
    case 'user':
      return t('scriptWorkspace.kindUser');
    case 'readonly':
      return t('scriptWorkspace.kindReadonly');
  }
}

function fileName(relativePath: string): string {
  return relativePath.split('/').pop() ?? relativePath;
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

function fileReadOnlyReason(file: ScriptWorkspaceFile | null, t: (key: string) => string): string {
  if (!file) {
    return t('scriptWorkspace.selectFileHint');
  }
  if (file.editable) {
    if (file.kind === 'user') {
      return t('scriptWorkspace.userEditableReason');
    }
    return t('scriptWorkspace.managedEditableReason');
  }
  if (file.kind === 'manifest') {
    return t('scriptWorkspace.manifestReadOnlyReason');
  }
  return file.readOnlyReason ?? t('scriptWorkspace.defaultReadOnlyReason');
}

function canCopyAsManaged(file: ScriptWorkspaceFile | null): boolean {
  if (!file || file.kind !== 'user') {
    return false;
  }
  return (
    file.relativePath.endsWith('.js') &&
    (
      file.relativePath.startsWith('kubejs/server_scripts/') ||
      file.relativePath.startsWith('kubejs/client_scripts/') ||
      file.relativePath.startsWith('kubejs/startup_scripts/')
    )
  );
}

function insertDirectoryNode(root: FileTreeNode, directory: ScriptWorkspaceDirectory): void {
  const parts = directory.relativePath.split('/');
  let current = root;

  parts.forEach((part, index) => {
    const childPath = parts.slice(0, index + 1).join('/');
    let child = current.children.find(node => node.name === part && node.type === 'directory');

    if (!child) {
      child = {
        name: part,
        relativePath: childPath,
        type: 'directory',
        children: [],
      };
      current.children.push(child);
    }

    if (index === parts.length - 1) {
      child.directory = directory;
    }
    current = child;
  });
}

function insertFileNode(root: FileTreeNode, file: ScriptWorkspaceFile): void {
  const parts = file.relativePath.split('/');
  let current = root;

  parts.forEach((part, index) => {
    const isFile = index === parts.length - 1;
    const childPath = parts.slice(0, index + 1).join('/');
    let child = current.children.find(node => node.name === part && node.type === (isFile ? 'file' : 'directory'));

    if (!child) {
      child = {
        name: part,
        relativePath: childPath,
        type: isFile ? 'file' : 'directory',
        children: [],
        file: isFile ? file : undefined,
      };
      current.children.push(child);
    }
    if (isFile) {
      child.file = file;
    }
    current = child;
  });
}

function sortTree(node: FileTreeNode): FileTreeNode {
  return {
    ...node,
    children: node.children
      .map(sortTree)
      .sort((left, right) => {
        if (left.type !== right.type) {
          return left.type === 'directory' ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      }),
  };
}

function buildFileTree(files: ScriptWorkspaceFile[], directories: ScriptWorkspaceDirectory[]): FileTreeNode {
  const root: FileTreeNode = {
    name: '',
    relativePath: '',
    type: 'directory',
    children: [],
  };

  directories.forEach(directory => insertDirectoryNode(root, directory));
  files.forEach(file => insertFileNode(root, file));
  return sortTree(root);
}

export default function ScriptWorkspacePage(): React.ReactElement {
  const { t } = useI18n();
  const { currentProject } = useProjectStore();
  const [files, setFiles] = useState<ScriptWorkspaceFile[]>([]);
  const [directories, setDirectories] = useState<ScriptWorkspaceDirectory[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedDirectoryPath, setSelectedDirectoryPath] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<OpenFileTab[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set(['kubejs', 'config']));
  const [failedOpenPath, setFailedOpenPath] = useState<string | null>(null);
  const [operationMode, setOperationMode] = useState<OperationMode | null>(null);
  const [operationPath, setOperationPath] = useState('');
  const [operationError, setOperationError] = useState<string | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingManaged, setIsCreatingManaged] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isCreatingDirectory, setIsCreatingDirectory] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isCopyingManaged, setIsCopyingManaged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const selectedTab = openTabs.find(tab => tab.file.relativePath === selectedPath) ?? null;
  const selectedFile = selectedTab?.file ?? files.find(file => file.relativePath === selectedPath) ?? null;
  const isDirty = Boolean(selectedTab && selectedTab.content !== selectedTab.originalContent);
  const fileTree = useMemo(() => buildFileTree(files, directories), [directories, files]);

  const loadFiles = useCallback(async (): Promise<void> => {
    if (!currentProject) {
      setFiles([]);
      setDirectories([]);
      setSelectedPath(null);
      setSelectedDirectoryPath(null);
      setOpenTabs([]);
      return;
    }

    setIsLoadingFiles(true);
    setError(null);
    setSaveMessage(null);

    try {
      const response = await electronAPI().scriptWorkspaceList(currentProject.path);
      if (!response.success || !response.data) {
        throw new Error(response.error || t('scriptWorkspace.listFailed'));
      }
      setFiles(response.data.files);
      setDirectories(response.data.directories ?? []);
      setOpenTabs(previous => previous.map(tab => {
        const updatedFile = response.data?.files.find(file => file.relativePath === tab.file.relativePath);
        return updatedFile ? { ...tab, file: updatedFile } : tab;
      }));
      setSelectedPath(previous => {
        if (previous && response.data?.files.some(file => file.relativePath === previous)) {
          return previous;
        }
        return response.data?.files[0]?.relativePath ?? null;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('scriptWorkspace.listFailed'));
    } finally {
      setIsLoadingFiles(false);
    }
  }, [currentProject, t]);

  const openFile = useCallback(async (relativePath: string): Promise<void> => {
    if (!currentProject) {
      return;
    }

    setSelectedPath(relativePath);
    if (openTabs.some(tab => tab.file.relativePath === relativePath)) {
      return;
    }

    setFailedOpenPath(null);
    setIsLoadingFile(true);
    setError(null);
    setSaveMessage(null);

    try {
      const response = await electronAPI().scriptWorkspaceRead(currentProject.path, relativePath);
      if (!response.success || !response.data) {
        throw new Error(response.error || t('scriptWorkspace.readFailed'));
      }
      setOpenTabs(previous => {
        if (previous.some(tab => tab.file.relativePath === response.data!.file.relativePath)) {
          return previous;
        }
        return [
          ...previous,
          {
            file: response.data!.file,
            content: response.data!.content,
            originalContent: response.data!.content,
          },
        ];
      });
    } catch (caught) {
      setFailedOpenPath(relativePath);
      setError(caught instanceof Error ? caught.message : t('scriptWorkspace.readFailed'));
    } finally {
      setIsLoadingFile(false);
    }
  }, [currentProject, openTabs, t]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    if (
      selectedPath &&
      selectedPath !== failedOpenPath &&
      !openTabs.some(tab => tab.file.relativePath === selectedPath)
    ) {
      void openFile(selectedPath);
    }
  }, [failedOpenPath, openFile, openTabs, selectedPath]);

  function parentDirectory(relativePath: string): string {
    const parts = relativePath.split('/');
    parts.pop();
    return parts.join('/');
  }

  const selectFile = (file: ScriptWorkspaceFile): void => {
    setSelectedDirectoryPath(parentDirectory(file.relativePath));
    void openFile(file.relativePath);
  };

  const operationBaseDirectory = (): string => {
    if (selectedDirectoryPath) {
      return selectedDirectoryPath;
    }
    if (selectedFile) {
      return parentDirectory(selectedFile.relativePath);
    }
    return directories.find(directory => directory.relativePath === 'kubejs/server_scripts')?.relativePath
      ?? directories[0]?.relativePath
      ?? 'kubejs/server_scripts';
  };

  const defaultFilePathForBase = (baseDirectory: string): string => {
    if (
      baseDirectory.startsWith('kubejs/server_scripts') ||
      baseDirectory.startsWith('kubejs/client_scripts') ||
      baseDirectory.startsWith('kubejs/startup_scripts')
    ) {
      return `${baseDirectory}/user_script.js`;
    }
    if (baseDirectory.startsWith('config')) {
      return `${baseDirectory}/new_config.toml`;
    }
    return `${baseDirectory}/new_file.json`;
  };

  const openOperation = (mode: OperationMode): void => {
    setOperationMode(mode);
    setOperationError(null);
    if (mode === 'create-file') {
      setOperationPath(defaultFilePathForBase(operationBaseDirectory()));
    } else if (mode === 'create-directory') {
      setOperationPath(`${operationBaseDirectory()}/new_folder`);
    } else {
      setOperationPath(selectedFile?.relativePath ?? '');
    }
  };

  const operationTitle = (): string => {
    if (operationMode === 'create-file') {
      return t('scriptWorkspace.createFileTitle');
    }
    if (operationMode === 'create-directory') {
      return t('scriptWorkspace.createDirectoryTitle');
    }
    return t('scriptWorkspace.renameTitle');
  };

  const operationPlaceholder = (): string => {
    if (operationMode === 'create-file') {
      return t('scriptWorkspace.createFilePlaceholder');
    }
    if (operationMode === 'create-directory') {
      return t('scriptWorkspace.createDirectoryPlaceholder');
    }
    return t('scriptWorkspace.renamePlaceholder');
  };

  const saveFile = async (): Promise<void> => {
    if (!currentProject || !selectedTab || !selectedFile || !selectedFile.editable) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      const confirmedUserFileWrite = selectedFile.kind === 'user'
        ? window.confirm(t('scriptWorkspace.userSaveConfirm'))
        : true;
      if (!confirmedUserFileWrite) {
        return;
      }

      const response = await electronAPI().scriptWorkspaceSave(
        currentProject.path,
        selectedFile.relativePath,
        selectedTab.content,
        { confirmUserFileWrite: selectedFile.kind === 'user' }
      );
      if (!response.success || !response.data) {
        throw new Error(response.error || t('scriptWorkspace.saveFailed'));
      }
      setOpenTabs(previous => previous.map(tab => (
        tab.file.relativePath === response.data!.file.relativePath
          ? { ...tab, file: response.data!.file, originalContent: tab.content }
          : tab
      )));
      setSaveMessage(t('scriptWorkspace.savedAt', { time: new Date(response.data.savedAt).toLocaleString() }));
      await loadFiles();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('scriptWorkspace.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (!isSaving && isDirty) {
          void saveFile();
        }
      }
    };

    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  }, [isDirty, isSaving, saveFile]);

  const createManagedScript = async (): Promise<void> => {
    if (!currentProject) {
      return;
    }

    setIsCreatingManaged(true);
    setError(null);
    setSaveMessage(null);

    try {
      const response = await electronAPI().scriptWorkspaceCreateManaged(currentProject.path);
      if (!response.success || !response.data) {
        throw new Error(response.error || t('scriptWorkspace.createManagedFailed'));
      }
      setSelectedPath(response.data.file.relativePath);
      setOpenTabs(previous => [
        ...previous.filter(tab => tab.file.relativePath !== response.data!.file.relativePath),
        {
          file: response.data!.file,
          content: response.data!.content,
          originalContent: response.data!.content,
        },
      ]);
      setSaveMessage(response.data.created ? t('scriptWorkspace.managedCreated') : t('scriptWorkspace.managedOpened'));
      await loadFiles();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('scriptWorkspace.createManagedFailed'));
    } finally {
      setIsCreatingManaged(false);
    }
  };

  const createUserFile = async (): Promise<void> => {
    if (!currentProject) {
      return;
    }

    const trimmedPath = operationPath.trim();
    if (trimmedPath.length === 0) {
      setOperationError(t('scriptWorkspace.operationPathRequired'));
      return;
    }

    setIsCreatingUser(true);
    setError(null);
    setSaveMessage(null);

    try {
      const response = await electronAPI().scriptWorkspaceCreateUser(currentProject.path, trimmedPath);
      if (!response.success || !response.data) {
        throw new Error(response.error || t('scriptWorkspace.createUserFailed'));
      }
      setSelectedPath(response.data.file.relativePath);
      setSelectedDirectoryPath(parentDirectory(response.data.file.relativePath));
      setExpandedPaths(previous => new Set([...previous, parentDirectory(response.data!.file.relativePath)]));
      setOpenTabs(previous => [
        ...previous.filter(tab => tab.file.relativePath !== response.data!.file.relativePath),
        {
          file: response.data!.file,
          content: response.data!.content,
          originalContent: response.data!.content,
        },
      ]);
      setSaveMessage(t('scriptWorkspace.userCreated'));
      setOperationMode(null);
      await loadFiles();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('scriptWorkspace.createUserFailed'));
    } finally {
      setIsCreatingUser(false);
    }
  };

  const createDirectory = async (): Promise<void> => {
    if (!currentProject) {
      return;
    }

    const trimmedPath = operationPath.trim();
    if (trimmedPath.length === 0) {
      setOperationError(t('scriptWorkspace.operationPathRequired'));
      return;
    }

    setIsCreatingDirectory(true);
    setError(null);
    setSaveMessage(null);

    try {
      const response = await electronAPI().scriptWorkspaceCreateDirectory(currentProject.path, trimmedPath);
      if (!response.success || !response.data) {
        throw new Error(response.error || t('scriptWorkspace.createDirectoryFailed'));
      }
      setSelectedDirectoryPath(response.data.directory.relativePath);
      setExpandedPaths(previous => {
        const next = new Set(previous);
        next.add(response.data!.directory.relativePath);
        const parent = parentDirectory(response.data!.directory.relativePath);
        if (parent) {
          next.add(parent);
        }
        return next;
      });
      setSaveMessage(response.data.created ? t('scriptWorkspace.directoryCreated') : t('scriptWorkspace.directoryOpened'));
      setOperationMode(null);
      await loadFiles();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('scriptWorkspace.createDirectoryFailed'));
    } finally {
      setIsCreatingDirectory(false);
    }
  };

  const renameSelectedFile = async (): Promise<void> => {
    if (!currentProject || !selectedFile) {
      setOperationError(t('scriptWorkspace.renameRequiresFile'));
      return;
    }
    if (selectedFile.kind !== 'user') {
      setOperationError(t('scriptWorkspace.renameRequiresFile'));
      return;
    }

    const trimmedPath = operationPath.trim();
    if (trimmedPath.length === 0) {
      setOperationError(t('scriptWorkspace.operationPathRequired'));
      return;
    }
    if (!window.confirm(t('scriptWorkspace.renameUserConfirm'))) {
      return;
    }

    setIsRenaming(true);
    setError(null);
    setSaveMessage(null);

    try {
      const response = await electronAPI().scriptWorkspaceRename(
        currentProject.path,
        selectedFile.relativePath,
        trimmedPath,
        { confirmUserFileWrite: true }
      );
      if (!response.success || !response.data) {
        throw new Error(response.error || t('scriptWorkspace.renameFailed'));
      }
      setSelectedPath(response.data.file.relativePath);
      setSelectedDirectoryPath(parentDirectory(response.data.file.relativePath));
      setOpenTabs(previous => previous.map(tab => (
        tab.file.relativePath === response.data!.previousRelativePath
          ? { ...tab, file: response.data!.file }
          : tab
      )));
      setExpandedPaths(previous => new Set([...previous, parentDirectory(response.data!.file.relativePath)]));
      setSaveMessage(t('scriptWorkspace.renamedFile', { path: response.data.file.relativePath }));
      setOperationMode(null);
      await loadFiles();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('scriptWorkspace.renameFailed'));
    } finally {
      setIsRenaming(false);
    }
  };

  const submitOperation = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setOperationError(null);
    if (operationMode === 'create-file') {
      await createUserFile();
    } else if (operationMode === 'create-directory') {
      await createDirectory();
    } else if (operationMode === 'rename') {
      await renameSelectedFile();
    }
  };

  const copyAsManaged = async (): Promise<void> => {
    if (!currentProject || !selectedFile || !canCopyAsManaged(selectedFile)) {
      return;
    }

    if (isDirty && !window.confirm(t('scriptWorkspace.copyDirtyConfirm'))) {
      return;
    }

    setIsCopyingManaged(true);
    setError(null);
    setSaveMessage(null);

    try {
      const response = await electronAPI().scriptWorkspaceCopyAsManaged(
        currentProject.path,
        selectedFile.relativePath
      );
      if (!response.success || !response.data) {
        throw new Error(response.error || t('scriptWorkspace.copyManagedFailed'));
      }
      setSelectedPath(response.data.file.relativePath);
      setOpenTabs(previous => [
        ...previous.filter(tab => tab.file.relativePath !== response.data!.file.relativePath),
        {
          file: response.data!.file,
          content: response.data!.content,
          originalContent: response.data!.content,
        },
      ]);
      setSaveMessage(t('scriptWorkspace.copiedManaged', { path: response.data.sourceRelativePath }));
      await loadFiles();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('scriptWorkspace.copyManagedFailed'));
    } finally {
      setIsCopyingManaged(false);
    }
  };

  const toggleDirectory = (relativePath: string): void => {
    setExpandedPaths(previous => {
      const next = new Set(previous);
      if (next.has(relativePath)) {
        next.delete(relativePath);
      } else {
        next.add(relativePath);
      }
      return next;
    });
  };

  const updateSelectedContent = (nextContent: string): void => {
    if (!selectedPath) {
      return;
    }
    setOpenTabs(previous => previous.map(tab => (
      tab.file.relativePath === selectedPath ? { ...tab, content: nextContent } : tab
    )));
  };

  const closeTab = (relativePath: string, event: React.MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    const tab = openTabs.find(candidate => candidate.file.relativePath === relativePath);
    if (tab && tab.content !== tab.originalContent && !window.confirm(t('scriptWorkspace.closeTabConfirm'))) {
      return;
    }

    setOpenTabs(previous => previous.filter(candidate => candidate.file.relativePath !== relativePath));
    if (selectedPath === relativePath) {
      const index = openTabs.findIndex(candidate => candidate.file.relativePath === relativePath);
      const nextTab = openTabs[index + 1] ?? openTabs[index - 1] ?? null;
      setSelectedPath(nextTab?.file.relativePath ?? files[0]?.relativePath ?? null);
    }
  };

  const renderFileTreeNode = (node: FileTreeNode, depth = 0): React.ReactElement => {
    if (node.type === 'directory') {
      const expanded = expandedPaths.has(node.relativePath);
      return (
        <div key={node.relativePath || 'root'} className={styles.treeNode}>
          {node.relativePath && (
            <button
              type="button"
              className={`${styles.directoryItem} ${selectedDirectoryPath === node.relativePath ? styles.directoryItemActive : ''}`}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => {
                setSelectedDirectoryPath(node.relativePath);
                toggleDirectory(node.relativePath);
              }}
            >
              <span className={styles.treeCaret}>{expanded ? 'v' : '>'}</span>
              <span className={styles.directoryName}>{node.name}</span>
            </button>
          )}
          {(expanded || !node.relativePath) && node.children.map(child => renderFileTreeNode(
            child,
            node.relativePath ? depth + 1 : depth
          ))}
        </div>
      );
    }

    const file = node.file!;
    const tab = openTabs.find(candidate => candidate.file.relativePath === file.relativePath);
    const tabDirty = Boolean(tab && tab.content !== tab.originalContent);

    return (
      <button
        key={file.relativePath}
        type="button"
        className={`${styles.treeFileItem} ${selectedPath === file.relativePath ? styles.treeFileItemActive : ''}`}
        style={{ paddingLeft: 28 + depth * 14 }}
        onClick={() => selectFile(file)}
      >
        <span className={styles.fileLeafName}>{fileName(file.relativePath)}{tabDirty ? ' *' : ''}</span>
        <span className={styles.fileLeafMeta}>
          <span className={`${styles.kindBadge} ${styles[`kind-${file.kind}`]}`}>
            {kindLabel(file.kind, t)}
          </span>
          <span>{formatSize(file.size)}</span>
        </span>
      </button>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>{t('scriptWorkspace.title')}</h1>
          <p className={styles.description}>
            {t('scriptWorkspace.description')}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={createManagedScript}
            disabled={!currentProject || isCreatingManaged}
          >
            {isCreatingManaged ? t('scriptWorkspace.creating') : t('scriptWorkspace.createManaged')}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => openOperation('create-file')}
            disabled={!currentProject || isCreatingUser}
          >
            {isCreatingUser ? t('scriptWorkspace.creating') : t('scriptWorkspace.createUser')}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => openOperation('create-directory')}
            disabled={!currentProject || isCreatingDirectory}
          >
            {isCreatingDirectory ? t('scriptWorkspace.creating') : t('scriptWorkspace.createDirectory')}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => openOperation('rename')}
            disabled={!currentProject || selectedFile?.kind !== 'user' || isRenaming}
          >
            {isRenaming ? t('scriptWorkspace.saving') : t('scriptWorkspace.rename')}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={copyAsManaged}
            disabled={!currentProject || !canCopyAsManaged(selectedFile) || isCopyingManaged}
          >
            {isCopyingManaged ? t('scriptWorkspace.copying') : t('scriptWorkspace.copyAsManaged')}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void loadFiles()}
            disabled={!currentProject || isLoadingFiles}
          >
            {isLoadingFiles ? t('scriptWorkspace.refreshing') : t('scriptWorkspace.refresh')}
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={saveFile}
            disabled={!selectedTab || !selectedFile?.editable || !isDirty || isSaving}
          >
            {isSaving ? t('scriptWorkspace.saving') : t('scriptWorkspace.save')}
          </button>
        </div>
      </div>

      {!currentProject && (
        <div className={styles.notice}>{t('scriptWorkspace.noProject')}</div>
      )}

      <div className={styles.layout}>
        <aside className={styles.filePanel}>
          <div className={styles.panelHeader}>
            <h2>{t('scriptWorkspace.files')}</h2>
            <span>{files.length}</span>
          </div>
          {operationMode && (
            <form className={styles.operationForm} onSubmit={(event) => void submitOperation(event)}>
              <div className={styles.operationTitle}>{operationTitle()}</div>
              <label className={styles.operationLabel}>
                <span>{t('scriptWorkspace.operationPath')}</span>
                <input
                  value={operationPath}
                  onChange={(event) => setOperationPath(event.target.value)}
                  placeholder={operationPlaceholder()}
                  disabled={isCreatingUser || isCreatingDirectory || isRenaming}
                />
              </label>
              {operationError && <div className={styles.operationError}>{operationError}</div>}
              <div className={styles.operationActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => {
                    setOperationMode(null);
                    setOperationError(null);
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={isCreatingUser || isCreatingDirectory || isRenaming}
                >
                  {t('common.confirm')}
                </button>
              </div>
            </form>
          )}
          {files.length === 0 && directories.length === 0 && (
            <div className={styles.emptyState}>
              {isLoadingFiles ? t('scriptWorkspace.loadingFiles') : t('scriptWorkspace.emptyFiles')}
            </div>
          )}
          {(files.length > 0 || directories.length > 0) && (
            <div className={styles.fileTree}>
              {fileTree.children.map(node => renderFileTreeNode(node))}
            </div>
          )}
        </aside>

        <section className={styles.editorPanel}>
          {openTabs.length > 0 && (
            <div className={styles.tabStrip}>
              {openTabs.map(tab => {
                const tabDirty = tab.content !== tab.originalContent;
                return (
                  <div
                    key={tab.file.relativePath}
                    role="tab"
                    tabIndex={0}
                    className={`${styles.editorTab} ${selectedPath === tab.file.relativePath ? styles.editorTabActive : ''}`}
                    onClick={() => setSelectedPath(tab.file.relativePath)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        setSelectedPath(tab.file.relativePath);
                      }
                    }}
                    title={tab.file.relativePath}
                  >
                    <span>{fileName(tab.file.relativePath)}{tabDirty ? ' *' : ''}</span>
                    <span className={`${styles.kindDot} ${styles[`kindDot-${tab.file.kind}`]}`} />
                    <button
                      type="button"
                      className={styles.closeTabButton}
                      onClick={(event) => closeTab(tab.file.relativePath, event)}
                      aria-label={t('scriptWorkspace.closeTab')}
                    >
                      x
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div className={styles.editorHeader}>
            <div className={styles.fileTitle}>
              <strong>{selectedFile?.relativePath ?? t('scriptWorkspace.untitled')}</strong>
              <span>{fileReadOnlyReason(selectedFile, t)}</span>
            </div>
            <div className={styles.fileStatus}>
              {selectedFile && (
                <span className={`${styles.kindBadge} ${styles[`kind-${selectedFile.kind}`]}`}>
                  {kindLabel(selectedFile.kind, t)}
                </span>
              )}
              {isDirty && <span className={styles.dirtyBadge}>{t('scriptWorkspace.dirty')}</span>}
              {selectedFile && !selectedFile.editable && (
                <span className={styles.readOnlyBadge}>{t('scriptWorkspace.readonly')}</span>
              )}
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}
          {saveMessage && <div className={styles.success}>{saveMessage}</div>}

          <div className={styles.editorShell}>
            {isLoadingFile ? (
              <div className={styles.emptyState}>{t('scriptWorkspace.loadingFile')}</div>
            ) : selectedTab ? (
              <Editor
                height="100%"
                language={selectedTab.file.language}
                value={selectedTab.content}
                theme="vs-dark"
                onChange={value => updateSelectedContent(value ?? '')}
                options={{
                  readOnly: !selectedTab.file.editable,
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
              <div className={styles.emptyState}>{t('scriptWorkspace.selectToView')}</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

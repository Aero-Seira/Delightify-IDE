/**
 * Script workspace types - M2 U5
 */

export type ScriptWorkspaceFileKind = 'managed' | 'user' | 'manifest' | 'readonly';

export interface ScriptWorkspaceFile {
  relativePath: string;
  filePath: string;
  kind: ScriptWorkspaceFileKind;
  language: 'javascript' | 'json' | 'yaml' | 'plaintext';
  editable: boolean;
  requiresSaveConfirmation?: boolean;
  readOnlyReason?: string;
  exists: boolean;
  size?: number;
  modifiedAt?: string;
}

export interface ScriptWorkspaceDirectory {
  relativePath: string;
  filePath: string;
  exists: boolean;
  modifiedAt?: string;
}

export interface ScriptWorkspaceListResult {
  files: ScriptWorkspaceFile[];
  directories?: ScriptWorkspaceDirectory[];
}

export interface ScriptWorkspaceReadResult {
  file: ScriptWorkspaceFile;
  content: string;
}

export interface ScriptWorkspaceSaveResult {
  file: ScriptWorkspaceFile;
  savedAt: string;
}

export interface ScriptWorkspaceSaveOptions {
  confirmUserFileWrite?: boolean;
}

export interface ScriptWorkspaceCreateManagedResult {
  file: ScriptWorkspaceFile;
  content: string;
  created: boolean;
}

export interface ScriptWorkspaceCreateUserResult {
  file: ScriptWorkspaceFile;
  content: string;
  created: boolean;
}

export interface ScriptWorkspaceCreateDirectoryResult {
  directory: ScriptWorkspaceDirectory;
  created: boolean;
}

export interface ScriptWorkspaceRenameOptions {
  confirmUserFileWrite?: boolean;
}

export interface ScriptWorkspaceRenameResult {
  file: ScriptWorkspaceFile;
  previousRelativePath: string;
}

export interface ScriptWorkspaceCopyAsManagedResult {
  file: ScriptWorkspaceFile;
  content: string;
  created: boolean;
  sourceRelativePath: string;
}

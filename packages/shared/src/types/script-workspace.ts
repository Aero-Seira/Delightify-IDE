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

export interface ScriptWorkspaceListResult {
  files: ScriptWorkspaceFile[];
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

export interface ScriptWorkspaceCopyAsManagedResult {
  file: ScriptWorkspaceFile;
  content: string;
  created: boolean;
  sourceRelativePath: string;
}

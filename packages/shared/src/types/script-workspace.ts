/**
 * Script workspace types - M2 U5
 */

export type ScriptWorkspaceFileKind = 'managed' | 'user' | 'manifest';

export interface ScriptWorkspaceFile {
  relativePath: string;
  filePath: string;
  kind: ScriptWorkspaceFileKind;
  language: 'javascript' | 'json' | 'plaintext';
  editable: boolean;
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

export interface ScriptWorkspaceCreateManagedResult {
  file: ScriptWorkspaceFile;
  content: string;
  created: boolean;
}

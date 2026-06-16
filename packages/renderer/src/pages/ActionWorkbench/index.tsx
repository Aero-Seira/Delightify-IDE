import React, { useMemo, useState } from 'react';
import type {
  ActionRequestAction,
  ChangeOperation,
  EngineActionRequest,
  EngineDryRunResult,
  KubeJsExportResult,
  KubeJsPreviewResult,
  KubeJsRevertResult,
} from '@delightify/shared';
import BlastSummary from '../../components/BlastSummary';
import { electronAPI } from '../../ipc';
import { useProjectStore } from '../../store/projectStore';
import styles from './style.module.css';

type WorkbenchAction = Extract<ActionRequestAction, 'replace' | 'retag' | 'remove' | 'rename'>;
type TargetKind = 'item' | 'tag';

interface ReplaceForm {
  fromKind: TargetKind;
  fromRef: string;
  toKind: TargetKind;
  toRef: string;
  scope: 'input' | 'output' | 'both';
  filterTypeId: string;
  filterModid: string;
}

interface RetagForm {
  op: 'add' | 'remove';
  tag: string;
  items: string;
}

interface RemoveForm {
  recipeIds: string;
}

interface RenameForm {
  item: string;
  locale: string;
  newName: string;
}

const ACTIONS: { id: WorkbenchAction; label: string; description: string }[] = [
  {
    id: 'replace',
    label: 'Replace',
    description: '替换配方输入；输出替换仅分析，当前不会导出。',
  },
  {
    id: 'retag',
    label: 'Retag',
    description: '向 item tag 增加或移除成员，默认需要人工确认。',
  },
  {
    id: 'remove',
    label: 'Remove Recipe',
    description: '删除指定配方，检查产物下游引用后再确认。',
  },
  {
    id: 'rename',
    label: 'Rename',
    description: '生成 lang 覆盖，只改显示名，不改变注册 id。',
  },
];

function splitList(value: string): string[] {
  return value
    .split(/[\n,，]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function operationLabel(operation: ChangeOperation): string {
  const target = operation.recipeId || String(operation.before.item ?? operation.before.ref ?? operation.before.tag ?? '');
  return target ? `${operation.kind} / ${target}` : operation.kind;
}

function buildRequest(
  action: WorkbenchAction,
  replaceForm: ReplaceForm,
  retagForm: RetagForm,
  removeForm: RemoveForm,
  renameForm: RenameForm,
  confirmedOperationIds: string[]
): EngineActionRequest {
  const withConfirmed = <T extends Record<string, unknown>>(params: T): T => {
    if (confirmedOperationIds.length === 0) {
      return params;
    }
    return {
      ...params,
      confirmedOperationIds,
    };
  };

  switch (action) {
    case 'replace': {
      const filter: Record<string, string> = {};
      if (replaceForm.filterTypeId.trim()) {
        filter.typeId = replaceForm.filterTypeId.trim();
      }
      if (replaceForm.filterModid.trim()) {
        filter.modid = replaceForm.filterModid.trim();
      }
      return {
        action,
        params: withConfirmed({
          from: { kind: replaceForm.fromKind, ref: replaceForm.fromRef.trim() },
          to: { kind: replaceForm.toKind, ref: replaceForm.toRef.trim() },
          scope: replaceForm.scope,
          ...(Object.keys(filter).length > 0 ? { filter } : {}),
        }),
      };
    }
    case 'retag':
      return {
        action,
        params: withConfirmed({
          op: retagForm.op,
          tag: retagForm.tag.trim(),
          items: splitList(retagForm.items),
        }),
      };
    case 'remove':
      return {
        action,
        params: withConfirmed({
          recipeIds: splitList(removeForm.recipeIds),
        }),
      };
    case 'rename':
      return {
        action,
        params: {
          items: [
            {
              item: renameForm.item.trim(),
              locale: renameForm.locale.trim(),
              newName: renameForm.newName.trim(),
            },
          ],
        },
      };
  }
}

export default function ActionWorkbenchPage(): React.ReactElement {
  const { currentProject } = useProjectStore();
  const [action, setAction] = useState<WorkbenchAction>('replace');
  const [replaceForm, setReplaceForm] = useState<ReplaceForm>({
    fromKind: 'item',
    fromRef: '',
    toKind: 'item',
    toRef: '',
    scope: 'input',
    filterTypeId: '',
    filterModid: '',
  });
  const [retagForm, setRetagForm] = useState<RetagForm>({
    op: 'add',
    tag: '',
    items: '',
  });
  const [removeForm, setRemoveForm] = useState<RemoveForm>({
    recipeIds: '',
  });
  const [renameForm, setRenameForm] = useState<RenameForm>({
    item: '',
    locale: 'zh_cn',
    newName: '',
  });
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dryRun, setDryRun] = useState<EngineDryRunResult | null>(null);
  const [previewResult, setPreviewResult] = useState<KubeJsPreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<KubeJsExportResult | null>(null);
  const [revertResult, setRevertResult] = useState<KubeJsRevertResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  const currentAction = ACTIONS.find(item => item.id === action) ?? ACTIONS[0];
  const deferredOperations = useMemo(() => (
    dryRun?.operations.filter(operation => !operation.includedInChangeSet) ?? []
  ), [dryRun]);
  const confirmedOperations = useMemo(() => (
    dryRun?.operations.filter(operation => operation.includedInChangeSet) ?? []
  ), [dryRun]);

  const updateSelected = (operationId: string, checked: boolean): void => {
    setSelectedIds(previous => {
      const next = new Set(previous);
      if (checked) {
        next.add(operationId);
      } else {
        next.delete(operationId);
      }
      return next;
    });
  };

  const resetResultState = (): void => {
    setDryRun(null);
    setPreviewResult(null);
    setPreviewError(null);
    setExportResult(null);
    setRevertResult(null);
    setError(null);
    setSelectedIds(new Set());
  };

  const changeAction = (nextAction: WorkbenchAction): void => {
    setAction(nextAction);
    setConfirmedIds(new Set());
    resetResultState();
  };

  const runDryRun = async (ids = confirmedIds): Promise<void> => {
    if (!currentProject) {
      setError('请先打开或创建项目。');
      return;
    }

    setIsRunning(true);
    setError(null);
    setExportResult(null);
    setRevertResult(null);

    try {
      const request = buildRequest(
        action,
        replaceForm,
        retagForm,
        removeForm,
        renameForm,
        Array.from(ids)
      );
      const response = await electronAPI().engineDryRun(currentProject.path, request);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Dry-run 失败');
      }
      setDryRun(response.data);
      setSelectedIds(new Set());
      setPreviewResult(null);
      setPreviewError(null);

      if (response.data.changeSetPreview.length > 0) {
        const previewResponse = await electronAPI().previewKubeJs({
          changeSet: response.data.changeSetPreview,
        });
        if (!previewResponse.success || !previewResponse.data) {
          setPreviewError(previewResponse.error || '生成预览失败');
        } else {
          setPreviewResult(previewResponse.data);
        }
      }
    } catch (caught) {
      setDryRun(null);
      setPreviewResult(null);
      setPreviewError(null);
      setError(caught instanceof Error ? caught.message : 'Dry-run 失败');
    } finally {
      setIsRunning(false);
    }
  };

  const confirmSelected = async (): Promise<void> => {
    const next = new Set(confirmedIds);
    for (const operationId of selectedIds) {
      next.add(operationId);
    }
    setConfirmedIds(next);
    await runDryRun(next);
  };

  const exportChangeSet = async (): Promise<void> => {
    if (!currentProject || !dryRun) {
      return;
    }

    setIsExporting(true);
    setError(null);
    setExportResult(null);

    try {
      const response = await electronAPI().exportKubeJs(currentProject.path, {
        changeSet: dryRun.changeSetPreview,
      });
      if (!response.success || !response.data) {
        throw new Error(response.error || '导出失败');
      }
      setExportResult(response.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '导出失败');
    } finally {
      setIsExporting(false);
    }
  };

  const revertGeneratedFiles = async (): Promise<void> => {
    if (!currentProject) {
      return;
    }

    setIsReverting(true);
    setError(null);
    setRevertResult(null);

    try {
      const response = await electronAPI().revertKubeJs(currentProject.path);
      if (!response.success || !response.data) {
        throw new Error(response.error || '撤销失败');
      }
      setRevertResult(response.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '撤销失败');
    } finally {
      setIsReverting(false);
    }
  };

  const renderTargetKindSelect = (
    value: TargetKind,
    onChange: (value: TargetKind) => void
  ): React.ReactElement => (
    <select value={value} onChange={event => onChange(event.target.value as TargetKind)}>
      <option value="item">item</option>
      <option value="tag">tag</option>
    </select>
  );

  const renderActionForm = (): React.ReactElement => {
    switch (action) {
      case 'replace':
        return (
          <>
            <div className={styles.formGrid}>
              <label>
                <span>From kind</span>
                {renderTargetKindSelect(replaceForm.fromKind, fromKind => setReplaceForm({ ...replaceForm, fromKind }))}
              </label>
              <label>
                <span>From ref</span>
                <input
                  value={replaceForm.fromRef}
                  onChange={event => setReplaceForm({ ...replaceForm, fromRef: event.target.value })}
                  placeholder="minecraft:iron_ingot"
                />
              </label>
              <label>
                <span>To kind</span>
                {renderTargetKindSelect(replaceForm.toKind, toKind => setReplaceForm({ ...replaceForm, toKind }))}
              </label>
              <label>
                <span>To ref</span>
                <input
                  value={replaceForm.toRef}
                  onChange={event => setReplaceForm({ ...replaceForm, toRef: event.target.value })}
                  placeholder="minecraft:copper_ingot"
                />
              </label>
              <label>
                <span>Scope</span>
                <select
                  value={replaceForm.scope}
                  onChange={event => setReplaceForm({ ...replaceForm, scope: event.target.value as ReplaceForm['scope'] })}
                >
                  <option value="input">input</option>
                  <option value="output">output</option>
                  <option value="both">both</option>
                </select>
              </label>
              <label>
                <span>Type filter</span>
                <input
                  value={replaceForm.filterTypeId}
                  onChange={event => setReplaceForm({ ...replaceForm, filterTypeId: event.target.value })}
                  placeholder="minecraft:crafting_shaped"
                />
              </label>
              <label>
                <span>Mod filter</span>
                <input
                  value={replaceForm.filterModid}
                  onChange={event => setReplaceForm({ ...replaceForm, filterModid: event.target.value })}
                  placeholder="minecraft"
                />
              </label>
            </div>
          </>
        );
      case 'retag':
        return (
          <div className={styles.formGrid}>
            <label>
              <span>Operation</span>
              <select
                value={retagForm.op}
                onChange={event => setRetagForm({ ...retagForm, op: event.target.value as RetagForm['op'] })}
              >
                <option value="add">add</option>
                <option value="remove">remove</option>
              </select>
            </label>
            <label>
              <span>Tag</span>
              <input
                value={retagForm.tag}
                onChange={event => setRetagForm({ ...retagForm, tag: event.target.value })}
                placeholder="forge:ingots/copper"
              />
            </label>
            <label className={styles.fullWidth}>
              <span>Items</span>
              <textarea
                value={retagForm.items}
                onChange={event => setRetagForm({ ...retagForm, items: event.target.value })}
                placeholder="minecraft:copper_ingot&#10;create:copper_ingot"
              />
            </label>
          </div>
        );
      case 'remove':
        return (
          <div className={styles.formGrid}>
            <label className={styles.fullWidth}>
              <span>Recipe IDs</span>
              <textarea
                value={removeForm.recipeIds}
                onChange={event => setRemoveForm({ recipeIds: event.target.value })}
                placeholder="minecraft:iron_ingot_from_smelting"
              />
            </label>
          </div>
        );
      case 'rename':
        return (
          <div className={styles.formGrid}>
            <label>
              <span>Item</span>
              <input
                value={renameForm.item}
                onChange={event => setRenameForm({ ...renameForm, item: event.target.value })}
                placeholder="minecraft:copper_ingot"
              />
            </label>
            <label>
              <span>Locale</span>
              <input
                value={renameForm.locale}
                onChange={event => setRenameForm({ ...renameForm, locale: event.target.value })}
                placeholder="zh_cn"
              />
            </label>
            <label className={styles.fullWidth}>
              <span>New name</span>
              <input
                value={renameForm.newName}
                onChange={event => setRenameForm({ ...renameForm, newName: event.target.value })}
                placeholder="铜锭"
              />
            </label>
          </div>
        );
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Action Workbench</h1>
          <p className={styles.description}>
            构建手动动作方案，先 dry-run 审阅影响范围和风险，再导出 Delightify 受管文件。
          </p>
        </div>
        {currentProject && (
          <div className={styles.projectBadge}>
            <span>{currentProject.name}</span>
            <code>{currentProject.path}</code>
          </div>
        )}
      </div>

      {!currentProject && (
        <div className={styles.notice}>请先在项目管理中打开或创建一个 Minecraft 实例项目。</div>
      )}

      <div className={styles.layout}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>动作</h2>
            <span>U3 基础动作</span>
          </div>

          <div className={styles.actionTabs}>
            {ACTIONS.map(item => (
              <button
                key={item.id}
                type="button"
                className={`${styles.actionTab} ${action === item.id ? styles.actionTabActive : ''}`}
                onClick={() => changeAction(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className={styles.actionDescription}>{currentAction.description}</div>
          {renderActionForm()}

          <div className={styles.buttonRow}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => runDryRun()}
              disabled={!currentProject || isRunning}
            >
              {isRunning ? '计算中...' : 'Dry-run'}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                setConfirmedIds(new Set());
                resetResultState();
              }}
              disabled={isRunning}
            >
              清空结果
            </button>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>结果</h2>
            {dryRun && <span>{dryRun.operations.length} operations</span>}
          </div>

          {error && <div className={styles.error}>{error}</div>}

          {!dryRun && !error && (
            <div className={styles.emptyState}>填写参数后运行 dry-run。</div>
          )}

          {dryRun && (
            <div className={styles.resultStack}>
              <div className={styles.summaryGrid}>
                <div className={styles.metric}>
                  <strong>{dryRun.operations.length}</strong>
                  <span>总操作</span>
                </div>
                <div className={styles.metric}>
                  <strong>{dryRun.changeSetPreview.length}</strong>
                  <span>可导出</span>
                </div>
                <div className={styles.metric}>
                  <strong>{deferredOperations.length}</strong>
                  <span>待确认/搁置</span>
                </div>
                <div className={`${styles.metric} ${styles[`risk-${dryRun.risk.severity}`]}`}>
                  <strong>{dryRun.risk.severity}</strong>
                  <span>风险</span>
                </div>
              </div>

              {dryRun.risk.reasons.length > 0 && (
                <div className={styles.reasonList}>
                  {dryRun.risk.reasons.map(reason => (
                    <div key={reason}>{reason}</div>
                  ))}
                </div>
              )}

              <BlastSummary summaries={dryRun.blast} emptyText="本次动作未返回影响范围。" />

              <div className={styles.operations}>
                <div className={styles.sectionTitle}>可导出操作</div>
                {confirmedOperations.length === 0 ? (
                  <div className={styles.muted}>暂无可导出的 change set。</div>
                ) : confirmedOperations.map(operation => (
                  <details key={operation.operationId} className={styles.operation} open={confirmedOperations.length <= 3}>
                    <summary>
                      <span>{operationLabel(operation)}</span>
                      <code>{operation.operationId}</code>
                    </summary>
                    <pre>{formatJson(operation)}</pre>
                  </details>
                ))}
              </div>

              <div className={styles.operations}>
                <div className={styles.sectionTitle}>待确认或搁置</div>
                {deferredOperations.length === 0 ? (
                  <div className={styles.muted}>没有待确认操作。</div>
                ) : deferredOperations.map(operation => (
                  <div key={operation.operationId} className={styles.deferredOperation}>
                    <label className={styles.checkLine}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(operation.operationId)}
                        onChange={event => updateSelected(operation.operationId, event.target.checked)}
                      />
                      <span>{operationLabel(operation)}</span>
                    </label>
                    <code>{operation.operationId}</code>
                    {operation.reason && <p>{operation.reason}</p>}
                  </div>
                ))}

                {deferredOperations.length > 0 && (
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={confirmSelected}
                    disabled={selectedIds.size === 0 || isRunning}
                  >
                    确认选中并重新计算
                  </button>
                )}
              </div>

              {dryRun.deferredSuggestions.length > 0 && (
                <div className={styles.operations}>
                  <div className={styles.sectionTitle}>Deferred 建议</div>
                  {dryRun.deferredSuggestions.map((suggestion, index) => (
                    <pre key={`${suggestion.kind}:${index}`}>{formatJson(suggestion)}</pre>
                  ))}
                </div>
              )}

              <div className={styles.operations}>
                <div className={styles.sectionTitle}>生成文件预览</div>
                {previewError && <div className={styles.error}>{previewError}</div>}
                {!previewError && !previewResult && (
                  <div className={styles.muted}>当前 change set 没有可预览文件。</div>
                )}
                {previewResult && previewResult.files.length === 0 && (
                  <div className={styles.muted}>当前 change set 不会写出文件。</div>
                )}
                {previewResult?.files.map(file => (
                  <details key={file.relativePath} className={styles.operation} open={previewResult.files.length === 1}>
                    <summary>
                      <span>{file.relativePath}</span>
                      <code>{file.operationCount} operations</code>
                    </summary>
                    <pre>{file.content}</pre>
                  </details>
                ))}
              </div>

              <div className={styles.exportBar}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={exportChangeSet}
                  disabled={dryRun.changeSetPreview.length === 0 || isExporting}
                >
                  {isExporting ? '导出中...' : '导出 KubeJS'}
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={revertGeneratedFiles}
                  disabled={!currentProject || isReverting}
                >
                  {isReverting ? '撤销中...' : '撤销生成文件'}
                </button>
              </div>

              {exportResult && (
                <div className={styles.exportResult}>
                  <strong>导出完成</strong>
                  <span>{exportResult.operationCount} operations / {exportResult.files.length} files</span>
                  {exportResult.files.map(file => (
                    <code key={file.filePath}>{file.filePath} ({file.operationCount})</code>
                  ))}
                </div>
              )}

              {revertResult && (
                <div className={styles.exportResult}>
                  <strong>{revertResult.deleted ? '已撤销生成文件' : '没有可撤销文件'}</strong>
                  <code>{revertResult.filePath}</code>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

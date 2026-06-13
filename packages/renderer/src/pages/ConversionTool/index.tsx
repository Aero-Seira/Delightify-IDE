import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  DataImportHistory,
  KubeJsExportResult,
  UnifyCandidate,
  UnifyDecision,
  UnifyDiffOperation,
  UnifyDryRunResult,
  UnifyQueryResult,
  UnifyRiskSeverity,
} from '@delightify/shared';
import { electronAPI } from '../../ipc';
import { useProjectStore } from '../../store/projectStore';
import styles from './style.module.css';

const SearchIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

const CheckIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const FileIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M8 13h8" />
    <path d="M8 17h6" />
  </svg>
);

const UndoIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 1 1 0 11H11" />
  </svg>
);

const AlertIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </svg>
);

const riskLabel: Record<UnifyRiskSeverity, string> = {
  info: '提示',
  low: '低',
  medium: '中',
  high: '高',
};

const decisionLabel: Record<UnifyDecision['status'], string> = {
  target: '目标',
  auto: '自动',
  deferred: '搁置',
};

const operationLabel: Record<UnifyDiffOperation['kind'], string> = {
  replace_recipe_input_item: '替换输入',
  replace_recipe_output_item: '替换输出',
  tag_input_reference: 'Tag 引用',
  raw_unparsed_reference: '未结构化',
};

function riskClassName(severity: UnifyRiskSeverity): string {
  const classes: Record<UnifyRiskSeverity, string> = {
    info: styles.riskInfo,
    low: styles.riskLow,
    medium: styles.riskMedium,
    high: styles.riskHigh,
  };
  return classes[severity];
}

function operationValue(value?: Record<string, unknown>): string {
  if (!value) return '-';
  const ref = value.ref ?? value.itemId ?? value.kind ?? 'unknown';
  const count = value.count;
  return count === undefined ? String(ref) : `${String(ref)} x${String(count)}`;
}

function referenceCount(candidate: UnifyCandidate): number {
  return (
    candidate.references.directInputs.length +
    candidate.references.tagInputs.length +
    candidate.references.outputs.length +
    candidate.references.unparsedRaw.length
  );
}

function latestSuccessfulImport(imports: DataImportHistory[]): DataImportHistory | null {
  const successful = imports.filter(item => item.isSuccess);
  if (successful.length === 0) return null;
  return [...successful].sort((a, b) => b.importedAt.localeCompare(a.importedAt))[0];
}

function statusClass(status: UnifyDecision['status']): string {
  const classes: Record<UnifyDecision['status'], string> = {
    target: styles.statusTarget,
    auto: styles.statusAuto,
    deferred: styles.statusDeferred,
  };
  return classes[status];
}

export default function ConversionToolPage(): React.ReactElement {
  const { currentProject } = useProjectStore();

  const [query, setQuery] = useState('铜锭');
  const [lang, setLang] = useState('zh_cn');
  const [selectedTarget, setSelectedTarget] = useState('');
  const [queryResult, setQueryResult] = useState<UnifyQueryResult | null>(null);
  const [dryRunResult, setDryRunResult] = useState<UnifyDryRunResult | null>(null);
  const [exportResult, setExportResult] = useState<KubeJsExportResult | null>(null);
  const [latestImport, setLatestImport] = useState<DataImportHistory | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    async function loadHistory(): Promise<void> {
      if (!currentProject) {
        setLatestImport(null);
        return;
      }

      setIsLoadingHistory(true);
      try {
        const result = await electronAPI().modDataGetImportHistory(currentProject.path);
        if (!disposed && result.success && result.data) {
          setLatestImport(latestSuccessfulImport(result.data));
        }
      } catch {
        if (!disposed) {
          setLatestImport(null);
        }
      } finally {
        if (!disposed) {
          setIsLoadingHistory(false);
        }
      }
    }

    loadHistory();
    return () => {
      disposed = true;
    };
  }, [currentProject]);

  const candidates = queryResult?.candidates ?? [];
  const selectedTargetCandidate = useMemo(
    () => candidates.find(candidate => candidate.item.itemId === selectedTarget),
    [candidates, selectedTarget]
  );

  const dryRunOperationsByDecision = useMemo(() => {
    const byDecision = new Map<string, UnifyDiffOperation[]>();
    for (const operation of dryRunResult?.diff ?? []) {
      const operations = byDecision.get(operation.decisionId) ?? [];
      operations.push(operation);
      byDecision.set(operation.decisionId, operations);
    }
    return byDecision;
  }, [dryRunResult]);

  const runQuery = useCallback(async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!currentProject || !query.trim()) return;

    setIsQuerying(true);
    setError(null);
    setNotice(null);
    setQueryResult(null);
    setDryRunResult(null);
    setExportResult(null);

    try {
      const result = await electronAPI().unifyQuery(currentProject.path, {
        query: query.trim(),
        lang,
        limit: 80,
      });

      if (result.success && result.data) {
        setQueryResult(result.data);
        setSelectedTarget('');
        if (result.data.candidates.length === 0) {
          setNotice('没有找到候选物品。');
        }
      } else {
        setError(result.error || 'unify 查询失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unify 查询失败');
    } finally {
      setIsQuerying(false);
    }
  }, [currentProject, lang, query]);

  const runDryRun = useCallback(async () => {
    if (!currentProject || !queryResult) return;

    setIsDryRunning(true);
    setError(null);
    setNotice(null);
    setDryRunResult(null);
    setExportResult(null);

    try {
      const result = await electronAPI().unifyDryRun(currentProject.path, {
        query: queryResult.query,
        lang: queryResult.lang,
        limit: 80,
        targetItemId: selectedTarget || undefined,
      });

      if (result.success && result.data) {
        setDryRunResult(result.data);
        setSelectedTarget(result.data.targetItemId);
        if (result.data.changeSet.length === 0) {
          setNotice('dry-run 没有生成可自动导出的 change set。');
        }
      } else {
        setError(result.error || 'dry-run 失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'dry-run 失败');
    } finally {
      setIsDryRunning(false);
    }
  }, [currentProject, queryResult, selectedTarget]);

  const exportKubeJs = useCallback(async () => {
    if (!currentProject || !dryRunResult || dryRunResult.changeSet.length === 0) return;

    setIsExporting(true);
    setError(null);
    setNotice(null);

    try {
      const result = await electronAPI().exportKubeJs(currentProject.path, {
        changeSet: dryRunResult.changeSet,
      });

      if (result.success && result.data) {
        setExportResult(result.data);
        setNotice(`已生成 ${result.data.operationCount} 条 KubeJS 操作。`);
      } else {
        setError(result.error || 'KubeJS 导出失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'KubeJS 导出失败');
    } finally {
      setIsExporting(false);
    }
  }, [currentProject, dryRunResult]);

  const revertKubeJs = useCallback(async () => {
    if (!currentProject) return;
    const confirmed = window.confirm('删除 Delightify 生成的 KubeJS 文件？');
    if (!confirmed) return;

    setIsReverting(true);
    setError(null);
    setNotice(null);

    try {
      const result = await electronAPI().revertKubeJs(currentProject.path);
      if (result.success && result.data) {
        setExportResult(null);
        setNotice(result.data.deleted ? '已删除 Delightify 生成文件。' : '没有找到可撤销的 Delightify 生成文件。');
      } else {
        setError(result.error || '撤销生成文件失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '撤销生成文件失败');
    } finally {
      setIsReverting(false);
    }
  }, [currentProject]);

  if (!currentProject) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <AlertIcon />
          <h2>请先打开项目</h2>
          <p>unify 工作流需要项目路径、项目数据库和导出目标目录。</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Unify 工作台</h1>
          <p className={styles.description}>查询候选、审阅 dry-run，并生成 Delightify 管理的 KubeJS 文件。</p>
        </div>
        <div className={styles.projectMeta}>
          <span className={styles.projectName}>{currentProject.name}</span>
          <span className={styles.projectPath}>{currentProject.path}</span>
        </div>
      </div>

      <div className={styles.statusStrip}>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>数据源</span>
          <span className={styles.statusValue}>
            {isLoadingHistory ? '读取中' : latestImport?.sourceKind || '未导入'}
          </span>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>unify 能力</span>
          <span className={`${styles.statusValue} ${latestImport?.capabilities?.mvp0Unify ? styles.ready : styles.muted}`}>
            {latestImport?.capabilities?.mvp0Unify ? '可用' : latestImport?.capabilities?.reason || '未知'}
          </span>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>输出文件</span>
          <span className={styles.statusValue}>kubejs/server_scripts/zzz_delightify_generated.js</span>
        </div>
      </div>

      <form className={styles.queryPanel} onSubmit={runQuery}>
        <div className={styles.queryGroup}>
          <label htmlFor="unify-query">查询</label>
          <div className={styles.searchField}>
            <SearchIcon />
            <input
              id="unify-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例如：铜锭、copper_ingot、#forge:ingots/copper"
            />
          </div>
        </div>

        <div className={styles.langGroup}>
          <label htmlFor="unify-lang">语言</label>
          <select
            id="unify-lang"
            value={lang}
            onChange={(event) => setLang(event.target.value)}
          >
            <option value="zh_cn">zh_cn</option>
            <option value="en_us">en_us</option>
          </select>
        </div>

        <button className={styles.primaryButton} type="submit" disabled={!query.trim() || isQuerying}>
          {isQuerying ? '查询中' : '查询候选'}
        </button>
      </form>

      {(error || notice) && (
        <div className={`${styles.message} ${error ? styles.messageError : styles.messageInfo}`}>
          {error || notice}
        </div>
      )}

      {queryResult && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>候选物品</h2>
              <p>{queryResult.candidates.length} 个候选，生成于 {new Date(queryResult.generatedAt).toLocaleString()}</p>
            </div>
            <div className={styles.targetControl}>
              <label htmlFor="target-item">目标</label>
              <select
                id="target-item"
                value={selectedTarget}
                onChange={(event) => setSelectedTarget(event.target.value)}
                disabled={candidates.length === 0}
              >
                <option value="">自动选择</option>
                {candidates.map(candidate => (
                  <option key={candidate.item.itemId} value={candidate.item.itemId}>
                    {candidate.item.displayName ? `${candidate.item.displayName} - ` : ''}{candidate.item.itemId}
                  </option>
                ))}
              </select>
              <button
                className={styles.secondaryButton}
                type="button"
                disabled={candidates.length === 0 || isDryRunning}
                onClick={runDryRun}
              >
                {isDryRunning ? '计算中' : '生成 dry-run'}
              </button>
            </div>
          </div>

          {selectedTargetCandidate && (
            <div className={styles.targetSummary}>
              <CheckIcon />
              <span>当前目标：{selectedTargetCandidate.item.displayName || selectedTargetCandidate.item.itemId}</span>
              <code>{selectedTargetCandidate.item.itemId}</code>
            </div>
          )}

          <div className={styles.candidateList}>
            {candidates.map(candidate => (
              <article key={candidate.item.itemId} className={styles.candidateRow}>
                <div className={styles.candidateMain}>
                  <div className={styles.itemName}>{candidate.item.displayName || candidate.item.itemId}</div>
                  <code>{candidate.item.itemId}</code>
                  <div className={styles.itemMeta}>
                    <span>{candidate.item.modid}</span>
                    <span>{referenceCount(candidate)} 个引用</span>
                    <span>{candidate.item.tags.length} 个 tag</span>
                  </div>
                </div>
                <div className={styles.candidateReason}>
                  {candidate.matchedBy.map(match => (
                    <span key={`${match.reason}:${match.value}`} className={styles.matchTag}>
                      {match.reason}: {match.value}
                    </span>
                  ))}
                </div>
                <div className={`${styles.riskBadge} ${riskClassName(candidate.riskLevel)}`}>
                  {riskLabel[candidate.riskLevel]}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {dryRunResult && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Dry-run 审阅</h2>
              <p>
                目标 {dryRunResult.targetItemId}，自动 {dryRunResult.autoDecisionCount} 项，搁置 {dryRunResult.deferredDecisionCount} 项
              </p>
            </div>
            <div className={styles.actionGroup}>
              <button
                className={styles.primaryButton}
                type="button"
                disabled={dryRunResult.changeSet.length === 0 || isExporting}
                onClick={exportKubeJs}
              >
                <FileIcon />
                {isExporting ? '生成中' : `生成 KubeJS (${dryRunResult.changeSet.length})`}
              </button>
              <button
                className={styles.dangerButton}
                type="button"
                disabled={isReverting}
                onClick={revertKubeJs}
              >
                <UndoIcon />
                {isReverting ? '撤销中' : '撤销生成文件'}
              </button>
            </div>
          </div>

          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              <span>决策</span>
              <strong>{dryRunResult.decisions.length}</strong>
            </div>
            <div className={styles.summaryItem}>
              <span>Diff</span>
              <strong>{dryRunResult.diff.length}</strong>
            </div>
            <div className={styles.summaryItem}>
              <span>Change set</span>
              <strong>{dryRunResult.changeSet.length}</strong>
            </div>
            <div className={styles.summaryItem}>
              <span>目标策略</span>
              <strong>{dryRunResult.targetReason}</strong>
            </div>
          </div>

          <div className={styles.reviewGrid}>
            <div className={styles.reviewColumn}>
              <h3>决策清单</h3>
              <div className={styles.decisionList}>
                {dryRunResult.decisions.map(decision => {
                  const operations = dryRunOperationsByDecision.get(decision.decisionId) ?? [];
                  return (
                    <article key={decision.decisionId} className={styles.decisionRow}>
                      <div className={styles.decisionHead}>
                        <span className={`${styles.decisionStatus} ${statusClass(decision.status)}`}>
                          {decisionLabel[decision.status]}
                        </span>
                        <span className={styles.confidence}>{Math.round(decision.confidence * 100)}%</span>
                      </div>
                      <div className={styles.decisionPath}>
                        <code>{decision.sourceItemId}</code>
                        <span>→</span>
                        <code>{decision.targetItemId}</code>
                      </div>
                      <p>{decision.reason}</p>
                      <div className={styles.operationCount}>{operations.length} 个 diff 操作</div>
                      {decision.riskSignals.length > 0 && (
                        <div className={styles.riskList}>
                          {decision.riskSignals.slice(0, 3).map(signal => (
                            <span key={`${decision.decisionId}:${signal.code}`} className={`${styles.riskPill} ${riskClassName(signal.severity)}`}>
                              {signal.message}
                            </span>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>

            <div className={styles.reviewColumn}>
              <h3>Diff</h3>
              <div className={styles.diffList}>
                {dryRunResult.diff.map(operation => (
                  <article key={operation.operationId} className={styles.diffRow}>
                    <div className={styles.diffHead}>
                      <span className={styles.operationKind}>{operationLabel[operation.kind]}</span>
                      <span className={operation.includedInChangeSet ? styles.included : styles.excluded}>
                        {operation.includedInChangeSet ? '将导出' : '仅审阅'}
                      </span>
                    </div>
                    <code className={styles.recipeId}>{operation.recipeId}</code>
                    <div className={styles.diffBody}>
                      <span>{operationValue(operation.before)}</span>
                      <span>→</span>
                      <span>{operationValue(operation.after)}</span>
                    </div>
                    {operation.reason && <p>{operation.reason}</p>}
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {exportResult && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>生成结果</h2>
              <p>{exportResult.filePath}</p>
            </div>
            <span className={styles.generatedAt}>{new Date(exportResult.writtenAt).toLocaleString()}</span>
          </div>
          <pre className={styles.codePreview}>{exportResult.generatedCode}</pre>
        </section>
      )}
    </div>
  );
}

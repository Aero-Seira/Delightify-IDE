import React, { useMemo } from 'react';
import type { EngineBlastSummary } from '@delightify/shared';
import styles from './style.module.css';

interface BlastSummaryProps {
  title?: string;
  summaries: EngineBlastSummary[];
  isLoading?: boolean;
  error?: string | null;
  emptyText?: string;
}

function totalFor(summary: EngineBlastSummary): number {
  return (
    summary.counts.inputRefs +
    summary.counts.outputRefs +
    summary.counts.tagConnected +
    summary.counts.relatedUnparsed
  );
}

export default function BlastSummary({
  title = '影响范围',
  summaries,
  isLoading = false,
  error = null,
  emptyText = '未发现相关引用。',
}: BlastSummaryProps): React.ReactElement | null {
  const totals = useMemo(() => summaries.reduce((acc, summary) => ({
    inputRefs: acc.inputRefs + summary.counts.inputRefs,
    outputRefs: acc.outputRefs + summary.counts.outputRefs,
    tagConnected: acc.tagConnected + summary.counts.tagConnected,
    relatedUnparsed: acc.relatedUnparsed + summary.counts.relatedUnparsed,
  }), {
    inputRefs: 0,
    outputRefs: 0,
    tagConnected: 0,
    relatedUnparsed: 0,
  }), [summaries]);

  const previewRefs = useMemo(() => summaries.flatMap(summary => [
    ...summary.inputRefs.slice(0, 3).map(ref => ({ label: '输入', id: ref.recipeId, target: summary.target?.ref })),
    ...summary.outputRefs.slice(0, 3).map(ref => ({ label: '输出', id: ref.recipeId, target: summary.target?.ref })),
    ...summary.relatedUnparsed.slice(0, 2).map(ref => ({ label: '未结构化', id: ref.recipeId, target: summary.target?.ref })),
  ]).slice(0, 6), [summaries]);

  if (!isLoading && !error && summaries.length === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={styles.panel}>
        <div className={styles.title}>{title}</div>
        <div className={styles.muted}>正在查询引用关系...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.panel}>
        <div className={styles.title}>{title}</div>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  const hasBlock = summaries.some(summary => summary.isBlock);
  const hasCrossMod = summaries.some(summary => summary.crossMod);
  const totalReferences = summaries.reduce((sum, summary) => sum + totalFor(summary), 0);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>{title}</div>
          <div className={styles.muted}>
            {totalReferences === 0 ? emptyText : `共 ${totalReferences} 条相关引用。`}
          </div>
        </div>
        <div className={styles.badges}>
          {hasBlock && <span className={styles.badgeWarn}>方块物品</span>}
          {hasCrossMod && <span className={styles.badgeWarn}>跨 Mod</span>}
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.metric}>
          <span>{totals.inputRefs}</span>
          <small>作为输入</small>
        </div>
        <div className={styles.metric}>
          <span>{totals.outputRefs}</span>
          <small>作为输出</small>
        </div>
        <div className={styles.metric}>
          <span>{totals.tagConnected}</span>
          <small>Tag 连带</small>
        </div>
        <div className={styles.metric}>
          <span>{totals.relatedUnparsed}</span>
          <small>未结构化</small>
        </div>
      </div>

      {previewRefs.length > 0 && (
        <div className={styles.refs}>
          {previewRefs.map(ref => (
            <div key={`${ref.label}:${ref.target ?? ''}:${ref.id}`} className={styles.ref}>
              <span>{ref.target ? `${ref.label} / ${ref.target}` : ref.label}</span>
              <code>{ref.id}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

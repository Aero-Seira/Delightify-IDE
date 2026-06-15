import type { Client } from '@libsql/client';
import type { ChangeOperation } from '../ir';
import {
  computeBlastRadius,
  type BlastRadius,
  type BlastRiskClassification,
} from '../blast-radius';

export interface HidePlanRequest {
  items: string[];
}

export interface HidePlanResult {
  operations: ChangeOperation[];
  blast: BlastRadius[];
  risk: BlastRiskClassification;
}

const HIDE_REASON = 'JEI 隐藏发射属输出层，且 KubeJS 1.21 JEI 事件待核实。';

function dedupeItems(items: string[]): string[] {
  return Array.from(new Set(items)).sort();
}

function hasReferences(blast: BlastRadius): boolean {
  return (
    blast.recipeRefsAsInput.length > 0 ||
    blast.recipeRefsAsOutput.length > 0 ||
    blast.tagConnectedRecipes.length > 0 ||
    blast.relatedUnparsed.length > 0
  );
}

function mergeHideRisk(blasts: BlastRadius[]): BlastRiskClassification {
  const referenced = blasts.some(hasReferences);

  return {
    severity: referenced ? 'low' : 'info',
    mustDefer: false,
    reasons: referenced
      ? ['hide 仅影响 JEI 显示；引用清单用于审阅，发射等待输出层。']
      : ['hide 仅影响 JEI 显示；发射等待输出层。'],
  };
}

function hideOperation(item: string): ChangeOperation {
  return {
    operationId: `hide_in_jei:${item}`,
    decisionId: 'hide_in_jei',
    kind: 'hide_in_jei',
    before: {
      item,
    },
    includedInChangeSet: false,
    reason: HIDE_REASON,
  };
}

export async function planHide(db: Client, req: HidePlanRequest): Promise<HidePlanResult> {
  const items = dedupeItems(req.items);
  const blast = await Promise.all(items.map(item => computeBlastRadius(db, {
    kind: 'item',
    ref: item,
  })));

  return {
    operations: items.map(hideOperation),
    blast,
    risk: mergeHideRisk(blast),
  };
}

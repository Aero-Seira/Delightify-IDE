import type { Client } from '@libsql/client';
import type { ChangeOperation } from '../ir';
import {
  classifyRisk,
  computeBlastRadius,
  type BlastRadius,
  type BlastRiskClassification,
  type BlastRiskSeverity,
} from '../blast-radius';

type DbRow = Record<string, unknown>;

export type ScaleRecipeField = 'input_count' | 'output_count' | 'time' | 'energy' | string;
export type ScaleRoundMode = 'floor' | 'round' | 'ceil';
export type ScaleClassificationDecision =
  | 'emission_pending'
  | 'conservation_skip'
  | 'type_defer'
  | 'no_baseline';

export interface ScalePlanRequest {
  recipeIds: string[];
  field: ScaleRecipeField;
  factor?: number;
  delta?: number;
  clamp?: {
    min?: number;
    max?: number;
  };
  round?: ScaleRoundMode;
}

export interface ScaleClassification {
  operationId: string;
  recipeId: string;
  field: string;
  decision: ScaleClassificationDecision;
  baseline?: number;
  computed?: number;
  reason: string;
}

export interface ScalePlanResult {
  operations: ChangeOperation[];
  classifications: ScaleClassification[];
  blast: BlastRadius[];
  risk: BlastRiskClassification;
}

interface RecipeFact {
  recipeId: string;
  typeId: string;
  modid: string;
}

interface CountBaseline {
  slot: number;
  value: number;
}

interface RecipeInputFact {
  slot: number;
  kind: string;
  ref: string;
  count: number;
}

interface RecipeOutputFact {
  slot: number;
  itemId: string;
  count: number;
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function numberOrDefault(value: unknown, defaultValue: number): number {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : defaultValue;
}

function optionalString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

function severityRank(severity: BlastRiskSeverity): number {
  switch (severity) {
    case 'high':
      return 4;
    case 'medium':
      return 3;
    case 'low':
      return 2;
    case 'info':
    default:
      return 1;
  }
}

function highestSeverity(severities: BlastRiskSeverity[]): BlastRiskSeverity {
  return severities.reduce<BlastRiskSeverity>((highest, severity) => (
    severityRank(severity) > severityRank(highest) ? severity : highest
  ), 'info');
}

function scaleOperationId(field: string, recipeId: string, slot?: number): string {
  return ['scale', field, recipeId, slot ?? 'recipe'].join(':');
}

function validateScaleRequest(req: ScalePlanRequest): void {
  const hasFactor = req.factor !== undefined;
  const hasDelta = req.delta !== undefined;
  if (hasFactor === hasDelta) {
    throw new Error('scale 请求必须且只能提供 factor 或 delta。');
  }
  if (hasFactor && !Number.isFinite(req.factor)) {
    throw new Error('scale factor 必须是有限数字。');
  }
  if (hasDelta && !Number.isFinite(req.delta)) {
    throw new Error('scale delta 必须是有限数字。');
  }
  if (req.round && !['floor', 'round', 'ceil'].includes(req.round)) {
    throw new Error(`未知 scale round 模式: ${req.round}`);
  }
  if (req.clamp?.min !== undefined && !Number.isFinite(req.clamp.min)) {
    throw new Error('scale clamp.min 必须是有限数字。');
  }
  if (req.clamp?.max !== undefined && !Number.isFinite(req.clamp.max)) {
    throw new Error('scale clamp.max 必须是有限数字。');
  }
  if (
    req.clamp?.min !== undefined &&
    req.clamp?.max !== undefined &&
    req.clamp.min > req.clamp.max
  ) {
    throw new Error('scale clamp.min 不能大于 clamp.max。');
  }
}

function roundValue(value: number, mode: ScaleRoundMode): number {
  switch (mode) {
    case 'floor':
      return Math.floor(value);
    case 'ceil':
      return Math.ceil(value);
    case 'round':
    default:
      return Math.round(value);
  }
}

function computeScaledValue(baseline: number, req: ScalePlanRequest): number {
  const raw = req.factor !== undefined
    ? baseline * req.factor
    : baseline + (req.delta ?? 0);
  const rounded = roundValue(raw, req.round ?? 'round');
  const minClamped = req.clamp?.min === undefined ? rounded : Math.max(req.clamp.min, rounded);
  return req.clamp?.max === undefined ? minClamped : Math.min(req.clamp.max, minClamped);
}

async function readRecipeFacts(db: Client, recipeIds: string[]): Promise<Map<string, RecipeFact>> {
  const facts = new Map<string, RecipeFact>();

  for (const recipeId of recipeIds) {
    const result = await db.execute({
      sql: `
        SELECT recipe_id, type_id, modid
        FROM recipes
        WHERE recipe_id = ?
        LIMIT 1
      `,
      args: [recipeId],
    });
    const row = result.rows[0] as DbRow | undefined;
    if (!row) {
      continue;
    }
    facts.set(recipeId, {
      recipeId: String(row.recipe_id),
      typeId: String(row.type_id),
      modid: String(row.modid),
    });
  }

  return facts;
}

async function readInputFacts(db: Client, recipeId: string): Promise<RecipeInputFact[]> {
  const result = await db.execute({
    sql: `
      SELECT slot, kind, ref, count
      FROM recipe_inputs
      WHERE recipe_id = ?
      ORDER BY slot
    `,
    args: [recipeId],
  });

  return (result.rows as DbRow[]).map(row => ({
    slot: numberOrDefault(row.slot, 0),
    kind: optionalString(row.kind),
    ref: optionalString(row.ref),
    count: numberOrDefault(row.count, 1),
  }));
}

async function readOutputFacts(db: Client, recipeId: string): Promise<RecipeOutputFact[]> {
  const result = await db.execute({
    sql: `
      SELECT slot, item_id, count
      FROM recipe_outputs
      WHERE recipe_id = ?
      ORDER BY slot
    `,
    args: [recipeId],
  });

  return (result.rows as DbRow[]).map(row => ({
    slot: numberOrDefault(row.slot, 0),
    itemId: String(row.item_id),
    count: numberOrDefault(row.count, 1),
  }));
}

async function readOutputItems(db: Client, recipeIds: string[]): Promise<string[]> {
  const outputItems = new Set<string>();

  for (const recipeId of recipeIds) {
    const outputs = await readOutputFacts(db, recipeId);
    for (const output of outputs) {
      outputItems.add(output.itemId);
    }
  }

  return [...outputItems].sort();
}

function isConservationRecipe(inputs: RecipeInputFact[], outputs: RecipeOutputFact[]): boolean {
  return (
    inputs.length === 1 &&
    outputs.length === 1 &&
    inputs[0].kind === 'item' &&
    inputs[0].ref === outputs[0].itemId &&
    inputs[0].count === outputs[0].count
  );
}

function countBaselinesForField(
  field: string,
  inputs: RecipeInputFact[],
  outputs: RecipeOutputFact[]
): CountBaseline[] {
  if (field === 'input_count') {
    return inputs.map(input => ({
      slot: input.slot,
      value: input.count,
    }));
  }

  if (field === 'output_count') {
    return outputs.map(output => ({
      slot: output.slot,
      value: output.count,
    }));
  }

  return [];
}

function scaleOperation(params: {
  operationId: string;
  recipeId: string;
  fact?: RecipeFact;
  field: string;
  slot?: number;
  baseline?: number;
  computed?: number;
  reason: string;
}): ChangeOperation {
  const before: Record<string, unknown> = {
    field: params.field,
    recipeId: params.recipeId,
  };
  if (params.slot !== undefined) {
    before.slot = params.slot;
  }
  if (params.baseline !== undefined) {
    before.value = params.baseline;
  }

  const after = params.computed === undefined
    ? undefined
    : {
        field: params.field,
        value: params.computed,
      };

  return {
    operationId: params.operationId,
    decisionId: `scale:${params.field}:${params.recipeId}`,
    kind: 'scale_recipe_field',
    recipeId: params.recipeId,
    typeId: params.fact?.typeId,
    modid: params.fact?.modid,
    slot: params.slot,
    before,
    after,
    includedInChangeSet: false,
    reason: params.reason,
  };
}

function mergeRisk(blasts: BlastRadius[]): BlastRiskClassification {
  const reasons = new Set<string>();
  const severities: BlastRiskSeverity[] = [];

  for (const blast of blasts) {
    const risk = classifyRisk(blast, { action: 'scale' });
    severities.push(risk.severity);
    for (const reason of risk.reasons) {
      reasons.add(reason);
    }
  }

  if (blasts.length > 0) {
    reasons.add('scale 发射属输出层，本批仅产 IR 供审阅。');
  }

  return {
    severity: highestSeverity(severities),
    mustDefer: Array.from(reasons).some(reason => !reason.includes('输出层')),
    reasons: Array.from(reasons),
  };
}

export async function planScale(db: Client, req: ScalePlanRequest): Promise<ScalePlanResult> {
  validateScaleRequest(req);

  const recipeIds = dedupeStrings(req.recipeIds);
  const facts = await readRecipeFacts(db, recipeIds);
  const operations: ChangeOperation[] = [];
  const classifications: ScaleClassification[] = [];

  for (const recipeId of recipeIds) {
    const fact = facts.get(recipeId);
    const operationIdForRecipe = scaleOperationId(req.field, recipeId);

    if (!fact) {
      const reason = '找不到配方，无法读取结构化基线。';
      operations.push(scaleOperation({
        operationId: operationIdForRecipe,
        recipeId,
        field: req.field,
        reason,
      }));
      classifications.push({
        operationId: operationIdForRecipe,
        recipeId,
        field: req.field,
        decision: 'no_baseline',
        reason,
      });
      continue;
    }

    if (req.field !== 'input_count' && req.field !== 'output_count') {
      const reason = '字段仅存在 raw_json 中，需配方类型解析；本批只产 IR，不做类型重建。';
      operations.push(scaleOperation({
        operationId: operationIdForRecipe,
        recipeId,
        fact,
        field: req.field,
        reason,
      }));
      classifications.push({
        operationId: operationIdForRecipe,
        recipeId,
        field: req.field,
        decision: 'type_defer',
        reason,
      });
      continue;
    }

    const [inputs, outputs] = await Promise.all([
      readInputFacts(db, recipeId),
      readOutputFacts(db, recipeId),
    ]);
    const baselines = countBaselinesForField(req.field, inputs, outputs);

    if (baselines.length === 0) {
      const reason = '该字段没有结构化基线行，无法计算 before/after。';
      operations.push(scaleOperation({
        operationId: operationIdForRecipe,
        recipeId,
        fact,
        field: req.field,
        reason,
      }));
      classifications.push({
        operationId: operationIdForRecipe,
        recipeId,
        field: req.field,
        decision: 'no_baseline',
        reason,
      });
      continue;
    }

    const conservation = isConservationRecipe(inputs, outputs);
    for (const baseline of baselines) {
      const operationId = scaleOperationId(req.field, recipeId, baseline.slot);
      const computed = conservation ? baseline.value : computeScaledValue(baseline.value, req);
      const decision: ScaleClassificationDecision = conservation
        ? 'conservation_skip'
        : 'emission_pending';
      const reason = conservation
        ? '守恒型 1:1 转化，scale 按规格跳过。'
        : 'scale 语义可计算，但发射属输出层，本批不纳入 changeSet。';

      operations.push(scaleOperation({
        operationId,
        recipeId,
        fact,
        field: req.field,
        slot: baseline.slot,
        baseline: baseline.value,
        computed,
        reason,
      }));
      classifications.push({
        operationId,
        recipeId,
        field: req.field,
        decision,
        baseline: baseline.value,
        computed,
        reason,
      });
    }
  }

  const outputItems = await readOutputItems(db, recipeIds);
  const blast = await Promise.all(outputItems.map(item => computeBlastRadius(db, {
    kind: 'item',
    ref: item,
  })));

  return {
    operations,
    classifications,
    blast,
    risk: mergeRisk(blast),
  };
}

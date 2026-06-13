/**
 * Unify query types - MVP-0
 */

import type { ProjectCapabilities } from './mod';

export interface UnifyQueryParams {
  query: string;
  lang?: string;
  limit?: number;
}

export type UnifyMatchReason = 'display_name' | 'item_id_path' | 'tag';

export interface UnifyCandidateMatch {
  reason: UnifyMatchReason;
  value: string;
}

export interface UnifyItemFacts {
  itemId: string;
  modid: string;
  displayName?: string;
  translationKey?: string;
  tags: string[];
  isBlock: boolean;
  maxStack: number;
  maxDamage: number;
  isDamageable: boolean;
  isFireResistant: boolean;
  rarity?: string;
  enchantValue?: number;
  foodNutrition?: number;
  foodSaturation?: number;
  foodAlwaysEat?: boolean;
  defaultComponentsJson?: string;
}

export type UnifyReferenceKind = 'direct_input' | 'tag_input' | 'output' | 'raw_unparsed';

export interface UnifyRecipeReference {
  kind: UnifyReferenceKind;
  recipeId: string;
  typeId: string;
  modid: string;
  unparsed: boolean;
  slot?: number;
  role?: string;
  ref?: string;
  tagId?: string;
  count?: number;
  componentsJson?: string;
}

export interface UnifyCandidateReferences {
  directInputs: UnifyRecipeReference[];
  tagInputs: UnifyRecipeReference[];
  outputs: UnifyRecipeReference[];
  unparsedRaw: UnifyRecipeReference[];
}

export type UnifyRiskSeverity = 'info' | 'low' | 'medium' | 'high';

export interface UnifyRiskSignal {
  code: string;
  severity: UnifyRiskSeverity;
  message: string;
  data?: Record<string, unknown>;
}

export interface UnifyCandidate {
  item: UnifyItemFacts;
  matchedBy: UnifyCandidateMatch[];
  references: UnifyCandidateReferences;
  riskSignals: UnifyRiskSignal[];
  riskLevel: UnifyRiskSeverity;
}

export interface UnifyQueryResult {
  query: string;
  normalizedQuery: string;
  lang: string;
  sourceKind: 'exporter_v1';
  capabilities: ProjectCapabilities;
  candidates: UnifyCandidate[];
  generatedAt: string;
}

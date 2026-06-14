/**
 * 通用动作引擎类型 - M2
 */

export type ChangeOperationKind =
  | 'replace_recipe_input_item'
  | 'replace_recipe_output_item'
  | 'remove_recipe'
  | 'retag_add'
  | 'retag_remove'
  | 'rename_lang'
  | 'scale_recipe_field'
  | 'hide_in_jei'
  | 'tag_input_reference'
  | 'raw_unparsed_reference';

export interface ChangeOperation {
  operationId: string;
  decisionId: string;
  kind: ChangeOperationKind;
  recipeId?: string;
  typeId?: string;
  modid?: string;
  slot?: number;
  before: Record<string, unknown>;
  after?: Record<string, unknown>;
  includedInChangeSet: boolean;
  reason?: string;
}

export type ChangeSet = ChangeOperation[];

export type DecisionStatus = 'target' | 'auto' | 'deferred';

export type ActionRequestAction =
  | 'replace'
  | 'retag'
  | 'remove'
  | 'rename'
  | 'scale'
  | 'unify'
  | 'differentiate'
  | 'harmonize'
  | 'constrain_inputs';

export interface ActionRequest {
  action: ActionRequestAction;
  params: Record<string, unknown>;
  scope?: Record<string, unknown>;
}

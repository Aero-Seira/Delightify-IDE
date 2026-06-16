/**
 * Mock Electron API - v2.1
 * 根据 reference_sql/export.sqlite 样例调整
 */

import type { 
  Project, Item, Recipe, RecipeDetail, ModDataImportProgress,
  CreateProjectData,
  UpdateProjectData,
  ItemQueryParams, ItemQueryResult,
  RecipeQueryParams,
  ModDataImportResult,
  ValidationResult,
  UnifyDryRunParams,
  UnifyDryRunResult,
  UnifyQueryParams,
  UnifyQueryResult,
  IpcResponse,
  EngineActionRequest,
  EngineBlastSummary,
  EngineDryRunResult,
  KubeJsExportParams,
  KubeJsExportResult,
  KubeJsPreviewResult,
  KubeJsRevertResult,
} from '@delightify/shared';
import type { ElectronAPI } from './index';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 模拟存储
const mockProjects: Project[] = [];
let currentProject: Project | null = null;

// 生成示例数据
function generateMockItems(count: number): Item[] {
  return Array.from({ length: count }, (_, i) => ({
    itemId: `minecraft:item_${i}`,
    modid: 'minecraft',
  }));
}

function generateMockRecipes(count: number): Recipe[] {
  const types = [
    'minecraft:crafting_shaped',
    'minecraft:crafting_shapeless', 
    'minecraft:smelting',
    'minecraft:blasting',
    'minecraft:smoking',
    'farmersdelight:cooking',
  ];
  
  const items = [
    'minecraft:oak_planks', 'minecraft:stick', 'minecraft:diamond',
    'minecraft:iron_ingot', 'minecraft:gold_ingot', 'minecraft:coal',
    'minecraft:cobblestone', 'minecraft:log', 'minecraft:crafting_table',
    'minecraft:furnace', 'minecraft:chest', 'minecraft:iron_pickaxe',
    'minecraft:diamond_sword', 'minecraft:bowl', 'minecraft:bread',
    'minecraft:cooked_beef', 'minecraft:torch', 'minecraft:glass',
    'minecraft:stone_bricks', 'minecraft:wooden_sword',
  ];
  
  return Array.from({ length: count }, (_, i) => {
    const typeId = types[i % types.length];
    const resultItem = items[i % items.length];
    
    // 生成不同的配方 JSON
    let rawJson: string | undefined;
    if (typeId.includes('crafting')) {
      rawJson = JSON.stringify({
        type: typeId,
        pattern: ['XX', 'XX'],
        key: {
          X: { item: items[(i + 1) % items.length] }
        },
        result: { item: resultItem, count: 1 }
      });
    } else if (typeId.includes('smelt') || typeId.includes('blast') || typeId.includes('smoke')) {
      rawJson = JSON.stringify({
        type: typeId,
        ingredient: { item: items[(i + 2) % items.length] },
        result: resultItem,
        cookingtime: 200,
        experience: 0.35
      });
    } else {
      rawJson = JSON.stringify({
        type: typeId,
        ingredients: [
          { item: items[(i + 1) % items.length] },
          { item: items[(i + 3) % items.length] }
        ],
        result: { item: resultItem }
      });
    }
    
    return {
      recipeId: `minecraft:recipe_${i}`,
      typeId,
      modid: typeId.includes('farmersdelight') ? 'farmersdelight' : 'minecraft',
      hash: `hash_${i}`,
      rawJson,
      unparsed: false,
    };
  });
}

function generateMockUnifyCandidates(): UnifyQueryResult['candidates'] {
  return [
    {
      item: {
        itemId: 'minecraft:copper_ingot',
        modid: 'minecraft',
        displayName: '铜锭',
        translationKey: 'item.minecraft.copper_ingot',
        tags: ['forge:ingots/copper', 'c:ingots/copper'],
        isBlock: false,
        maxStack: 64,
        maxDamage: 0,
        isDamageable: false,
        isFireResistant: false,
      },
      matchedBy: [
        { reason: 'display_name', value: '铜锭' },
        { reason: 'item_id_path', value: 'copper_ingot' },
      ],
      references: {
        directInputs: [],
        tagInputs: [],
        outputs: [{ kind: 'output', recipeId: 'minecraft:copper_ingot_from_block', typeId: 'minecraft:crafting_shapeless', modid: 'minecraft', unparsed: false, slot: 0, count: 9 }],
        unparsedRaw: [],
      },
      riskSignals: [
        { code: 'has_recipe_outputs', severity: 'medium', message: '候选作为配方输出出现，替换输出会影响产物流向。' },
      ],
      riskLevel: 'medium',
    },
    {
      item: {
        itemId: 'moda:copper_ingot',
        modid: 'moda',
        displayName: '铜锭',
        translationKey: 'item.moda.copper_ingot',
        tags: ['forge:ingots/copper'],
        isBlock: false,
        maxStack: 64,
        maxDamage: 0,
        isDamageable: false,
        isFireResistant: false,
      },
      matchedBy: [
        { reason: 'display_name', value: '铜锭' },
        { reason: 'item_id_path', value: 'copper_ingot' },
      ],
      references: {
        directInputs: [
          { kind: 'direct_input', recipeId: 'moda:copper_gear', typeId: 'minecraft:crafting_shaped', modid: 'moda', unparsed: false, slot: 1, role: 'input', ref: 'moda:copper_ingot', count: 1 },
          { kind: 'direct_input', recipeId: 'moda:copper_wire', typeId: 'minecraft:crafting_shapeless', modid: 'moda', unparsed: false, slot: 0, role: 'input', ref: 'moda:copper_ingot', count: 2 },
        ],
        tagInputs: [],
        outputs: [],
        unparsedRaw: [],
      },
      riskSignals: [],
      riskLevel: 'low',
    },
    {
      item: {
        itemId: 'modb:copper_ingot',
        modid: 'modb',
        displayName: '铜锭',
        translationKey: 'item.modb.copper_ingot',
        tags: ['forge:ingots/copper'],
        isBlock: false,
        maxStack: 64,
        maxDamage: 0,
        isDamageable: false,
        isFireResistant: false,
      },
      matchedBy: [
        { reason: 'display_name', value: '铜锭' },
      ],
      references: {
        directInputs: [
          { kind: 'direct_input', recipeId: 'modb:copper_plate', typeId: 'minecraft:smelting', modid: 'modb', unparsed: false, slot: 0, role: 'input', ref: 'modb:copper_ingot', count: 1 },
        ],
        tagInputs: [
          { kind: 'tag_input', recipeId: 'modb:machine_frame', typeId: 'minecraft:crafting_shaped', modid: 'modb', unparsed: false, slot: 4, role: 'input', ref: 'forge:ingots/copper', tagId: 'forge:ingots/copper', count: 1 },
        ],
        outputs: [],
        unparsedRaw: [
          { kind: 'raw_unparsed', recipeId: 'modb:scripted_copper', typeId: 'kubejs:custom', modid: 'modb', unparsed: true },
        ],
      },
      riskSignals: [
        { code: 'tag_input_references', severity: 'info', message: '候选通过 tag 被配方间接引用。' },
        { code: 'related_unparsed_recipes', severity: 'high', message: '存在相关未结构化配方，不能自动 rewrite，只能进入风险说明。' },
      ],
      riskLevel: 'high',
    },
  ];
}

function mockEngineBlastSummary(
  target: { kind: 'item' | 'tag'; ref: string } = { kind: 'item', ref: 'minecraft:copper_ingot' }
): EngineBlastSummary {
  return {
    target,
    inputRefs: [],
    outputRefs: [],
    tagConnected: [],
    relatedUnparsed: [],
    isBlock: false,
    crossMod: false,
    counts: {
      inputRefs: 0,
      outputRefs: 0,
      tagConnected: 0,
      relatedUnparsed: 0,
    },
  };
}

/**
 * Mock API
 */
export const mockElectronAPI = {
  // ========== 项目管理 ==========
  projectList: async () => {
    await delay(300);
    return { success: true, data: mockProjects, total: mockProjects.length };
  },

  projectOpen: async (projectId?: string) => {
    await delay(200);
    if (projectId) {
      const project = mockProjects.find(p => p.id === projectId);
      if (project) {
        currentProject = project;
        return { success: true, data: project };
      }
    }
    return { success: true, data: currentProject, canceled: !projectId };
  },

  projectCreate: async (data: CreateProjectData) => {
    await delay(500);
    const newProject: Project = {
      id: `proj_${Date.now()}`,
      name: data.name,
      description: data.description || '',
      path: data.path,
      mcVersion: data.mcVersion,
      modLoader: data.modLoader,
      modLoaderVersion: data.modLoaderVersion,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
      isFavorite: false,
      status: 'needs_import',
      totalMods: 0,
      totalItems: 0,
      totalRecipes: 0,
    };
    mockProjects.push(newProject);
    return { success: true, data: newProject };
  },

  projectGetCurrent: async () => ({
    success: true,
    data: currentProject,
  }),

  projectUpdate: async (projectId: string, data: UpdateProjectData) => {
    const project = mockProjects.find(p => p.id === projectId);
    if (project) {
      Object.assign(project, data, { updatedAt: new Date().toISOString() });
      return { success: true, data: project };
    }
    return { success: false, error: 'Project not found' };
  },

  projectDelete: async (projectId: string) => {
    const index = mockProjects.findIndex(p => p.id === projectId);
    if (index >= 0) {
      mockProjects.splice(index, 1);
      return { success: true };
    }
    return { success: false, error: 'Project not found' };
  },

  projectGetStats: async () => ({
    success: true,
    data: {
      modCount: 3,
      itemCount: 100,
      recipeCount: 50,
      tagCount: 20,
      recipeTypeCount: 8,
      needsReimport: true,
      instance: {
        path: '/mock/path/to/modpack',
        pathExists: true,
        directories: {
          minecraftRoot: false,
          mods: true,
          config: true,
          kubejs: true,
          saves: true,
          resourcepacks: false,
          delightify: true,
        },
        modJarCount: 3,
        exporterSnapshot: {
          found: true,
          relativePath: 'mpide-exporter/export.sqlite',
          filePath: '/mock/path/to/modpack/mpide-exporter/export.sqlite',
          size: 1024,
          modifiedAt: new Date().toISOString(),
        },
        git: {
          isRepo: true,
          branch: 'main',
          dirty: true,
          changedFiles: 2,
        },
        generated: {
          manifestExists: true,
          serverScriptExists: true,
          managedFiles: 2,
        },
        warnings: ['Git 工作区有 2 个未提交变更。'],
      },
    },
  }),

  selectDirectory: async () => ({
    canceled: false,
    filePaths: ['/mock/path/to/modpack'],
  }),

  selectDataFile: async () => ({
    canceled: false,
    filePaths: ['/mock/path/to/export.sqlite'],
  }),

  // ========== Mod数据导入 ==========
  modDataDetect: async () => ({
    success: true,
    data: { filePath: '/mock/export.sqlite', found: true },
  }),

  modDataValidate: async (): Promise<{ success: boolean; data: ValidationResult }> => ({
    success: true,
    data: {
      valid: true,
      version: '2.0',
      schemaVersion: '2.0',
      sourceKind: 'exporter_v1',
      capabilities: { browse: true, mvp0Unify: true },
      loader: 'forge',
      mcVersion: '1.20.1',
      minecraftVersion: '1.20.1',
      forgeVersion: '47.4.18',
      modCount: 3,
      itemCount: 100,
      recipeCount: 50,
      tagCount: 20,
    },
  }),

  modDataImport: async (): Promise<{ success: boolean; data: ModDataImportResult }> => {
    await delay(2000);
    return {
      success: true,
      data: {
        success: true,
        importId: 'mock_import_1',
        sourceKind: 'exporter_v1',
        capabilities: { browse: true, mvp0Unify: true },
        stats: { modCount: 3, itemCount: 100, recipeCount: 50, tagCount: 20 },
      },
    };
  },

  onModDataImportProgress: (callback: (progress: ModDataImportProgress) => void) => {
    const phases = [
      { phase: 'detecting' as const, message: '检测数据文件...' },
      { phase: 'validating' as const, message: '验证数据文件...' },
      { phase: 'reading' as const, message: '读取数据...' },
      { phase: 'importing' as const, message: '导入数据...' },
      { phase: 'completed' as const, message: '导入完成！' },
    ];
    let i = 0;
    const interval = setInterval(() => {
      const p = phases[i];
      callback({ phase: p.phase, percent: (i + 1) * 20, message: p.message });
      i++;
      if (i >= phases.length) clearInterval(interval);
    }, 400);
    return () => clearInterval(interval);
  },

  modDataGetImportHistory: async () => ({
    success: true,
    data: [],
  }),

  // ========== 物品查询 ==========
  itemsQuery: async (_projectPath: string, params: ItemQueryParams): Promise<{ success: boolean; data?: ItemQueryResult }> => {
    await delay(300);
    const { search, page = 1, pageSize = 50 } = params;
    let items = generateMockItems(100);
    if (search) {
      items = items.filter(i => i.itemId.includes(search));
    }
    const start = (page - 1) * pageSize;
    return {
      success: true,
      data: {
        items: items.slice(start, start + pageSize),
        total: items.length,
        page,
        pageSize,
      },
    };
  },

  itemsGetByMod: async (_projectPath: string, modid: string) => ({
    success: true,
    data: generateMockItems(50).map(i => ({ ...i, modid })),
  }),

  itemsGetDetail: async (_projectPath: string, itemId: string) => ({
    success: true,
    data: {
      itemId,
      modid: 'minecraft',
      displayName: itemId.split(':').pop()?.replace(/_/g, ' '),
      tags: ['forge:items', 'minecraft:items'],
    },
  }),

  itemsGetTexture: async (): Promise<IpcResponse<{ base64: string; mimeType: string } | null>> => ({
    success: true,
    data: null,
  }),

  // ========== 标签和模组查询 ==========
  tagsQuery: async () => ({
    success: true,
    data: [
      { tagId: 'forge:storage_blocks', itemCount: 12 },
      { tagId: 'minecraft:logs', itemCount: 8 },
    ],
  }),

  modsQuery: async () => ({
    success: true,
    data: [
      { modid: 'minecraft', version: '1.20.1', name: 'Minecraft' },
      { modid: 'forge', version: '47.4.18', name: 'Forge' },
    ],
  }),

  // ========== 配方查询 ==========
  recipesQuery: async (_projectPath: string, _params: RecipeQueryParams) => {
    await delay(300);
    return {
      success: true,
      data: {
        recipes: generateMockRecipes(20),
        total: 20,
      },
    };
  },

  recipesGetTypes: async () => ({
    success: true,
    data: [
      { typeId: 'minecraft:crafting_shaped', displayName: '有序合成', recipeCount: 100 },
      { typeId: 'minecraft:smelting', displayName: '熔炼', recipeCount: 50 },
    ],
  }),

  recipesGetDetail: async (_projectPath: string, recipeId: string): Promise<IpcResponse<RecipeDetail | null>> => ({
    success: true,
    data: {
      recipe: {
        recipeId,
        typeId: 'minecraft:crafting_shaped',
        modid: 'minecraft',
        hash: 'mock_hash',
        unparsed: false,
      },
      inputs: [],
      outputs: [],
    },
  }),

  // ========== Unify 查询 ==========
  unifyQuery: async (_projectPath: string, params: UnifyQueryParams) => ({
    success: true,
    data: {
      query: params.query,
      normalizedQuery: params.query.trim().toLowerCase(),
      lang: params.lang || 'zh_cn',
      sourceKind: 'exporter_v1' as const,
      capabilities: { browse: true, mvp0Unify: true },
      candidates: generateMockUnifyCandidates(),
      generatedAt: new Date().toISOString(),
    } satisfies UnifyQueryResult,
  }),

  unifyDryRun: async (_projectPath: string, params: UnifyDryRunParams) => {
    const targetItemId = params.targetItemId || 'minecraft:copper_ingot';
    const diff: UnifyDryRunResult['diff'] = [
      {
        operationId: 'unify:moda:copper_ingot->minecraft:copper_ingot:op_1',
        decisionId: 'unify:moda:copper_ingot->minecraft:copper_ingot',
        kind: 'replace_recipe_input_item',
        recipeId: 'moda:copper_gear',
        typeId: 'minecraft:crafting_shaped',
        modid: 'moda',
        slot: 1,
        before: { kind: 'item', ref: 'moda:copper_ingot', count: 1 },
        after: { kind: 'item', ref: targetItemId, count: 1 },
        includedInChangeSet: true,
      },
      {
        operationId: 'unify:moda:copper_ingot->minecraft:copper_ingot:op_2',
        decisionId: 'unify:moda:copper_ingot->minecraft:copper_ingot',
        kind: 'replace_recipe_input_item',
        recipeId: 'moda:copper_wire',
        typeId: 'minecraft:crafting_shapeless',
        modid: 'moda',
        slot: 0,
        before: { kind: 'item', ref: 'moda:copper_ingot', count: 2 },
        after: { kind: 'item', ref: targetItemId, count: 2 },
        includedInChangeSet: true,
      },
      {
        operationId: 'unify:modb:copper_ingot->minecraft:copper_ingot:op_1',
        decisionId: 'unify:modb:copper_ingot->minecraft:copper_ingot',
        kind: 'replace_recipe_input_item',
        recipeId: 'modb:copper_plate',
        typeId: 'minecraft:smelting',
        modid: 'modb',
        slot: 0,
        before: { kind: 'item', ref: 'modb:copper_ingot', count: 1 },
        after: { kind: 'item', ref: targetItemId, count: 1 },
        includedInChangeSet: false,
        reason: '存在未结构化相关配方，需要人工审阅。',
      },
      {
        operationId: 'unify:modb:copper_ingot->minecraft:copper_ingot:op_2',
        decisionId: 'unify:modb:copper_ingot->minecraft:copper_ingot',
        kind: 'raw_unparsed_reference',
        recipeId: 'modb:scripted_copper',
        typeId: 'kubejs:custom',
        modid: 'modb',
        before: { unparsed: true },
        includedInChangeSet: false,
        reason: '未结构化配方不能自动 rewrite。',
      },
    ];

    return {
      success: true,
      data: {
        query: params.query,
        normalizedQuery: params.query.trim().toLowerCase(),
        lang: params.lang || 'zh_cn',
        targetItemId,
        targetReason: params.targetItemId ? 'user_selected' : 'mock_default',
        decisions: [
          {
            decisionId: 'unify:minecraft:copper_ingot->minecraft:copper_ingot',
            status: 'target',
            sourceItemId: 'minecraft:copper_ingot',
            targetItemId,
            action: { type: 'keep_target', targetItemId, operationIds: [] },
            confidence: 1,
            evidence: ['matched_by:display_name:铜锭', 'same_item_path:copper_ingot'],
            riskSignals: [],
            riskLevel: 'low',
            reason: '保留目标物品，不生成替换操作。',
            diffOperationIds: [],
          },
          {
            decisionId: 'unify:moda:copper_ingot->minecraft:copper_ingot',
            status: 'auto',
            sourceItemId: 'moda:copper_ingot',
            targetItemId,
            action: {
              type: 'replace_item_references',
              sourceItemId: 'moda:copper_ingot',
              targetItemId,
              operationIds: [
                'unify:moda:copper_ingot->minecraft:copper_ingot:op_1',
                'unify:moda:copper_ingot->minecraft:copper_ingot:op_2',
              ],
            },
            confidence: 0.95,
            evidence: ['matched_by:display_name:铜锭', 'shared_tags:forge:ingots/copper', 'direct_inputs:2'],
            riskSignals: [],
            riskLevel: 'low',
            reason: '低风险候选，仅包含可结构化替换的直接 item 输入引用。',
            diffOperationIds: [
              'unify:moda:copper_ingot->minecraft:copper_ingot:op_1',
              'unify:moda:copper_ingot->minecraft:copper_ingot:op_2',
            ],
          },
          {
            decisionId: 'unify:modb:copper_ingot->minecraft:copper_ingot',
            status: 'deferred',
            sourceItemId: 'modb:copper_ingot',
            targetItemId,
            action: {
              type: 'defer_review',
              sourceItemId: 'modb:copper_ingot',
              targetItemId,
              operationIds: [],
            },
            confidence: 0.55,
            evidence: ['matched_by:display_name:铜锭', 'tag_inputs:1', 'unparsed_related:1'],
            riskSignals: [
              { code: 'related_unparsed_recipes', severity: 'high', message: '存在相关未结构化配方，不能自动 rewrite，只能进入风险说明。' },
            ],
            riskLevel: 'high',
            reason: '存在相关未结构化配方，不能自动 rewrite，只能进入风险说明。',
            diffOperationIds: [
              'unify:modb:copper_ingot->minecraft:copper_ingot:op_1',
              'unify:modb:copper_ingot->minecraft:copper_ingot:op_2',
            ],
          },
        ],
        diff,
        changeSet: diff.filter(operation => operation.includedInChangeSet),
        autoDecisionCount: 1,
        deferredDecisionCount: 1,
        generatedAt: new Date().toISOString(),
      } satisfies UnifyDryRunResult,
    };
  },

  // ========== Engine 查询 ==========
  engineDryRun: async (
    _projectPath: string,
    req: EngineActionRequest
  ): Promise<IpcResponse<EngineDryRunResult>> => {
    const data: EngineDryRunResult = {
      action: req.action,
      operations: [],
      changeSetPreview: [],
      deferredSuggestions: [],
      risk: {
        severity: 'info',
        mustDefer: false,
        reasons: [],
      },
      blast: [],
    };
    if (req.action === 'scale') {
      data.scaleClassifications = [];
    }
    return { success: true, data };
  },

  engineBlast: async (
    _projectPath: string,
    target: { kind: 'item' | 'tag'; ref: string }
  ): Promise<IpcResponse<EngineBlastSummary>> => ({
    success: true,
    data: mockEngineBlastSummary(target),
  }),

  // ========== 导出 ==========
  previewKubeJs: async (
    params: KubeJsExportParams
  ): Promise<{ success: boolean; data: KubeJsPreviewResult }> => {
    const generatedAt = new Date().toISOString();
    const content = params.changeSet.length === 0
      ? ''
      : [
        '// @delightify-generated',
        '// Do not edit by hand. Regenerate from Delightify.',
        `// Generated at: ${generatedAt}`,
        '',
        'ServerEvents.recipes(event => {',
        '}',
        '',
      ].join('\n');

    return {
      success: true,
      data: {
        operationCount: params.changeSet.length,
        generatedAt,
        files: params.changeSet.length === 0 ? [] : [
          {
            relativePath: 'kubejs/server_scripts/zzz_delightify_generated.js',
            operationCount: params.changeSet.length,
            content,
          },
        ],
      },
    };
  },

  exportKubeJs: async (
    projectPath: string,
    params: KubeJsExportParams
  ): Promise<{ success: boolean; data: KubeJsExportResult }> => {
    const writtenAt = new Date().toISOString();
    const filePath = `${projectPath}/kubejs/server_scripts/zzz_delightify_generated.js`;
    const generatedCode = params.changeSet.length === 0
      ? ''
      : [
        '// @delightify-generated',
        '// Do not edit by hand. Regenerate from Delightify.',
        `// Generated at: ${writtenAt}`,
        '',
        'ServerEvents.recipes(event => {',
        '}',
        '',
      ].join('\n');

    return {
      success: true,
      data: {
        filePath,
        operationCount: params.changeSet.length,
        generatedCode,
        writtenAt,
        files: params.changeSet.length === 0 ? [] : [
          {
            filePath,
            operationCount: params.changeSet.length,
          },
        ],
      },
    };
  },

  revertKubeJs: async (
    projectPath: string
  ): Promise<{ success: boolean; data: KubeJsRevertResult }> => ({
    success: true,
    data: {
      filePath: `${projectPath}/kubejs/server_scripts/zzz_delightify_generated.js`,
      deleted: true,
    },
  }),

  // ========== 通用工具 ==========
  openExternal: async (url: string) => {
    window.open(url, '_blank');
  },

  // ========== 调试 ==========
  debugDbTables: async () => ({
    success: true,
    data: [
      { name: 'mods', rowCount: 3 },
      { name: 'items', rowCount: 100 },
      { name: 'recipes', rowCount: 50 },
      { name: 'item_tags', rowCount: 200 },
    ],
  }),

  debugDbQuery: async () => ({
    success: true,
    data: [],
  }),

  debugClearData: async () => ({
    success: true,
    data: { cleared: true },
  }),
} satisfies ElectronAPI;

export const browserElectronAPI = mockElectronAPI;

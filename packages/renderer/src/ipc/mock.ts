/**
 * Mock Electron API - v2.1
 * 根据 reference_sql/export.sqlite 样例调整
 */

import type { 
  Project, Item, Recipe, ModDataImportProgress,
  ItemQueryParams, ItemQueryResult,
  RecipeQueryParams,
} from '@delightify/shared';

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

  projectCreate: async (data: any) => {
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

  projectUpdate: async (projectId: string, data: any) => {
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
      needsReimport: true,
    },
  }),

  selectDirectory: async () => ({
    canceled: false,
    filePaths: ['/mock/path/to/modpack'],
  }),

  // ========== Mod数据导入 ==========
  modDataDetect: async () => ({
    success: true,
    data: { filePath: '/mock/export.sqlite', found: true },
  }),

  modDataValidate: async () => ({
    success: true,
    data: {
      valid: true,
      minecraftVersion: '1.20.1',
      forgeVersion: '47.4.18',
      modCount: 3,
    },
  }),

  modDataImport: async () => {
    await delay(2000);
    return {
      success: true,
      data: {
        success: true,
        importId: 'mock_import_1',
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
      tags: ['forge:items', 'minecraft:items'],
    },
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

  recipesGetDetail: async (_projectPath: string, recipeId: string) => ({
    success: true,
    data: {
      recipeId,
      typeId: 'minecraft:crafting_shaped',
      modid: 'minecraft',
      hash: 'mock_hash',
      unparsed: false,
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
};

export const browserElectronAPI = mockElectronAPI;

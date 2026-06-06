/**
 * 配置加载服务 / Configuration Loader Service
 * 
 * 负责从 config/ 目录加载配方类型定义和物品分类配置
 * Responsible for loading recipe type definitions and item category configurations from config/ directory
 */

import { promises as fs, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  RecipeTypeDefinition,
  ItemCategoryConfig,
  RecipeTypesFile,
} from '@delightify/shared';

// 获取当前文件目录（兼容 CommonJS 和 ES Modules）
// Get current file directory (compatible with CommonJS and ES Modules)
const getCurrentDir = (): string => {
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  // ES Module 环境 / ES Module environment
  try {
    // @ts-expect-error import.meta 在 ES Module 中可用
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
};

/**
 * 配置加载器类 / Configuration Loader Class
 */
export class ConfigLoader {
  private readonly configPath: string;

  /**
   * 创建配置加载器实例 / Create ConfigLoader instance
   * @param configPath - 配置目录路径 / Configuration directory path
   */
  constructor(configPath?: string) {
    // 默认使用项目根目录下的 config 文件夹
    // Default to config folder in project root
    this.configPath = configPath || this.resolveConfigPath();
  }

  /**
   * 解析配置目录路径 / Resolve configuration directory path
   * @returns 配置目录的绝对路径 / Absolute path to config directory
   */
  private resolveConfigPath(): string {
    // 在 Electron 环境中，__dirname 是编译后的目录
    // 我们需要向上导航到项目根目录
    // In Electron, __dirname is the compiled directory
    // We need to navigate up to project root
    
    // 尝试从当前文件位置向上查找
    // Try to find from current file location
    let currentDir = getCurrentDir();
    
    // 最多向上查找 5 层目录
    // Search up to 5 parent directories
    for (let i = 0; i < 5; i++) {
      const configDir = path.join(currentDir, 'config');
      const possiblePath = path.join(currentDir, '..', 'config');
      
      // 检查是否存在 config 目录
      // Check if config directory exists
      try {
        if (this.directoryExistsSync(configDir)) {
          return configDir;
        }
        if (this.directoryExistsSync(possiblePath)) {
          return path.resolve(possiblePath);
        }
      } catch {
        // 继续向上查找 / Continue searching upward
      }
      
      currentDir = path.join(currentDir, '..');
    }
    
    // 默认返回相对于工作目录的 config 路径
    // Default to config path relative to working directory
    return path.resolve(process.cwd(), 'config');
  }

  /**
   * 同步检查目录是否存在 / Synchronously check if directory exists
   * @param dirPath - 目录路径 / Directory path
   * @returns 是否存在 / Whether exists
   */
  private directoryExistsSync(dirPath: string): boolean {
    try {
      const stats = statSync(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * 获取配置目录路径 / Get configuration directory path
   * @returns 配置目录路径 / Configuration directory path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * 检查路径是否存在 / Check if path exists
   * @param filePath - 文件路径 / File path
   * @returns 是否存在 / Whether exists
   */
  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 读取目录下的所有 JSON 文件 / Read all JSON files in directory
   * @param dirPath - 目录路径 / Directory path
   * @returns JSON 文件路径数组 / Array of JSON file paths
   */
  private async readJsonFiles(dirPath: string): Promise<string[]> {
    const exists = await this.pathExists(dirPath);
    if (!exists) {
      return [];
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const jsonFiles: string[] = [];

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // 递归读取子目录 / Recursively read subdirectories
          const subFiles = await this.readJsonFiles(fullPath);
          jsonFiles.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          jsonFiles.push(fullPath);
        }
      }

      return jsonFiles;
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
      return [];
    }
  }

  /**
   * 解析 JSON 文件 / Parse JSON file
   * @param filePath - 文件路径 / File path
   * @returns 解析后的数据或 null / Parsed data or null
   */
  private async parseJsonFile<T>(filePath: string): Promise<T | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      console.error(`Error parsing JSON file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * 加载所有配方类型定义 / Load all recipe type definitions
   * 
   * 从 builtin 和 custom 目录加载所有配方类型
   * Loads all recipe types from builtin and custom directories
   * 
   * @returns 配方类型定义数组 / Array of recipe type definitions
   */
  async loadRecipeTypes(): Promise<RecipeTypeDefinition[]> {
    const recipeTypes: RecipeTypeDefinition[] = [];
    const builtinDir = path.join(this.configPath, 'recipe_types', 'builtin');
    const customDir = path.join(this.configPath, 'recipe_types', 'custom');

    // 加载内置配方类型 / Load builtin recipe types
    const builtinFiles = await this.readJsonFiles(builtinDir);
    for (const file of builtinFiles) {
      const data = await this.parseJsonFile<RecipeTypesFile>(file);
      if (data?.recipeTypes && Array.isArray(data.recipeTypes)) {
        recipeTypes.push(...data.recipeTypes);
      }
    }

    // 加载自定义配方类型 / Load custom recipe types
    const customFiles = await this.readJsonFiles(customDir);
    for (const file of customFiles) {
      const data = await this.parseJsonFile<RecipeTypesFile>(file);
      if (data?.recipeTypes && Array.isArray(data.recipeTypes)) {
        recipeTypes.push(...data.recipeTypes);
      }
    }

    return recipeTypes;
  }

  /**
   * 加载物品分类配置 / Load item category configuration
   * 
   * @returns 物品分类配置 / Item category configuration
   */
  async loadItemCategories(): Promise<ItemCategoryConfig> {
    const filePath = path.join(this.configPath, 'item_categories.json');
    const exists = await this.pathExists(filePath);
    
    if (!exists) {
      console.warn(`Item categories file not found: ${filePath}`);
      return {
        categories: {},
        item_mapping: {},
      };
    }

    const data = await this.parseJsonFile<ItemCategoryConfig>(filePath);
    
    if (!data) {
      console.warn(`Failed to parse item categories file: ${filePath}`);
      return {
        categories: {},
        item_mapping: {},
      };
    }

    return {
      categories: data.categories || {},
      item_mapping: data.item_mapping || {},
    };
  }

  /**
   * 加载映射规则配置 / Load mapping rules configuration
   * 
   * @returns 映射规则配置对象 / Mapping rules configuration object
   */
  async loadMappingRules(): Promise<Record<string, unknown>> {
    const filePath = path.join(this.configPath, 'mapping_rules.json');
    const exists = await this.pathExists(filePath);
    
    if (!exists) {
      console.warn(`Mapping rules file not found: ${filePath}`);
      return {};
    }

    const data = await this.parseJsonFile<Record<string, unknown>>(filePath);
    return data || {};
  }
}

/**
 * 创建默认配置加载器实例 / Create default ConfigLoader instance
 */
export const configLoader = new ConfigLoader();

export default ConfigLoader;

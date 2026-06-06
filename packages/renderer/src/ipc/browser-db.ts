/**
 * 浏览器数据库适配器
 * 使用 IndexedDB 模拟 SQLite 数据库功能
 */

const DB_NAME = 'DelightifyDB';
const DB_VERSION = 1;

interface DBSchema {
  mods: ModRecord;
  items: ItemRecord;
  recipes: RecipeRecord;
  tags: TagRecord;
  translations: TranslationRecord;
  textures: TextureRecord;
}

interface ModRecord {
  mod_id: string;
  mod_name: string;
  version?: string;
  mc_version?: string;
  item_count: number;
  recipe_count: number;
  parsed_at: string;
}

interface ItemRecord {
  item_id: string;
  mod_id: string;
  display_name_key?: string;
  display_name?: string;
  category?: string;
  texture_path?: string;
  texture_cache_name?: string;
  texture_type?: 'item' | 'block' | 'unknown';
  is_block: number;
  created_at: string;
}

interface RecipeRecord {
  recipe_id: string;
  mod_id: string;
  recipe_type_id: string;
  raw_json: string;
  parsed_at: string;
}

interface TagRecord {
  tag_id: string;
  item_id: string;
  source_mod_id: string;
}

interface TranslationRecord {
  key: string;
  lang: string;
  value: string;
  mod_id: string;
}

interface TextureRecord {
  texture_id: string;
  mod_id: string;
  original_path: string;
  cache_name: string;
  data?: Blob; // 实际图片数据
  cached_at: string;
}

class BrowserDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        
        // Mods 表
        if (!db.objectStoreNames.contains('mods')) {
          const modsStore = db.createObjectStore('mods', { keyPath: 'mod_id' });
          modsStore.createIndex('mod_name', 'mod_name', { unique: false });
        }
        
        // Items 表
        if (!db.objectStoreNames.contains('items')) {
          const itemsStore = db.createObjectStore('items', { keyPath: 'item_id' });
          itemsStore.createIndex('mod_id', 'mod_id', { unique: false });
          itemsStore.createIndex('category', 'category', { unique: false });
          itemsStore.createIndex('texture_type', 'texture_type', { unique: false });
          itemsStore.createIndex('display_name', 'display_name', { unique: false });
        }
        
        // Recipes 表
        if (!db.objectStoreNames.contains('recipes')) {
          const recipesStore = db.createObjectStore('recipes', { keyPath: 'recipe_id' });
          recipesStore.createIndex('mod_id', 'mod_id', { unique: false });
        }
        
        // Tags 表
        if (!db.objectStoreNames.contains('tags')) {
          const tagsStore = db.createObjectStore('tags', { keyPath: ['tag_id', 'item_id'] });
          tagsStore.createIndex('tag_id', 'tag_id', { unique: false });
          tagsStore.createIndex('item_id', 'item_id', { unique: false });
        }
        
        // Translations 表
        if (!db.objectStoreNames.contains('translations')) {
          const transStore = db.createObjectStore('translations', { keyPath: ['key', 'lang'] });
          transStore.createIndex('key', 'key', { unique: false });
          transStore.createIndex('lang', 'lang', { unique: false });
        }
        
        // Textures 表（存储实际的图片 Blob）
        if (!db.objectStoreNames.contains('textures')) {
          const texturesStore = db.createObjectStore('textures', { keyPath: 'texture_id' });
          texturesStore.createIndex('cache_name', 'cache_name', { unique: true });
          texturesStore.createIndex('mod_id', 'mod_id', { unique: false });
        }
      };
    });
  }

  // 通用查询方法
  async execute<T = any>(
    storeName: keyof DBSchema,
    mode: 'readonly' | 'readwrite' = 'readonly'
  ): Promise<{ rows: T[] }> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve({ rows: request.result });
      request.onerror = () => reject(request.error);
    });
  }

  // 条件查询
  async query<T = any>(
    storeName: keyof DBSchema,
    indexName: string,
    value: any
  ): Promise<{ rows: T[] }> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      
      request.onsuccess = () => resolve({ rows: request.result });
      request.onerror = () => reject(request.error);
    });
  }

  // 插入/更新
  async put<T = any>(storeName: keyof DBSchema, data: T): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 批量插入
  async putMany<T = any>(storeName: keyof DBSchema, data: T[]): Promise<void> {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    
    for (const item of data) {
      store.put(item);
    }
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // 删除
  async delete(storeName: keyof DBSchema, key: any): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 清空表
  async clear(storeName: keyof DBSchema): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 保存纹理数据（Blob）
  async saveTexture(cacheName: string, blob: Blob, metadata: any): Promise<void> {
    if (!this.db) await this.init();
    
    const textureData = {
      texture_id: `${metadata.modId}:${metadata.itemName}`,
      mod_id: metadata.modId,
      original_path: metadata.path,
      cache_name: cacheName,
      data: blob,
      cached_at: new Date().toISOString(),
    };
    
    await this.put('textures', textureData);
  }

  // 获取纹理数据
  async getTexture(cacheName: string): Promise<Blob | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('textures', 'readonly');
      const store = transaction.objectStore('textures');
      const index = store.index('cache_name');
      const request = index.get(cacheName);
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.data : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // 获取数据库统计
  async getStats(): Promise<Record<string, number>> {
    if (!this.db) await this.init();
    
    const stores: Array<keyof DBSchema> = ['mods', 'items', 'recipes', 'tags', 'translations', 'textures'];
    const stats: Record<string, number> = {};
    
    for (const storeName of stores) {
      const result = await this.execute(storeName);
      stats[storeName as string] = result.rows.length;
    }
    
    return stats;
  }
}

// 单例实例
export const browserDB = new BrowserDB();

// 初始化数据库
export async function initBrowserDB(): Promise<void> {
  await browserDB.init();
  console.log('[BrowserDB] Database initialized');
}

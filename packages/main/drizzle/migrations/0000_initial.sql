-- Initial Migration for Delightify M1
-- Creates all core tables for global.db and project.db

-- ============================================
-- Global Database Tables (global.db)
-- ============================================

-- mods: 模组元信息表
CREATE TABLE IF NOT EXISTS mods (
  mod_id TEXT PRIMARY KEY,
  mod_name TEXT NOT NULL,
  version TEXT,
  mc_version TEXT,
  source_type TEXT NOT NULL,
  jar_path TEXT,
  jar_hash TEXT,
  parsed_at TEXT,
  item_count INTEGER NOT NULL DEFAULT 0,
  recipe_count INTEGER NOT NULL DEFAULT 0
);

-- items: 物品条目表
CREATE TABLE IF NOT EXISTS items (
  item_id TEXT PRIMARY KEY,
  mod_id TEXT NOT NULL REFERENCES mods(mod_id),
  display_name_key TEXT,
  display_name TEXT,
  category TEXT,
  texture_path TEXT,
  texture_cache_name TEXT,
  is_block INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- item_tags: 物品标签关联表
CREATE TABLE IF NOT EXISTS item_tags (
  tag_id TEXT NOT NULL,
  item_id TEXT NOT NULL REFERENCES items(item_id),
  source_mod_id TEXT NOT NULL,
  PRIMARY KEY (tag_id, item_id)
);

-- recipe_types: 配方类型表
CREATE TABLE IF NOT EXISTS recipe_types (
  recipe_type_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  input_slot_count INTEGER NOT NULL DEFAULT 1,
  output_slot_count INTEGER NOT NULL DEFAULT 1,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  source_mod_id TEXT,
  field_spec TEXT
);

-- recipes: 配方表
CREATE TABLE IF NOT EXISTS recipes (
  recipe_id TEXT PRIMARY KEY,
  mod_id TEXT NOT NULL REFERENCES mods(mod_id),
  recipe_type_id TEXT NOT NULL REFERENCES recipe_types(recipe_type_id),
  raw_json TEXT NOT NULL,
  input_slots TEXT,
  output_slots TEXT,
  parsed_at TEXT NOT NULL
);

-- translations: 翻译表
CREATE TABLE IF NOT EXISTS translations (
  key TEXT NOT NULL,
  lang TEXT NOT NULL,
  value TEXT NOT NULL,
  mod_id TEXT NOT NULL,
  PRIMARY KEY (key, lang)
);

-- textures: 材质缓存表
CREATE TABLE IF NOT EXISTS textures (
  texture_id TEXT PRIMARY KEY,
  mod_id TEXT NOT NULL,
  original_path TEXT NOT NULL,
  cache_name TEXT NOT NULL,
  file_hash TEXT,
  width INTEGER,
  height INTEGER,
  cached_at TEXT NOT NULL
);

-- ============================================
-- Graph Layer Tables (M2+ preparation)
-- ============================================

-- entities: 统一实体表
CREATE TABLE IF NOT EXISTS entities (
  entity_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  original_id TEXT NOT NULL,
  mod_id TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL
);

-- relations: 关系边表
CREATE TABLE IF NOT EXISTS relations (
  relation_id TEXT PRIMARY KEY,
  from_entity_id TEXT NOT NULL REFERENCES entities(entity_id),
  to_entity_id TEXT NOT NULL REFERENCES entities(entity_id),
  relation_type TEXT NOT NULL,
  layer TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  confidence REAL DEFAULT 1.0,
  payload TEXT,
  created_at TEXT NOT NULL
);

-- imports: 导入批次记录表
CREATE TABLE IF NOT EXISTS imports (
  import_id TEXT PRIMARY KEY,
  import_type TEXT NOT NULL,
  source_path TEXT,
  file_hash TEXT,
  parser_version TEXT NOT NULL,
  item_count INTEGER DEFAULT 0,
  recipe_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT
);

-- relation_evidence: 关系证据溯源表
CREATE TABLE IF NOT EXISTS relation_evidence (
  evidence_id TEXT PRIMARY KEY,
  relation_id TEXT NOT NULL REFERENCES relations(relation_id),
  import_id TEXT REFERENCES imports(import_id),
  evidence_type TEXT NOT NULL,
  content TEXT NOT NULL,
  file_path TEXT,
  json_path TEXT,
  created_at TEXT NOT NULL
);

-- ============================================
-- Project Database Tables (project.db)
-- ============================================

-- conversion_history: 配方转换历史表
CREATE TABLE IF NOT EXISTS conversion_history (
  conversion_id TEXT PRIMARY KEY,
  source_recipe_id TEXT NOT NULL,
  source_recipe_type TEXT NOT NULL,
  target_recipe_type TEXT NOT NULL,
  converted_json TEXT,
  conversion_method TEXT NOT NULL,
  llm_confidence REAL,
  user_confirmed INTEGER DEFAULT 0,
  user_note TEXT,
  created_at TEXT NOT NULL,
  confirmed_at TEXT
);

-- project_relations: 项目级语义关系覆盖表
CREATE TABLE IF NOT EXISTS project_relations (
  relation_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL,
  override_data TEXT,
  user_note TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (relation_id, project_id)
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- items 表索引
CREATE INDEX IF NOT EXISTS idx_items_mod_id ON items(mod_id);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_display_name ON items(display_name);

-- item_tags 表索引
CREATE INDEX IF NOT EXISTS idx_item_tags_tag_id ON item_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_item_tags_item_id ON item_tags(item_id);

-- recipes 表索引
CREATE INDEX IF NOT EXISTS idx_recipes_mod_id ON recipes(mod_id);
CREATE INDEX IF NOT EXISTS idx_recipes_recipe_type_id ON recipes(recipe_type_id);

-- translations 表索引
CREATE INDEX IF NOT EXISTS idx_translations_lang ON translations(lang);
CREATE INDEX IF NOT EXISTS idx_translations_mod_id ON translations(mod_id);

-- textures 表索引
CREATE INDEX IF NOT EXISTS idx_textures_mod_id ON textures(mod_id);
CREATE INDEX IF NOT EXISTS idx_textures_cache_name ON textures(cache_name);

-- relations 表索引
CREATE INDEX IF NOT EXISTS idx_relations_from_entity ON relations(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_relations_to_entity ON relations(to_entity_id);
CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(relation_type);
CREATE INDEX IF NOT EXISTS idx_relations_layer ON relations(layer);

-- imports 表索引
CREATE INDEX IF NOT EXISTS idx_imports_status ON imports(status);
CREATE INDEX IF NOT EXISTS idx_imports_started_at ON imports(started_at);

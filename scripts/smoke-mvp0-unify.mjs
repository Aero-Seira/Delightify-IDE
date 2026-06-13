import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createClient } from '@libsql/client';
import { exportKubeJs, revertKubeJs } from '../packages/main/dist/services/export/index.js';
import { closeAllConnections } from '../packages/main/dist/services/database/index.js';
import { importModData, validateModDataFile } from '../packages/main/dist/services/mod-data-importer/index.js';
import { dryRunUnify, queryUnifyCandidates } from '../packages/main/dist/services/unify/index.js';

async function run(client, sql, args = []) {
  await client.execute({ sql, args });
}

async function createExporterV1Snapshot(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const client = createClient({ url: `file:${filePath}` });

  try {
    await run(client, 'CREATE TABLE schema_version (version INTEGER PRIMARY KEY)');
    await run(client, 'CREATE TABLE manifest ("key" TEXT PRIMARY KEY, value TEXT NOT NULL)');
    await run(client, 'CREATE TABLE mods (modid TEXT PRIMARY KEY, version TEXT, name TEXT)');
    await run(client, `
      CREATE TABLE items (
        item_id TEXT PRIMARY KEY,
        modid TEXT NOT NULL,
        translation_key TEXT,
        is_block INTEGER NOT NULL DEFAULT 0,
        max_stack INTEGER NOT NULL DEFAULT 64,
        max_damage INTEGER NOT NULL DEFAULT 0,
        is_damageable INTEGER NOT NULL DEFAULT 0,
        is_fire_resistant INTEGER NOT NULL DEFAULT 0,
        rarity TEXT,
        enchant_value INTEGER DEFAULT 0,
        food_nutrition INTEGER,
        food_saturation REAL,
        food_always_eat INTEGER,
        default_components_json TEXT
      )
    `);
    await run(client, 'CREATE TABLE item_tags (tag_id TEXT NOT NULL, item_id TEXT NOT NULL, PRIMARY KEY(tag_id, item_id))');
    await run(client, `
      CREATE TABLE recipes (
        recipe_id TEXT PRIMARY KEY,
        type_id TEXT NOT NULL,
        modid TEXT NOT NULL,
        hash TEXT NOT NULL,
        raw_json TEXT,
        unparsed INTEGER NOT NULL DEFAULT 0,
        "group" TEXT
      )
    `);
    await run(client, `
      CREATE TABLE recipe_inputs (
        recipe_id TEXT NOT NULL,
        slot INTEGER NOT NULL,
        role TEXT NOT NULL,
        kind TEXT NOT NULL,
        ref TEXT,
        count INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY(recipe_id, slot, role, kind, ref)
      )
    `);
    await run(client, `
      CREATE TABLE recipe_outputs (
        recipe_id TEXT NOT NULL,
        slot INTEGER NOT NULL,
        item_id TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 1,
        components_json TEXT,
        is_primary INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY(recipe_id, slot, item_id)
      )
    `);
    await run(client, 'CREATE TABLE translations ("key" TEXT NOT NULL, lang TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY("key", lang))');

    await run(client, 'INSERT INTO schema_version (version) VALUES (1)');

    const manifestRows = [
      ['schema_version', '1'],
      ['loader', 'neoforge'],
      ['mc_version', '1.21.1'],
      ['exported_at_utc', '2026-01-01T00:00:00.000Z'],
      ['mod_count', '3'],
      ['modlist_hash', 'mvp0-smoke'],
    ];
    for (const row of manifestRows) {
      await run(client, 'INSERT INTO manifest ("key", value) VALUES (?, ?)', row);
    }

    const mods = [
      ['minecraft', '1.21.1', 'Minecraft'],
      ['moda', '1.0.0', 'Mod A'],
      ['modb', '1.0.0', 'Mod B'],
    ];
    for (const mod of mods) {
      await run(client, 'INSERT INTO mods (modid, version, name) VALUES (?, ?, ?)', mod);
    }

    const items = [
      ['minecraft:copper_ingot', 'minecraft', 'item.minecraft.copper_ingot'],
      ['moda:copper_ingot', 'moda', 'item.moda.copper_ingot'],
      ['modb:copper_ingot', 'modb', 'item.modb.copper_ingot'],
      ['minecraft:copper_block', 'minecraft', 'block.minecraft.copper_block'],
      ['moda:copper_gear', 'moda', 'item.moda.copper_gear'],
      ['moda:copper_wire', 'moda', 'item.moda.copper_wire'],
      ['modb:copper_plate', 'modb', 'item.modb.copper_plate'],
    ];
    for (const item of items) {
      await run(
        client,
        `INSERT INTO items (
          item_id,
          modid,
          translation_key,
          is_block,
          max_stack,
          max_damage,
          is_damageable,
          is_fire_resistant,
          rarity,
          enchant_value,
          food_nutrition,
          food_saturation,
          food_always_eat,
          default_components_json
        ) VALUES (?, ?, ?, 0, 64, 0, 0, 0, 'common', 0, NULL, NULL, NULL, NULL)`,
        item
      );
    }

    const translations = [
      ['item.minecraft.copper_ingot', 'zh_cn', '铜锭'],
      ['item.moda.copper_ingot', 'zh_cn', '铜锭'],
      ['item.modb.copper_ingot', 'zh_cn', '铜锭'],
      ['block.minecraft.copper_block', 'zh_cn', '铜块'],
      ['item.moda.copper_gear', 'zh_cn', '铜齿轮'],
      ['item.moda.copper_wire', 'zh_cn', '铜线'],
      ['item.modb.copper_plate', 'zh_cn', '铜板'],
    ];
    for (const translation of translations) {
      await run(client, 'INSERT INTO translations ("key", lang, value) VALUES (?, ?, ?)', translation);
    }

    const tags = [
      ['forge:ingots/copper', 'minecraft:copper_ingot'],
      ['forge:ingots/copper', 'moda:copper_ingot'],
      ['forge:ingots/copper', 'modb:copper_ingot'],
    ];
    for (const tag of tags) {
      await run(client, 'INSERT INTO item_tags (tag_id, item_id) VALUES (?, ?)', tag);
    }

    const recipes = [
      ['minecraft:copper_ingot_from_block', 'minecraft:crafting_shapeless', 'minecraft', 'hash-target', '{"type":"minecraft:crafting_shapeless"}', 0, null],
      ['moda:copper_gear', 'minecraft:crafting_shaped', 'moda', 'hash-gear', '{"type":"minecraft:crafting_shaped"}', 0, null],
      ['moda:copper_wire', 'minecraft:crafting_shapeless', 'moda', 'hash-wire', '{"type":"minecraft:crafting_shapeless"}', 0, null],
      ['modb:copper_plate', 'minecraft:smelting', 'modb', 'hash-plate', '{"type":"minecraft:smelting"}', 0, null],
      ['modb:scripted_copper', 'kubejs:custom', 'modb', 'hash-scripted', '{"input":"modb:copper_ingot"}', 1, null],
    ];
    for (const recipe of recipes) {
      await run(client, 'INSERT INTO recipes (recipe_id, type_id, modid, hash, raw_json, unparsed, "group") VALUES (?, ?, ?, ?, ?, ?, ?)', recipe);
    }

    const inputs = [
      ['moda:copper_gear', 1, 'input', 'item', 'moda:copper_ingot', 1],
      ['moda:copper_wire', 0, 'input', 'item', 'moda:copper_ingot', 2],
      ['modb:copper_plate', 0, 'input', 'item', 'modb:copper_ingot', 1],
    ];
    for (const input of inputs) {
      await run(client, 'INSERT INTO recipe_inputs (recipe_id, slot, role, kind, ref, count) VALUES (?, ?, ?, ?, ?, ?)', input);
    }

    const outputs = [
      ['minecraft:copper_ingot_from_block', 0, 'minecraft:copper_ingot', 9, null, 1],
      ['moda:copper_gear', 0, 'moda:copper_gear', 1, null, 1],
      ['moda:copper_wire', 0, 'moda:copper_wire', 2, null, 1],
      ['modb:copper_plate', 0, 'modb:copper_plate', 1, null, 1],
    ];
    for (const output of outputs) {
      await run(client, 'INSERT INTO recipe_outputs (recipe_id, slot, item_id, count, components_json, is_primary) VALUES (?, ?, ?, ?, ?, ?)', output);
    }
  } finally {
    await client.close();
  }
}

async function main() {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'delightify-mvp0-smoke-'));
  const exportPath = path.join(projectPath, 'delightify', 'export.sqlite');

  try {
    await createExporterV1Snapshot(exportPath);

    const validation = await validateModDataFile(exportPath);
    assert.equal(validation.valid, true);
    assert.equal(validation.sourceKind, 'exporter_v1');
    assert.equal(validation.capabilities?.mvp0Unify, true);

    const importResult = await importModData({ projectPath });
    assert.equal(importResult.success, true);
    assert.equal(importResult.sourceKind, 'exporter_v1');
    assert.equal(importResult.capabilities?.mvp0Unify, true);
    assert.equal(importResult.stats?.itemCount, 7);
    assert.equal(importResult.stats?.recipeCount, 5);

    const query = await queryUnifyCandidates(projectPath, {
      query: '铜锭',
      lang: 'zh_cn',
    });
    const itemIds = query.candidates.map(candidate => candidate.item.itemId).sort();
    assert.deepEqual(itemIds, [
      'minecraft:copper_ingot',
      'moda:copper_ingot',
      'modb:copper_ingot',
    ]);

    const dryRun = await dryRunUnify(projectPath, {
      query: '铜锭',
      lang: 'zh_cn',
      targetItemId: 'minecraft:copper_ingot',
    });
    assert.equal(dryRun.targetItemId, 'minecraft:copper_ingot');
    assert.equal(dryRun.autoDecisionCount, 1);
    assert.equal(dryRun.deferredDecisionCount, 1);
    assert.equal(dryRun.changeSet.length, 2);
    assert.equal(dryRun.diff.some(operation => operation.kind === 'raw_unparsed_reference'), true);

    const exportResult = await exportKubeJs(projectPath, {
      changeSet: dryRun.changeSet,
    });
    assert.equal(exportResult.operationCount, 2);
    assert.equal(exportResult.filePath, path.join(projectPath, 'kubejs', 'server_scripts', 'zzz_delightify_generated.js'));
    assert.match(exportResult.generatedCode, /@delightify-generated/);
    assert.match(exportResult.generatedCode, /event\.replaceInput\(\{ id: "moda:copper_gear" \}, "moda:copper_ingot", "minecraft:copper_ingot"\)/);
    assert.match(exportResult.generatedCode, /event\.replaceInput\(\{ id: "moda:copper_wire" \}, "moda:copper_ingot", "minecraft:copper_ingot"\)/);

    const secondExport = await exportKubeJs(projectPath, {
      changeSet: dryRun.changeSet,
    });
    assert.equal(secondExport.operationCount, 2);

    const revertResult = await revertKubeJs(projectPath);
    assert.deepEqual(revertResult, {
      filePath: exportResult.filePath,
      deleted: true,
    });
    const secondRevertResult = await revertKubeJs(projectPath);
    assert.deepEqual(secondRevertResult, {
      filePath: exportResult.filePath,
      deleted: false,
    });

    console.log('MVP-0 unify smoke passed');
  } finally {
    await closeAllConnections();
    await fs.rm(projectPath, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

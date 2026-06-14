import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createClient } from '@libsql/client';
import { planHarmonize } from '../packages/main/dist/services/engine/index.js';

async function run(client, sql, args = []) {
  await client.execute({ sql, args });
}

async function createFixture(dbPath) {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  const client = createClient({ url: `file:${dbPath}` });

  await run(client, `
    CREATE TABLE items (
      item_id TEXT PRIMARY KEY,
      modid TEXT NOT NULL,
      is_block INTEGER NOT NULL DEFAULT 0
    )
  `);
  await run(client, 'CREATE TABLE item_tags (tag_id TEXT NOT NULL, item_id TEXT NOT NULL, PRIMARY KEY(tag_id, item_id))');
  await run(client, `
    CREATE TABLE recipes (
      recipe_id TEXT PRIMARY KEY,
      type_id TEXT NOT NULL,
      modid TEXT NOT NULL,
      raw_json TEXT,
      unparsed INTEGER NOT NULL DEFAULT 0
    )
  `);
  await run(client, `
    CREATE TABLE recipe_inputs (
      recipe_id TEXT NOT NULL,
      slot INTEGER NOT NULL,
      role TEXT NOT NULL,
      kind TEXT NOT NULL,
      ref TEXT,
      count INTEGER NOT NULL DEFAULT 1
    )
  `);
  await run(client, `
    CREATE TABLE recipe_outputs (
      recipe_id TEXT NOT NULL,
      slot INTEGER NOT NULL,
      item_id TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 1,
      components_json TEXT
    )
  `);

  const items = [
    ['moda:raw_steel_ingot', 'moda', 0],
    ['moda:steel_ingot', 'moda', 0],
    ['moda:machine_frame', 'moda', 0],
  ];
  for (const item of items) {
    await run(client, 'INSERT INTO items (item_id, modid, is_block) VALUES (?, ?, ?)', item);
  }

  await run(client, 'INSERT INTO recipes (recipe_id, type_id, modid, raw_json, unparsed) VALUES (?, ?, ?, ?, ?)', [
    'moda:machine_frame',
    'minecraft:crafting_shaped',
    'moda',
    '{"type":"minecraft:crafting_shaped"}',
    0,
  ]);
  await run(client, 'INSERT INTO recipe_inputs (recipe_id, slot, role, kind, ref, count) VALUES (?, ?, ?, ?, ?, ?)', [
    'moda:machine_frame',
    0,
    'input',
    'item',
    'moda:raw_steel_ingot',
    1,
  ]);
  await run(client, 'INSERT INTO recipe_outputs (recipe_id, slot, item_id, count, components_json) VALUES (?, ?, ?, ?, ?)', [
    'moda:machine_frame',
    0,
    'moda:machine_frame',
    1,
    null,
  ]);

  return client;
}

async function main() {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'delightify-m2-harmonize-'));
  const dbPath = path.join(projectPath, '.delightify', 'project.db');
  const client = await createFixture(dbPath);

  try {
    const dryRun = await planHarmonize(client, {
      outlierReplaces: [{
        from: { kind: 'item', ref: 'moda:raw_steel_ingot' },
        to: { kind: 'item', ref: 'moda:steel_ingot' },
        scope: 'input',
      }],
      recipeTypeChanges: [{
        recipeId: 'moda:machine_frame',
        fromType: 'minecraft:crafting_shaped',
        toType: 'create:mechanical_crafting',
      }],
    });

    assert.equal(dryRun.operations.length, 1);
    assert.equal(dryRun.operations[0].kind, 'replace_recipe_input_item');
    assert.equal(dryRun.operations[0].recipeId, 'moda:machine_frame');
    assert.deepEqual(dryRun.operations[0].before, {
      kind: 'item',
      ref: 'moda:raw_steel_ingot',
      count: 1,
    });
    assert.deepEqual(dryRun.operations[0].after, {
      kind: 'item',
      ref: 'moda:steel_ingot',
      count: 1,
    });
    assert.equal(dryRun.operations[0].includedInChangeSet, true);
    assert.equal(dryRun.blast.replace.length, 1);
    assert.equal(dryRun.blast.replace[0].risk.severity, 'low');

    assert.equal(dryRun.deferredSuggestions.length, 1);
    assert.equal(dryRun.deferredSuggestions[0].kind, 'change_recipe_type');
    assert.deepEqual(dryRun.deferredSuggestions[0].target, {
      recipeId: 'moda:machine_frame',
      fromType: 'minecraft:crafting_shaped',
      toType: 'create:mechanical_crafting',
    });
    assert.equal(dryRun.operations.some(operation => operation.kind === 'change_recipe_type'), false);

    console.log('M2 harmonize smoke passed');
  } finally {
    await client.close();
    await fs.rm(projectPath, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createClient } from '@libsql/client';
import { planConstrainInputs } from '../packages/main/dist/services/engine/index.js';

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
    ['culinary:animal_fat', 'culinary', 0],
    ['culinary:olive_oil', 'culinary', 0],
    ['culinary:seed_oil', 'culinary', 0],
    ['culinary:tallow', 'culinary', 0],
    ['culinary:soap', 'culinary', 0],
  ];
  for (const item of items) {
    await run(client, 'INSERT INTO items (item_id, modid, is_block) VALUES (?, ?, ?)', item);
  }

  for (const itemId of ['culinary:animal_fat', 'culinary:olive_oil', 'culinary:seed_oil']) {
    await run(client, 'INSERT INTO item_tags (tag_id, item_id) VALUES (?, ?)', ['forge:oils', itemId]);
  }

  await run(client, 'INSERT INTO recipes (recipe_id, type_id, modid, raw_json, unparsed) VALUES (?, ?, ?, ?, ?)', [
    'culinary:soap',
    'minecraft:crafting_shapeless',
    'culinary',
    '{"type":"minecraft:crafting_shapeless"}',
    0,
  ]);
  await run(client, 'INSERT INTO recipe_inputs (recipe_id, slot, role, kind, ref, count) VALUES (?, ?, ?, ?, ?, ?)', [
    'culinary:soap',
    0,
    'input',
    'tag',
    'forge:oils',
    1,
  ]);
  await run(client, 'INSERT INTO recipe_outputs (recipe_id, slot, item_id, count, components_json) VALUES (?, ?, ?, ?, ?)', [
    'culinary:soap',
    0,
    'culinary:soap',
    1,
    null,
  ]);

  return client;
}

async function main() {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'delightify-m2-constrain-'));
  const dbPath = path.join(projectPath, '.delightify', 'project.db');
  const client = await createFixture(dbPath);

  try {
    const dryRun = await planConstrainInputs(client, {
      slotTag: 'forge:oils',
      allow: ['culinary:olive_oil'],
      deny: ['culinary:animal_fat'],
      bridgeSuggestions: [{ from: 'culinary:animal_fat', to: 'culinary:tallow' }],
    });

    assert.equal(dryRun.operations.length, 3);
    const replaceOps = dryRun.operations.filter(operation => operation.kind === 'replace_recipe_input_item');
    const retagRemoveOps = dryRun.operations.filter(operation => operation.kind === 'retag_remove');
    assert.equal(replaceOps.length, 1);
    assert.equal(retagRemoveOps.length, 2);
    assert.equal(replaceOps[0].recipeId, 'culinary:soap');
    assert.deepEqual(replaceOps[0].before, { kind: 'tag', ref: 'forge:oils', count: 1 });
    assert.deepEqual(replaceOps[0].after, { kind: 'item', ref: 'culinary:olive_oil', count: 1 });
    assert.equal(dryRun.operations.every(operation => operation.includedInChangeSet === false), true);
    assert.ok(replaceOps[0].reason?.includes('tag 变更'));
    assert.deepEqual(retagRemoveOps.map(operation => operation.before.item).sort(), [
      'culinary:animal_fat',
      'culinary:seed_oil',
    ]);

    assert.equal(dryRun.deferredSuggestions.length, 1);
    assert.equal(dryRun.deferredSuggestions[0].kind, 'add_bridge_recipe');
    assert.deepEqual(dryRun.deferredSuggestions[0].target, {
      slotTag: 'forge:oils',
      from: 'culinary:animal_fat',
      to: 'culinary:tallow',
    });

    const confirmed = await planConstrainInputs(client, {
      slotTag: 'forge:oils',
      allow: ['culinary:olive_oil'],
      deny: ['culinary:animal_fat'],
      bridgeSuggestions: [{ from: 'culinary:animal_fat', to: 'culinary:tallow' }],
      confirmedOperationIds: dryRun.operations.map(operation => operation.operationId),
    });
    assert.equal(confirmed.operations.length, 3);
    assert.equal(confirmed.operations.every(operation => operation.includedInChangeSet === true), true);
    assert.equal(confirmed.deferredSuggestions[0].kind, 'add_bridge_recipe');

    console.log('M2 constrain smoke passed');
  } finally {
    await client.close();
    await fs.rm(projectPath, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

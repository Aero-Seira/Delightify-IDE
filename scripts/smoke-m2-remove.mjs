import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createClient } from '@libsql/client';
import { makeChangeSet, planRemoveRecipe } from '../packages/main/dist/services/engine/index.js';
import { exportKubeJs, revertKubeJs } from '../packages/main/dist/services/export/index.js';

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
    ['moda:orphan_gem', 'moda', 0],
    ['moda:tin_ingot', 'moda', 0],
    ['moda:tin_plate', 'moda', 0],
  ];
  for (const item of items) {
    await run(client, 'INSERT INTO items (item_id, modid, is_block) VALUES (?, ?, ?)', item);
  }

  const recipes = [
    ['moda:orphan_gem', 'minecraft:crafting_shapeless', 'moda', '{"type":"minecraft:crafting_shapeless"}', 0],
    ['moda:tin_ingot', 'minecraft:smelting', 'moda', '{"type":"minecraft:smelting"}', 0],
    ['moda:tin_plate', 'minecraft:crafting_shaped', 'moda', '{"type":"minecraft:crafting_shaped"}', 0],
  ];
  for (const recipe of recipes) {
    await run(client, 'INSERT INTO recipes (recipe_id, type_id, modid, raw_json, unparsed) VALUES (?, ?, ?, ?, ?)', recipe);
  }

  await run(client, 'INSERT INTO recipe_inputs (recipe_id, slot, role, kind, ref, count) VALUES (?, ?, ?, ?, ?, ?)', [
    'moda:tin_plate',
    0,
    'input',
    'item',
    'moda:tin_ingot',
    1,
  ]);

  const outputs = [
    ['moda:orphan_gem', 0, 'moda:orphan_gem', 1, null],
    ['moda:tin_ingot', 0, 'moda:tin_ingot', 1, null],
    ['moda:tin_plate', 0, 'moda:tin_plate', 1, null],
  ];
  for (const output of outputs) {
    await run(client, 'INSERT INTO recipe_outputs (recipe_id, slot, item_id, count, components_json) VALUES (?, ?, ?, ?, ?)', output);
  }

  return client;
}

async function main() {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'delightify-m2-remove-'));
  const dbPath = path.join(projectPath, '.delightify', 'project.db');
  const client = await createFixture(dbPath);

  try {
    const safeDryRun = await planRemoveRecipe(client, {
      recipeIds: ['moda:orphan_gem'],
    });
    assert.equal(safeDryRun.operations.length, 1);
    assert.equal(safeDryRun.operations[0].includedInChangeSet, false);
    assert.equal(makeChangeSet(safeDryRun.operations).length, 0);

    const safeConfirmed = await planRemoveRecipe(client, {
      recipeIds: ['moda:orphan_gem'],
      confirmedOperationIds: [safeDryRun.operations[0].operationId],
    });
    const changeSet = makeChangeSet(safeConfirmed.operations);
    assert.equal(changeSet.length, 1);

    const exportResult = await exportKubeJs(projectPath, { changeSet });
    assert.match(exportResult.generatedCode, /ServerEvents\.recipes\(event => \{/);
    assert.match(exportResult.generatedCode, /event\.remove\(\{ id: "moda:orphan_gem" \}\)/);
    assert.doesNotMatch(exportResult.generatedCode, /ServerEvents\.tags/);

    const downstreamDryRun = await planRemoveRecipe(client, {
      recipeIds: ['moda:tin_ingot'],
      confirmedOperationIds: ['remove_recipe:moda:tin_ingot'],
    });
    assert.equal(downstreamDryRun.operations.length, 1);
    assert.equal(downstreamDryRun.operations[0].includedInChangeSet, false);
    assert.ok(downstreamDryRun.operations[0].reason?.includes('产物被其它配方作为输入引用'));
    assert.deepEqual(
      downstreamDryRun.downstream[0].outputs[0].inputReferences.map(reference => reference.recipeId),
      ['moda:tin_plate']
    );

    const revertResult = await revertKubeJs(projectPath);
    assert.deepEqual(revertResult, {
      filePath: path.join(projectPath, 'kubejs', 'server_scripts', 'zzz_delightify_generated.js'),
      deleted: true,
    });
    const secondRevertResult = await revertKubeJs(projectPath);
    assert.deepEqual(secondRevertResult, {
      filePath: path.join(projectPath, 'kubejs', 'server_scripts', 'zzz_delightify_generated.js'),
      deleted: false,
    });

    console.log('M2 remove_recipe smoke passed');
  } finally {
    await client.close();
    await fs.rm(projectPath, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createClient } from '@libsql/client';
import { makeChangeSet, planScale } from '../packages/main/dist/services/engine/index.js';

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
    ['minecraft:raw_copper', 'minecraft', 0],
    ['minecraft:copper_ingot', 'minecraft', 0],
    ['moda:pressed_coin', 'moda', 0],
    ['moda:coin_blank', 'moda', 0],
    ['moda:dough', 'moda', 0],
    ['moda:baked_dough', 'moda', 0],
  ];
  for (const item of items) {
    await run(client, 'INSERT INTO items (item_id, modid, is_block) VALUES (?, ?, ?)', item);
  }

  const recipes = [
    [
      'minecraft:copper_ingot_from_smelting',
      'minecraft:smelting',
      'minecraft',
      '{"type":"minecraft:smelting","cookingtime":200}',
      0,
    ],
    [
      'moda:coin_press',
      'minecraft:crafting_shapeless',
      'moda',
      '{"type":"minecraft:crafting_shapeless"}',
      0,
    ],
    [
      'moda:baked_dough',
      'minecraft:smelting',
      'moda',
      '{"type":"minecraft:smelting","cookingtime":100}',
      0,
    ],
  ];
  for (const recipe of recipes) {
    await run(client, 'INSERT INTO recipes (recipe_id, type_id, modid, raw_json, unparsed) VALUES (?, ?, ?, ?, ?)', recipe);
  }

  const inputs = [
    ['minecraft:copper_ingot_from_smelting', 0, 'input', 'item', 'minecraft:raw_copper', 1],
    ['moda:coin_press', 0, 'input', 'item', 'moda:pressed_coin', 1],
    ['moda:baked_dough', 0, 'input', 'item', 'moda:dough', 1],
  ];
  for (const input of inputs) {
    await run(client, 'INSERT INTO recipe_inputs (recipe_id, slot, role, kind, ref, count) VALUES (?, ?, ?, ?, ?, ?)', input);
  }

  const outputs = [
    ['minecraft:copper_ingot_from_smelting', 0, 'minecraft:copper_ingot', 3, null],
    ['moda:coin_press', 0, 'moda:pressed_coin', 1, null],
    ['moda:baked_dough', 0, 'moda:baked_dough', 1, null],
  ];
  for (const output of outputs) {
    await run(client, 'INSERT INTO recipe_outputs (recipe_id, slot, item_id, count, components_json) VALUES (?, ?, ?, ?, ?)', output);
  }

  await run(client, 'INSERT INTO recipes (recipe_id, type_id, modid, raw_json, unparsed) VALUES (?, ?, ?, ?, ?)', [
    'moda:empty_recipe',
    'kubejs:custom',
    'moda',
    '{"type":"kubejs:custom"}',
    0,
  ]);

  return client;
}

function classificationByRecipe(result, recipeId) {
  return result.classifications.find(classification => classification.recipeId === recipeId);
}

async function main() {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'delightify-m2-scale-'));
  const dbPath = path.join(projectPath, '.delightify', 'project.db');
  const client = await createFixture(dbPath);

  try {
    const outputScale = await planScale(client, {
      recipeIds: ['minecraft:copper_ingot_from_smelting'],
      field: 'output_count',
      factor: 2,
      round: 'round',
    });

    assert.equal(outputScale.operations.length, 1);
    assert.equal(outputScale.operations[0].kind, 'scale_recipe_field');
    assert.equal(outputScale.operations[0].includedInChangeSet, false);
    assert.equal(outputScale.operations[0].before.value, 3);
    assert.equal(outputScale.operations[0].after.value, 6);
    assert.equal(makeChangeSet(outputScale.operations).length, 0);
    assert.equal(outputScale.classifications[0].decision, 'emission_pending');
    assert.equal(outputScale.classifications[0].baseline, 3);
    assert.equal(outputScale.classifications[0].computed, 6);
    assert.ok(outputScale.blast.some(blast => blast.target.ref === 'minecraft:copper_ingot'));

    const roundedScale = await planScale(client, {
      recipeIds: ['minecraft:copper_ingot_from_smelting'],
      field: 'output_count',
      factor: 1.5,
      round: 'floor',
    });
    assert.equal(roundedScale.classifications[0].computed, 4);

    const conservation = await planScale(client, {
      recipeIds: ['moda:coin_press'],
      field: 'output_count',
      factor: 4,
    });
    assert.equal(conservation.operations.length, 1);
    assert.equal(conservation.operations[0].includedInChangeSet, false);
    assert.equal(conservation.classifications[0].decision, 'conservation_skip');
    assert.equal(conservation.classifications[0].baseline, 1);
    assert.equal(conservation.classifications[0].computed, 1);
    assert.equal(conservation.operations[0].after.value, 1);

    const typeDeferred = await planScale(client, {
      recipeIds: ['moda:baked_dough'],
      field: 'time',
      delta: 20,
    });
    assert.equal(typeDeferred.operations.length, 1);
    assert.equal(typeDeferred.operations[0].includedInChangeSet, false);
    assert.equal(typeDeferred.operations[0].after, undefined);
    assert.equal(typeDeferred.classifications[0].decision, 'type_defer');
    assert.ok(typeDeferred.classifications[0].reason.includes('raw_json'));

    const noBaseline = await planScale(client, {
      recipeIds: ['moda:empty_recipe', 'moda:missing_recipe'],
      field: 'output_count',
      factor: 2,
    });
    assert.equal(noBaseline.operations.length, 2);
    assert.equal(classificationByRecipe(noBaseline, 'moda:empty_recipe').decision, 'no_baseline');
    assert.equal(classificationByRecipe(noBaseline, 'moda:missing_recipe').decision, 'no_baseline');
    assert.equal(noBaseline.operations.every(operation => operation.includedInChangeSet === false), true);
    assert.equal(makeChangeSet(noBaseline.operations).length, 0);

    const firstRun = await planScale(client, {
      recipeIds: ['minecraft:copper_ingot_from_smelting'],
      field: 'output_count',
      factor: 2,
      round: 'round',
    });
    const secondRun = await planScale(client, {
      recipeIds: ['minecraft:copper_ingot_from_smelting'],
      field: 'output_count',
      factor: 2,
      round: 'round',
    });
    assert.deepEqual(
      firstRun.classifications.map(classification => classification.computed),
      secondRun.classifications.map(classification => classification.computed)
    );

    const combined = [
      ...outputScale.operations,
      ...conservation.operations,
      ...typeDeferred.operations,
      ...noBaseline.operations,
    ];
    assert.equal(combined.every(operation => operation.includedInChangeSet === false), true);
    assert.equal(makeChangeSet(combined).length, 0);

    console.log('M2 scale smoke passed');
  } finally {
    await client.close();
    await fs.rm(projectPath, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

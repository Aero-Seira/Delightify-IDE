import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createClient } from '@libsql/client';
import { classifyRisk, computeBlastRadius } from '../packages/main/dist/services/engine/index.js';

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
    ['minecraft:copper_ingot', 'minecraft', 0],
    ['moda:copper_ingot', 'moda', 0],
    ['minecraft:copper_block', 'minecraft', 1],
  ];
  for (const item of items) {
    await run(client, 'INSERT INTO items (item_id, modid, is_block) VALUES (?, ?, ?)', item);
  }

  const tags = [
    ['forge:ingots/copper', 'minecraft:copper_ingot'],
    ['forge:ingots/copper', 'moda:copper_ingot'],
  ];
  for (const tag of tags) {
    await run(client, 'INSERT INTO item_tags (tag_id, item_id) VALUES (?, ?)', tag);
  }

  const recipes = [
    ['moda:copper_gear', 'minecraft:crafting_shaped', 'moda', '{"type":"minecraft:crafting_shaped"}', 0],
    ['moda:copper_wire', 'minecraft:crafting_shapeless', 'moda', '{"type":"minecraft:crafting_shapeless"}', 0],
    ['minecraft:copper_from_block', 'minecraft:crafting_shapeless', 'minecraft', '{"type":"minecraft:crafting_shapeless"}', 0],
    ['modb:machine_frame', 'minecraft:crafting_shaped', 'modb', '{"type":"minecraft:crafting_shaped"}', 0],
    ['modb:scripted_copper', 'kubejs:custom', 'modb', '{"input":"moda:copper_ingot"}', 1],
  ];
  for (const recipe of recipes) {
    await run(client, 'INSERT INTO recipes (recipe_id, type_id, modid, raw_json, unparsed) VALUES (?, ?, ?, ?, ?)', recipe);
  }

  const inputs = [
    ['moda:copper_gear', 1, 'input', 'item', 'moda:copper_ingot', 1],
    ['moda:copper_wire', 0, 'input', 'item', 'moda:copper_ingot', 2],
    ['modb:machine_frame', 4, 'input', 'tag', 'forge:ingots/copper', 1],
  ];
  for (const input of inputs) {
    await run(client, 'INSERT INTO recipe_inputs (recipe_id, slot, role, kind, ref, count) VALUES (?, ?, ?, ?, ?, ?)', input);
  }

  const outputs = [
    ['minecraft:copper_from_block', 0, 'minecraft:copper_ingot', 9, null],
  ];
  for (const output of outputs) {
    await run(client, 'INSERT INTO recipe_outputs (recipe_id, slot, item_id, count, components_json) VALUES (?, ?, ?, ?, ?)', output);
  }

  return client;
}

async function main() {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'delightify-m2-blast-'));
  const dbPath = path.join(projectPath, '.delightify', 'project.db');
  const client = await createFixture(dbPath);

  try {
    const copperBlast = await computeBlastRadius(client, { kind: 'item', ref: 'moda:copper_ingot' });
    assert.deepEqual(copperBlast.recipeRefsAsInput.map(ref => ref.recipeId), [
      'moda:copper_gear',
      'moda:copper_wire',
    ]);
    assert.deepEqual(copperBlast.recipeRefsAsOutput.map(ref => ref.recipeId), []);
    assert.deepEqual(copperBlast.tagConnectedRecipes.map(ref => ref.recipeId), ['modb:machine_frame']);
    assert.deepEqual(copperBlast.relatedUnparsed.map(ref => ref.recipeId), ['modb:scripted_copper']);
    assert.equal(copperBlast.isBlock, false);
    assert.equal(copperBlast.crossMod, true);

    const copperRisk = classifyRisk(copperBlast);
    assert.equal(copperRisk.mustDefer, true);
    assert.equal(copperRisk.severity, 'high');
    assert.equal(copperRisk.reasons.some(reason => reason.includes('未结构化')), true);

    const blockBlast = await computeBlastRadius(client, { kind: 'item', ref: 'minecraft:copper_block' });
    assert.equal(blockBlast.isBlock, true);
    const blockRisk = classifyRisk(blockBlast);
    assert.equal(blockRisk.mustDefer, true);
    assert.equal(blockRisk.severity, 'high');
    assert.equal(blockRisk.reasons.some(reason => reason.includes('方块')), true);

    const tagBlast = await computeBlastRadius(client, { kind: 'tag', ref: 'forge:ingots/copper' });
    assert.deepEqual(tagBlast.recipeRefsAsInput.map(ref => ref.recipeId), ['modb:machine_frame']);
    assert.equal(classifyRisk(tagBlast).mustDefer, true);

    console.log('M2 blast-radius smoke passed');
  } finally {
    await client.close();
    await fs.rm(projectPath, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

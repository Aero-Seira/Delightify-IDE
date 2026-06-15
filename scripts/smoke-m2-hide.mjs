import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createClient } from '@libsql/client';
import { makeChangeSet, planHide } from '../packages/main/dist/services/engine/index.js';

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
    ['moda:hidden_dust', 'moda', 0],
    ['moda:hidden_plate', 'moda', 0],
    ['minecraft:iron_ingot', 'minecraft', 0],
  ];
  for (const item of items) {
    await run(client, 'INSERT INTO items (item_id, modid, is_block) VALUES (?, ?, ?)', item);
  }

  await run(client, 'INSERT INTO recipes (recipe_id, type_id, modid, raw_json, unparsed) VALUES (?, ?, ?, ?, ?)', [
    'moda:hidden_plate',
    'minecraft:crafting_shapeless',
    'moda',
    '{"type":"minecraft:crafting_shapeless"}',
    0,
  ]);
  await run(client, 'INSERT INTO recipe_inputs (recipe_id, slot, role, kind, ref, count) VALUES (?, ?, ?, ?, ?, ?)', [
    'moda:hidden_plate',
    0,
    'input',
    'item',
    'moda:hidden_dust',
    2,
  ]);
  await run(client, 'INSERT INTO recipe_outputs (recipe_id, slot, item_id, count, components_json) VALUES (?, ?, ?, ?, ?)', [
    'moda:hidden_plate',
    0,
    'moda:hidden_plate',
    1,
    null,
  ]);

  return client;
}

async function main() {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'delightify-m2-hide-'));
  const dbPath = path.join(projectPath, '.delightify', 'project.db');
  const client = await createFixture(dbPath);

  try {
    const dryRun = await planHide(client, {
      items: ['moda:hidden_dust'],
    });

    assert.equal(dryRun.operations.length, 1);
    assert.equal(dryRun.operations[0].kind, 'hide_in_jei');
    assert.equal(dryRun.operations[0].before.item, 'moda:hidden_dust');
    assert.equal(dryRun.operations[0].includedInChangeSet, false);
    assert.ok(dryRun.operations[0].reason.includes('JEI'));
    assert.equal(makeChangeSet(dryRun.operations).length, 0);

    assert.equal(dryRun.blast.length, 1);
    assert.equal(dryRun.blast[0].target.ref, 'moda:hidden_dust');
    assert.ok(dryRun.blast[0].recipeRefsAsInput.some(reference => reference.recipeId === 'moda:hidden_plate'));
    assert.equal(dryRun.risk.mustDefer, false);

    console.log('M2 hide smoke passed');
  } finally {
    await client.close();
    await fs.rm(projectPath, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

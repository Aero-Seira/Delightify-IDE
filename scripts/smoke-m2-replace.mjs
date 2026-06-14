import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createClient } from '@libsql/client';
import { makeChangeSet, planReplace } from '../packages/main/dist/services/engine/index.js';
import { emitChangeSet, exportKubeJs, revertKubeJs } from '../packages/main/dist/services/export/index.js';

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
    ['moda:zinc_dust', 'moda', 0],
    ['moda:refined_zinc_dust', 'moda', 0],
    ['moda:zinc_plate', 'moda', 0],
    ['modb:lead_dust', 'modb', 0],
    ['moda:lead_plate', 'moda', 0],
  ];
  for (const item of items) {
    await run(client, 'INSERT INTO items (item_id, modid, is_block) VALUES (?, ?, ?)', item);
  }

  const recipes = [
    ['moda:zinc_plate', 'minecraft:crafting_shaped', 'moda', '{"type":"minecraft:crafting_shaped"}', 0],
    ['moda:zinc_dust_from_raw', 'minecraft:smelting', 'moda', '{"type":"minecraft:smelting"}', 0],
    ['moda:lead_plate', 'minecraft:crafting_shaped', 'moda', '{"type":"minecraft:crafting_shaped"}', 0],
    ['moda:scripted_lead', 'kubejs:custom', 'moda', '{"input":"modb:lead_dust"}', 1],
  ];
  for (const recipe of recipes) {
    await run(client, 'INSERT INTO recipes (recipe_id, type_id, modid, raw_json, unparsed) VALUES (?, ?, ?, ?, ?)', recipe);
  }

  const inputs = [
    ['moda:zinc_plate', 0, 'input', 'item', 'moda:zinc_dust', 1],
    ['moda:lead_plate', 0, 'input', 'item', 'modb:lead_dust', 1],
  ];
  for (const input of inputs) {
    await run(client, 'INSERT INTO recipe_inputs (recipe_id, slot, role, kind, ref, count) VALUES (?, ?, ?, ?, ?, ?)', input);
  }

  const outputs = [
    ['moda:zinc_plate', 0, 'moda:zinc_plate', 1, null],
    ['moda:zinc_dust_from_raw', 0, 'moda:zinc_dust', 1, null],
    ['moda:lead_plate', 0, 'moda:lead_plate', 1, null],
  ];
  for (const output of outputs) {
    await run(client, 'INSERT INTO recipe_outputs (recipe_id, slot, item_id, count, components_json) VALUES (?, ?, ?, ?, ?)', output);
  }

  return client;
}

async function main() {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'delightify-m2-replace-'));
  const dbPath = path.join(projectPath, '.delightify', 'project.db');
  const client = await createFixture(dbPath);

  try {
    const inputPlan = await planReplace(client, {
      from: { kind: 'item', ref: 'moda:zinc_dust' },
      to: { kind: 'item', ref: 'moda:refined_zinc_dust' },
      scope: 'input',
    });
    assert.equal(inputPlan.operations.length, 1);
    assert.equal(inputPlan.operations[0].kind, 'replace_recipe_input_item');
    assert.equal(inputPlan.operations[0].includedInChangeSet, false);
    assert.ok(inputPlan.operations[0].reason?.includes('产物'));

    const filteredInputPlan = await planReplace(client, {
      from: { kind: 'item', ref: 'moda:zinc_dust' },
      to: { kind: 'item', ref: 'moda:refined_zinc_dust' },
      scope: 'input',
      filter: { typeId: 'minecraft:crafting_shaped' },
    });
    assert.equal(filteredInputPlan.operations.length, 1);

    const lowRiskClient = await createClient({ url: 'file::memory:' });
    try {
      await run(lowRiskClient, `
        CREATE TABLE items (
          item_id TEXT PRIMARY KEY,
          modid TEXT NOT NULL,
          is_block INTEGER NOT NULL DEFAULT 0
        )
      `);
      await run(lowRiskClient, 'CREATE TABLE item_tags (tag_id TEXT NOT NULL, item_id TEXT NOT NULL, PRIMARY KEY(tag_id, item_id))');
      await run(lowRiskClient, 'CREATE TABLE recipes (recipe_id TEXT PRIMARY KEY, type_id TEXT NOT NULL, modid TEXT NOT NULL, raw_json TEXT, unparsed INTEGER NOT NULL DEFAULT 0)');
      await run(lowRiskClient, 'CREATE TABLE recipe_inputs (recipe_id TEXT NOT NULL, slot INTEGER NOT NULL, role TEXT NOT NULL, kind TEXT NOT NULL, ref TEXT, count INTEGER NOT NULL DEFAULT 1)');
      await run(lowRiskClient, 'CREATE TABLE recipe_outputs (recipe_id TEXT NOT NULL, slot INTEGER NOT NULL, item_id TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 1, components_json TEXT)');
      await run(lowRiskClient, 'INSERT INTO items (item_id, modid, is_block) VALUES (?, ?, ?)', ['moda:zinc_dust', 'moda', 0]);
      await run(lowRiskClient, 'INSERT INTO items (item_id, modid, is_block) VALUES (?, ?, ?)', ['moda:refined_zinc_dust', 'moda', 0]);
      await run(lowRiskClient, 'INSERT INTO items (item_id, modid, is_block) VALUES (?, ?, ?)', ['moda:zinc_plate', 'moda', 0]);
      await run(lowRiskClient, 'INSERT INTO recipes (recipe_id, type_id, modid, raw_json, unparsed) VALUES (?, ?, ?, ?, ?)', [
        'moda:zinc_plate',
        'minecraft:crafting_shaped',
        'moda',
        '{"type":"minecraft:crafting_shaped"}',
        0,
      ]);
      await run(lowRiskClient, 'INSERT INTO recipe_inputs (recipe_id, slot, role, kind, ref, count) VALUES (?, ?, ?, ?, ?, ?)', [
        'moda:zinc_plate',
        0,
        'input',
        'item',
        'moda:zinc_dust',
        1,
      ]);
      await run(lowRiskClient, 'INSERT INTO recipe_outputs (recipe_id, slot, item_id, count, components_json) VALUES (?, ?, ?, ?, ?)', [
        'moda:zinc_plate',
        0,
        'moda:zinc_plate',
        1,
        null,
      ]);

      const lowRiskPlan = await planReplace(lowRiskClient, {
        from: { kind: 'item', ref: 'moda:zinc_dust' },
        to: { kind: 'item', ref: 'moda:refined_zinc_dust' },
        scope: 'input',
      });
      assert.equal(lowRiskPlan.operations.length, 1);
      assert.equal(lowRiskPlan.operations[0].includedInChangeSet, true);

      const exportResult = await exportKubeJs(projectPath, {
        changeSet: makeChangeSet(lowRiskPlan.operations),
      });
      assert.match(exportResult.generatedCode, /event\.replaceInput\(\{ id: "moda:zinc_plate" \}, "moda:zinc_dust", "moda:refined_zinc_dust"\)/);
    } finally {
      await lowRiskClient.close();
    }

    const outputPlan = await planReplace(client, {
      from: { kind: 'item', ref: 'moda:zinc_dust' },
      to: { kind: 'item', ref: 'moda:refined_zinc_dust' },
      scope: 'output',
    });
    assert.equal(outputPlan.operations.length, 1);
    assert.equal(outputPlan.operations[0].kind, 'replace_recipe_output_item');
    assert.equal(outputPlan.operations[0].includedInChangeSet, false);
    assert.equal(outputPlan.operations[0].reason, '输出替换需要人工审阅，未验证 replaceOutput 语义');
    assert.equal(emitChangeSet(makeChangeSet(outputPlan.operations)).length, 0);

    const riskyInputPlan = await planReplace(client, {
      from: { kind: 'item', ref: 'modb:lead_dust' },
      to: { kind: 'item', ref: 'moda:refined_zinc_dust' },
      scope: 'input',
    });
    assert.equal(riskyInputPlan.operations.length, 1);
    assert.equal(riskyInputPlan.operations[0].includedInChangeSet, false);
    assert.ok(riskyInputPlan.operations[0].reason?.includes('未结构化'));

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

    console.log('M2 replace smoke passed');
  } finally {
    await client.close();
    await fs.rm(projectPath, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

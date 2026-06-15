import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createClient } from '@libsql/client';
import { closeProjectDbClient } from '../packages/main/dist/services/database/client.js';
import { planEngineAction, planEngineBlast } from '../packages/main/dist/services/engine/index.js';

async function run(client, sql, args = []) {
  await client.execute({ sql, args });
}

async function insertMany(client, sql, rows) {
  for (const row of rows) {
    await run(client, sql, row);
  }
}

async function createFixture(dbPath) {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  const client = createClient({ url: `file:${dbPath}` });

  await run(client, `
    CREATE TABLE items (
      item_id TEXT PRIMARY KEY,
      modid TEXT NOT NULL,
      translation_key TEXT,
      is_block INTEGER NOT NULL DEFAULT 0
    )
  `);
  await run(client, 'CREATE TABLE item_tags (tag_id TEXT NOT NULL, item_id TEXT NOT NULL, PRIMARY KEY(tag_id, item_id))');
  await run(client, `
    CREATE TABLE translations (
      lang TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY(lang, key)
    )
  `);
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
      count INTEGER NOT NULL DEFAULT 1
    )
  `);
  await run(client, `
    CREATE TABLE recipe_outputs (
      recipe_id TEXT NOT NULL,
      slot INTEGER NOT NULL,
      item_id TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 1,
      components_json TEXT,
      is_primary INTEGER NOT NULL DEFAULT 1
    )
  `);

  await insertMany(client, 'INSERT INTO items (item_id, modid, translation_key, is_block) VALUES (?, ?, ?, ?)', [
    ['minecraft:copper_ingot', 'minecraft', 'item.minecraft.copper_ingot', 0],
    ['minecraft:raw_copper', 'minecraft', 'item.minecraft.raw_copper', 0],
    ['moda:copper_ingot', 'moda', 'item.moda.copper_ingot', 0],
    ['moda:copper_wire', 'moda', 'item.moda.copper_wire', 0],
    ['moda:unused_input', 'moda', 'item.moda.unused_input', 0],
    ['moda:unused_output', 'moda', 'item.moda.unused_output', 0],
    ['moda:zinc_dust', 'moda', 'item.moda.zinc_dust', 0],
    ['modb:zinc_dust', 'modb', 'item.modb.zinc_dust', 0],
    ['moda:zinc_plate', 'moda', 'item.moda.zinc_plate', 0],
    ['moda:marble', 'moda', 'item.moda.marble', 0],
    ['create:marble', 'create', 'item.create.marble', 0],
    ['create:marble_polished', 'create', 'item.create.marble_polished', 0],
  ]);

  await insertMany(client, 'INSERT INTO translations (lang, key, value) VALUES (?, ?, ?)', [
    ['zh_cn', 'item.moda.marble', '大理石'],
    ['zh_cn', 'item.create.marble', '大理石'],
  ]);

  await insertMany(client, 'INSERT INTO item_tags (tag_id, item_id) VALUES (?, ?)', [
    ['forge:dusts/zinc', 'moda:zinc_dust'],
    ['forge:ingots/copper', 'minecraft:copper_ingot'],
    ['forge:ingots/copper', 'moda:copper_ingot'],
  ]);

  await insertMany(client, 'INSERT INTO recipes (recipe_id, type_id, modid, hash, raw_json, unparsed) VALUES (?, ?, ?, ?, ?, ?)', [
    [
      'minecraft:copper_ingot_from_smelting',
      'minecraft:smelting',
      'minecraft',
      'hash_copper_ingot_from_smelting',
      '{"type":"minecraft:smelting","cookingtime":200}',
      0,
    ],
    [
      'moda:copper_wire',
      'minecraft:crafting_shapeless',
      'moda',
      'hash_copper_wire',
      '{"type":"minecraft:crafting_shapeless"}',
      0,
    ],
    [
      'moda:unused_recipe',
      'minecraft:crafting_shapeless',
      'moda',
      'hash_unused_recipe',
      '{"type":"minecraft:crafting_shapeless"}',
      0,
    ],
    [
      'moda:zinc_plate',
      'minecraft:crafting_shaped',
      'moda',
      'hash_zinc_plate',
      '{"type":"minecraft:crafting_shaped"}',
      0,
    ],
    [
      'create:marble_polish',
      'minecraft:stonecutting',
      'create',
      'hash_marble_polish',
      '{"type":"minecraft:stonecutting"}',
      0,
    ],
  ]);

  await insertMany(client, 'INSERT INTO recipe_inputs (recipe_id, slot, role, kind, ref, count) VALUES (?, ?, ?, ?, ?, ?)', [
    ['minecraft:copper_ingot_from_smelting', 0, 'input', 'item', 'minecraft:raw_copper', 1],
    ['moda:copper_wire', 0, 'input', 'item', 'moda:copper_ingot', 1],
    ['moda:unused_recipe', 0, 'input', 'item', 'moda:unused_input', 1],
    ['moda:zinc_plate', 0, 'input', 'tag', 'forge:dusts/zinc', 1],
    ['create:marble_polish', 0, 'input', 'item', 'create:marble', 1],
  ]);

  await insertMany(client, 'INSERT INTO recipe_outputs (recipe_id, slot, item_id, count, components_json, is_primary) VALUES (?, ?, ?, ?, ?, ?)', [
    ['minecraft:copper_ingot_from_smelting', 0, 'minecraft:copper_ingot', 3, null, 1],
    ['moda:copper_wire', 0, 'moda:copper_wire', 1, null, 1],
    ['moda:unused_recipe', 0, 'moda:unused_output', 1, null, 1],
    ['moda:zinc_plate', 0, 'moda:zinc_plate', 1, null, 1],
    ['create:marble_polish', 0, 'create:marble_polished', 1, null, 1],
  ]);

  await client.close();
}

function assertBlastSummaryShape(summary) {
  assert.ok(summary.target === undefined || summary.target.kind === 'item' || summary.target.kind === 'tag');
  assert.ok(Array.isArray(summary.inputRefs));
  assert.ok(Array.isArray(summary.outputRefs));
  assert.ok(Array.isArray(summary.tagConnected));
  assert.ok(Array.isArray(summary.relatedUnparsed));
  assert.equal(typeof summary.isBlock, 'boolean');
  assert.equal(typeof summary.crossMod, 'boolean');
  assert.deepEqual(summary.counts, {
    inputRefs: summary.inputRefs.length,
    outputRefs: summary.outputRefs.length,
    tagConnected: summary.tagConnected.length,
    relatedUnparsed: summary.relatedUnparsed.length,
  });
}

function assertDryRunShape(result, action) {
  assert.equal(result.action, action);
  assert.ok(Array.isArray(result.operations));
  assert.ok(Array.isArray(result.changeSetPreview));
  const operationIds = new Set(result.operations.map(operation => operation.operationId));
  assert.ok(result.changeSetPreview.every(operation => (
    operation.includedInChangeSet && operationIds.has(operation.operationId)
  )));
  assert.ok(['info', 'low', 'medium', 'high'].includes(result.risk.severity));
  assert.equal(typeof result.risk.mustDefer, 'boolean');
  assert.ok(Array.isArray(result.risk.reasons));
  assert.ok(Array.isArray(result.deferredSuggestions));
  assert.ok(Array.isArray(result.blast));
  result.blast.forEach(assertBlastSummaryShape);
}

async function main() {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'delightify-engine-dispatch-'));
  const dbPath = path.join(projectPath, '.delightify', 'project.db');
  await createFixture(dbPath);

  const requests = [
    {
      action: 'retag',
      params: {
        items: ['modb:zinc_dust'],
        tag: 'forge:dusts/zinc',
        op: 'add',
      },
    },
    {
      action: 'remove',
      params: {
        recipeIds: ['moda:unused_recipe'],
        confirmedOperationIds: ['remove_recipe:moda:unused_recipe'],
      },
    },
    {
      action: 'replace',
      params: {
        from: { kind: 'item', ref: 'moda:copper_ingot' },
        to: { kind: 'item', ref: 'minecraft:copper_ingot' },
        scope: 'input',
      },
    },
    {
      action: 'rename',
      params: {
        items: [{ item: 'moda:marble', locale: 'zh_cn', newName: '模组大理石' }],
      },
    },
    {
      action: 'scale',
      params: {
        recipeIds: ['minecraft:copper_ingot_from_smelting'],
        field: 'output_count',
        factor: 2,
      },
    },
    {
      action: 'hide',
      params: {
        items: ['moda:marble'],
      },
    },
    {
      action: 'constrain_inputs',
      params: {
        slotTag: 'forge:dusts/zinc',
        allow: ['moda:zinc_dust'],
        bridgeSuggestions: [{ from: 'minecraft:fat', to: 'farmersdelight:oil' }],
      },
    },
    {
      action: 'differentiate',
      params: {
        group: [
          {
            item: 'moda:marble',
            subTag: 'delightify:marble/moda',
            variantName: [{ locale: 'zh_cn', newName: '模组大理石' }],
          },
          {
            item: 'create:marble',
            subTag: 'delightify:marble/create',
            variantName: [{ locale: 'zh_cn', newName: '机械动力大理石' }],
          },
        ],
        chainReplaces: [
          {
            from: { kind: 'item', ref: 'create:marble' },
            to: { kind: 'item', ref: 'moda:marble' },
            scope: 'input',
          },
        ],
      },
    },
    {
      action: 'harmonize',
      params: {
        outlierReplaces: [
          {
            from: { kind: 'item', ref: 'moda:copper_ingot' },
            to: { kind: 'item', ref: 'minecraft:copper_ingot' },
            scope: 'input',
          },
        ],
        recipeTypeChanges: [
          {
            recipeId: 'moda:copper_wire',
            fromType: 'minecraft:crafting_shapeless',
            toType: 'minecraft:crafting_shaped',
          },
        ],
      },
    },
  ];

  try {
    for (const request of requests) {
      const result = await planEngineAction(projectPath, request);
      assertDryRunShape(result, request.action);
      if (request.action === 'scale') {
        assert.ok(Array.isArray(result.scaleClassifications));
      }
      if (['constrain_inputs', 'differentiate', 'harmonize'].includes(request.action)) {
        assert.ok(Array.isArray(result.deferredSuggestions));
      }
    }

    const blast = await planEngineBlast(projectPath, { kind: 'item', ref: 'moda:copper_ingot' });
    assertBlastSummaryShape(blast);
    assert.equal(blast.target.ref, 'moda:copper_ingot');
    assert.equal(blast.counts.inputRefs, 1);

    console.log('Engine dispatch smoke passed');
  } finally {
    await closeProjectDbClient(dbPath, true);
    await fs.rm(projectPath, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

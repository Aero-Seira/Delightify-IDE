import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createClient } from '@libsql/client';
import { makeChangeSet, planRetag } from '../packages/main/dist/services/engine/index.js';
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
    ['moda:zinc_block', 'moda', 1],
    ['moda:zinc_plate', 'moda', 0],
    ['modb:zinc_dust', 'modb', 0],
  ];
  for (const item of items) {
    await run(client, 'INSERT INTO items (item_id, modid, is_block) VALUES (?, ?, ?)', item);
  }

  await run(client, 'INSERT INTO item_tags (tag_id, item_id) VALUES (?, ?)', [
    'forge:dusts/zinc',
    'moda:zinc_dust',
  ]);
  await run(client, 'INSERT INTO item_tags (tag_id, item_id) VALUES (?, ?)', [
    'forge:storage_blocks/zinc',
    'moda:zinc_block',
  ]);

  await run(client, 'INSERT INTO recipes (recipe_id, type_id, modid, raw_json, unparsed) VALUES (?, ?, ?, ?, ?)', [
    'moda:zinc_plate',
    'minecraft:crafting_shaped',
    'moda',
    '{"type":"minecraft:crafting_shaped"}',
    0,
  ]);
  await run(client, 'INSERT INTO recipe_inputs (recipe_id, slot, role, kind, ref, count) VALUES (?, ?, ?, ?, ?, ?)', [
    'moda:zinc_plate',
    0,
    'input',
    'tag',
    'forge:dusts/zinc',
    1,
  ]);
  await run(client, 'INSERT INTO recipe_inputs (recipe_id, slot, role, kind, ref, count) VALUES (?, ?, ?, ?, ?, ?)', [
    'moda:zinc_plate',
    1,
    'input',
    'tag',
    'forge:storage_blocks/zinc',
    1,
  ]);
  await run(client, 'INSERT INTO recipe_outputs (recipe_id, slot, item_id, count, components_json) VALUES (?, ?, ?, ?, ?)', [
    'moda:zinc_plate',
    0,
    'moda:zinc_plate',
    1,
    null,
  ]);

  return client;
}

function assertRecipeOnlyOutputUnchanged() {
  const generatedAt = '2026-01-01T00:00:00.000Z';
  const recipeOnlyChangeSet = [{
    operationId: 'replace:fixture',
    decisionId: 'replace:fixture',
    kind: 'replace_recipe_input_item',
    recipeId: 'moda:zinc_plate',
    typeId: 'minecraft:crafting_shaped',
    modid: 'moda',
    slot: 0,
    before: { kind: 'item', ref: 'moda:zinc_dust', count: 1 },
    after: { kind: 'item', ref: 'minecraft:zinc_dust', count: 1 },
    includedInChangeSet: true,
  }];
  const files = emitChangeSet(recipeOnlyChangeSet, generatedAt);

  assert.equal(files.length, 1);
  assert.equal(files[0].content, [
    '// @delightify-generated',
    '// Do not edit by hand. Regenerate from Delightify.',
    `// Generated at: ${generatedAt}`,
    '',
    'ServerEvents.recipes(event => {',
    '  event.replaceInput({ id: "moda:zinc_plate" }, "moda:zinc_dust", "minecraft:zinc_dust")',
    '})',
    '',
  ].join('\n'));
}

async function main() {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'delightify-m2-retag-'));
  const dbPath = path.join(projectPath, '.delightify', 'project.db');
  const client = await createFixture(dbPath);

  try {
    const addDryRun = await planRetag(client, {
      items: ['modb:zinc_dust'],
      tag: 'forge:dusts/zinc',
      op: 'add',
    });
    assert.equal(addDryRun.operations.length, 1);
    assert.equal(addDryRun.operations.every(operation => operation.includedInChangeSet === false), true);
    assert.equal(addDryRun.risk.mustDefer, true);
    assert.ok(addDryRun.blast.recipeRefsAsInput.length > 0);
    assert.equal(makeChangeSet(addDryRun.operations).length, 0);

    const addOperationId = addDryRun.operations[0].operationId;
    const removeOperationId = 'retag:remove:forge:dusts/zinc:moda:zinc_dust';
    const [confirmedAdd, confirmedRemove] = await Promise.all([
      planRetag(client, {
        items: ['modb:zinc_dust'],
        tag: 'forge:dusts/zinc',
        op: 'add',
        confirmedOperationIds: [addOperationId],
      }),
      planRetag(client, {
        items: ['moda:zinc_dust'],
        tag: 'forge:dusts/zinc',
        op: 'remove',
        confirmedOperationIds: [removeOperationId],
      }),
    ]);
    const changeSet = makeChangeSet([
      ...confirmedAdd.operations,
      ...confirmedRemove.operations,
    ]);
    assert.equal(changeSet.length, 2);

    const exportResult = await exportKubeJs(projectPath, { changeSet });
    assert.match(exportResult.generatedCode, /ServerEvents\.tags\('item', event => \{/);
    assert.match(exportResult.generatedCode, /event\.add\("forge:dusts\/zinc", "modb:zinc_dust"\)/);
    assert.match(exportResult.generatedCode, /event\.remove\("forge:dusts\/zinc", "moda:zinc_dust"\)/);
    assert.equal(exportResult.files.length, 1);
    assert.equal(exportResult.files[0].operationCount, 2);

    const strongRiskPlan = await planRetag(client, {
      items: ['modb:zinc_dust'],
      tag: 'forge:storage_blocks/zinc',
      op: 'add',
      confirmedOperationIds: ['retag:add:forge:storage_blocks/zinc:modb:zinc_dust'],
    });
    assert.equal(strongRiskPlan.blast.isBlock, true);
    assert.equal(strongRiskPlan.operations[0].includedInChangeSet, false);
    assert.ok(strongRiskPlan.operations[0].reason?.includes('确认不能覆盖'));

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

    assertRecipeOnlyOutputUnchanged();
    console.log('M2 retag smoke passed');
  } finally {
    await client.close();
    await fs.rm(projectPath, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

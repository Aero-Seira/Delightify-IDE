import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createClient } from '@libsql/client';
import { planDifferentiate } from '../packages/main/dist/services/engine/index.js';

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
      translation_key TEXT,
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
  await run(client, 'CREATE TABLE translations ("key" TEXT NOT NULL, lang TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY("key", lang))');

  const items = [
    ['create:marble', 'create', 'block.create.marble', 1],
    ['create:marble_bricks', 'create', 'block.create.marble_bricks', 1],
    ['quark:marble', 'quark', 'block.quark.marble', 1],
    ['somemod:marble', 'somemod', 'block.somemod.marble', 1],
  ];
  for (const item of items) {
    await run(client, 'INSERT INTO items (item_id, modid, translation_key, is_block) VALUES (?, ?, ?, ?)', item);
  }

  const translations = [
    ['block.create.marble', 'zh_cn', '大理石'],
    ['block.create.marble_bricks', 'zh_cn', '大理石砖'],
    ['block.quark.marble', 'zh_cn', '大理石'],
    ['block.somemod.marble', 'zh_cn', '大理石'],
  ];
  for (const translation of translations) {
    await run(client, 'INSERT INTO translations ("key", lang, value) VALUES (?, ?, ?)', translation);
  }

  await run(client, 'INSERT INTO recipes (recipe_id, type_id, modid, raw_json, unparsed) VALUES (?, ?, ?, ?, ?)', [
    'create:marble_bricks_from_marble',
    'create:cutting',
    'create',
    '{"type":"create:cutting"}',
    0,
  ]);
  await run(client, 'INSERT INTO recipe_inputs (recipe_id, slot, role, kind, ref, count) VALUES (?, ?, ?, ?, ?, ?)', [
    'create:marble_bricks_from_marble',
    0,
    'input',
    'item',
    'create:marble',
    1,
  ]);
  await run(client, 'INSERT INTO recipe_outputs (recipe_id, slot, item_id, count, components_json) VALUES (?, ?, ?, ?, ?)', [
    'create:marble_bricks_from_marble',
    0,
    'create:marble_bricks',
    1,
    null,
  ]);

  return client;
}

function differentiateRequest() {
  return {
    group: [
      {
        item: 'create:marble',
        subTag: 'delightify:marbles/functional',
        variantName: [{ locale: 'zh_cn', newName: '动力大理石' }],
      },
      {
        item: 'quark:marble',
        subTag: 'delightify:marbles/decorative',
        variantName: [{ locale: 'zh_cn', newName: 'Quark 大理石' }],
      },
      {
        item: 'somemod:marble',
        subTag: 'delightify:marbles/decorative',
        variantName: [{ locale: 'zh_cn', newName: '装饰大理石' }],
      },
    ],
  };
}

async function main() {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'delightify-m2-differentiate-'));
  const dbPath = path.join(projectPath, '.delightify', 'project.db');
  const client = await createFixture(dbPath);

  try {
    const dryRun = await planDifferentiate(client, differentiateRequest());

    const renameOps = dryRun.operations.filter(operation => operation.kind === 'rename_lang');
    const retagOps = dryRun.operations.filter(operation => operation.kind === 'retag_add');
    assert.equal(renameOps.length, 3);
    assert.equal(renameOps.every(operation => operation.includedInChangeSet === true), true);
    assert.deepEqual(renameOps.map(operation => operation.after.newName).sort(), [
      'Quark 大理石',
      '动力大理石',
      '装饰大理石',
    ]);

    assert.equal(retagOps.length, 3);
    assert.equal(retagOps.every(operation => operation.includedInChangeSet === false), true);
    assert.deepEqual(retagOps.map(operation => operation.before.tag).sort(), [
      'delightify:marbles/decorative',
      'delightify:marbles/decorative',
      'delightify:marbles/functional',
    ]);

    assert.equal(dryRun.deferredSuggestions.length, 1);
    assert.equal(dryRun.deferredSuggestions[0].kind, 'naming_style');
    assert.ok(dryRun.deferredSuggestions[0].reason.includes('命名风格'));

    assert.equal(dryRun.operations.some(operation => (
      operation.kind === 'remove_recipe' ||
      operation.kind === 'retag_remove' ||
      operation.operationId.includes('merge')
    )), false);

    const createBlast = dryRun.blast.rename.blast.find(blast => blast.target.ref === 'create:marble');
    assert.ok(createBlast.recipeRefsAsInput.some(reference => reference.recipeId === 'create:marble_bricks_from_marble'));
    assert.equal(dryRun.operations.some(operation => (
      operation.kind.startsWith('replace_recipe') &&
      JSON.stringify(operation.before).includes('create:marble')
    )), false);

    const confirmed = await planDifferentiate(client, {
      ...differentiateRequest(),
      confirmedOperationIds: retagOps.map(operation => operation.operationId),
    });
    const confirmedRetagOps = confirmed.operations.filter(operation => operation.kind === 'retag_add');
    assert.equal(confirmedRetagOps.every(operation => operation.includedInChangeSet === true), true);
    assert.equal(confirmed.deferredSuggestions[0].kind, 'naming_style');

    console.log('M2 differentiate smoke passed');
  } finally {
    await client.close();
    await fs.rm(projectPath, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

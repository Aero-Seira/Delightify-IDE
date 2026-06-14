import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createClient } from '@libsql/client';
import { makeChangeSet, planRename } from '../packages/main/dist/services/engine/index.js';
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
    ['minecraft:copper_ingot', 'minecraft', 'item.minecraft.copper_ingot', 0],
    ['minecraft:iron_ingot', 'minecraft', 'item.minecraft.iron_ingot', 0],
    ['moda:copper_wire', 'moda', 'item.moda.copper_wire', 0],
  ];
  for (const item of items) {
    await run(client, 'INSERT INTO items (item_id, modid, translation_key, is_block) VALUES (?, ?, ?, ?)', item);
  }

  const translations = [
    ['item.minecraft.copper_ingot', 'en_us', 'Copper Ingot'],
    ['item.minecraft.copper_ingot', 'zh_cn', '铜锭'],
    ['item.minecraft.iron_ingot', 'en_us', 'Iron Ingot'],
    ['item.moda.copper_wire', 'en_us', 'Copper Wire'],
  ];
  for (const translation of translations) {
    await run(client, 'INSERT INTO translations ("key", lang, value) VALUES (?, ?, ?)', translation);
  }

  await run(client, 'INSERT INTO recipes (recipe_id, type_id, modid, raw_json, unparsed) VALUES (?, ?, ?, ?, ?)', [
    'moda:copper_wire',
    'minecraft:crafting_shapeless',
    'moda',
    '{"type":"minecraft:crafting_shapeless"}',
    0,
  ]);
  await run(client, 'INSERT INTO recipe_inputs (recipe_id, slot, role, kind, ref, count) VALUES (?, ?, ?, ?, ?, ?)', [
    'moda:copper_wire',
    0,
    'input',
    'item',
    'minecraft:copper_ingot',
    1,
  ]);
  await run(client, 'INSERT INTO recipe_outputs (recipe_id, slot, item_id, count, components_json) VALUES (?, ?, ?, ?, ?)', [
    'moda:copper_wire',
    0,
    'moda:copper_wire',
    1,
    null,
  ]);

  return client;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'delightify-m2-rename-'));
  const dbPath = path.join(projectPath, '.delightify', 'project.db');
  const client = await createFixture(dbPath);
  const enUsPath = path.join(projectPath, 'kubejs', 'assets', 'minecraft', 'lang', 'en_us.json');
  const zhCnPath = path.join(projectPath, 'kubejs', 'assets', 'minecraft', 'lang', 'zh_cn.json');
  const serverScriptPath = path.join(projectPath, 'kubejs', 'server_scripts', 'zzz_delightify_generated.js');
  const manifestPath = path.join(projectPath, 'kubejs', '.delightify-generated.json');

  try {
    const dryRun = await planRename(client, {
      items: [
        { item: 'minecraft:copper_ingot', locale: 'en_us', newName: 'Copper Ingot (Primary)' },
        { item: 'minecraft:copper_ingot', locale: 'zh_cn', newName: '主铜锭' },
        { item: 'minecraft:iron_ingot', locale: 'en_us', newName: 'Iron Ingot (Reference)' },
      ],
    });

    assert.equal(dryRun.operations.length, 3);
    assert.equal(dryRun.operations.every(operation => operation.kind === 'rename_lang'), true);
    assert.equal(dryRun.operations.every(operation => operation.includedInChangeSet), true);
    assert.equal(dryRun.risk.mustDefer, false);
    assert.equal(dryRun.operations[0].after.newName, 'Copper Ingot (Primary)');
    assert.equal(dryRun.operations[0].before.oldName, 'Copper Ingot');
    assert.ok(dryRun.blast[0].recipeRefsAsInput.some(reference => reference.recipeId === 'moda:copper_wire'));

    const exportResult = await exportKubeJs(projectPath, {
      changeSet: makeChangeSet(dryRun.operations),
    }, {
      generatedAt: '2026-01-04T00:00:00.000Z',
    });
    assert.equal(exportResult.generatedCode, '');
    assert.equal(exportResult.files.length, 2);

    const enUs = await readJson(enUsPath);
    assert.deepEqual(enUs, {
      'item.minecraft.copper_ingot': 'Copper Ingot (Primary)',
      'item.minecraft.iron_ingot': 'Iron Ingot (Reference)',
    });

    const zhCn = await readJson(zhCnPath);
    assert.deepEqual(zhCn, {
      'item.minecraft.copper_ingot': '主铜锭',
    });

    const manifest = await readJson(manifestPath);
    assert.deepEqual(manifest.files.map(entry => entry.relativePath).sort(), [
      'kubejs/assets/minecraft/lang/en_us.json',
      'kubejs/assets/minecraft/lang/zh_cn.json',
    ]);

    const mixedChangeSet = [
      ...makeChangeSet(dryRun.operations),
      {
        operationId: 'replace:rename-smoke',
        decisionId: 'replace:rename-smoke',
        kind: 'replace_recipe_input_item',
        recipeId: 'moda:copper_wire',
        typeId: 'minecraft:crafting_shapeless',
        modid: 'moda',
        slot: 0,
        before: { kind: 'item', ref: 'minecraft:copper_ingot', count: 1 },
        after: { kind: 'item', ref: 'minecraft:iron_ingot', count: 1 },
        includedInChangeSet: true,
      },
    ];
    const mixedExport = await exportKubeJs(projectPath, {
      changeSet: mixedChangeSet,
    }, {
      generatedAt: '2026-01-05T00:00:00.000Z',
    });
    assert.equal(mixedExport.files.length, 3);
    assert.match(mixedExport.generatedCode, /event\.replaceInput\(\{ id: "moda:copper_wire" \}, "minecraft:copper_ingot", "minecraft:iron_ingot"\)/);
    assert.equal(await exists(serverScriptPath), true);

    const mixedManifest = await readJson(manifestPath);
    assert.deepEqual(mixedManifest.files.map(entry => entry.relativePath).sort(), [
      'kubejs/assets/minecraft/lang/en_us.json',
      'kubejs/assets/minecraft/lang/zh_cn.json',
      'kubejs/server_scripts/zzz_delightify_generated.js',
    ]);

    const revertResult = await revertKubeJs(projectPath);
    assert.deepEqual(revertResult, {
      filePath: path.join(projectPath, 'kubejs', 'server_scripts', 'zzz_delightify_generated.js'),
      deleted: true,
    });
    assert.equal(await exists(enUsPath), false);
    assert.equal(await exists(zhCnPath), false);
    assert.equal(await exists(manifestPath), false);

    const secondRevertResult = await revertKubeJs(projectPath);
    assert.deepEqual(secondRevertResult, {
      filePath: path.join(projectPath, 'kubejs', 'server_scripts', 'zzz_delightify_generated.js'),
      deleted: false,
    });

    console.log('M2 rename smoke passed');
  } finally {
    await client.close();
    await fs.rm(projectPath, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

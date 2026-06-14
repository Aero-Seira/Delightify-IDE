import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { exportKubeJs, revertKubeJs } from '../packages/main/dist/services/export/index.js';

function renameOperation(item, locale, newName) {
  return {
    operationId: `rename_lang:${locale}:${item}`,
    decisionId: `rename:${locale}:${item}`,
    kind: 'rename_lang',
    before: {
      item,
      locale,
    },
    after: {
      item,
      locale,
      newName,
    },
    includedInChangeSet: true,
  };
}

async function readText(filePath) {
  return fs.readFile(filePath, 'utf8');
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readFilesSnapshot(filePaths) {
  const snapshot = new Map();
  for (const filePath of filePaths.sort()) {
    snapshot.set(filePath, await readText(filePath));
  }
  return snapshot;
}

async function main() {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'delightify-m2-fileset-'));
  const manifestPath = path.join(projectPath, 'kubejs', '.delightify-generated.json');
  const enUsPath = path.join(projectPath, 'kubejs', 'assets', 'minecraft', 'lang', 'en_us.json');
  const zhCnPath = path.join(projectPath, 'kubejs', 'assets', 'minecraft', 'lang', 'zh_cn.json');

  try {
    const enChangeSet = [
      renameOperation('minecraft:copper_ingot', 'en_us', 'Copper Ingot (Delightify)'),
    ];
    const zhChangeSet = [
      renameOperation('minecraft:copper_ingot', 'zh_cn', '铜锭（Delightify）'),
    ];

    const firstExport = await exportKubeJs(projectPath, {
      changeSet: enChangeSet,
    }, {
      generatedAt: '2026-01-01T00:00:00.000Z',
    });
    assert.equal(firstExport.generatedCode, '');
    assert.equal(firstExport.files.length, 1);
    assert.equal(firstExport.files[0].filePath, enUsPath);
    assert.equal(await exists(enUsPath), true);
    assert.match(await readText(enUsPath), /Copper Ingot \(Delightify\)/);

    const secondExport = await exportKubeJs(projectPath, {
      changeSet: zhChangeSet,
    }, {
      generatedAt: '2026-01-02T00:00:00.000Z',
    });
    assert.equal(secondExport.files.length, 1);
    assert.equal(secondExport.files[0].filePath, zhCnPath);
    assert.equal(await exists(enUsPath), false);
    assert.equal(await exists(zhCnPath), true);
    assert.match(await readText(zhCnPath), /铜锭（Delightify）/);

    const manifest = JSON.parse(await readText(manifestPath));
    assert.deepEqual(manifest.files.map(entry => entry.relativePath), [
      'kubejs/assets/minecraft/lang/zh_cn.json',
    ]);

    const fixedExport = await exportKubeJs(projectPath, {
      changeSet: zhChangeSet,
    }, {
      generatedAt: '2026-01-03T00:00:00.000Z',
    });
    const fixedPaths = [
      ...fixedExport.files.map(file => file.filePath),
      manifestPath,
    ];
    const firstSnapshot = await readFilesSnapshot(fixedPaths);

    const repeatedExport = await exportKubeJs(projectPath, {
      changeSet: zhChangeSet,
    }, {
      generatedAt: '2026-01-03T00:00:00.000Z',
    });
    const repeatedPaths = [
      ...repeatedExport.files.map(file => file.filePath),
      manifestPath,
    ];
    const secondSnapshot = await readFilesSnapshot(repeatedPaths);
    assert.deepEqual(secondSnapshot, firstSnapshot);

    const revertResult = await revertKubeJs(projectPath);
    assert.deepEqual(revertResult, {
      filePath: path.join(projectPath, 'kubejs', 'server_scripts', 'zzz_delightify_generated.js'),
      deleted: true,
    });
    assert.equal(await exists(zhCnPath), false);
    assert.equal(await exists(manifestPath), false);

    const secondRevertResult = await revertKubeJs(projectPath);
    assert.deepEqual(secondRevertResult, {
      filePath: path.join(projectPath, 'kubejs', 'server_scripts', 'zzz_delightify_generated.js'),
      deleted: false,
    });

    console.log('M2 fileset smoke passed');
  } finally {
    await fs.rm(projectPath, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

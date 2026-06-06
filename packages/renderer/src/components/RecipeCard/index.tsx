/**
 * 配方卡片组件 - v2.7 (修复JSON解析)
 * 
 * 支持的配方格式：
 * 1. Shaped (有序合成): { pattern: [...], key: {...}, result: {...} }
 * 2. Shapeless (无序合成): { ingredients: [...], result: {...} }
 *    - ingredients 格式: [{ items: [...] }] 或 [{ item: "..." }] 或 ["..."]
 * 3. Smelting/Cooking: { ingredient: {...}, result: {...} }
 *    - ingredient 格式: { items: [...] } 或 { item: "..." } 或 "..."
 */

import React, { useMemo, useState } from 'react';
import type { Recipe } from '@delightify/shared';
import ItemIcon from '../ItemIcon';
import styles from './style.module.css';

interface RecipeCardProps {
  recipe: Recipe;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

interface RecipeSlot {
  item?: string;
  tag?: string;
  count?: number;
}

interface ParseInfo {
  hasRawJson: boolean;
  rawJsonLength: number;
  jsonType: string | undefined;
  hasPattern: boolean;
  hasKey: boolean;
  hasIngredients: boolean;
  hasIngredient: boolean;
  inputCount: number;
  firstInput: RecipeSlot | undefined;
  error?: string;
}

function getRecipeTypeMeta(typeId: string): { name: string; color: string } {
  const name = typeId.split(':')[1]?.replace(/_/g, ' ') || typeId;
  const color = typeId.includes('shaped')
    ? '#4dabf7'
    : typeId.includes('shapeless')
      ? '#69db7c'
      : typeId.includes('smelt') || typeId.includes('cook')
        ? '#ff8787'
        : '#868e96';

  return { name, color };
}

/**
 * 从数据中提取物品ID
 * 处理多种格式：{ items: [...] }, { item: "..." }, "...", { tag: "..." }
 */
function extractItemId(data: any): string | undefined {
  if (!data) return undefined;
  
  // 字符串格式: "minecraft:stick"
  if (typeof data === 'string') {
    return data;
  }
  
  // 对象格式
  if (typeof data === 'object') {
    // { item: "minecraft:stick" }
    if (data.item && typeof data.item === 'string') {
      return data.item;
    }
    
    // { items: ["minecraft:stick", ...] } - 取第一个
    if (data.items && Array.isArray(data.items) && data.items.length > 0) {
      const first = data.items[0];
      if (typeof first === 'string') return first;
      if (first && typeof first === 'object' && first.item) return first.item;
      return extractItemId(first); // 递归处理嵌套
    }
    
    // { tag: "minecraft:logs" }
    if (data.tag && typeof data.tag === 'string') {
      return `tag:${data.tag}`;
    }
  }
  
  return undefined;
}

/**
 * 从配方JSON提取物品
 */
function extractItemsFromRecipe(json: any): { inputs: RecipeSlot[]; output: RecipeSlot | null } {
  const inputs: RecipeSlot[] = [];
  let output: RecipeSlot | null = null;
  
  if (!json) return { inputs, output };
  
  // ===== 提取输入 =====
  
  // 1. 有序合成 (pattern + key)
  if (json.pattern && json.key) {
    // 遍历 pattern 的每个位置
    json.pattern.forEach((row: string) => {
      for (const char of row) {
        if (char !== ' ' && char !== '.') {
          const keyData = json.key[char];
          if (keyData) {
            // key 可能是数组（多个选项），取第一个
            const data = Array.isArray(keyData) ? keyData[0] : keyData;
            const itemId = extractItemId(data);
            if (itemId) {
              if (itemId.startsWith('tag:')) {
                inputs.push({ tag: itemId.slice(4) });
              } else {
                inputs.push({ item: itemId });
              }
            }
          }
        }
      }
    });
  }
  // 2. 无序合成 (ingredients 数组)
  else if (json.ingredients && Array.isArray(json.ingredients)) {
    json.ingredients.forEach((ing: any) => {
      // ingredients 可能是嵌套数组（某些模组的格式）
      const itemData = Array.isArray(ing) ? ing[0] : ing;
      
      const itemId = extractItemId(itemData);
      if (itemId) {
        if (itemId.startsWith('tag:')) {
          inputs.push({ tag: itemId.slice(4) });
        } else {
          inputs.push({ item: itemId });
        }
      }
    });
  }
  // 3. 单一输入 (ingredient)
  else if (json.ingredient) {
    const itemId = extractItemId(json.ingredient);
    if (itemId) {
      if (itemId.startsWith('tag:')) {
        inputs.push({ tag: itemId.slice(4) });
      } else {
        inputs.push({ item: itemId });
      }
    }
  }
  
  // ===== 提取输出 =====
  if (json.result) {
    if (typeof json.result === 'string') {
      output = { item: json.result, count: 1 };
    } else if (typeof json.result === 'object') {
      const item = json.result.item || json.result.id;
      if (item) {
        output = { item, count: json.result.count || 1 };
      }
    }
  }
  
  return { inputs, output };
}

/**
 * 配方卡片
 */
export default function RecipeCard({
  recipe,
  selected = false,
  onClick,
  onDoubleClick,
}: RecipeCardProps): React.ReactElement {
  const [showDebug, setShowDebug] = useState(false);
  
  const { inputs, output, isShaped, parseInfo } = useMemo(() => {
    try {
      const json = recipe.rawJson ? JSON.parse(recipe.rawJson) : null;
      const { inputs, output } = extractItemsFromRecipe(json);
      
      // 收集解析信息用于调试
      const parseInfo: ParseInfo = {
        hasRawJson: !!recipe.rawJson,
        rawJsonLength: recipe.rawJson?.length || 0,
        jsonType: json?.type,
        hasPattern: !!json?.pattern,
        hasKey: !!json?.key,
        hasIngredients: !!json?.ingredients,
        hasIngredient: !!json?.ingredient,
        inputCount: inputs.length,
        firstInput: inputs[0],
      };
      
      return {
        inputs,
        output,
        isShaped: !!json?.pattern,
        parseInfo,
      };
    } catch (e) {
      console.error('[RecipeCard] Parse error:', e);
      return { 
        inputs: [], 
        output: null, 
        isShaped: false, 
        parseInfo: { 
          hasRawJson: !!recipe.rawJson,
          rawJsonLength: recipe.rawJson?.length || 0,
          jsonType: undefined,
          hasPattern: false,
          hasKey: false,
          hasIngredients: false,
          hasIngredient: false,
          inputCount: 0,
          firstInput: undefined,
          error: String(e) 
        } as ParseInfo
      };
    }
  }, [recipe.rawJson, recipe.recipeId, recipe.typeId]);
  
  const { name: typeName, color: typeColor } = useMemo(
    () => getRecipeTypeMeta(recipe.typeId),
    [recipe.typeId]
  );
  const typeBadgeStyle: React.CSSProperties = {
    backgroundColor: `${typeColor}20`,
    color: typeColor,
  };

  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* 类型标签 */}
      <div className={styles.typeBadge} style={typeBadgeStyle}>
        {typeName}
      </div>

      {/* 配方内容 */}
      <div className={styles.body} style={{ minHeight: 80 }}>
        {/* 输入区域 */}
        <div className={styles.inputs}>
          <div className={isShaped ? styles.craftingGrid : styles.shapelessGrid}>
          {isShaped ? (
            // 有序合成 - 3行3列网格
            [0, 1, 2].map(row => (
              <div key={row} className={styles.gridRow}>
                {[0, 1, 2].map(col => {
                  const idx = row * 3 + col;
                  const slot = inputs[idx];
                  return (
                    <div
                      key={col}
                      className={slot ? styles.slot : styles.emptySlot}
                      style={{ width: 24, height: 24 }}
                      title={slot?.item || slot?.tag || '空'}
                    >
                      {slot ? (
                        <ItemIcon 
                          itemId={slot.item || (slot.tag ? `tag:${slot.tag}` : '')} 
                          size={22}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))
          ) : (
            // 无序合成或其他
            <>
              {inputs.length > 0 ? (
                inputs.slice(0, 4).map((slot, idx) => (
                  <div
                    key={idx}
                    className={styles.slot}
                    style={{ width: 32, height: 32 }}
                  >
                    <ItemIcon 
                      itemId={slot.item || (slot.tag ? `tag:${slot.tag}` : '')} 
                      size={30}
                    />
                  </div>
                ))
              ) : (
                <span className={styles.inputFallback}>
                  无输入 ({parseInfo.inputCount})
                </span>
              )}
              {inputs.length > 4 && (
                <span className={styles.inputMore}>
                  +{inputs.length - 4}
                </span>
              )}
            </>
          )}
          </div>
        </div>

        {/* 箭头 */}
        <span className={styles.arrow} style={{ fontSize: 20 }}>→</span>

        {/* 输出 */}
        <div className={styles.outputs}>
          {output ? (
            <div className={`${styles.slot} ${styles.outputSlot}`}>
              <ItemIcon itemId={output.item || ''} size={46} />
              {(output.count || 1) > 1 && (
                <span className={styles.slotCount}>{output.count}</span>
              )}
            </div>
          ) : (
            <div className={styles.emptyOutput}>?</div>
          )}
        </div>
      </div>

      {/* 底部信息 */}
      <div className={styles.footer}>
        <span className={styles.modName}>{recipe.modid}</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowDebug(!showDebug); }}
          className={styles.debugButton}
        >
          {showDebug ? '隐藏' : '调试'}
        </button>
      </div>
      
      {/* 调试信息面板 */}
      {showDebug && (
        <div className={styles.debugPanel}>
          <div className={styles.debugTitle}>解析诊断:</div>
          <div>hasRawJson: {parseInfo.hasRawJson ? '✓' : '✗'}</div>
          <div>rawJsonLength: {parseInfo.rawJsonLength}</div>
          <div>type: {parseInfo.jsonType || 'N/A'}</div>
          <div>hasPattern: {parseInfo.hasPattern ? '✓' : '✗'}</div>
          <div>hasKey: {parseInfo.hasKey ? '✓' : '✗'}</div>
          <div>hasIngredients: {parseInfo.hasIngredients ? '✓' : '✗'}</div>
          <div>hasIngredient: {parseInfo.hasIngredient ? '✓' : '✗'}</div>
          <div>inputCount: {parseInfo.inputCount}</div>
          <div>firstInput: {JSON.stringify(parseInfo.firstInput)}</div>
          {parseInfo.error && <div className={styles.debugError}>error: {parseInfo.error}</div>}
        </div>
      )}
    </div>
  );
}

/**
 * 列表行组件
 */
export function RecipeListRow({
  recipe,
  selected = false,
  onClick,
  onDoubleClick,
}: RecipeCardProps): React.ReactElement {
  const { inputs, output } = useMemo(() => {
    try {
      const json = recipe.rawJson ? JSON.parse(recipe.rawJson) : null;
      return extractItemsFromRecipe(json);
    } catch {
      return { inputs: [], output: null };
    }
  }, [recipe.rawJson]);
  const { name: typeName, color: typeColor } = useMemo(
    () => getRecipeTypeMeta(recipe.typeId),
    [recipe.typeId]
  );

  return (
    <div
      className={`${styles.listRow} ${selected ? styles.selected : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <span
        className={styles.listTypeBadge}
        style={{ backgroundColor: `${typeColor}20`, color: typeColor }}
      >
        {typeName}
      </span>
      
      <div className={styles.listInputs}>
        {inputs.slice(0, 3).map((slot, idx) => (
          <div key={idx} className={styles.listItemSlot}>
            <ItemIcon itemId={slot.item || (slot.tag ? `tag:${slot.tag}` : '')} size={24} />
          </div>
        ))}
      </div>

      <span className={styles.listArrow}>→</span>

      <div className={styles.listOutputSlot}>
        {output && (
          <>
            <ItemIcon itemId={output.item || ''} size={28} />
            {(output.count || 1) > 1 && (
              <span className={styles.slotCount}>{output.count}</span>
            )}
          </>
        )}
      </div>

      <div className={styles.listInfo}>
        <div className={styles.listRecipeId}>{recipe.recipeId}</div>
        <div className={styles.listMod}>{recipe.modid}</div>
      </div>
    </div>
  );
}

/**
 * 详情卡片
 */
export function RecipeDetailCard({ recipe }: { recipe: Recipe }): React.ReactElement {
  const { inputs, output, parseInfo } = useMemo(() => {
    try {
      const json = recipe.rawJson ? JSON.parse(recipe.rawJson) : null;
      const { inputs, output } = extractItemsFromRecipe(json);
      return { 
        inputs, 
        output, 
        parseInfo: {
          hasRawJson: !!recipe.rawJson,
          jsonKeys: json ? Object.keys(json) : [],
          type: json?.type,
        }
      };
    } catch (e) {
      return { inputs: [], output: null, parseInfo: { error: String(e) } };
    }
  }, [recipe.rawJson]);
  
  const [showJson, setShowJson] = React.useState(false);
  const { name: typeName, color: typeColor } = useMemo(
    () => getRecipeTypeMeta(recipe.typeId),
    [recipe.typeId]
  );

  return (
    <div className={styles.detailCard}>
      <div className={styles.detailHeader}>
        <span
          className={styles.detailTypeBadge}
          style={{ backgroundColor: `${typeColor}20`, color: typeColor }}
        >
          {typeName}
        </span>
        <span className={styles.detailMod}>{recipe.modid}</span>
      </div>

      <div className={styles.detailBody}>
        <div className={styles.detailSection}>
          <h4>输入 ({inputs.length})</h4>
          <div className={styles.detailInputs}>
            {inputs.length > 0 ? (
              <div className={styles.detailItemsGrid}>
                {inputs.map((slot, idx) => (
                  <div key={idx} className={styles.detailItem}>
                    <div className={styles.detailItemIcon}>
                      <ItemIcon itemId={slot.item || (slot.tag ? `tag:${slot.tag}` : '')} size={48} />
                    </div>
                    <div className={styles.detailSlotName}>
                      {(slot.item || slot.tag || '?').split(':').pop()?.substring(0, 10)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.detailEmpty}>无输入</p>
            )}
          </div>
        </div>

        <div className={styles.detailArrow}>→</div>

        <div className={styles.detailSection}>
          <h4>输出</h4>
          <div className={styles.detailOutputs}>
            {output ? (
              <div className={styles.detailOutputItem}>
                <div className={styles.detailOutputIcon}>
                  <ItemIcon itemId={output.item || ''} size={56} />
                  {(output.count || 1) > 1 && (
                    <span className={styles.slotCount}>{output.count}</span>
                  )}
                </div>
                <div className={styles.detailSlotName}>
                  {output.item?.split(':').pop()}
                  {output.count && output.count > 1 ? ` x${output.count}` : ''}
                </div>
              </div>
            ) : (
              <p className={styles.detailEmpty}>无输出</p>
            )}
          </div>
        </div>
      </div>

      <div className={styles.detailFooter}>
        <code className={styles.detailRecipeId}>{recipe.recipeId}</code>
        <button 
          type="button"
          onClick={() => setShowJson(!showJson)}
          className={styles.toggleJsonBtn}
        >
          {showJson ? '隐藏 JSON' : '查看 JSON'}
        </button>
      </div>

      {showJson && recipe.rawJson && (
        <pre className={styles.jsonViewer}>{JSON.stringify(JSON.parse(recipe.rawJson), null, 2)}</pre>
      )}
    </div>
  );
}

package com.delightify.modinspector;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 存储分析结果的数据类
 */
public class RegistrationInfo {
    private String modId;
    private List<ItemInfo> items = new ArrayList<>();
    private List<BlockInfo> blocks = new ArrayList<>();
    private List<MultiBlockStructure> multiBlockStructures = new ArrayList<>();
    private List<String> errors = new ArrayList<>();

    public void setModId(String modId) {
        this.modId = modId;
    }

    public String getModId() {
        return modId;
    }

    public void addItem(ItemInfo item) {
        items.add(item);
    }

    public void addBlock(BlockInfo block) {
        blocks.add(block);
    }

    public void addMultiBlockStructure(MultiBlockStructure structure) {
        multiBlockStructures.add(structure);
    }

    public void addError(String error) {
        errors.add(error);
    }

    public List<ItemInfo> getItems() {
        return items;
    }

    public List<BlockInfo> getBlocks() {
        return blocks;
    }

    public List<MultiBlockStructure> getMultiBlockStructures() {
        return multiBlockStructures;
    }

    public List<String> getErrors() {
        return errors;
    }

    /**
     * 物品信息
     */
    public static class ItemInfo {
        public String id;
        public String className;
        public Integer maxStackSize;
        public Integer durability;
        public Boolean isBlockItem;
        public String blockId;
        public Map<String, Object> properties = new HashMap<>();

        public ItemInfo(String id, String className) {
            this.id = id;
            this.className = className;
        }
    }

    /**
     * 方块信息
     */
    public static class BlockInfo {
        public String id;
        public String className;
        public Float hardness;
        public Float resistance;
        public Integer lightLevel;
        public String material;
        public Map<String, Object> properties = new HashMap<>();

        public BlockInfo(String id, String className) {
            this.id = id;
            this.className = className;
        }
    }
}

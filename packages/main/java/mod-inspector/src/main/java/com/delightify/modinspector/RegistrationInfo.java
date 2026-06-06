package com.delightify.modinspector;

import java.util.*;

/**
 * 模组注册信息的数据模型
 */
public class RegistrationInfo {
    
    private String modId;
    private List<ItemRegistration> items = new ArrayList<>();
    private List<BlockRegistration> blocks = new ArrayList<>();
    private List<String> errors = new ArrayList<>();
    
    public static class ItemRegistration {
        public String id;
        public String className;
        public Integer maxStackSize;
        public Integer durability;
        public Boolean isBlockItem;
        public String blockId;  // 如果是方块物品，对应方块 ID
        public Map<String, Object> properties = new HashMap<>();
        
        public ItemRegistration(String id, String className) {
            this.id = id;
            this.className = className;
        }
    }
    
    public static class BlockRegistration {
        public String id;
        public String className;
        public Float hardness;
        public Float resistance;
        public Integer lightLevel;
        public String material;
        public Map<String, Object> properties = new HashMap<>();
        
        public BlockRegistration(String id, String className) {
            this.id = id;
            this.className = className;
        }
    }
    
    // Getters and Setters
    public String getModId() { return modId; }
    public void setModId(String modId) { this.modId = modId; }
    
    public List<ItemRegistration> getItems() { return items; }
    public List<BlockRegistration> getBlocks() { return blocks; }
    public List<String> getErrors() { return errors; }
    
    /**
     * 转换为 JSON 字符串
     */
    public String toJson() {
        StringBuilder sb = new StringBuilder();
        sb.append("{\n");
        
        // Mod ID
        sb.append("  \"modId\": \"").append(escapeJson(modId)).append("\",\n");
        
        // Items
        sb.append("  \"items\": [\n");
        for (int i = 0; i < items.size(); i++) {
            ItemRegistration item = items.get(i);
            sb.append("    {\n");
            sb.append("      \"id\": \"").append(escapeJson(item.id)).append("\",\n");
            sb.append("      \"className\": \"").append(escapeJson(item.className)).append("\",\n");
            if (item.maxStackSize != null) {
                sb.append("      \"maxStackSize\": ").append(item.maxStackSize).append(",\n");
            }
            if (item.durability != null) {
                sb.append("      \"durability\": ").append(item.durability).append(",\n");
            }
            if (item.isBlockItem != null) {
                sb.append("      \"isBlockItem\": ").append(item.isBlockItem).append(",\n");
            }
            if (item.blockId != null) {
                sb.append("      \"blockId\": \"").append(escapeJson(item.blockId)).append("\",\n");
            }
            sb.append("      \"properties\": ").append(mapToJson(item.properties)).append("\n");
            sb.append("    }");
            if (i < items.size() - 1) sb.append(",");
            sb.append("\n");
        }
        sb.append("  ],\n");
        
        // Blocks
        sb.append("  \"blocks\": [\n");
        for (int i = 0; i < blocks.size(); i++) {
            BlockRegistration block = blocks.get(i);
            sb.append("    {\n");
            sb.append("      \"id\": \"").append(escapeJson(block.id)).append("\",\n");
            sb.append("      \"className\": \"").append(escapeJson(block.className)).append("\",\n");
            if (block.hardness != null) {
                sb.append("      \"hardness\": ").append(block.hardness).append(",\n");
            }
            if (block.resistance != null) {
                sb.append("      \"resistance\": ").append(block.resistance).append(",\n");
            }
            if (block.lightLevel != null) {
                sb.append("      \"lightLevel\": ").append(block.lightLevel).append(",\n");
            }
            if (block.material != null) {
                sb.append("      \"material\": \"").append(escapeJson(block.material)).append("\",\n");
            }
            sb.append("      \"properties\": ").append(mapToJson(block.properties)).append("\n");
            sb.append("    }");
            if (i < blocks.size() - 1) sb.append(",");
            sb.append("\n");
        }
        sb.append("  ],\n");
        
        // Errors
        sb.append("  \"errors\": [\n");
        for (int i = 0; i < errors.size(); i++) {
            sb.append("    \"").append(escapeJson(errors.get(i))).append("\"");
            if (i < errors.size() - 1) sb.append(",");
            sb.append("\n");
        }
        sb.append("  ]\n");
        
        sb.append("}");
        return sb.toString();
    }
    
    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
    
    private String mapToJson(Map<String, Object> map) {
        if (map.isEmpty()) return "{}";
        StringBuilder sb = new StringBuilder();
        sb.append("{");
        int i = 0;
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            sb.append("\"").append(escapeJson(entry.getKey())).append("\": ");
            Object value = entry.getValue();
            if (value instanceof String) {
                sb.append("\"").append(escapeJson((String) value)).append("\"");
            } else if (value instanceof Boolean) {
                sb.append(value);
            } else if (value instanceof Number) {
                sb.append(value);
            } else {
                sb.append("\"").append(escapeJson(String.valueOf(value))).append("\"");
            }
            if (i < map.size() - 1) sb.append(", ");
            i++;
        }
        sb.append("}");
        return sb.toString();
    }
}

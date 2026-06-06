package com.delightify.modinspector;

import java.util.List;
import java.util.Map;

/**
 * 将 RegistrationInfo 转换为 JSON 字符串
 */
public class JsonOutput {

    public static String toJson(RegistrationInfo info) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\n");

        // modId
        sb.append("  \"modId\": ").append(quote(info.getModId())).append(",\n");

        // items
        sb.append("  \"items\": [\n");
        List<RegistrationInfo.ItemInfo> items = info.getItems();
        for (int i = 0; i < items.size(); i++) {
            appendItem(sb, items.get(i), 2);
            if (i < items.size() - 1) sb.append(",");
            sb.append("\n");
        }
        sb.append("  ],\n");

        // blocks
        sb.append("  \"blocks\": [\n");
        List<RegistrationInfo.BlockInfo> blocks = info.getBlocks();
        for (int i = 0; i < blocks.size(); i++) {
            appendBlock(sb, blocks.get(i), 2);
            if (i < blocks.size() - 1) sb.append(",");
            sb.append("\n");
        }
        sb.append("  ],\n");

        // multiBlockStructures
        sb.append("  \"multiBlockStructures\": [\n");
        List<MultiBlockStructure> structures = info.getMultiBlockStructures();
        for (int i = 0; i < structures.size(); i++) {
            appendMultiBlockStructure(sb, structures.get(i), 2);
            if (i < structures.size() - 1) sb.append(",");
            sb.append("\n");
        }
        sb.append("  ],\n");

        // errors
        sb.append("  \"errors\": [\n");
        List<String> errors = info.getErrors();
        for (int i = 0; i < errors.size(); i++) {
            sb.append("    ").append(quote(errors.get(i)));
            if (i < errors.size() - 1) sb.append(",");
            sb.append("\n");
        }
        sb.append("  ]\n");

        sb.append("}");
        return sb.toString();
    }

    private static void appendItem(StringBuilder sb, RegistrationInfo.ItemInfo item, int indent) {
        String ind = "  ".repeat(indent);
        sb.append(ind).append("{\n");
        
        sb.append(ind).append("  \"id\": ").append(quote(item.id)).append(",\n");
        sb.append(ind).append("  \"className\": ").append(quote(item.className)).append(",\n");
        
        if (item.maxStackSize != null) {
            sb.append(ind).append("  \"maxStackSize\": ").append(item.maxStackSize).append(",\n");
        }
        if (item.durability != null) {
            sb.append(ind).append("  \"durability\": ").append(item.durability).append(",\n");
        }
        if (item.isBlockItem != null) {
            sb.append(ind).append("  \"isBlockItem\": ").append(item.isBlockItem).append(",\n");
        }
        if (item.blockId != null) {
            sb.append(ind).append("  \"blockId\": ").append(quote(item.blockId)).append(",\n");
        }
        
        sb.append(ind).append("  \"properties\": ");
        appendMap(sb, item.properties, indent + 2);
        sb.append("\n");
        
        sb.append(ind).append("}");
    }

    private static void appendBlock(StringBuilder sb, RegistrationInfo.BlockInfo block, int indent) {
        String ind = "  ".repeat(indent);
        sb.append(ind).append("{\n");
        
        sb.append(ind).append("  \"id\": ").append(quote(block.id)).append(",\n");
        sb.append(ind).append("  \"className\": ").append(quote(block.className)).append(",\n");
        
        if (block.hardness != null) {
            sb.append(ind).append("  \"hardness\": ").append(block.hardness).append(",\n");
        }
        if (block.resistance != null) {
            sb.append(ind).append("  \"resistance\": ").append(block.resistance).append(",\n");
        }
        if (block.lightLevel != null) {
            sb.append(ind).append("  \"lightLevel\": ").append(block.lightLevel).append(",\n");
        }
        if (block.material != null) {
            sb.append(ind).append("  \"material\": ").append(quote(block.material)).append(",\n");
        }
        
        sb.append(ind).append("  \"properties\": ");
        appendMap(sb, block.properties, indent + 2);
        sb.append("\n");
        
        sb.append(ind).append("}");
    }

    private static void appendMultiBlockStructure(StringBuilder sb, MultiBlockStructure structure, int indent) {
        String ind = "  ".repeat(indent);
        sb.append(ind).append("{\n");
        
        sb.append(ind).append("  \"baseId\": ").append(quote(structure.baseId)).append(",\n");
        sb.append(ind).append("  \"modId\": ").append(quote(structure.modId)).append(",\n");
        sb.append(ind).append("  \"confidence\": ").append(structure.confidence).append(",\n");
        sb.append(ind).append("  \"detectionSource\": ").append(quote(structure.detectionSource)).append(",\n");
        
        sb.append(ind).append("  \"parts\": [\n");
        for (int i = 0; i < structure.parts.size(); i++) {
            MultiBlockStructure.Part part = structure.parts.get(i);
            sb.append(ind).append("    {\n");
            sb.append(ind).append("      \"id\": ").append(quote(part.id)).append(",\n");
            sb.append(ind).append("      \"position\": ").append(quote(part.position));
            if (part.variant != null) {
                sb.append(",\n").append(ind).append("      \"variant\": ").append(quote(part.variant));
            }
            if (part.state != null) {
                sb.append(",\n").append(ind).append("      \"state\": ").append(quote(part.state));
            }
            sb.append("\n").append(ind).append("    }");
            if (i < structure.parts.size() - 1) sb.append(",");
            sb.append("\n");
        }
        sb.append(ind).append("  ]\n");
        
        sb.append(ind).append("}");
    }

    private static void appendMap(StringBuilder sb, Map<String, Object> map, int indent) {
        if (map == null || map.isEmpty()) {
            sb.append("{}");
            return;
        }

        String ind = "  ".repeat(indent);
        sb.append("{\n");
        
        int count = 0;
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            sb.append(ind).append("  ").append(quote(entry.getKey())).append(": ");
            
            Object value = entry.getValue();
            if (value == null) {
                sb.append("null");
            } else if (value instanceof String) {
                sb.append(quote((String) value));
            } else if (value instanceof Number) {
                sb.append(value);
            } else if (value instanceof Boolean) {
                sb.append(value);
            } else {
                sb.append(quote(value.toString()));
            }
            
            if (++count < map.size()) sb.append(",");
            sb.append("\n");
        }
        
        sb.append(ind).append("}");
    }

    private static String quote(String s) {
        if (s == null) return "null";
        StringBuilder sb = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < ' ') {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        sb.append('"');
        return sb.toString();
    }
}

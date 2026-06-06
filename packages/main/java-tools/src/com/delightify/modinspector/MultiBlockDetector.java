package com.delightify.modinspector;

import java.util.*;
import java.util.regex.*;

/**
 * 多方块结构检测器
 * 
 * 基于物品/方块 ID 的命名模式识别多方块结构
 * 例如：
 * - lemon_tree_upper + lemon_tree_lower = lemon_tree
 * - apple_pie + apple_pie_slice = apple_pie
 * - tomato_budding + tomato_mature = tomato
 */
public class MultiBlockDetector {

    // 多方块后缀模式
    private static final List<Pattern> PART_SUFFIXES = Arrays.asList(
        // 位置后缀
        Pattern.compile("^(.+)_(upper|top|upper_part)$"),
        Pattern.compile("^(.+)_(lower|bottom|lower_part)$"),
        Pattern.compile("^(.+)_(middle|mid|center)$"),
        
        // 变体后缀
        Pattern.compile("^(.+)_(small|medium|large|tiny)$"),
        
        // 状态后缀
        Pattern.compile("^(.+)_(fruits|flowering|mature|young|budding|sprouting)$"),
        Pattern.compile("^(.+)_(unripe|ripe|rotten|fresh)$"),
        
        // 壁/挂/立后缀
        Pattern.compile("^(.+)_(wall|hanging|standing)$"),
        Pattern.compile("^(.+)_(wall_|hanging_)(.+)$"),
        
        // 切片/部分
        Pattern.compile("^(.+)_(slice|piece|quarter|eighth|half|segment)$"),
        Pattern.compile("^(.+)_(slices|pieces|servings)$"),
        
        // Canvas 标志（FarmersDelight 特定）
        Pattern.compile("^(.+)_(canvas_sign|wall_canvas_sign|hanging_canvas_sign|wall_hanging_canvas_sign)$"),
        Pattern.compile("^(.+)_(canvas_sign|hanging_canvas_sign)_(white|orange|magenta|light_blue|yellow|lime|pink|gray|light_gray|cyan|purple|blue|brown|green|red|black)$")
    );

    // 已知的多方块结构基础 ID
    private Set<String> knownMultiBlockBases = new HashSet<>();

    /**
     * 分析物品列表，检测多方块结构
     */
    public List<MultiBlockStructure> detectStructures(List<RegistrationInfo.ItemInfo> items,
                                                      List<RegistrationInfo.BlockInfo> blocks) {
        List<MultiBlockStructure> structures = new ArrayList<>();
        
        // 合并所有 ID
        Set<String> allIds = new HashSet<>();
        for (RegistrationInfo.ItemInfo item : items) {
            allIds.add(item.id);
        }
        for (RegistrationInfo.BlockInfo block : blocks) {
            allIds.add(block.id);
        }
        
        // 按基础 ID 分组
        Map<String, List<String>> groups = new HashMap<>();
        
        for (String id : allIds) {
            String baseName = extractBaseName(id);
            if (baseName != null) {
                groups.computeIfAbsent(baseName, k -> new ArrayList<>()).add(id);
            }
        }
        
        // 创建多方块结构
        for (Map.Entry<String, List<String>> entry : groups.entrySet()) {
            String baseId = entry.getKey();
            List<String> parts = entry.getValue();
            
            if (parts.size() >= 2) {
                MultiBlockStructure structure = createStructure(baseId, parts);
                if (structure != null) {
                    structures.add(structure);
                    System.err.println("[MultiBlockDetector] Found structure: " + baseId + 
                                     " with " + parts.size() + " parts");
                }
            }
        }
        
        return structures;
    }

    /**
     * 从 ID 提取基础名称
     */
    private String extractBaseName(String id) {
        // 提取路径部分
        String path = id;
        if (id.contains(":")) {
            path = id.substring(id.indexOf(':') + 1);
        }
        
        // 检查各种后缀模式
        for (Pattern pattern : PART_SUFFIXES) {
            Matcher matcher = pattern.matcher(path);
            if (matcher.matches()) {
                return id.substring(0, id.lastIndexOf(':') + 1) + matcher.group(1);
            }
        }
        
        return null;
    }

    /**
     * 创建多方块结构
     */
    private MultiBlockStructure createStructure(String baseId, List<String> partIds) {
        MultiBlockStructure structure = new MultiBlockStructure();
        structure.baseId = baseId;
        structure.modId = baseId.split(":")[0];
        structure.parts = new ArrayList<>();
        
        for (String partId : partIds) {
            MultiBlockStructure.Part part = new MultiBlockStructure.Part();
            part.id = partId;
            part.position = inferPosition(partId);
            part.variant = inferVariant(partId);
            part.state = inferState(partId);
            structure.parts.add(part);
        }
        
        // 根据部分数量计算可信度
        structure.confidence = Math.min(1.0, 0.5 + (partIds.size() - 1) * 0.2);
        structure.detectionSource = "heuristic";
        
        return structure;
    }

    /**
     * 推断部位位置
     */
    private String inferPosition(String id) {
        String path = id.toLowerCase();
        
        if (path.contains("upper") || path.contains("top")) return "top";
        if (path.contains("lower") || path.contains("bottom")) return "bottom";
        if (path.contains("middle") || path.contains("mid")) return "middle";
        if (path.contains("center")) return "center";
        if (path.contains("wall")) return "wall";
        if (path.contains("hanging")) return "hanging";
        if (path.contains("standing")) return "standing";
        
        return "single";
    }

    /**
     * 推断变体
     */
    private String inferVariant(String id) {
        String path = id.toLowerCase();
        
        if (path.contains("small")) return "small";
        if (path.contains("medium")) return "medium";
        if (path.contains("large")) return "large";
        if (path.contains("tiny")) return "tiny";
        
        return null;
    }

    /**
     * 推断状态
     */
    private String inferState(String id) {
        String path = id.toLowerCase();
        
        if (path.contains("fruits")) return "fruits";
        if (path.contains("flowering")) return "flowering";
        if (path.contains("mature")) return "mature";
        if (path.contains("young")) return "young";
        if (path.contains("budding")) return "budding";
        if (path.contains("sprouting")) return "sprouting";
        if (path.contains("unripe")) return "unripe";
        if (path.contains("ripe")) return "ripe";
        if (path.contains("rotten")) return "rotten";
        if (path.contains("fresh")) return "fresh";
        
        return null;
    }
}

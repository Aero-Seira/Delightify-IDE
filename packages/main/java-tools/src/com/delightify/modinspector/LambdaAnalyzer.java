package com.delightify.modinspector;

import org.objectweb.asm.*;

import java.util.*;

/**
 * Lambda 方法分析器 - 提取 Item/Block 构造和属性配置
 * 
 * 分析目标：
 * () -> new Item(new Item.Properties().stacksTo(64).durability(256))
 */
public class LambdaAnalyzer extends MethodVisitor {
    private final ItemProperties properties = new ItemProperties();
    private final BlockProperties blockProperties = new BlockProperties();
    private String constructedClass = null;
    private boolean isItem = false;
    private boolean isBlock = false;

    public LambdaAnalyzer() {
        super(Opcodes.ASM9);
    }

    @Override
    public void visitTypeInsn(int opcode, String type) {
        if (opcode == Opcodes.NEW) {
            String className = type.replace('/', '.');
            constructedClass = className;
            
            if (className.contains("Item") && !className.contains("BlockItem")) {
                isItem = true;
            } else if (className.contains("BlockItem")) {
                isItem = true;
                properties.isBlockItem = true;
            } else if (className.contains("Block")) {
                isBlock = true;
            }
            
            System.err.println("[LambdaAnalyzer] NEW " + className);
        }
    }

    @Override
    public void visitMethodInsn(int opcode, String owner, String name, 
                                String descriptor, boolean isInterface) {
        // 分析 Item.Properties 链式调用
        if (owner.contains("Item$Properties") || owner.contains("ItemProperties")) {
            analyzeItemProperty(name, descriptor);
        }
        
        // 分析 Block.Properties 链式调用
        if (owner.contains("Block$Properties") || owner.contains("BlockBehaviour$Properties")) {
            analyzeBlockProperty(name, descriptor);
        }
        
        // 分析构造调用
        if (name.equals("<init>")) {
            if (descriptor.contains("Item$Properties") || descriptor.contains("Properties")) {
                System.err.println("[LambdaAnalyzer] Constructor with Properties");
            }
        }
    }

    /**
     * 分析 Item.Properties 方法调用
     */
    private void analyzeItemProperty(String methodName, String descriptor) {
        System.err.println("[LambdaAnalyzer] Item.Properties." + methodName + "()");
        
        switch (methodName) {
            case "stacksTo":
                properties.maxStackSize = extractIntArg(descriptor);
                break;
            case "durability":
                properties.durability = extractIntArg(descriptor);
                break;
            case "fireResistant":
                properties.isFireResistant = true;
                break;
            case "rarity":
                properties.rarity = extractEnumArg(descriptor);
                break;
            case "food":
                properties.isFood = true;
                break;
            case "craftRemainder":
                properties.hasCraftRemainder = true;
                break;
        }
    }

    /**
     * 分析 Block.Properties 方法调用
     */
    private void analyzeBlockProperty(String methodName, String descriptor) {
        System.err.println("[LambdaAnalyzer] Block.Properties." + methodName + "()");
        
        switch (methodName) {
            case "strength":
                float[] strengths = extractFloatArgs(descriptor);
                if (strengths.length >= 1) blockProperties.hardness = strengths[0];
                if (strengths.length >= 2) blockProperties.resistance = strengths[1];
                break;
            case "lightLevel":
                blockProperties.lightLevel = extractIntArg(descriptor);
                break;
            case "friction":
                blockProperties.friction = extractFloatArg(descriptor);
                break;
            case "speedFactor":
                blockProperties.speedFactor = extractFloatArg(descriptor);
                break;
            case "jumpFactor":
                blockProperties.jumpFactor = extractFloatArg(descriptor);
                break;
            case "noOcclusion":
                blockProperties.noOcclusion = true;
                break;
            case "noCollission":
                blockProperties.noCollision = true;
                break;
        }
    }

    // ========== 参数提取辅助方法 ==========

    private Integer extractIntArg(String descriptor) {
        // 从方法描述符提取整数参数 (I) 或 (IF) 等
        try {
            // 简化实现：假设描述符格式为 (I)... 或 (II)...
            if (descriptor.contains("(I)")) {
                return null; // 需要在运行时知道具体值
            }
        } catch (Exception e) {
            // 忽略
        }
        return null;
    }

    private Float extractFloatArg(String descriptor) {
        return null; // 运行时才能确定
    }

    private float[] extractFloatArgs(String descriptor) {
        return new float[0];
    }

    private String extractEnumArg(String descriptor) {
        return null;
    }

    // ========== 结果获取 ==========

    public ItemProperties getItemProperties() {
        return properties;
    }

    public BlockProperties getBlockProperties() {
        return blockProperties;
    }

    public String getConstructedClass() {
        return constructedClass;
    }

    public boolean isItem() {
        return isItem;
    }

    public boolean isBlock() {
        return isBlock;
    }

    // ========== 属性类 ==========

    public static class ItemProperties {
        public Integer maxStackSize;
        public Integer durability;
        public Boolean isFireResistant;
        public String rarity;
        public Boolean isFood;
        public Boolean hasCraftRemainder;
        public Boolean isBlockItem;
    }

    public static class BlockProperties {
        public Float hardness;
        public Float resistance;
        public Integer lightLevel;
        public Float friction;
        public Float speedFactor;
        public Float jumpFactor;
        public Boolean noOcclusion;
        public Boolean noCollision;
    }
}

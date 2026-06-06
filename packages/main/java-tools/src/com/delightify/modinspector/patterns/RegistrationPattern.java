package com.delightify.modinspector.patterns;

import com.google.gson.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;

/**
 * 注册模式定义
 * 从 JSON 配置加载，描述特定版本/加载器的注册方式
 */
public class RegistrationPattern {
    private String id;
    private String name;
    private String description;
    private PatternAppliesTo appliesTo;
    private int priority;
    private boolean enabled;
    private BytecodeSignatures bytecodeSignatures;
    private ExtractionRules extractionRules;
    private List<String> examples;
    
    // 运行时匹配分数
    private transient double matchScore = 0;
    
    public static RegistrationPattern loadFromJson(String jsonContent) {
        Gson gson = new Gson();
        return gson.fromJson(jsonContent, RegistrationPattern.class);
    }
    
    public static List<RegistrationPattern> loadAllFromDirectory(String dirPath) throws IOException {
        List<RegistrationPattern> patterns = new ArrayList<>();
        Path path = Paths.get(dirPath);
        
        if (!Files.exists(path)) {
            System.err.println("[RegistrationPattern] Pattern directory not found: " + dirPath);
            return patterns;
        }
        
        Files.list(path)
            .filter(p -> p.toString().endsWith(".json"))
            .forEach(p -> {
                try {
                    String content = Files.readString(p);
                    RegistrationPattern pattern = loadFromJson(content);
                    if (pattern.isEnabled()) {
                        patterns.add(pattern);
                        System.err.println("[RegistrationPattern] Loaded: " + pattern.getId());
                    }
                } catch (Exception e) {
                    System.err.println("[RegistrationPattern] Failed to load " + p + ": " + e.getMessage());
                }
            });
        
        // 按优先级排序
        patterns.sort((a, b) -> Integer.compare(b.getPriority(), a.getPriority()));
        
        return patterns;
    }
    
    /**
     * 计算给定字节码样本与当前模式的匹配分数
     */
    public double calculateMatchScore(BytecodeSample sample) {
        double score = 0;
        
        if (bytecodeSignatures == null) return 0;
        
        // 检查字段类型
        if (bytecodeSignatures.fieldTypes != null) {
            for (FieldTypeSignature sig : bytecodeSignatures.fieldTypes) {
                if (sample.containsFieldType(sig.type)) {
                    score += sig.score;
                }
            }
        }
        
        // 检查方法调用
        if (bytecodeSignatures.methodCalls != null) {
            for (MethodCallSignature sig : bytecodeSignatures.methodCalls) {
                if (sample.containsMethodCall(sig.owner, sig.name)) {
                    score += sig.score;
                }
            }
        }
        
        // 检查字符串常量
        if (bytecodeSignatures.stringConstants != null) {
            for (String constant : bytecodeSignatures.stringConstants) {
                if (sample.containsString(constant)) {
                    score += 5;
                }
            }
        }
        
        this.matchScore = score;
        return score;
    }
    
    /**
     * 判断此模式是否可能适用于给定的模组加载器和版本
     */
    public boolean isApplicable(String loader, String mcVersion) {
        if (appliesTo == null) return true;
        
        boolean loaderMatches = appliesTo.loaders == null || 
            appliesTo.loaders.stream().anyMatch(l -> l.equalsIgnoreCase(loader));
        
        boolean versionMatches = appliesTo.minecraftVersions == null ||
            appliesTo.minecraftVersions.stream().anyMatch(v -> mcVersion.startsWith(v));
        
        return loaderMatches && versionMatches;
    }
    
    // Getters
    public String getId() { return id; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public int getPriority() { return priority; }
    public boolean isEnabled() { return enabled; }
    public double getMatchScore() { return matchScore; }
    public BytecodeSignatures getBytecodeSignatures() { return bytecodeSignatures; }
    public ExtractionRules getExtractionRules() { return extractionRules; }
    
    // Inner classes for JSON structure
    
    static class PatternAppliesTo {
        List<String> loaders;
        List<String> minecraftVersions;
    }
    
    static class BytecodeSignatures {
        List<FieldTypeSignature> fieldTypes;
        List<MethodCallSignature> methodCalls;
        List<String> stringConstants;
        List<String> imports;
        List<EventSignature> events;
    }
    
    static class FieldTypeSignature {
        String type;
        String genericTypeRegex;
        String registryType;
        List<String> modifiers;
        int score;
    }
    
    static class MethodCallSignature {
        String owner;
        String name;
        String descriptor;
        int score;
    }
    
    static class EventSignature {
        String className;
        String handlerAnnotation;
        int score;
    }
    
    static class ExtractionRules {
        Map<String, Object> registryFields;
        Map<String, Object> registerCalls;
        List<Map<String, Object>> helperMethods;
        Map<String, Object> eventRegistration;
        Map<String, Object> staticRegistration;
        Map<String, Object> setRegistryName;
        Map<String, Object> staticFields;
    }
    
    /**
     * 字节码样本 - 用于模式匹配
     */
    public static class BytecodeSample {
        private final Set<String> fieldTypes = new HashSet<>();
        private final Set<String> methodCalls = new HashSet<>();
        private final Set<String> strings = new HashSet<>();
        
        public void addFieldType(String type) { fieldTypes.add(type); }
        public void addMethodCall(String owner, String name) { 
            methodCalls.add(owner + "." + name); 
        }
        public void addString(String s) { strings.add(s); }
        
        public boolean containsFieldType(String type) { return fieldTypes.contains(type); }
        public boolean containsMethodCall(String owner, String name) { 
            return methodCalls.contains(owner + "." + name); 
        }
        public boolean containsString(String s) { return strings.contains(s); }
    }
}

package com.delightify.modinspector.patterns;

import org.objectweb.asm.*;
import java.io.*;
import java.util.*;
import java.util.jar.*;

/**
 * 模式匹配器
 * 
 * 1. 扫描 JAR 文件收集字节码特征
 * 2. 与所有注册模式进行匹配
 * 3. 返回最佳匹配的模式列表
 */
public class PatternMatcher {
    private final List<RegistrationPattern> patterns;
    
    public PatternMatcher(List<RegistrationPattern> patterns) {
        this.patterns = patterns;
    }
    
    /**
     * 从目录加载所有模式创建匹配器
     */
    public static PatternMatcher loadFromDirectory(String patternsDir) throws IOException {
        List<RegistrationPattern> patterns = RegistrationPattern.loadAllFromDirectory(patternsDir);
        return new PatternMatcher(patterns);
    }
    
    /**
     * 分析 JAR 文件，返回最佳匹配的模式
     */
    public List<RegistrationPattern> findBestMatches(String jarPath, String detectedLoader, String mcVersion) {
        // 1. 收集字节码样本
        RegistrationPattern.BytecodeSample sample = collectSample(jarPath);
        
        // 2. 计算每个模式的匹配分数
        List<ScoredPattern> scored = new ArrayList<>();
        
        for (RegistrationPattern pattern : patterns) {
            // 检查适用性（加载器和版本）
            if (!pattern.isApplicable(detectedLoader, mcVersion)) {
                continue;
            }
            
            double score = pattern.calculateMatchScore(sample);
            if (score > 0) {
                scored.add(new ScoredPattern(pattern, score));
            }
        }
        
        // 3. 按分数排序
        scored.sort((a, b) -> Double.compare(b.score, a.score));
        
        // 4. 返回前 N 个模式（或分数高于阈值的模式）
        List<RegistrationPattern> results = new ArrayList<>();
        for (ScoredPattern sp : scored) {
            if (sp.score >= 20) { // 最低阈值
                results.add(sp.pattern);
                System.err.println("[PatternMatcher] Match: " + sp.pattern.getId() + " score=" + sp.score);
            }
        }
        
        return results;
    }
    
    /**
     * 快速检测 JAR 使用的注册模式（不提取完整信息）
     */
    public PatternDetectionResult detectPattern(String jarPath) {
        PatternDetectionResult result = new PatternDetectionResult();
        
        try (JarFile jar = new JarFile(jarPath)) {
            int classCount = 0;
            Map<String, Integer> patternVotes = new HashMap<>();
            
            for (JarEntry entry : jar.stream().toList()) {
                if (!entry.getName().endsWith(".class")) continue;
                
                try (InputStream is = jar.getInputStream(entry)) {
                    byte[] bytes = is.readAllBytes();
                    
                    // 快速扫描字符串常量
                    String sample = new String(bytes, 0, Math.min(bytes.length, 5000));
                    
                    // 投票给可能匹配的模式
                    for (RegistrationPattern pattern : patterns) {
                        int votes = 0;
                        
                        if (pattern.getBytecodeSignatures() != null && 
                            pattern.getBytecodeSignatures().stringConstants != null) {
                            for (String constant : pattern.getBytecodeSignatures().stringConstants) {
                                if (sample.contains(constant)) {
                                    votes++;
                                }
                            }
                        }
                        
                        if (votes > 0) {
                            patternVotes.merge(pattern.getId(), votes, Integer::sum);
                        }
                    }
                    
                    classCount++;
                    if (classCount > 100) break; // 采样前100个类
                }
            }
            
            // 找出最高票的模式
            String bestPattern = patternVotes.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(null);
            
            result.detectedPatternId = bestPattern;
            result.confidence = bestPattern != null ? patternVotes.get(bestPattern) : 0;
            result.allVotes = patternVotes;
            
        } catch (Exception e) {
            System.err.println("[PatternMatcher] Detection failed: " + e.getMessage());
        }
        
        return result;
    }
    
    /**
     * 收集 JAR 文件的字节码样本
     */
    private RegistrationPattern.BytecodeSample collectSample(String jarPath) {
        RegistrationPattern.BytecodeSample sample = new RegistrationPattern.BytecodeSample();
        
        try (JarFile jar = new JarFile(jarPath)) {
            for (JarEntry entry : jar.stream().toList()) {
                if (!entry.getName().endsWith(".class")) continue;
                
                try (InputStream is = jar.getInputStream(entry)) {
                    byte[] bytes = is.readAllBytes();
                    
                    // 快速字符串扫描
                    String strSample = new String(bytes, 0, Math.min(bytes.length, 8000));
                    
                    // 提取可能的类名和方法调用
                    extractFeatures(strSample, sample);
                    
                } catch (Exception e) {
                    // 忽略单个类的错误
                }
            }
        } catch (Exception e) {
            System.err.println("[PatternMatcher] Failed to collect sample: " + e.getMessage());
        }
        
        return sample;
    }
    
    /**
     * 从字节码字符串中提取特征
     */
    private void extractFeatures(String sample, RegistrationPattern.BytecodeSample target) {
        // 查找字段类型
        if (sample.contains("DeferredRegister")) {
            target.addFieldType("DeferredRegister");
        }
        if (sample.contains("RegistryObject")) {
            target.addFieldType("RegistryObject");
        }
        
        // 查找方法调用
        if (sample.contains("DeferredRegister.register")) {
            target.addMethodCall("DeferredRegister", "register");
        }
        if (sample.contains("Registry.register")) {
            target.addMethodCall("Registry", "register");
        }
        if (sample.contains("GameRegistry.register")) {
            target.addMethodCall("GameRegistry", "register");
        }
        
        // 查找其他特征字符串
        target.addString("DeferredRegister");
        target.addString("RegistryObject");
        target.addString("Registry");
        target.addString("GameRegistry");
    }
    
    /**
     * 获取所有可用的模式
     */
    public List<RegistrationPattern> getAllPatterns() {
        return new ArrayList<>(patterns);
    }
    
    // Inner classes
    
    private static class ScoredPattern {
        final RegistrationPattern pattern;
        final double score;
        
        ScoredPattern(RegistrationPattern pattern, double score) {
            this.pattern = pattern;
            this.score = score;
        }
    }
    
    public static class PatternDetectionResult {
        public String detectedPatternId;
        public int confidence;
        public Map<String, Integer> allVotes = new HashMap<>();
        
        @Override
        public String toString() {
            return "PatternDetectionResult{pattern='" + detectedPatternId + "', confidence=" + confidence + "}";
        }
    }
}

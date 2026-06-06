package com.delightify.modinspector;

import com.delightify.modinspector.fabric.FabricClassVisitor;
import com.delightify.modinspector.forge112.Forge112ClassVisitor;
import com.delightify.modinspector.patterns.PatternMatcher;
import com.delightify.modinspector.patterns.RegistrationPattern;
import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassVisitor;

import java.io.*;
import java.util.*;
import java.util.jar.*;

/**
 * JAR 文件分析器 - 使用 ASM 提取注册信息
 */
public class JarAnalyzer {
    private String modId;
    private String detectedLoader;
    private String detectedVersion;
    private PatternMatcher patternMatcher;
    private boolean verbose = false;

    public JarAnalyzer(String modId) {
        this.modId = modId;
        
        try {
            String patternsDir = System.getProperty("user.dir") + "/config/registration_patterns";
            this.patternMatcher = PatternMatcher.loadFromDirectory(patternsDir);
            System.err.println("[JarAnalyzer] Loaded " + patternMatcher.getAllPatterns().size() + " patterns");
        } catch (Exception e) {
            System.err.println("[JarAnalyzer] Failed to load patterns: " + e.getMessage());
            this.patternMatcher = null;
        }
    }

    public void setVerbose(boolean verbose) {
        this.verbose = verbose;
    }

    public RegistrationInfo analyze(String jarPath) throws IOException {
        RegistrationInfo info = new RegistrationInfo();
        info.setModId(modId);

        detectModInfo(jarPath);
        
        List<RegistrationPattern> patterns = null;
        if (patternMatcher != null) {
            patterns = patternMatcher.findBestMatches(jarPath, detectedLoader, detectedVersion);
            System.err.println("[JarAnalyzer] Detected patterns: " + 
                patterns.stream().map(RegistrationPattern::getId).toList());
        }

        try (JarFile jar = new JarFile(jarPath)) {
            int classCount = 0;
            int analyzedCount = 0;

            for (JarEntry entry : jar.stream().toList()) {
                if (entry.getName().endsWith(".class")) {
                    classCount++;
                    if (analyzeClass(jar, entry, info, patterns)) {
                        analyzedCount++;
                    }
                }
            }

            System.err.println("[JarAnalyzer] Total classes: " + classCount + 
                             ", Analyzed: " + analyzedCount);
            System.err.println("[JarAnalyzer] Found " + info.getItems().size() + " items, " + 
                             info.getBlocks().size() + " blocks");
            
            MultiBlockDetector detector = new MultiBlockDetector();
            List<MultiBlockStructure> structures = detector.detectStructures(
                info.getItems(), info.getBlocks());
            
            for (MultiBlockStructure structure : structures) {
                info.addMultiBlockStructure(structure);
            }
            
            System.err.println("[JarAnalyzer] Found " + structures.size() + " multi-block structures");
        }

        return info;
    }

    private void detectModInfo(String jarPath) {
        try (JarFile jar = new JarFile(jarPath)) {
            JarEntry modsToml = jar.getJarEntry("META-INF/mods.toml");
            if (modsToml != null) {
                String content = new String(jar.getInputStream(modsToml).readAllBytes());
                detectedLoader = "forge";
                var matcher = java.util.regex.Pattern.compile(
                    "loaderVersion\\s*=\\s*\"([^\"]+)\"").matcher(content);
                if (matcher.find()) {
                    String version = matcher.group(1);
                    if (version.contains("41") || version.contains("42") || version.contains("43")) {
                        detectedVersion = "1.19";
                    } else if (version.contains("40")) {
                        detectedVersion = "1.18";
                    } else if (version.contains("36") || version.contains("37")) {
                        detectedVersion = "1.16";
                    }
                }
                System.err.println("[JarAnalyzer] Detected Forge mod, version: " + detectedVersion);
                return;
            }
            
            JarEntry fabricModJson = jar.getJarEntry("fabric.mod.json");
            if (fabricModJson != null) {
                detectedLoader = "fabric";
                String content = new String(jar.getInputStream(fabricModJson).readAllBytes());
                var matcher = java.util.regex.Pattern.compile(
                    "minecraft\\s*:\s*\"([^\"]+)\"").matcher(content);
                if (matcher.find()) {
                    detectedVersion = matcher.group(1).replace(">=", "").replace("~", "");
                }
                System.err.println("[JarAnalyzer] Detected Fabric mod, version: " + detectedVersion);
                return;
            }
            
            JarEntry mcmodInfo = jar.getJarEntry("mcmod.info");
            if (mcmodInfo != null) {
                detectedLoader = "forge";
                detectedVersion = "1.12";
                System.err.println("[JarAnalyzer] Detected Forge 1.12 mod (mcmod.info)");
                return;
            }
            
        } catch (Exception e) {
            System.err.println("[JarAnalyzer] Failed to detect mod info: " + e.getMessage());
        }
        
        if (detectedLoader == null) {
            detectedLoader = "forge";
            detectedVersion = "1.20";
            System.err.println("[JarAnalyzer] Could not detect loader, assuming Forge 1.20");
        }
    }

    private boolean analyzeClass(JarFile jar, JarEntry entry, RegistrationInfo info,
                                  List<RegistrationPattern> patterns) {
        String className = entry.getName();
        
        try (InputStream is = jar.getInputStream(entry)) {
            byte[] classBytes = is.readAllBytes();
            
            if (!containsRegistryReferences(classBytes)) {
                return false;
            }

            if (verbose || className.contains("ModItems") || className.contains("Registry")) {
                System.err.println("[JarAnalyzer] Analyzing: " + className);
            }

            ClassReader reader = new ClassReader(classBytes);
            ClassVisitor visitor = selectVisitor(info, classBytes);
            
            reader.accept(visitor, ClassReader.SKIP_DEBUG | ClassReader.SKIP_FRAMES);

            if (visitor instanceof RegistryClassVisitor) {
                return ((RegistryClassVisitor) visitor).hasRegistryContent();
            } else if (visitor instanceof FabricClassVisitor) {
                return ((FabricClassVisitor) visitor).hasRegistryContent();
            } else if (visitor instanceof Forge112ClassVisitor) {
                return ((Forge112ClassVisitor) visitor).hasRegistryContent();
            }
            
            return false;
            
        } catch (Exception e) {
            System.err.println("[JarAnalyzer] Failed to analyze " + className + ": " + e.getMessage());
            return false;
        }
    }

    private ClassVisitor selectVisitor(RegistrationInfo info, byte[] classBytes) {
        String sample = new String(classBytes, 0, Math.min(classBytes.length, 8000));
        
        // 根据检测到的加载器和字节码特征选择分析器
        if ("fabric".equals(detectedLoader)) {
            return new FabricClassVisitor(info, modId);
        }
        
        if ("1.12".equals(detectedVersion) || sample.contains("GameRegistry")) {
            return new Forge112ClassVisitor(info, modId);
        }
        
        // 默认使用 Forge 1.16+ (DeferredRegister) 分析器
        return new RegistryClassVisitor(info, modId);
    }

    private boolean containsRegistryReferences(byte[] bytes) {
        int limit = Math.min(bytes.length, 10000);
        String sample = new String(bytes, 0, limit);

        return sample.contains("DeferredRegister") ||
               sample.contains("RegistryObject") ||
               sample.contains("ForgeRegistries") ||
               sample.contains("GameRegistry") ||
               sample.contains("net/minecraft/core/Registry") ||
               sample.contains("register(");
    }
}

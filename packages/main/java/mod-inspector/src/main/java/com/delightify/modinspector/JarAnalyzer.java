package com.delightify.modinspector;

import org.objectweb.asm.*;

import java.io.*;
import java.nio.file.*;
import java.util.jar.*;

/**
 * JAR/目录分析器
 * 
 * 遍历 JAR 或目录中的所有 class 文件，使用 ASM 分析注册信息
 */
public class JarAnalyzer {
    
    private String modId;
    
    public JarAnalyzer(String modId) {
        this.modId = modId;
    }
    
    /**
     * 分析 JAR 文件或目录
     * 
     * @param path JAR 文件路径或目录路径
     * @return 注册信息
     */
    public RegistrationInfo analyze(String path) throws IOException {
        File file = new File(path);
        if (!file.exists()) {
            throw new IOException("Path not found: " + path);
        }
        
        if (file.isDirectory()) {
            return analyzeDirectory(file);
        } else {
            return analyzeJar(file);
        }
    }
    
    /**
     * 分析 JAR 文件
     */
    private RegistrationInfo analyzeJar(File jarFile) throws IOException {
        RegistrationInfo info = new RegistrationInfo();
        info.setModId(modId);
        
        try (JarFile jar = new JarFile(jarFile)) {
            int classCount = 0;
            int analyzedCount = 0;
            
            for (JarEntry entry : jar.stream().toList()) {
                if (entry.getName().endsWith(".class")) {
                    classCount++;
                    
                    try {
                        if (analyzeClassFromJar(jar, entry, info)) {
                            analyzedCount++;
                        }
                    } catch (Exception e) {
                        info.getErrors().add("Failed to analyze " + entry.getName() + ": " + e.getMessage());
                    }
                }
            }
            
            System.err.println("[JarAnalyzer] Total classes: " + classCount);
            System.err.println("[JarAnalyzer] Analyzed: " + analyzedCount);
        }
        
        return info;
    }
    
    /**
     * 分析目录
     */
    private RegistrationInfo analyzeDirectory(File dir) throws IOException {
        RegistrationInfo info = new RegistrationInfo();
        info.setModId(modId);
        
        int classCount = 0;
        int analyzedCount = 0;
        
        // 递归遍历目录
        Files.walk(dir.toPath())
            .filter(Files::isRegularFile)
            .filter(p -> p.toString().endsWith(".class"))
            .forEach(path -> {
                try {
                    if (analyzeClassFromFile(path.toFile(), info)) {
                        // 计数器需要在原子操作中更新，这里简化处理
                    }
                } catch (Exception e) {
                    info.getErrors().add("Failed to analyze " + path + ": " + e.getMessage());
                }
            });
        
        // 重新遍历计数
        classCount = (int) Files.walk(dir.toPath())
            .filter(Files::isRegularFile)
            .filter(p -> p.toString().endsWith(".class"))
            .count();
        
        System.err.println("[JarAnalyzer] Total classes: " + classCount);
        
        return info;
    }
    
    /**
     * 分析 JAR 中的 class 文件
     */
    private boolean analyzeClassFromJar(JarFile jar, JarEntry entry, RegistrationInfo info) throws IOException {
        byte[] classBytes;
        
        try (InputStream is = jar.getInputStream(entry)) {
            classBytes = is.readAllBytes();
        }
        
        return analyzeClassBytes(entry.getName(), classBytes, info);
    }
    
    /**
     * 分析文件系统中的 class 文件
     */
    private boolean analyzeClassFromFile(File file, RegistrationInfo info) throws IOException {
        byte[] classBytes = Files.readAllBytes(file.toPath());
        return analyzeClassBytes(file.getPath(), classBytes, info);
    }
    
    /**
     * 分析 class 字节码
     */
    private boolean analyzeClassBytes(String className, byte[] classBytes, RegistrationInfo info) {
        // 快速检查：是否包含注册相关类引用
        boolean hasRegistryRefs = containsRegistryReferences(classBytes);
        
        if (!hasRegistryRefs) {
            return false;
        }
        
        // 使用 ASM 分析
        ClassReader reader = new ClassReader(classBytes);
        RegistryClassVisitor visitor = new RegistryClassVisitor(info, modId);
        
        try {
            reader.accept(visitor, ClassReader.SKIP_DEBUG | ClassReader.SKIP_FRAMES);
        } catch (Exception e) {
            System.err.println("[JarAnalyzer] Error analyzing " + className + ": " + e.getMessage());
            return false;
        }
        
        return true;
    }
    
    /**
     * 快速检查是否包含注册相关引用
     * 
     * 这是一个优化，避免分析所有 class 文件
     */
    private boolean containsRegistryReferences(byte[] bytes) {
        // 检查字节码中是否包含 DeferredRegister 或 Registry 引用
        // 这是一个简单的启发式检查
        String sample = new String(bytes, 0, Math.min(bytes.length, 10000));
        
        return sample.contains("DeferredRegister") ||
               sample.contains("RegistryObject") ||
               sample.contains("Registry.register") ||
               sample.contains("ForgeRegistries") ||
               sample.contains("BuiltInRegistries") ||
               sample.contains("net/minecraft/core/Registry");
    }
}

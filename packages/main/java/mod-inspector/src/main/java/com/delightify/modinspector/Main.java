package com.delightify.modinspector;

import java.io.*;

/**
 * Mod Inspector 入口类
 * 
 * 用法: java -cp .:libs/* com.delightify.modinspector.Main <jarPath> <modId>
 */
public class Main {
    
    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("Usage: java -cp .:libs/* com.delightify.modinspector.Main <jarPath> [modId]");
            System.exit(1);
        }
        
        String jarPath = args[0];
        String modId = args.length > 1 ? args[1] : "unknown";
        
        try {
            // 从 JAR 文件名推断 modId（如果未提供）
            if ("unknown".equals(modId)) {
                modId = inferModIdFromJarName(jarPath);
            }
            
            JarAnalyzer analyzer = new JarAnalyzer(modId);
            RegistrationInfo info = analyzer.analyze(jarPath);
            
            // 输出 JSON 到 stdout
            System.out.println(info.toJson());
            
        } catch (Exception e) {
            // 输出错误 JSON
            System.err.println("{\"error\": \"" + escapeJson(e.getMessage()) + "\"}");
            System.exit(1);
        }
    }
    
    /**
     * 从 JAR 文件名推断 modId
     */
    private static String inferModIdFromJarName(String jarPath) {
        String fileName = new File(jarPath).getName();
        
        // 移除 .jar 后缀
        if (fileName.endsWith(".jar")) {
            fileName = fileName.substring(0, fileName.length() - 4);
        }
        
        // 尝试匹配常见模式：modid-1.20.1-1.0.0.jar
        String[] parts = fileName.split("-");
        if (parts.length > 0) {
            return parts[0].toLowerCase();
        }
        
        return fileName.toLowerCase().replaceAll("[^a-z0-9_]", "_");
    }
    
    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }
}

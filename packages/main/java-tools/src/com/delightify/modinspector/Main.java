package com.delightify.modinspector;

import java.io.IOException;

/**
 * 主入口 - 命令行工具
 * 
 * 用法: java -cp ... com.delightify.modinspector.Main <jarPath> [modId]
 */
public class Main {
    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("Usage: java -cp ... com.delightify.modinspector.Main <jarPath> [modId]");
            System.exit(1);
        }

        String jarPath = args[0];
        String modId = args.length > 1 ? args[1] : "unknown";

        System.err.println("[Main] Analyzing: " + jarPath);
        System.err.println("[Main] Mod ID: " + modId);

        try {
            JarAnalyzer analyzer = new JarAnalyzer(modId);
            RegistrationInfo info = analyzer.analyze(jarPath);

            // 输出 JSON 到 stdout
            String json = JsonOutput.toJson(info);
            System.out.println(json);

        } catch (IOException e) {
            System.err.println("[Main] Error: " + e.getMessage());
            // 输出错误 JSON
            System.out.println("{\"error\":\"" + escapeJson(e.getMessage()) + "\"}");
            System.exit(1);
        }
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }
}

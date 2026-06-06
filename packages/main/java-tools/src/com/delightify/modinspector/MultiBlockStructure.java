package com.delightify.modinspector;

import java.util.List;

/**
 * 多方块结构定义
 */
public class MultiBlockStructure {
    public String baseId;
    public String modId;
    public List<Part> parts;
    public String detectionSource;
    public double confidence;

    public static class Part {
        public String id;
        public String position;  // top, bottom, middle, center, wall, hanging, single
        public String variant;   // small, medium, large
        public String state;     // fruits, flowering, mature, young
    }
}

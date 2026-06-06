package com.delightify.modinspector.fabric;

import com.delightify.modinspector.RegistrationInfo;
import org.objectweb.asm.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Fabric 模组 ClassVisitor
 * 
 * Fabric 使用静态注册模式：
 * public static final Item EXAMPLE = Registry.register(Registry.ITEM, new Identifier("modid", "name"), new Item(...));
 */
public class FabricClassVisitor extends ClassVisitor {
    private final RegistrationInfo info;
    private final String modId;
    private String currentClassName;
    private boolean hasRegistryContent = false;
    
    // 存储可能的注册字段
    private final Map<String, FieldInfo> potentialFields = new HashMap<>();

    public FabricClassVisitor(RegistrationInfo info, String modId) {
        super(Opcodes.ASM9);
        this.info = info;
        this.modId = modId;
    }

    @Override
    public void visit(int version, int access, String name, String signature,
                      String superName, String[] interfaces) {
        this.currentClassName = name;
    }

    @Override
    public FieldVisitor visitField(int access, String name, String descriptor,
                                   String signature, Object value) {
        // Fabric 中，注册的字段通常是 public static final
        boolean isPublic = (access & Opcodes.ACC_PUBLIC) != 0;
        boolean isStatic = (access & Opcodes.ACC_STATIC) != 0;
        boolean isFinal = (access & Opcodes.ACC_FINAL) != 0;
        
        String type = extractTypeName(descriptor);
        
        // 检查是否是 Item 或 Block 类型
        if (isPublic && isStatic && isFinal) {
            if (type.contains("Item") || type.contains("Block")) {
                potentialFields.put(name, new FieldInfo(name, type, descriptor));
                hasRegistryContent = true;
            }
        }
        
        return new FieldVisitor(Opcodes.ASM9) {
            @Override
            public void visitEnd() {
                // 字段访问结束
            }
        };
    }

    @Override
    public MethodVisitor visitMethod(int access, String name, String descriptor,
                                     String signature, String[] exceptions) {
        boolean isStatic = (access & Opcodes.ACC_STATIC) != 0;
        boolean isClinit = name.equals("<clinit>");
        
        if ((isStatic || isClinit) && hasRegistryContent) {
            return new FabricMethodVisitor(info, modId, currentClassName, 
                                          name, potentialFields);
        }
        
        return null;
    }

    /**
     * 从描述符提取类型名
     */
    private String extractTypeName(String descriptor) {
        if (descriptor.startsWith("L") && descriptor.endsWith(";")) {
            String path = descriptor.substring(1, descriptor.length() - 1);
            String[] parts = path.split("/");
            return parts.length > 0 ? parts[parts.length - 1] : descriptor;
        }
        return descriptor;
    }

    public boolean hasRegistryContent() {
        return hasRegistryContent;
    }
    
    /**
     * 字段信息
     */
    static class FieldInfo {
        final String name;
        final String type;
        final String descriptor;
        String registeredId;
        
        FieldInfo(String name, String type, String descriptor) {
            this.name = name;
            this.type = type;
            this.descriptor = descriptor;
        }
    }
}

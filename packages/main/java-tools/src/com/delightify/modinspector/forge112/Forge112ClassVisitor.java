package com.delightify.modinspector.forge112;

import com.delightify.modinspector.RegistrationInfo;
import org.objectweb.asm.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Forge 1.12.2 ClassVisitor
 * 
 * Forge 1.12 使用 GameRegistry 注册：
 * GameRegistry.register(new Item().setRegistryName("modid", "name").setUnlocalizedName("name"));
 * 
 * 或者在 RegistryEvent.Register<Item> 事件中注册
 */
public class Forge112ClassVisitor extends ClassVisitor {
    private final RegistrationInfo info;
    private final String modId;
    private String currentClassName;
    private boolean hasRegistryContent = false;
    
    // 存储可能的注册事件处理器
    private boolean isRegistryEventHandler = false;
    private String registryEventType = null;

    public Forge112ClassVisitor(RegistrationInfo info, String modId) {
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
    public AnnotationVisitor visitAnnotation(String descriptor, boolean visible) {
        // 检测 @Mod 注解
        if (descriptor.contains("Mod") || descriptor.contains("Mod$")) {
            hasRegistryContent = true;
        }
        return null;
    }

    @Override
    public MethodVisitor visitMethod(int access, String name, String descriptor,
                                     String signature, String[] exceptions) {
        boolean isStatic = (access & Opcodes.ACC_STATIC) != 0;
        boolean isPublic = (access & Opcodes.ACC_PUBLIC) != 0;
        
        // 检测 RegistryEvent 处理器
        if (isPublic && descriptor.contains("RegistryEvent$Register")) {
            isRegistryEventHandler = true;
            hasRegistryContent = true;
            
            // 提取注册类型 (Item, Block 等)
            if (signature != null) {
                registryEventType = extractGenericType(signature);
            }
            
            return new Forge112EventMethodVisitor(info, modId, currentClassName, 
                                                  name, registryEventType);
        }
        
        // 静态初始化块（旧式直接注册）
        if (name.equals("<clinit>") || (isStatic && hasRegistryContent)) {
            return new Forge112StaticMethodVisitor(info, modId, currentClassName, name);
        }
        
        return null;
    }

    /**
     * 从泛型签名提取类型
     */
    private String extractGenericType(String signature) {
        // LRegistryEvent$Register<LItem;> -> Item
        int start = signature.indexOf('<');
        int end = signature.indexOf(';', start);
        if (start > 0 && end > start) {
            String typePath = signature.substring(start + 2, end); // +2 to skip <L
            String[] parts = typePath.split("/");
            return parts.length > 0 ? parts[parts.length - 1] : null;
        }
        return null;
    }

    public boolean hasRegistryContent() {
        return hasRegistryContent;
    }
}

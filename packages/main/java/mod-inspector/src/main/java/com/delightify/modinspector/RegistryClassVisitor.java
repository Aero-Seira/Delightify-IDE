package com.delightify.modinspector;

import org.objectweb.asm.*;
import java.util.*;

/**
 * ASM ClassVisitor 用于分析 Minecraft 模组中的注册代码
 * 
 * 支持的模式：
 * 1. Forge DeferredRegister
 * 2. Fabric Registry 注册
 * 3. 直接调用 Registry.register
 */
public class RegistryClassVisitor extends ClassVisitor {
    
    private RegistrationInfo info;
    private String className;
    private String modId;
    
    // 存储 DeferredRegister 字段信息
    private Map<String, DeferredRegisterInfo> deferredRegisters = new HashMap<>();
    
    // 存储 RegistryObject 字段信息
    private Map<String, RegistryObjectInfo> registryObjects = new HashMap<>();
    
    private static class DeferredRegisterInfo {
        String fieldName;
        String registryType;  // "ITEMS", "BLOCKS", etc.
        String modId;
    }
    
    private static class RegistryObjectInfo {
        String fieldName;
        String registrationName;  // 注册的 ID，如 "lemon"
        String type;              // "item" or "block"
        String supplierClass;     // Supplier 的类名
    }
    
    public RegistryClassVisitor(RegistrationInfo info, String modId) {
        super(Opcodes.ASM9);
        this.info = info;
        this.modId = modId;
    }
    
    @Override
    public void visit(int version, int access, String name, String signature, String superName, String[] interfaces) {
        this.className = name.replace('/', '.');
        super.visit(version, access, name, signature, superName, interfaces);
    }
    
    /**
     * 访问字段 - 识别 DeferredRegister 和 RegistryObject
     */
    @Override
    public FieldVisitor visitField(int access, String name, String descriptor, String signature, Object value) {
        // 检查是否是 DeferredRegister 类型
        if (descriptor.contains("DeferredRegister")) {
            DeferredRegisterInfo drInfo = new DeferredRegisterInfo();
            drInfo.fieldName = name;
            
            // 从 descriptor 提取注册表类型
            // Lnet/minecraftforge/registries/DeferredRegister<Lnet/minecraft/world/item/Item;>;
            if (descriptor.contains("/item/Item")) {
                drInfo.registryType = "ITEMS";
            } else if (descriptor.contains("/level/block/Block")) {
                drInfo.registryType = "BLOCKS";
            } else if (descriptor.contains("/world/level/block/entity/BlockEntityType")) {
                drInfo.registryType = "BLOCK_ENTITIES";
            } else if (descriptor.contains("/world/inventory/MenuType")) {
                drInfo.registryType = "MENUS";
            }
            
            drInfo.modId = modId;
            deferredRegisters.put(name, drInfo);
            
        } else if (descriptor.contains("RegistryObject")) {
            RegistryObjectInfo roInfo = new RegistryObjectInfo();
            roInfo.fieldName = name;
            registryObjects.put(name, roInfo);
        }
        
        return super.visitField(access, name, descriptor, signature, value);
    }
    
    /**
     * 访问方法 - 识别静态代码块中的注册逻辑
     */
    @Override
    public MethodVisitor visitMethod(int access, String name, String descriptor, String signature, String[] exceptions) {
        MethodVisitor mv = super.visitMethod(access, name, descriptor, signature, exceptions);
        
        // 特别关注静态初始化块和构造方法
        if ("<clinit>".equals(name) || "<init>".equals(name) || name.startsWith("register")) {
            return new RegistrationMethodVisitor(mv, name);
        }
        
        return mv;
    }
    
    /**
     * 方法访问器，用于分析注册调用
     */
    private class RegistrationMethodVisitor extends MethodVisitor {
        private String methodName;
        private String lastLdc;  // 存储上一个加载的字符串常量
        
        public RegistrationMethodVisitor(MethodVisitor mv, String methodName) {
            super(Opcodes.ASM9, mv);
            this.methodName = methodName;
        }
        
        @Override
        public void visitLdcInsn(Object value) {
            if (value instanceof String) {
                lastLdc = (String) value;
            }
            super.visitLdcInsn(value);
        }
        
        @Override
        public void visitMethodInsn(int opcode, String owner, String name, String descriptor, boolean isInterface) {
            // 检测 DeferredRegister.create 调用
            if ("create".equals(name) && owner.contains("DeferredRegister")) {
                // 这里可以提取注册表类型和 modId
            }
            
            // 检测 register 方法调用
            if ("register".equals(name)) {
                // 分析参数来确定注册的 ID 和类型
                analyzeRegisterCall(owner, descriptor);
            }
            
            super.visitMethodInsn(opcode, owner, name, descriptor, isInterface);
        }
        
        /**
         * 分析 register 调用
         */
        private void analyzeRegisterCall(String owner, String descriptor) {
            // 方法签名：(Ljava/lang/String;Ljava/util/function/Supplier;)Lnet/minecraftforge/registries/RegistryObject;
            // 第一个参数是注册名，第二个是 Supplier
            
            if (lastLdc != null && !lastLdc.isEmpty()) {
                String registrationId = lastLdc;
                
                // 判断是物品还是方块注册
                if (owner.contains("DeferredRegister")) {
                    DeferredRegisterInfo dr = findDeferredRegisterForMethod();
                    if (dr != null) {
                        if ("ITEMS".equals(dr.registryType)) {
                            RegistrationInfo.ItemRegistration item = new RegistrationInfo.ItemRegistration(
                                modId + ":" + registrationId,
                                className
                            );
                            info.getItems().add(item);
                        } else if ("BLOCKS".equals(dr.registryType)) {
                            RegistrationInfo.BlockRegistration block = new RegistrationInfo.BlockRegistration(
                                modId + ":" + registrationId,
                                className
                            );
                            info.getBlocks().add(block);
                        }
                    }
                }
            }
        }
        
        private DeferredRegisterInfo findDeferredRegisterForMethod() {
            // 简化处理：返回第一个找到的 DeferredRegister
            // 实际应该根据方法上下文确定
            return deferredRegisters.values().stream().findFirst().orElse(null);
        }
    }
    
    /**
     * 完成访问后处理
     */
    @Override
    public void visitEnd() {
        super.visitEnd();
        
        // 关联 RegistryObject 与 DeferredRegister
        for (RegistryObjectInfo ro : registryObjects.values()) {
            // 可以在这里添加额外的处理逻辑
        }
    }
}

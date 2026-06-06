package com.delightify.modinspector;

import org.objectweb.asm.*;

import java.util.HashMap;
import java.util.Map;

/**
 * ASM ClassVisitor - 识别 DeferredRegister 字段和注册调用
 */
public class RegistryClassVisitor extends ClassVisitor {
    private final RegistrationInfo info;
    private final String modId;
    private String currentClassName;
    private boolean hasRegistryContent = false;

    // 存储 DeferredRegister 字段信息：fieldName -> registryType
    private final Map<String, String> deferredRegisters = new HashMap<>();
    
    // 存储 Lambda 方法信息
    private final Map<String, LambdaInfo> lambdaMethods = new HashMap<>();

    public RegistryClassVisitor(RegistrationInfo info, String modId) {
        super(Opcodes.ASM9);
        this.info = info;
        this.modId = modId;
    }

    @Override
    public void visit(int version, int access, String name, String signature,
                      String superName, String[] interfaces) {
        this.currentClassName = name;
    }

    /**
     * 访问字段 - 识别 DeferredRegister 字段
     */
    @Override
    public FieldVisitor visitField(int access, String name, String descriptor,
                                   String signature, Object value) {
        // 检查是否是 DeferredRegister 类型
        String registryType = extractRegistryType(descriptor, signature);
        if (registryType != null) {
            deferredRegisters.put(name, registryType);
            hasRegistryContent = true;
            System.err.println("[RegistryClassVisitor] Found DeferredRegister field: " + 
                             name + " -> " + registryType);
        }

        return new FieldVisitor(Opcodes.ASM9) {
            @Override
            public void visitEnd() {
                // 字段访问结束
            }
        };
    }

    /**
     * 访问方法 - 创建 RegistryMethodVisitor 来分析注册调用
     */
    @Override
    public MethodVisitor visitMethod(int access, String name, String descriptor,
                                     String signature, String[] exceptions) {
        boolean isStatic = (access & Opcodes.ACC_STATIC) != 0;
        boolean isClinit = name.equals("<clinit>");
        boolean isSynthetic = (access & Opcodes.ACC_SYNTHETIC) != 0;
        
        // 收集 Lambda 方法信息（用于后续属性分析）
        if (isStatic && isSynthetic && name.startsWith("lambda$")) {
            LambdaAnalyzer analyzer = new LambdaAnalyzer();
            lambdaMethods.put(name, new LambdaInfo(name, analyzer));
            
            // 返回组合 visitor
            return new CombinedMethodVisitor(
                new RegistryMethodVisitor(info, modId, currentClassName, 
                                         name, deferredRegisters, lambdaMethods),
                analyzer
            );
        }
        
        // 分析静态初始化块和静态方法
        if ((isStatic || isClinit) && !deferredRegisters.isEmpty()) {
            return new RegistryMethodVisitor(info, modId, currentClassName, 
                                            name, deferredRegisters, lambdaMethods);
        }

        return null;
    }

    /**
     * 从类型描述符中提取注册表类型
     */
    private String extractRegistryType(String descriptor, String signature) {
        if (!descriptor.contains("DeferredRegister")) {
            return null;
        }

        if (signature != null) {
            int start = signature.indexOf('<');
            int end = signature.indexOf(';', start);
            if (start > 0 && end > start) {
                String typePath = signature.substring(start + 1, end);
                String[] parts = typePath.split("/");
                if (parts.length > 0) {
                    String typeName = parts[parts.length - 1];
                    if (typeName.startsWith("L")) {
                        typeName = typeName.substring(1);
                    }
                    return typeName.toLowerCase();
                }
            }
        }

        return "unknown";
    }

    public boolean hasRegistryContent() {
        return hasRegistryContent || !deferredRegisters.isEmpty();
    }
    
    public Map<String, LambdaInfo> getLambdaMethods() {
        return lambdaMethods;
    }
    
    /**
     * Lambda 方法信息
     */
    public static class LambdaInfo {
        public final String name;
        public final LambdaAnalyzer analyzer;
        
        public LambdaInfo(String name, LambdaAnalyzer analyzer) {
            this.name = name;
            this.analyzer = analyzer;
        }
    }
    
    /**
     * 组合多个 MethodVisitor
     */
    private static class CombinedMethodVisitor extends MethodVisitor {
        private final MethodVisitor[] visitors;
        
        CombinedMethodVisitor(MethodVisitor... visitors) {
            super(Opcodes.ASM9);
            this.visitors = visitors;
        }
        
        @Override
        public void visitCode() {
            for (MethodVisitor v : visitors) {
                if (v != null) v.visitCode();
            }
        }
        
        @Override
        public void visitInsn(int opcode) {
            for (MethodVisitor v : visitors) {
                if (v != null) v.visitInsn(opcode);
            }
        }
        
        @Override
        public void visitIntInsn(int opcode, int operand) {
            for (MethodVisitor v : visitors) {
                if (v != null) v.visitIntInsn(opcode, operand);
            }
        }
        
        @Override
        public void visitVarInsn(int opcode, int var) {
            for (MethodVisitor v : visitors) {
                if (v != null) v.visitVarInsn(opcode, var);
            }
        }
        
        @Override
        public void visitTypeInsn(int opcode, String type) {
            for (MethodVisitor v : visitors) {
                if (v != null) v.visitTypeInsn(opcode, type);
            }
        }
        
        @Override
        public void visitFieldInsn(int opcode, String owner, String name, String descriptor) {
            for (MethodVisitor v : visitors) {
                if (v != null) v.visitFieldInsn(opcode, owner, name, descriptor);
            }
        }
        
        @Override
        public void visitMethodInsn(int opcode, String owner, String name, 
                                    String descriptor, boolean isInterface) {
            for (MethodVisitor v : visitors) {
                if (v != null) v.visitMethodInsn(opcode, owner, name, descriptor, isInterface);
            }
        }
        
        @Override
        public void visitInvokeDynamicInsn(String name, String descriptor, 
                                           Handle bootstrapMethodHandle,
                                           Object... bootstrapMethodArguments) {
            for (MethodVisitor v : visitors) {
                if (v != null) v.visitInvokeDynamicInsn(name, descriptor, bootstrapMethodHandle, bootstrapMethodArguments);
            }
        }
        
        @Override
        public void visitLdcInsn(Object value) {
            for (MethodVisitor v : visitors) {
                if (v != null) v.visitLdcInsn(value);
            }
        }
        
        @Override
        public void visitEnd() {
            for (MethodVisitor v : visitors) {
                if (v != null) v.visitEnd();
            }
        }
    }
}

package com.delightify.modinspector.forge112;

import com.delightify.modinspector.RegistrationInfo;
import org.objectweb.asm.*;

import java.util.*;

/**
 * Forge 1.12 静态注册方法访问器
 * 
 * 处理旧式静态注册：
 * public static final Item EXAMPLE = new Item().setRegistryName("modid", "example");
 * 
 * static {
 *     GameRegistry.register(EXAMPLE);
 * }
 */
public class Forge112StaticMethodVisitor extends MethodVisitor {
    private final RegistrationInfo info;
    private final String modId;
    private final String className;
    private final String methodName;
    
    private final Deque<StackValue> stack = new ArrayDeque<>();
    private final Map<String, PendingRegistration> pendingRegs = new HashMap<>();
    private int registerCallsFound = 0;

    public Forge112StaticMethodVisitor(RegistrationInfo info, String modId, 
                                       String className, String methodName) {
        super(Opcodes.ASM9);
        this.info = info;
        this.modId = modId;
        this.className = className;
        this.methodName = methodName;
    }

    @Override
    public void visitFieldInsn(int opcode, String owner, String name, String descriptor) {
        if (opcode == Opcodes.GETSTATIC) {
            // 获取字段值（可能是已创建的实例）
            stack.push(new StackValue(ValueType.FIELD_REF, name, descriptor));
        } else if (opcode == Opcodes.PUTSTATIC) {
            // 字段赋值
            if (!stack.isEmpty()) {
                StackValue value = stack.pop();
                if (value.type == ValueType.INSTANCE_WITH_NAME) {
                    // 保存待注册的物品
                    pendingRegs.put(name, new PendingRegistration(
                        name, 
                        (String) value.value, 
                        value.className
                    ));
                }
            }
        }
    }

    @Override
    public void visitLdcInsn(Object value) {
        if (value instanceof String) {
            stack.push(new StackValue(ValueType.STRING, value, null));
        } else {
            stack.push(new StackValue(ValueType.UNKNOWN, value, null));
        }
    }

    @Override
    public void visitMethodInsn(int opcode, String owner, String name, 
                                String descriptor, boolean isInterface) {
        // 检测 setRegistryName
        if (name.equals("setRegistryName") || name.equals("setRegistryName")) {
            handleSetRegistryName(descriptor);
            return;
        }
        
        // 检测 setUnlocalizedName（通常在 setRegistryName 之后链式调用）
        if (name.equals("setUnlocalizedName")) {
            // 消费参数，但保留实例
            int argCount = countArguments(descriptor);
            for (int i = 0; i < argCount && !stack.isEmpty(); i++) {
                stack.pop();
            }
            // 返回 this，所以保留栈顶
            return;
        }
        
        // 检测 GameRegistry.register
        if (name.equals("register") && owner.contains("GameRegistry")) {
            handleRegisterCall(descriptor);
            return;
        }
        
        // 其他方法
        int argCount = countArguments(descriptor);
        for (int i = 0; i < argCount && !stack.isEmpty(); i++) {
            stack.pop();
        }
        
        if (!descriptor.endsWith("V")) {
            // 方法返回对象，可能是实例本身
            stack.push(new StackValue(ValueType.UNKNOWN, null, null));
        }
    }

    @Override
    public void visitTypeInsn(int opcode, String type) {
        if (opcode == Opcodes.NEW) {
            String className = type.replace('/', '.');
            stack.push(new StackValue(ValueType.CLASS, className, className));
        }
    }

    private void handleSetRegistryName(String descriptor) {
        List<StackValue> args = new ArrayList<>();
        int argCount = countArguments(descriptor);
        
        // 先弹出实例（this）
        StackValue instance = !stack.isEmpty() ? stack.pop() : null;
        
        for (int i = 0; i < argCount && !stack.isEmpty(); i++) {
            args.add(stack.pop());
        }
        
        String regModId = null;
        String regName = null;
        
        if (args.size() == 1) {
            if (args.get(0).type == ValueType.STRING) {
                regModId = modId;
                regName = (String) args.get(0).value;
            }
        } else if (args.size() >= 2) {
            if (args.get(0).type == ValueType.STRING && 
                args.get(1).type == ValueType.STRING) {
                // 注意栈顺序是反的
                regName = (String) args.get(0).value;
                regModId = (String) args.get(1).value;
            }
        }
        
        if (regModId != null && regName != null) {
            String fullId = regModId + ":" + regName;
            String implClass = instance != null ? instance.className : "unknown";
            
            // 压入带有注册名的实例标记
            stack.push(new StackValue(ValueType.INSTANCE_WITH_NAME, fullId, implClass));
        } else {
            stack.push(instance != null ? instance : new StackValue(ValueType.UNKNOWN, null, null));
        }
    }

    private void handleRegisterCall(String descriptor) {
        // 获取要注册的字段引用
        if (!stack.isEmpty()) {
            StackValue arg = stack.pop();
            
            String fieldName = null;
            if (arg.type == ValueType.FIELD_REF) {
                fieldName = (String) arg.value;
            }
            
            if (fieldName != null && pendingRegs.containsKey(fieldName)) {
                PendingRegistration pending = pendingRegs.get(fieldName);
                
                String registryType = pending.className.contains("Block") && 
                                     !pending.className.contains("BlockItem") 
                                     ? "block" : "item";
                
                if ("item".equals(registryType)) {
                    RegistrationInfo.ItemInfo item = new RegistrationInfo.ItemInfo(
                        pending.registryName, 
                        pending.className
                    );
                    if (pending.className.contains("BlockItem")) {
                        item.isBlockItem = true;
                        item.blockId = pending.registryName;
                    }
                    info.addItem(item);
                    System.err.println("[Forge112] Registered ITEM: " + pending.registryName);
                    registerCallsFound++;
                } else {
                    RegistrationInfo.BlockInfo block = new RegistrationInfo.BlockInfo(
                        pending.registryName, 
                        pending.className
                    );
                    info.addBlock(block);
                    System.err.println("[Forge112] Registered BLOCK: " + pending.registryName);
                    registerCallsFound++;
                }
                
                // 从未决列表移除
                pendingRegs.remove(fieldName);
            }
        }
        
        stack.push(new StackValue(ValueType.UNKNOWN, null, null));
    }

    @Override
    public void visitEnd() {
        if (registerCallsFound > 0) {
            System.err.println("[Forge112] " + className + "." + methodName + 
                             " found " + registerCallsFound + " registrations");
        }
        
        // 处理剩余的未决注册（可能是没有显式 GameRegistry.register 的情况）
        for (PendingRegistration pending : pendingRegs.values()) {
            System.err.println("[Forge112] Warning: Pending registration not processed: " + pending.fieldName);
        }
    }

    private int countArguments(String descriptor) {
        int start = descriptor.indexOf('(') + 1;
        int end = descriptor.indexOf(')');
        if (start <= 0 || end < 0) return 0;
        
        String args = descriptor.substring(start, end);
        int count = 0;
        int i = 0;
        
        while (i < args.length()) {
            char c = args.charAt(i);
            if (c == 'L') {
                int semi = args.indexOf(';', i);
                if (semi > i) {
                    i = semi + 1;
                } else {
                    i++;
                }
                count++;
            } else if (c == '[') {
                i++;
            } else if (c != ')') {
                i++;
                count++;
            } else {
                i++;
            }
        }
        
        return count;
    }

    private enum ValueType {
        STRING, CLASS, FIELD_REF, INSTANCE_WITH_NAME, REGISTERED_ITEM, UNKNOWN
    }

    private static class StackValue {
        final ValueType type;
        final Object value;
        final String className;

        StackValue(ValueType type, Object value, String className) {
            this.type = type;
            this.value = value;
            this.className = className;
        }
    }

    private static class PendingRegistration {
        final String fieldName;
        final String registryName;
        final String className;

        PendingRegistration(String fieldName, String registryName, String className) {
            this.fieldName = fieldName;
            this.registryName = registryName;
            this.className = className;
        }
    }
}

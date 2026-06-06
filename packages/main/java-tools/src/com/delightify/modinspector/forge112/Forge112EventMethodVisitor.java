package com.delightify.modinspector.forge112;

import com.delightify.modinspector.RegistrationInfo;
import org.objectweb.asm.*;

import java.util.*;

/**
 * Forge 1.12 RegistryEvent 处理方法访问器
 * 
 * 处理 @SubscribeEvent 标注的方法：
 * @SubscribeEvent
 * public void onRegisterItems(RegistryEvent.Register<Item> event) {
 *     event.getRegistry().register(new Item());
 * }
 */
public class Forge112EventMethodVisitor extends MethodVisitor {
    private final RegistrationInfo info;
    private final String modId;
    private final String className;
    private final String methodName;
    private final String registryEventType;
    
    private final Deque<StackValue> stack = new ArrayDeque<>();
    private int registerCallsFound = 0;

    public Forge112EventMethodVisitor(RegistrationInfo info, String modId, 
                                      String className, String methodName,
                                      String registryEventType) {
        super(Opcodes.ASM9);
        this.info = info;
        this.modId = modId;
        this.className = className;
        this.methodName = methodName;
        this.registryEventType = registryEventType;
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
        // 检测 setRegistryName 调用
        if (name.equals("setRegistryName")) {
            handleSetRegistryName(descriptor);
            return;
        }
        
        // 检测 GameRegistry.register 或 IForgeRegistry.register
        if (name.equals("register") && 
            (owner.contains("GameRegistry") || owner.contains("IForgeRegistry"))) {
            handleRegisterCall(descriptor);
            return;
        }
        
        // 其他方法
        int argCount = countArguments(descriptor);
        for (int i = 0; i < argCount && !stack.isEmpty(); i++) {
            stack.pop();
        }
        
        if (!descriptor.endsWith("V")) {
            stack.push(new StackValue(ValueType.UNKNOWN, null, null));
        }
    }

    @Override
    public void visitTypeInsn(int opcode, String type) {
        if (opcode == Opcodes.NEW) {
            String className = type.replace('/', '.');
            stack.push(new StackValue(ValueType.CLASS, className, null));
        }
    }

    /**
     * 处理 setRegistryName 调用
     * setRegistryName(String name) 或 setRegistryName(String modId, String name)
     */
    private void handleSetRegistryName(String descriptor) {
        List<StackValue> args = new ArrayList<>();
        int argCount = countArguments(descriptor);
        
        for (int i = 0; i < argCount && !stack.isEmpty(); i++) {
            args.add(stack.pop());
        }
        
        String regModId = null;
        String regName = null;
        
        if (args.size() == 1) {
            // setRegistryName("name") - 使用默认 modId
            if (args.get(0).type == ValueType.STRING) {
                regModId = modId;
                regName = (String) args.get(0).value;
            }
        } else if (args.size() == 2) {
            // setRegistryName("modid", "name")
            if (args.get(0).type == ValueType.STRING && 
                args.get(1).type == ValueType.STRING) {
                regModId = (String) args.get(1).value; // 栈顶是第二个参数
                regName = (String) args.get(0).value;
            }
        }
        
        if (regModId != null && regName != null) {
            String fullId = regModId + ":" + regName;
            stack.push(new StackValue(ValueType.REGISTRY_NAME, fullId, null));
        } else {
            stack.push(new StackValue(ValueType.UNKNOWN, null, null));
        }
    }

    /**
     * 处理 register 调用
     */
    private void handleRegisterCall(String descriptor) {
        List<StackValue> args = new ArrayList<>();
        int argCount = countArguments(descriptor);
        
        for (int i = 0; i < argCount && !stack.isEmpty(); i++) {
            args.add(stack.pop());
        }
        
        String itemId = null;
        String implClass = null;
        String registryType = registryEventType;
        
        // 查找已设置的注册名
        for (StackValue arg : args) {
            if (arg.type == ValueType.REGISTRY_NAME && itemId == null) {
                itemId = (String) arg.value;
            } else if (arg.type == ValueType.CLASS && implClass == null) {
                implClass = (String) arg.value;
            }
        }
        
        // 如果没有找到注册名，可能是在构造时设置的
        if (itemId == null && implClass != null) {
            // 尝试从类名推断
            itemId = modId + ":" + inferIdFromClass(implClass);
        }
        
        if (itemId != null) {
            if (implClass == null) {
                implClass = inferClassFromType(registryType);
            }
            
            // 推断 registryType
            if (registryType == null) {
                registryType = implClass.contains("Block") && !implClass.contains("BlockItem") 
                    ? "block" : "item";
            }
            
            if ("item".equals(registryType)) {
                RegistrationInfo.ItemInfo item = new RegistrationInfo.ItemInfo(itemId, implClass);
                if (implClass.contains("BlockItem")) {
                    item.isBlockItem = true;
                    item.blockId = itemId;
                }
                info.addItem(item);
                System.err.println("[Forge112] Registered ITEM: " + itemId);
                registerCallsFound++;
            } else if ("block".equals(registryType)) {
                RegistrationInfo.BlockInfo block = new RegistrationInfo.BlockInfo(itemId, implClass);
                info.addBlock(block);
                System.err.println("[Forge112] Registered BLOCK: " + itemId);
                registerCallsFound++;
            }
        }
        
        stack.push(new StackValue(ValueType.REGISTERED_ITEM, itemId, registryType));
    }

    @Override
    public void visitEnd() {
        if (registerCallsFound > 0) {
            System.err.println("[Forge112] " + className + "." + methodName + 
                             " found " + registerCallsFound + " registrations");
        }
    }

    // ========== 辅助方法 ==========

    private String inferIdFromClass(String className) {
        // 从类名推断 ID，如 ItemExample -> example
        String simpleName = className.substring(className.lastIndexOf('.') + 1);
        if (simpleName.startsWith("Item")) {
            return simpleName.substring(4).toLowerCase();
        } else if (simpleName.startsWith("Block")) {
            return simpleName.substring(5).toLowerCase();
        }
        return simpleName.toLowerCase();
    }

    private String inferClassFromType(String type) {
        if ("Item".equals(type) || "item".equals(type)) {
            return "net.minecraft.item.Item";
        } else if ("Block".equals(type) || "block".equals(type)) {
            return "net.minecraft.block.Block";
        }
        return "unknown";
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
        STRING, CLASS, REGISTRY_NAME, REGISTERED_ITEM, UNKNOWN
    }

    private static class StackValue {
        final ValueType type;
        final Object value;
        final String registryType;

        StackValue(ValueType type, Object value, String registryType) {
            this.type = type;
            this.value = value;
            this.registryType = registryType;
        }
    }
}

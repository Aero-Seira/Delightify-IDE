package com.delightify.modinspector;

import org.objectweb.asm.*;

import java.util.*;

/**
 * ASM MethodVisitor - 检测 DeferredRegister.register() 调用
 */
public class RegistryMethodVisitor extends MethodVisitor {
    private final RegistrationInfo info;
    private final String modId;
    private final String className;
    private final String methodName;
    private final Map<String, String> deferredRegisters;
    private final Map<String, RegistryClassVisitor.LambdaInfo> lambdaMethods;

    // 模拟操作数栈
    private final Deque<StackValue> stack = new ArrayDeque<>();
    private String lastStringConstant = null;
    private int registerCallsFound = 0;
    private String currentRegistryType = null;
    
    // 记录当前 Lambda 实现方法
    private String currentLambdaMethod = null;

    public RegistryMethodVisitor(RegistrationInfo info, String modId, 
                                 String className, String methodName,
                                 Map<String, String> deferredRegisters,
                                 Map<String, RegistryClassVisitor.LambdaInfo> lambdaMethods) {
        super(Opcodes.ASM9);
        this.info = info;
        this.modId = modId;
        this.className = className;
        this.methodName = methodName;
        this.deferredRegisters = deferredRegisters;
        this.lambdaMethods = lambdaMethods;
    }

    @Override
    public void visitFieldInsn(int opcode, String owner, String name, String descriptor) {
        if (opcode == Opcodes.GETSTATIC) {
            if (descriptor.contains("DeferredRegister")) {
                String regType = deferredRegisters.get(name);
                stack.push(new StackValue(ValueType.DEFERRED_REGISTER, name, regType));
                currentRegistryType = regType;
            } else {
                stack.push(new StackValue(ValueType.UNKNOWN, null, null));
            }
        } else if (opcode == Opcodes.PUTSTATIC) {
            if (!stack.isEmpty()) {
                stack.pop();
            }
        }
    }

    @Override
    public void visitLdcInsn(Object value) {
        if (value instanceof String) {
            lastStringConstant = (String) value;
            stack.push(new StackValue(ValueType.STRING, value, null));
        } else {
            stack.push(new StackValue(ValueType.UNKNOWN, value, null));
        }
    }

    @Override
    public void visitInvokeDynamicInsn(String name, String descriptor, 
                                       Handle bootstrapMethodHandle,
                                       Object... bootstrapMethodArguments) {
        // 提取 Lambda 实现方法名
        String lambdaMethod = extractLambdaMethod(bootstrapMethodArguments);
        if (lambdaMethod != null) {
            currentLambdaMethod = lambdaMethod;
        }
        
        String implClass = extractLambdaClass(bootstrapMethodArguments);
        
        if (descriptor.contains("Supplier")) {
            stack.push(new StackValue(ValueType.SUPPLIER, implClass, null, lambdaMethod));
        } else {
            stack.push(new StackValue(ValueType.UNKNOWN, null, null));
        }
    }

    @Override
    public void visitMethodInsn(int opcode, String owner, String name, 
                                String descriptor, boolean isInterface) {
        if (opcode == Opcodes.INVOKEVIRTUAL && 
            name.equals("register") &&
            (owner.contains("DeferredRegister") || owner.contains("IForgeRegistry"))) {
            
            handleRegisterCall(descriptor);
        } else if (opcode == Opcodes.INVOKESTATIC && 
                 isRegistrationHelperMethod(name, descriptor)) {
            
            handleHelperMethod(name, descriptor);
        } else {
            int argCount = countArguments(descriptor);
            for (int i = 0; i < argCount && !stack.isEmpty(); i++) {
                stack.pop();
            }
            
            if (!descriptor.endsWith("V")) {
                stack.push(new StackValue(ValueType.UNKNOWN, null, null));
            }
        }
    }

    private void handleRegisterCall(String descriptor) {
        List<StackValue> args = new ArrayList<>();
        
        for (int i = 0; i < 3 && !stack.isEmpty(); i++) {
            args.add(stack.pop());
        }
        
        String itemId = null;
        String implClass = null;
        String registryType = null;
        String lambdaMethod = null;
        
        for (StackValue arg : args) {
            if (arg.type == ValueType.STRING && itemId == null) {
                itemId = (String) arg.value;
            } else if (arg.type == ValueType.SUPPLIER && implClass == null) {
                implClass = (String) arg.value;
                lambdaMethod = arg.lambdaMethod;
            } else if (arg.type == ValueType.DEFERRED_REGISTER && registryType == null) {
                registryType = arg.registryType;
            }
        }
        
        if (itemId == null && lastStringConstant != null) {
            itemId = lastStringConstant;
        }
        
        if (registryType == null && currentRegistryType != null) {
            registryType = currentRegistryType;
        }
        
        if (itemId != null) {
            String fullId = modId + ":" + itemId;
            
            if (implClass == null) {
                implClass = inferClassFromRegistry(registryType);
            }
            
            // 获取 Lambda 方法分析的属性
            LambdaAnalyzer.ItemProperties itemProps = null;
            LambdaAnalyzer.BlockProperties blockProps = null;
            
            if (lambdaMethod != null && lambdaMethods.containsKey(lambdaMethod)) {
                RegistryClassVisitor.LambdaInfo info = lambdaMethods.get(lambdaMethod);
                itemProps = info.analyzer.getItemProperties();
                blockProps = info.analyzer.getBlockProperties();
            }
            
            if ("item".equals(registryType)) {
                RegistrationInfo.ItemInfo item = new RegistrationInfo.ItemInfo(fullId, implClass);
                
                // 应用属性
                if (itemProps != null) {
                    item.maxStackSize = itemProps.maxStackSize;
                    item.durability = itemProps.durability;
                    if (itemProps.isBlockItem != null) {
                        item.isBlockItem = itemProps.isBlockItem;
                    }
                }
                
                // 检查是否是 BlockItem
                if (implClass != null && implClass.contains("BlockItem")) {
                    item.isBlockItem = true;
                    item.blockId = fullId;
                }
                
                info.addItem(item);
                System.err.println("[MethodVisitor] Registered ITEM: " + fullId + 
                    (itemProps != null && itemProps.maxStackSize != null ? 
                     " (stackSize=" + itemProps.maxStackSize + ")" : ""));
                registerCallsFound++;
            } else if ("block".equals(registryType)) {
                RegistrationInfo.BlockInfo block = new RegistrationInfo.BlockInfo(fullId, implClass);
                
                // 应用属性
                if (blockProps != null) {
                    block.hardness = blockProps.hardness;
                    block.resistance = blockProps.resistance;
                    block.lightLevel = blockProps.lightLevel;
                }
                
                info.addBlock(block);
                System.err.println("[MethodVisitor] Registered BLOCK: " + fullId);
                registerCallsFound++;
            }
        }
        
        stack.push(new StackValue(ValueType.REGISTRY_OBJECT, null, null));
    }

    private void handleHelperMethod(String helperName, String descriptor) {
        List<StackValue> args = new ArrayList<>();
        int argCount = countArguments(descriptor);
        
        for (int i = 0; i < argCount && !stack.isEmpty(); i++) {
            args.add(stack.pop());
        }
        
        String itemId = null;
        String implClass = null;
        String lambdaMethod = null;
        
        for (StackValue arg : args) {
            if (arg.type == ValueType.STRING && itemId == null) {
                itemId = (String) arg.value;
            } else if (arg.type == ValueType.SUPPLIER && implClass == null) {
                implClass = (String) arg.value;
                lambdaMethod = arg.lambdaMethod;
            }
        }
        
        if (itemId == null && lastStringConstant != null) {
            itemId = lastStringConstant;
        }
        
        if (itemId != null) {
            String fullId = modId + ":" + itemId;
            
            if (implClass == null) {
                implClass = inferClassFromHelper(helperName);
            }
            
            // 获取 Lambda 属性
            LambdaAnalyzer.ItemProperties itemProps = null;
            if (lambdaMethod != null && lambdaMethods.containsKey(lambdaMethod)) {
                itemProps = lambdaMethods.get(lambdaMethod).analyzer.getItemProperties();
            }
            
            RegistrationInfo.ItemInfo item = new RegistrationInfo.ItemInfo(fullId, implClass);
            
            if (itemProps != null) {
                item.maxStackSize = itemProps.maxStackSize;
                item.durability = itemProps.durability;
            }
            
            info.addItem(item);
            System.err.println("[MethodVisitor] Registered ITEM via " + helperName + ": " + fullId);
            registerCallsFound++;
        }
        
        stack.push(new StackValue(ValueType.REGISTRY_OBJECT, null, null));
    }

    @Override
    public void visitInsn(int opcode) {
        switch (opcode) {
            case Opcodes.DUP:
                if (!stack.isEmpty()) {
                    stack.push(stack.peek());
                }
                break;
            case Opcodes.POP:
                if (!stack.isEmpty()) {
                    stack.pop();
                }
                break;
            case Opcodes.ACONST_NULL:
                stack.push(new StackValue(ValueType.NULL, null, null));
                break;
        }
    }

    @Override
    public void visitTypeInsn(int opcode, String type) {
        if (opcode == Opcodes.NEW) {
            String className = type.replace('/', '.');
            stack.push(new StackValue(ValueType.CLASS, className, null));
        }
    }

    @Override
    public void visitEnd() {
        if (registerCallsFound > 0 || (className.contains("ModItems") && !methodName.equals("<clinit>"))) {
            System.err.println("[MethodVisitor] " + className + "." + methodName + 
                             " found " + registerCallsFound + " register calls");
        }
    }

    // ========== 辅助方法 ==========

    private String extractLambdaMethod(Object[] bootstrapMethodArguments) {
        if (bootstrapMethodArguments.length > 1 && 
            bootstrapMethodArguments[1] instanceof Handle) {
            Handle handle = (Handle) bootstrapMethodArguments[1];
            return handle.getName();
        }
        return null;
    }

    private String extractLambdaClass(Object[] bootstrapMethodArguments) {
        if (bootstrapMethodArguments.length > 1 && 
            bootstrapMethodArguments[1] instanceof Handle) {
            Handle handle = (Handle) bootstrapMethodArguments[1];
            String owner = handle.getOwner();
            String methodName = handle.getName();
            return owner.replace('/', '.') + "::" + methodName;
        }
        return null;
    }

    private boolean isRegistrationHelperMethod(String name, String descriptor) {
        String[] helpers = {"registerWithTab", "basicItem", "foodItem", "bowlFoodItem", 
                           "drinkItem", "registerBlock", "registerItem"};
        for (String helper : helpers) {
            if (name.equals(helper)) {
                return descriptor.contains("String") && 
                       (descriptor.contains("Supplier") || descriptor.contains("Item"));
            }
        }
        return false;
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

    private String inferClassFromRegistry(String registryType) {
        if ("item".equals(registryType)) {
            return "net.minecraft.world.item.Item";
        } else if ("block".equals(registryType)) {
            return "net.minecraft.world.level.block.Block";
        }
        return "unknown";
    }

    private String inferClassFromHelper(String helperName) {
        return "net.minecraft.world.item.Item";
    }

    // ========== 栈值类型 ==========

    private enum ValueType {
        STRING, DEFERRED_REGISTER, SUPPLIER, REGISTRY_OBJECT, 
        ITEM_RESULT, CLASS, NULL, UNKNOWN
    }

    private static class StackValue {
        final ValueType type;
        final Object value;
        final String registryType;
        final String lambdaMethod;

        StackValue(ValueType type, Object value, String registryType) {
            this(type, value, registryType, null);
        }

        StackValue(ValueType type, Object value, String registryType, String lambdaMethod) {
            this.type = type;
            this.value = value;
            this.registryType = registryType;
            this.lambdaMethod = lambdaMethod;
        }

        @Override
        public String toString() {
            return type + "(" + value + ")";
        }
    }
}

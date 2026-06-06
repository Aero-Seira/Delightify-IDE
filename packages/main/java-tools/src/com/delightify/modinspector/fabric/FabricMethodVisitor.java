package com.delightify.modinspector.fabric;

import com.delightify.modinspector.RegistrationInfo;
import org.objectweb.asm.*;

import java.util.*;

/**
 * Fabric MethodVisitor - 检测 Registry.register() 调用
 */
public class FabricMethodVisitor extends MethodVisitor {
    private final RegistrationInfo info;
    private final String modId;
    private final String className;
    private final String methodName;
    private final Map<String, FabricClassVisitor.FieldInfo> potentialFields;
    
    private final Deque<StackValue> stack = new ArrayDeque<>();
    private int registerCallsFound = 0;

    public FabricMethodVisitor(RegistrationInfo info, String modId, 
                               String className, String methodName,
                               Map<String, FabricClassVisitor.FieldInfo> potentialFields) {
        super(Opcodes.ASM9);
        this.info = info;
        this.modId = modId;
        this.className = className;
        this.methodName = methodName;
        this.potentialFields = potentialFields;
    }

    @Override
    public void visitFieldInsn(int opcode, String owner, String name, String descriptor) {
        if (opcode == Opcodes.GETSTATIC) {
            if (owner.contains("Registry")) {
                String registryType = inferRegistryType(name);
                stack.push(new StackValue(ValueType.REGISTRY, name, registryType));
            } else {
                stack.push(new StackValue(ValueType.UNKNOWN, null, null));
            }
        } else if (opcode == Opcodes.PUTSTATIC) {
            if (!stack.isEmpty()) {
                StackValue value = stack.pop();
                if (value.type == ValueType.REGISTERED_ITEM && value.id != null) {
                    FabricClassVisitor.FieldInfo field = potentialFields.get(name);
                    if (field != null) {
                        field.registeredId = value.id;
                    }
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
        if (name.equals("<init>") && owner.contains("Identifier")) {
            handleIdentifierConstructor(descriptor);
            return;
        }
        
        if ((opcode == Opcodes.INVOKESTATIC || opcode == Opcodes.INVOKEVIRTUAL) && 
            name.equals("register") && owner.contains("Registry")) {
            handleRegisterCall(descriptor);
            return;
        }
        
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

    private void handleIdentifierConstructor(String descriptor) {
        List<StackValue> args = new ArrayList<>();
        int argCount = countArguments(descriptor);
        
        for (int i = 0; i < argCount && !stack.isEmpty(); i++) {
            args.add(stack.pop());
        }
        
        String namespace = null;
        String path = null;
        
        for (int i = 0; i < args.size(); i++) {
            StackValue arg = args.get(i);
            if (arg.type == ValueType.STRING) {
                if (i == 0) path = (String) arg.value;
                else if (i == 1) namespace = (String) arg.value;
            }
        }
        
        if (namespace != null && path != null) {
            String fullId = namespace + ":" + path;
            stack.push(new StackValue(ValueType.IDENTIFIER, fullId, null));
        } else {
            stack.push(new StackValue(ValueType.UNKNOWN, null, null));
        }
    }

    private void handleRegisterCall(String descriptor) {
        List<StackValue> args = new ArrayList<>();
        int argCount = countArguments(descriptor);
        
        for (int i = 0; i < argCount && !stack.isEmpty(); i++) {
            args.add(stack.pop());
        }
        
        String registryType = null;
        String itemId = null;
        String implClass = null;
        
        for (StackValue arg : args) {
            if (arg.type == ValueType.REGISTRY && registryType == null) {
                registryType = arg.registryType;
            } else if (arg.type == ValueType.IDENTIFIER && itemId == null) {
                itemId = (String) arg.value;
            } else if (arg.type == ValueType.CLASS && implClass == null) {
                implClass = (String) arg.value;
            }
        }
        
        if (itemId != null) {
            String actualModId = modId;
            if (itemId.contains(":")) {
                String[] parts = itemId.split(":", 2);
                actualModId = parts[0];
                itemId = parts[1];
            }
            
            String fullId = actualModId + ":" + itemId;
            
            if (implClass == null) {
                implClass = inferClassFromRegistry(registryType);
            }
            
            if ("item".equals(registryType) || implClass.contains("Item")) {
                RegistrationInfo.ItemInfo item = new RegistrationInfo.ItemInfo(fullId, implClass);
                if (implClass.contains("BlockItem")) {
                    item.isBlockItem = true;
                    item.blockId = fullId;
                }
                info.addItem(item);
                System.err.println("[Fabric] Registered ITEM: " + fullId);
                registerCallsFound++;
            } else if ("block".equals(registryType) || implClass.contains("Block")) {
                RegistrationInfo.BlockInfo block = new RegistrationInfo.BlockInfo(fullId, implClass);
                info.addBlock(block);
                System.err.println("[Fabric] Registered BLOCK: " + fullId);
                registerCallsFound++;
            }
            
            stack.push(new StackValue(ValueType.REGISTERED_ITEM, fullId, registryType));
        } else {
            stack.push(new StackValue(ValueType.UNKNOWN, null, null));
        }
    }

    @Override
    public void visitEnd() {
        if (registerCallsFound > 0) {
            System.err.println("[Fabric] " + className + "." + methodName + 
                             " found " + registerCallsFound + " registrations");
        }
    }

    private String inferRegistryType(String registryFieldName) {
        if ("ITEM".equals(registryFieldName) || registryFieldName.contains("ITEM")) {
            return "item";
        } else if ("BLOCK".equals(registryFieldName) || registryFieldName.contains("BLOCK")) {
            return "block";
        }
        return "unknown";
    }

    private String inferClassFromRegistry(String registryType) {
        if ("item".equals(registryType)) {
            return "net.minecraft.world.item.Item";
        } else if ("block".equals(registryType)) {
            return "net.minecraft.world.level.block.Block";
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
        REGISTRY, STRING, IDENTIFIER, CLASS, REGISTERED_ITEM, UNKNOWN
    }

    private static class StackValue {
        final ValueType type;
        final Object value;
        final String registryType;
        final String id;

        StackValue(ValueType type, Object value, String registryType) {
            this(type, value, registryType, null);
        }

        StackValue(ValueType type, Object value, String registryType, String id) {
            this.type = type;
            this.value = value;
            this.registryType = registryType;
            this.id = id;
        }
    }
}

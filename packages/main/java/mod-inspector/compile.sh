#!/bin/bash

# Mod Inspector Java 工具编译脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Mod Inspector Compiler ==="

# 创建输出目录
mkdir -p build/classes
mkdir -p dist

# 设置 classpath
CLASSPATH="libs/asm-9.6.jar:libs/asm-tree-9.6.jar:libs/asm-analysis-9.6.jar:libs/asm-util-9.6.jar"

# 编译 Java 文件
echo "Compiling Java sources..."
find src/main/java -name "*.java" -print0 | xargs -0 javac -cp "$CLASSPATH" -d build/classes

# 创建 JAR
echo "Creating JAR file..."
jar cf dist/mod-inspector.jar -C build/classes .

# 复制依赖
cp libs/*.jar dist/

echo ""
echo "Build complete!"
echo "Output: dist/mod-inspector.jar"
echo ""
echo "Usage:"
echo "  cd dist && java -cp \"mod-inspector.jar:asm-9.6.jar:asm-tree-9.6.jar:asm-analysis-9.6.jar:asm-util-9.6.jar\" com.delightify.modinspector.Main <jarPath> [modId]"

#!/bin/bash
set -e

echo "=== Building mod-inspector ==="

mkdir -p dist

JARS="libs/asm-9.6.jar:libs/asm-tree-9.6.jar:libs/asm-analysis-9.6.jar:libs/asm-util-9.6.jar:libs/gson-2.10.1.jar"

echo "Compiling Java sources..."
javac -cp "$JARS" \
      -d dist \
      src/com/delightify/modinspector/*.java \
      src/com/delightify/modinspector/fabric/*.java \
      src/com/delightify/modinspector/forge112/*.java \
      src/com/delightify/modinspector/patterns/*.java

# Copy dependencies to dist
cp libs/*.jar dist/

# Create manifest
cat > dist/MANIFEST.MF << EOF
Manifest-Version: 1.0
Main-Class: com.delightify.modinspector.Main
Class-Path: asm-9.6.jar asm-tree-9.6.jar asm-analysis-9.6.jar asm-util-9.6.jar gson-2.10.1.jar
EOF

# Create JAR with manifest
cd dist
jar cvfm mod-inspector.jar MANIFEST.MF com

# Also create uber JAR with all dependencies embedded
echo "Creating uber JAR..."
mkdir -p combined
cd combined

jar xf ../asm-9.6.jar
jar xf ../asm-tree-9.6.jar
jar xf ../asm-analysis-9.6.jar
jar xf ../asm-util-9.6.jar
jar xf ../gson-2.10.1.jar
cp -r ../com .

cat > MANIFEST.MF << EOF
Manifest-Version: 1.0
Main-Class: com.delightify.modinspector.Main
EOF

jar cvfm ../mod-inspector-uber.jar MANIFEST.MF .

cd ..
rm -rf combined

echo "Build complete!"
echo "Output: dist/mod-inspector.jar (with classpath)"
echo "Output: dist/mod-inspector-uber.jar (standalone)"

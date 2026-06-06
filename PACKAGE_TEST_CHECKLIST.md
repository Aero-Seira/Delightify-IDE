# Delightify 打包测试清单

> 发布新版本前逐项检查，确保应用质量

---

## ✅ 测试前准备

```bash
# 1. 确保代码已提交并推送
git status  # 应该是干净的

# 2. 安装依赖
pnpm install

# 3. 类型检查（必须全过）
pnpm typecheck

# 4. 构建
pnpm build

# 5. 打包
pnpm dist
```

---

## 🖥️ Windows 测试

### 安装测试
- [ ] 双击 `Delightify Setup x.x.x.exe` 能正常启动安装向导
- [ ] 安装过程无报错
- [ ] 安装完成后桌面生成快捷方式
- [ ] 开始菜单中有程序入口
- [ ] 任务栏图标显示正确

### 启动测试
- [ ] 双击快捷方式启动，3 秒内显示界面
- [ ] 窗口标题显示 "Delightify"
- [ ] 窗口大小为 1280x800
- [ ] 任务栏图标正确

### 功能测试
- [ ] 侧边栏 5 个导航都能点击
- [ ] 每个页面内容正常显示
- [ ] 主题切换（深色/浅色）正常
- [ ] 语言切换（中文/英文）正常
- [ ] 窗口最小化/最大化/关闭正常

### 文件操作测试
- [ ] 点击"选择目录"能打开文件夹对话框
- [ ] 选择目录后路径显示正确
- [ ] 选择 JAR 文件功能正常（如有）

### 卸载测试
- [ ] 控制面板能正常卸载
- [ ] 卸载后无残留文件

---

## 🍎 macOS 测试

### 安装测试
- [ ] 双击 `.dmg` 能挂载
- [ ] 将应用拖到 Applications 文件夹
- [ ] 应用图标正确显示

### 启动测试
- [ ] 从 Launchpad 启动
- [ ] 首次启动无安全警告（或用户可跳过）
- [ ] Dock 栏图标正确
- [ ] 菜单栏显示正确（Delightify / Edit / View / Window / Help）

### 功能测试
- [ ] Command+W 关闭窗口
- [ ] Command+Q 退出应用
- [ ] 全屏模式正常（绿色按钮）
- [ ] 其他功能同 Windows

---

## 🐧 Linux 测试

### AppImage 测试
- [ ] 文件有执行权限：`chmod +x Delightify-x.x.x.AppImage`
- [ ] 双击能启动（或在终端运行）
- [ ] 界面显示正常

### deb 包测试（Ubuntu/Debian）
```bash
# 安装
sudo dpkg -i delightify_x.x.x_amd64.deb
sudo apt-get install -f  # 如有依赖问题

# 启动
Delightify
# 或在应用菜单中查找
```

- [ ] 安装无报错
- [ ] 应用菜单中有入口
- [ ] 功能正常

---

## 🔍 性能测试

### 启动性能
- [ ] 冷启动时间 < 3 秒
- [ ] 热启动时间 < 1 秒

### 运行性能
- [ ] 内存占用 < 500 MB
- [ ] CPU 占用 < 10%（空闲时）
- [ ] 切换页面无卡顿

### 长时间运行
- [ ] 连续运行 1 小时不崩溃
- [ ] 内存无持续泄漏（Task Manager 观察）

---

## 🎨 界面测试

### 分辨率适配
- [ ] 1280x720（最小支持分辨率）
- [ ] 1920x1080（标准分辨率）
- [ ] 2560x1440（2K 分辨率）
- [ ] 4K 分辨率（如有条件）

### 主题测试
- [ ] 浅色模式文字清晰可读
- [ ] 深色模式文字清晰可读
- [ ] 切换主题时无闪烁

---

## 📁 文件路径测试

### Windows
- [ ] 路径含空格：`C:\Program Files\Delightify\`
- [ ] 路径含中文：`C:\用户\用户名\Delightify\`

### Mac
- [ ] 路径含空格：`/Users/username/Application Support/Delightify/`
- [ ] 路径含中文：`/Users/用户名/Delightify/`

### Linux
- [ ] 路径含空格：`/home/user/.config/Delightify/`

---

## 🌐 国际化测试

### 中文模式
- [ ] 所有界面文字为中文
- [ ] 无乱码
- [ ] 文字无截断

### 英文模式
- [ ] 所有界面文字为英文
- [ ] 布局正常（英文通常更长）

---

## 🔒 安全测试

- [ ] 杀毒软件无误报（Windows Defender 等）
- [ ] 代码签名（如有证书）

---

## 📝 发布前最终检查

### 版本信息
- [ ] `package.json` 版本号正确
- [ ] 应用内显示的版本号正确
- [ ] Git 标签已打（`git tag v0.x.x`）

### 文档
- [ ] README.md 已更新
- [ ] CHANGELOG.md 已更新

### 资源
- [ ] 图标文件完整
- [ ] 配置文件已包含

---

## 🚀 发布流程

```bash
# 1. 更新版本号
# 修改所有 package.json 中的 version 字段

# 2. 提交
git add .
git commit -m "chore: release v0.2.0"

# 3. 打标签
git tag v0.2.0

# 4. 推送
git push origin main --tags

# 5. 等待 GitHub Actions 构建完成
# 访问 https://github.com/你的用户名/Delightify/actions

# 6. 发布 Release
# 访问 https://github.com/你的用户名/Delightify/releases
# 编辑草稿 Release，上传构建产物，发布
```

---

## 🐛 常见问题速查

### 问题：Windows 打包后运行闪退
**排查步骤**：
1. 在 `release/win-unpacked/` 中找到 `.exe`
2. 打开命令行运行：`Delightify.exe`
3. 查看报错信息
4. 常见原因：
   - Node 原生模块未正确编译
   - 资源路径错误
   - 缺少 VC++ 运行库

### 问题：Mac 提示"无法验证开发者"
**解决**：
1. 系统设置 → 隐私与安全性 → 仍要打开
2. 或右键点击应用 → 打开

### 问题：Linux AppImage 无法运行
**解决**：
```bash
chmod +x Delightify-x.x.x.AppImage
./Delightify-x.x.x.AppImage
```

### 问题：打包后资源文件缺失
**解决**：检查 `package.json` 的 `build.files` 配置

---

## 📊 测试矩阵

| 平台 | 版本 | 测试人 | 日期 | 结果 |
|------|------|--------|------|------|
| Windows 10 | 0.1.0 | | | |
| Windows 11 | 0.1.0 | | | |
| macOS Intel | 0.1.0 | | | |
| macOS Apple Silicon | 0.1.0 | | | |
| Ubuntu 22.04 | 0.1.0 | | | |
| Fedora 39 | 0.1.0 | | | |

---

*完成所有检查项后再发布！*

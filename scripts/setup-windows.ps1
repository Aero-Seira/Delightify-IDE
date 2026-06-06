#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Delightify Windows 开发环境设置脚本
    Windows Development Environment Setup Script for Delightify

.DESCRIPTION
    此脚本帮助 Windows 用户快速设置 Delightify 开发环境
    This script helps Windows users quickly set up the Delightify development environment

.EXAMPLE
    .\scripts\setup-windows.ps1

.NOTES
    需要以普通用户身份运行（不需要管理员权限）
    Run as regular user (administrator privileges not required)
#>

[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$SkipBuild,
    [switch]$VerboseBuild
)

# 设置错误处理
$ErrorActionPreference = "Stop"

# 颜色输出函数
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# 显示欢迎信息
Write-Host @"
========================================
  Delightify Windows 开发环境设置
  Development Environment Setup
========================================
"@ -ForegroundColor Blue

# 检查 Node.js
Write-Info "Checking Node.js installation..."
try {
    $nodeVersion = node --version
    $nodeVersionNumber = [version]($nodeVersion -replace '^v', '')
    $requiredVersion = [version]"18.0.0"
    
    if ($nodeVersionNumber -lt $requiredVersion) {
        Write-Error "Node.js version must be >= 18.0.0, current: $nodeVersion"
        Write-Info "Please download from: https://nodejs.org/"
        exit 1
    }
    Write-Success "Node.js version: $nodeVersion"
} catch {
    Write-Error "Node.js not found!"
    Write-Info "Please download from: https://nodejs.org/"
    exit 1
}

# 检查 pnpm
Write-Info "Checking pnpm installation..."
try {
    $pnpmVersion = pnpm --version
    $pnpmVersionNumber = [version]$pnpmVersion
    $requiredPnpmVersion = [version]"9.0.0"
    
    if ($pnpmVersionNumber -lt $requiredPnpmVersion) {
        Write-Warning "pnpm version should be >= 9.0.0, current: $pnpmVersion"
        Write-Info "Updating pnpm..."
        npm install -g pnpm@9
    }
    Write-Success "pnpm version: $pnpmVersion"
} catch {
    Write-Warning "pnpm not found, installing..."
    try {
        npm install -g pnpm@9
        Write-Success "pnpm installed successfully"
    } catch {
        Write-Error "Failed to install pnpm"
        Write-Info "Try running: npm install -g pnpm@9"
        exit 1
    }
}

# 检查 Git
Write-Info "Checking Git installation..."
try {
    $gitVersion = git --version
    Write-Success "Git version: $gitVersion"
} catch {
    Write-Warning "Git not found. It's recommended for development."
    Write-Info "Download from: https://git-scm.com/download/win"
}

# 获取项目根目录
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Info "Project root: $projectRoot"

# 安装依赖
if (-not $SkipInstall) {
    Write-Info "Installing dependencies..."
    try {
        pnpm install
        if ($LASTEXITCODE -ne 0) { throw "pnpm install failed" }
        Write-Success "Dependencies installed"
    } catch {
        Write-Error "Failed to install dependencies: $_"
        exit 1
    }
} else {
    Write-Info "Skipping dependency installation (--SkipInstall)"
}

# 构建项目
if (-not $SkipBuild) {
    Write-Info "Building project..."
    try {
        if ($VerboseBuild) {
            pnpm build
        } else {
            pnpm build 2>&1 | ForEach-Object { 
                if ($_ -match "error|Error|failed|Failed") { Write-Host $_ -ForegroundColor Red }
                else { Write-Host $_ }
            }
        }
        if ($LASTEXITCODE -ne 0) { throw "Build failed" }
        Write-Success "Project built successfully"
    } catch {
        Write-Error "Failed to build project: $_"
        exit 1
    }
} else {
    Write-Info "Skipping build (--SkipBuild)"
}

# 运行类型检查
Write-Info "Running type check..."
try {
    $typeCheckOutput = pnpm typecheck 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Type check passed"
    } else {
        Write-Warning "Type check completed with warnings"
        Write-Host $typeCheckOutput
    }
} catch {
    Write-Warning "Type check encountered issues: $_"
}

# 显示完成信息
Write-Host @"

========================================
  设置完成! / Setup Complete!
========================================

可用命令 / Available commands:

  开发模式 / Development:
    pnpm dev

  安全模式（兼容性）/ Safe mode (compatibility):
    pnpm dev:safe

  构建 / Build:
    pnpm build

  类型检查 / Type check:
    pnpm typecheck

  清理 / Clean:
    pnpm clean

  Windows 打包 / Windows packaging:
    pnpm dist:win

更多帮助 / More help:
  docs/windows-build.md

"@ -ForegroundColor Green

# 检查常见问题
Write-Info "Checking for common issues..."

# 检查 PowerShell 执行策略
$executionPolicy = Get-ExecutionPolicy
if ($executionPolicy -eq "Restricted") {
    Write-Warning "PowerShell execution policy is Restricted"
    Write-Info "If you encounter script execution issues, run:"
    Write-Info "  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser"
}

Write-Success "Setup completed! You can now run: pnpm dev"

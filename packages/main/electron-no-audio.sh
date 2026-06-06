#!/bin/bash
# 禁用音频启动 Electron（用于 Linux 环境缺少 ALSA 支持的情况）

export ELECTRON_DISABLE_SECURITY_WARNINGS=true

# 启动 Electron 时禁用音频
cd "$(dirname "$0")"
../../node_modules/.bin/electron . --disable-features=AudioServiceOutOfProcess "$@"

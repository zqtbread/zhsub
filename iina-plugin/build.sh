#!/bin/bash
# 把 iina-plugin/ 源码打包成 IINA 可加载的 .iinaplgz 插件包
set -e
cd "$(dirname "$0")"
rm -f com.wangxiaogang.zhsub.iinaplgz
zip -r -X com.wangxiaogang.zhsub.iinaplgz Info.json entry.js pref.html
echo "已生成 com.wangxiaogang.zhsub.iinaplgz"
echo "安装方式：双击该文件，或将其拷到 ~/Library/Application Support/IINA/plugins/（旧版 IINA 可能在 com.colliderli.iina/Plugins/）。"

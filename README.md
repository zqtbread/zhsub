# zhsub — 中文字幕下载（OpenSubtitles）

为 macOS 下载中文字幕（简体 + 繁体）的小工具，提供两种用法：

- **独立下载 app**：拖放视频文件，按文件名搜索中文字幕并下载到**视频同目录**（绕过播放器沙盒限制）。
- **IINA 插件**：集成进 IINA「字幕 › 查找在线字幕」，一键搜索下载。

数据源为 [OpenSubtitles](https://www.opensubtitles.com) 官方 v1 API。

> ⚠️ 本仓库**不内置任何账号密码**，你需要使用**自己的** OpenSubtitles 账号（免费注册）。

## 一、准备你自己的 OpenSubtitles 账号

1. 去 <https://www.opensubtitles.com> 注册（免费）。
2. 在账户设置页申请一个 **API Key**（OpenSubtitles v1 API 必需，免费）。

## 二、配置凭据（推荐方式 1，app 与插件共用）

**方式 1（推荐）：**
```bash
python3 setup_credentials.py
```
按提示输入 API Key、用户名、密码，会存入 macOS 钥匙串（service=`zhsub`）。一次配置，独立 app 与 IINA 插件都能读取。

**方式 2（仅 IINA 插件）：**
打开 IINA「偏好设置 › 插件 › 中文字幕下载」的 ⓘ 按钮，在设置页填写 API Key / 用户名 / 密码。

## 三、安装

### 独立下载 app

**普通用户（推荐）：** 到本仓库的 [Releases](https://github.com/zqtbread/zhsub/releases) 页面下载 `zhsub-macos-app.zip`，解压即得 `字幕下载.app`，拖到「应用程序」文件夹即可。

> ⚠️ 不要直接点仓库主页的 "Download ZIP" 或 clone 后用 `字幕下载.app`——那样 `.app` 内的启动脚本会丢失可执行权限，双击会报「无法打开」。请务必从 **Releases** 下载已打包好的 zip（已保留权限）。

使用：
- 双击打开 → 选择视频（可多选）；或
- 把视频文件直接拖到 app 图标上。

字幕会下载到视频同目录（如 `电影.mkv` → `电影.zh-CN.srt`）。

> 首次双击若提示「无法打开，因为来自身份不明的开发者」，请右键 → 打开，或在终端执行：
> `xattr -dr com.apple.quarantine "/Applications/字幕下载.app"`

纯命令行用法：
```bash
python3 zhsub_downloader.py "/路径/到/视频.mkv"
```

### IINA 插件
```bash
cd iina-plugin && bash build.sh
```
双击生成的 `com.wangxiaogang.zhsub.iinaplgz` 安装；或手动把 `entry.js` / `Info.json` / `pref.html` 放进
`~/Library/Application Support/IINA/plugins/com.wangxiaogang.zhsub.iinaplugin/`
（旧版 IINA 路径可能是 `com.colliderli.iina/Plugins/com.wangxiaogang.zhsub.iinaplugin/`）。

装完后**彻底退出并重启 IINA**（⌘+Q 再开），在「字幕 › 查找在线字幕」选择「中文字幕(OpenSubtitles)」。

## 四、已知限制

- **IINA 插件沙盒限制**：受 IINA 沙盒约束，插件下载的字幕**可能写不进外接磁盘**，会回退到插件目录（仍能加载，但不在视频同目录）。若需要字幕落在视频同目录，请用「独立下载 app」。
- **每日限额**：OpenSubtitles 免费账户每天 20 次下载。
- **中文资源**：OpenSubtitles 中文不如国内字幕组全，搜不到时可改用英文原名（如 `Leon The Professional`）。

## 五、许可证

MIT © zqtbread — 详见 [LICENSE](LICENSE)。

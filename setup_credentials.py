#!/usr/bin/env python3
# 首次配置 OpenSubtitles 凭据，写入 macOS 钥匙串（service=zhsub）。
# 之后运行 zhsub_downloader.py / IINA 插件均可免填读取。
#
# 没有账号？先去 https://www.opensubtitles.com 注册，
# 并在账户设置页申请一个免费的 API Key（OpenSubtitles v1 API 必需）。
import subprocess, getpass

def set_kc(account, value):
    # -U: 若钥匙串中该项目已存在则更新，否则创建
    r = subprocess.run(["security", "add-generic-password", "-s", "zhsub", "-a", account,
                        "-w", value, "-U"],
                       capture_output=True, text=True)
    if r.returncode != 0:
        print("保存失败:", r.stderr.strip())
        raise SystemExit(1)

def main():
    print("=== OpenSubtitles 凭据配置（仅首次需要）===")
    print("没有账号？先去 https://www.opensubtitles.com 注册，")
    print("并在账户设置页申请免费 API Key（v1 API 必需）。")
    apiKey = input("API Key: ").strip()
    username = input("用户名: ").strip()
    password = getpass.getpass("密码: ")
    if not apiKey or not username or not password:
        print("三项都必须填写。"); raise SystemExit(1)
    set_kc("apiKey", apiKey)
    set_kc("username", username)
    set_kc("password", password)
    print("凭据已保存到 macOS 钥匙串（service=zhsub）。")
    print("之后运行 zhsub_downloader.py 或使用 IINA 插件均无需再填。")

if __name__ == "__main__":
    main()

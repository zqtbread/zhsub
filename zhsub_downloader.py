#!/usr/bin/env python3
# 中文字幕下载器（OpenSubtitles 官方 v1 API）— 开源版
#
# 凭据从 macOS 钥匙串读取（service=zhsub），首次使用前请先运行 setup_credentials.py 配置。
# 用法: python3 zhsub_downloader.py "<视频文件路径>"
# 作用: 按视频文件名搜中文字幕(简体优先, 繁体其次)，下载到视频同目录 (视频名.zh-CN.srt)
# 依赖: macOS 自带 python3（urllib + subprocess），无需 pip 安装。
import sys, os, json, re, subprocess, urllib.parse, urllib.request

API = "https://api.opensubtitles.com/api/v1"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
KC_SERVICE = "zhsub"

def _kc_get(account):
    """从 macOS 钥匙串读取凭据（service=zhsub）。"""
    try:
        r = subprocess.run(["security", "find-generic-password", "-s", KC_SERVICE,
                            "-a", account, "-w"],
                           capture_output=True, text=True, timeout=10)
        return r.stdout.strip() if r.returncode == 0 else ""
    except Exception:
        return ""

def load_credentials():
    return {
        "apiKey": _kc_get("apiKey"),
        "username": _kc_get("username"),
        "password": _kc_get("password"),
        "token": None,
    }

def req(method, url, data=None, creds=None):
    headers = {"User-Agent": UA, "Api-Key": creds["apiKey"],
               "Content-Type": "application/json", "Accept": "application/json"}
    if creds.get("token"):
        headers["Authorization"] = "Bearer " + creds["token"]
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=30) as resp:
        return resp.read().decode("utf-8")

def login(creds):
    js = req("POST", API + "/login",
             {"username": creds["username"], "password": creds["password"],
              "grant_type": "password"}, creds)
    creds["token"] = json.loads(js)["token"]
    return creds

def search(creds, query):
    url = API + "/subtitles?query=" + urllib.parse.quote(query) + "&languages=zh-CN,zh-TW&limit=30"
    return json.loads(req("GET", url, creds=creds))

def best_sub(data):
    zh = [s for s in data if s.get("attributes", {}).get("language") == "zh-CN"]
    if not zh:
        zh = [s for s in data if s.get("attributes", {}).get("language") == "zh-TW"]
    if not zh:
        zh = data
    return zh[0]

def download(creds, file_id):
    js = req("POST", API + "/download", {"file_id": file_id}, creds)
    return json.loads(js)["link"]

def fetch_sub(creds, link, out):
    headers = {"User-Agent": UA, "Api-Key": creds["apiKey"],
               "Authorization": "Bearer " + creds["token"]}
    r = urllib.request.Request(link, headers=headers)
    with urllib.request.urlopen(r, timeout=60) as resp:
        data = resp.read()
    with open(out, "wb") as f:
        f.write(data)
    return len(data)

def clean(name):
    """去掉文件名里的年份、分辨率、编码、发布组等噪音，提高搜索命中。"""
    n = re.sub(r"\(.*?\)|\[.*?\]", " ", name)
    n = re.sub(r"\b(1080p|720p|2160p|BDrip|BRrip|WEBrip|HDrip|BluRay|x264|x265|h264|h265|HEVC|AC3|AAC|DD5\.1|DTS|TrueHD|Atmos|10bit|10-bit|PROPER|REPACK|EXTENDED|Director'?s?[ .]?cut|Uncensored|Remastered|IMAX|YIFY|ETRG|GalaxyRG|RARBG|PSA|emulesonic\.com|by\.[\w-]+)\b", " ", name, flags=re.I)
    n = re.sub(r"\b(19|20)\d{2}\b", " ", n)
    n = re.sub(r"[._]", " ", n)
    return re.sub(r"\s+", " ", n).strip()

def main():
    if len(sys.argv) < 2:
        print("用法: python3 zhsub_downloader.py <视频文件路径>")
        sys.exit(1)
    path = sys.argv[1]
    if not os.path.isfile(path):
        print("文件不存在:", path); sys.exit(1)
    creds = load_credentials()
    if not creds["apiKey"] or not creds["username"] or not creds["password"]:
        print("未找到 OpenSubtitles 凭据。请先运行: python3 setup_credentials.py")
        sys.exit(1)
    base = os.path.splitext(path)[0]
    raw = os.path.splitext(os.path.basename(path))[0]
    print("视频:", raw)
    login(creds)
    print("登录成功")
    seen, queries = set(), []
    for q in [raw, clean(raw)]:
        if q and q not in seen:
            seen.add(q); queries.append(q)
    for q in queries:
        print("搜索:", q)
        data = search(creds, q).get("data", [])
        if not data:
            print("  无结果"); continue
        sub = best_sub(data)
        lang = sub["attributes"].get("language", "zh-CN")
        fid = sub["attributes"]["files"][0]["file_id"]
        print("  命中语言:", lang, "file_id:", fid)
        link = download(creds, fid)
        out = base + "." + lang + ".srt"
        size = fetch_sub(creds, link, out)
        print("已保存:", out, "(", size, "字节 )")
        return
    print("未找到可用的中文字幕。可试试用英文名(如 Leon The Professional)再跑一次。")
    sys.exit(2)

if __name__ == "__main__":
    main()

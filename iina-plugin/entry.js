// 中文字幕下载插件（OpenSubtitles 官方 v1 API）— 开源版 v1.4.0
// 集成到 IINA「字幕 › 查找在线字幕」菜单，按当前视频文件名搜索中文字幕并下载。
//
// 开源版说明：
//   * 不内置任何账号密码。凭据来源（二选一，前者优先）：
//       1) IINA 插件「偏好设置」中填写（pref.html，存于 IINA preferences）；
//       2) macOS 钥匙串（service=zhsub，由 setup_credentials.py 写入，
//          与独立下载 app 共用，配一次即可两边使用）。
//   * 彻底弃用 iina.utils.exec，全部用官方 iina.http（网络）+ iina.file（读写），零 exec 依赖。
//   * 字幕优先保存到【视频文件同目录】；受 IINA 沙盒限制写不进外接盘时，
//     回退到插件目录（仍能加载，但不在视频同目录）。
//   * 搜索语言固定 zh-CN,zh-TW（简体+繁体）。浏览器级 UA 最稳。
const PROVIDER_ID = "zhsub";
const API = "https://api.opensubtitles.com/api/v1";
// 浏览器级 UA，避免被 OpenSubtitles 网关偶发拦截
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const KC_SERVICE = "zhsub";        // 与独立 app 共用的钥匙串 service 名
const DATA = "@data/";             // IINA 插件数据目录约定

let jwt = null; // 内存缓存登录 token

function log(m) { console.log("[ZhSub] " + m); }
function osd(m) { try { iina.core.osd(m); } catch (e) { log("osd err: " + e); } }

// 读取凭据：IINA preferences 优先，其次 macOS 钥匙串（由 setup_credentials.py 写入）
function getCred(acc) {
  try {
    if (iina.preferences && typeof iina.preferences.get === "function") {
      const v = iina.preferences.get(acc);
      if (v && String(v).trim()) return String(v);
    }
  } catch (e) { log("preferences read err: " + e); }
  try {
    const k = iina.utils.keyChainRead(KC_SERVICE, acc);
    if (k && String(k).trim()) return String(k);
  } catch (e) {}
  return "";
}

// 统一解析 http 响应：优先 res.data（已解析对象），否则 JSON.parse(res.text)
function body(res) {
  if (res && res.data && typeof res.data === "object") return res.data;
  if (res && res.data && typeof res.data === "string") {
    try { return JSON.parse(res.data); } catch (e) {}
  }
  if (res && typeof res.text === "string") {
    try { return JSON.parse(res.text); } catch (e) { return res.text; }
  }
  return null;
}

// 取得当前视频路径信息：{dir, base, baseNoExt, full}
function getMediaInfo() {
  let raw = "";
  try {
    const st = iina.core.status || {};
    raw = st.url || st.path || st.filename || "";
    if (!raw && st.playlist && st.playlist.current) raw = st.playlist.current.url || "";
  } catch (e) { log("status read err: " + e); }
  if (!raw) return null;
  if (raw.indexOf("file://") === 0) raw = raw.slice(7);
  try { raw = decodeURIComponent(raw); } catch (e) {}
  raw = raw.split("?")[0].split("#")[0];
  const base = raw.split("/").pop() || "";
  const dir = raw.slice(0, Math.max(0, raw.length - base.length - 1)) || null;
  const baseNoExt = base.replace(/\.[^.]+$/, "");
  return { dir, base, baseNoExt, full: raw };
}

// 登录拿 token（下载字幕必须）
async function login() {
  if (jwt) return jwt;
  const user = getCred("username"), pass = getCred("password"), key = getCred("apiKey");
  if (!user || !pass || !key) {
    osd("缺少 OpenSubtitles 凭据：请在 IINA 插件偏好设置填写，或运行 setup_credentials.py");
    return null;
  }
  try {
    const res = await iina.http.post(API + "/login", {
      headers: {
        "Api-Key": key, "User-Agent": UA,
        "Content-Type": "application/json", "Accept": "application/json",
      },
      data: { username: user, password: pass },
    });
    const j = body(res);
    const token = j && j.token;
    if (token) { jwt = token; log("login ok"); return jwt; }
    log("login no token: " + JSON.stringify(j).slice(0, 200));
    osd("OpenSubtitles 登录失败，请检查账号/API Key"); return null;
  } catch (e) { log("login err: " + e); osd("OpenSubtitles 登录失败：" + (e && e.message || e)); return null; }
}

// 搜索中文字幕（简体+繁体）
async function search() {
  const info = getMediaInfo();
  let query = info ? info.baseNoExt : "";
  if (!query) { try { query = (iina.core.status && iina.core.status.title) || ""; } catch (e) {} }
  if (!query) { osd("无法获取视频名称，请改用英文名重试"); return []; }
  log("search query: " + query);
  const key = getCred("apiKey");
  const token = await login();
  const headers = { "Api-Key": key, "User-Agent": UA, "Accept": "application/json" };
  if (token) headers["Authorization"] = "Bearer " + token;
  const url = API + "/subtitles?query=" + encodeURIComponent(query) +
    "&languages=zh-CN,zh-TW&limit=30";
  try {
    const res = await iina.http.get(url, { headers });
    const j = body(res);
    const items = [];
    (j && j.data || []).forEach(s => {
      const a = s.attributes || {};
      (a.files || []).forEach(f => {
        items.push(iina.subtitle.item({
          title: a.movie || a.release || (a.feature_details && a.feature_details.movie_name) || query,
          lang: (a.language || "zh").toLowerCase(),
          format: (a.format || "srt").toLowerCase(),
          fileId: f.file_id,
          fileName: query,
        }));
      });
    });
    log("search '" + query + "' -> " + items.length + " 条");
    if (items.length === 0) osd("未找到中文字幕，试试用英文原名搜索");
    return items;
  } catch (e) { log("search err: " + e); osd("字幕搜索失败：" + (e && e.message || e)); return []; }
}

// 列表展示
function describe(item) {
  const d = item.data;
  return { name: d.title || "字幕", left: (d.lang || "zh").toUpperCase(), right: "OpenSubtitles" };
}

// 取得下载目标路径（视频同目录优先），返回 {dir, baseName, langTag}
function targetInfo(d) {
  const info = getMediaInfo();
  let outDir = null;
  let baseName = (d.fileName || "sub").replace(/[^\w.\-\u4e00-\u9fa5]/g, "_").slice(0, 80);
  if (info && info.dir) {
    outDir = info.dir;
    baseName = (info.baseNoExt || baseName).replace(/[^\w.\-\u4e00-\u9fa5]/g, "_").slice(0, 100);
  }
  const langTag = (d.lang || "zh").toLowerCase();
  return { outDir, baseName, langTag };
}

// 下载字幕，返回本地路径数组（IINA 自动加载）
async function download(item) {
  const d = item.data;
  const key = getCred("apiKey");
  const token = await login();
  if (!token) { osd("登录失败，无法下载（请重试或检查账号）"); return []; }
  const { outDir, baseName, langTag } = targetInfo(d);
  try {
    const res = await iina.http.post(API + "/download", {
      headers: {
        "Api-Key": key, "User-Agent": UA,
        "Content-Type": "application/json", "Accept": "application/json",
        "Authorization": "Bearer " + token,
      },
      data: { file_id: d.fileId },
    });
    const rj = body(res) || {};
    const link = rj.link;
    const fname = rj.file_name || "";
    if (!link) { osd("未获得下载链接（可能已达每日 20 次限额）"); return []; }
    const ext = (fname.split(".").pop() || "").toLowerCase();
    const safeExt = (ext === "ass") ? "ass" : (ext === "vtt") ? "vtt" : "srt";
    // 压缩包：无法在插件内解压，引导用户手动下载
    if (ext === "zip") {
      osd("该字幕为压缩包，请浏览器手动下载：" + link);
      log("zip 字幕，link=" + link);
      return [];
    }
    const finalName = baseName + "." + langTag + "." + safeExt;

    // 优先：直接下载到视频同目录（若 IINA 允许写沙盒外路径）
    let dest = null;
    if (outDir) {
      const candidate = outDir + "/" + finalName;
      try {
        await iina.http.download(link, candidate);
        if (iina.file.exists(candidate)) dest = candidate;
        else log("直下视频同目录：文件未落地，回退");
      } catch (e) { log("直下视频同目录失败: " + e); }
    }
    // 回退 A：下到插件目录，再 read+write 复制到视频同目录
    if (!dest && outDir) {
      const tmpName = DATA + "dl_" + d.fileId;
      try {
        await iina.http.download(link, tmpName);
        const content = iina.file.read(tmpName);
        const candidate = outDir + "/" + finalName;
        iina.file.write(candidate, content);
        if (iina.file.exists(candidate)) dest = candidate;
        else log("write 视频同目录未落地，回退 @data");
      } catch (e) { log("复制失败: " + e); }
    }
    // 最终回退：保存在插件数据目录（仍能加载）
    if (!dest) {
      const fb = DATA + "sub_" + d.fileId + "." + langTag + "." + safeExt;
      try {
        await iina.http.download(link, fb);
        if (iina.file.exists(fb)) dest = fb;
        else { const c = iina.file.read(DATA + "dl_" + d.fileId); iina.file.write(fb, c); dest = fb; }
      } catch (e) { log("最终回退下载失败: " + e); osd("字幕下载出错（详见 IINA 插件控制台）"); return []; }
    }
    const shown = dest.startsWith(DATA) ? ("插件目录 " + dest) : dest.split("/").pop();
    osd("字幕已保存：" + shown);
    log("字幕已保存: " + dest);
    return [dest];
  } catch (e) { log("download err: " + e); osd("字幕下载出错：" + (e && e.message || e)); return []; }
}

iina.subtitle.registerProvider(PROVIDER_ID, {
  search,
  description: describe,
  download,
});

console.log("[ZhSub] 中文字幕(OpenSubtitles) v1.4.0 已注册，字幕优先保存到视频同目录");

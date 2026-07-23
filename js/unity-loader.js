/* ============================================================
   Unity WebGL 加载器
   ------------------------------------------------------------
   接入步骤（详见 README.md）：
   1. Unity 中 File → Build Settings → WebGL → Build，导出 WebGL 包；
   2. 把导出产物中的 Build/ 文件夹整个拷入本站 game/ 目录；
   3. 把下面 UNITY_CONFIG.buildName 改成你的构建文件名前缀
      （即 Build/ 里 xxx.loader.js 的 xxx 部分）；
   4. 用本地静态服务器打开网站（不能 file:// 直接双击）。
   未接入 Build 时，游戏窗口自动显示「游戏即将上线」占位封面。

   关于 data 大文件（当前方案：分卷）：
   PAGE.data.unityweb 约 113MB，超过 GitHub 单文件 100MB 限制，
   且 GitHub Pages 不支持 Git LFS，因此切成两个 <100MB 的
   .part1 / .part2 分卷直接提交进仓库。加载时本脚本按顺序下载
   各分卷、在浏览器内拼接为完整 Blob，再交给 Unity，行为与
   直接下载完整文件完全一致（已按字节校验）。
   ============================================================ */
(function () {
  'use strict';

  var UNITY_CONFIG = {
    buildDir: 'game/Build',   // Unity Build 文件夹在本站的位置
    buildName: 'PAGE', // TODO: 改成你的 xxx.loader.js 的前缀 xxx
    // data 分卷列表（按拼接顺序填写）。留空数组 [] 则改为探测整文件。
    dataParts: [
      'game/Build/PAGE.data.unityweb.part1',
      'game/Build/PAGE.data.unityweb.part2'
    ],
    // data 完整文件的外部直链（如 GitHub Releases / 对象存储）。
    // 填了会优先于 dataParts；留空（''）表示不用。
    dataUrlOverride: ''
  };

  var unityInstance = null;

  function exists(url) {
    return fetch(url, { method: 'HEAD' })
      .then(function (r) { return r.ok; })
      .catch(function () { return false; });
  }

  /* Unity 构建产物可能带 .unityweb / .br / .gz 压缩后缀，依次探测
     （当前的导出是 .unityweb：gzip 压缩 + JS 解压回退，框架会自行解压） */
  function detectExt(base) {
    return exists(base + '.unityweb').then(function (ok) {
      if (ok) return base + '.unityweb';
      return exists(base + '.br').then(function (ok2) {
        if (ok2) return base + '.br';
        return exists(base + '.gz').then(function (ok3) {
          if (ok3) return base + '.gz';
          return base;
        });
      });
    });
  }

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }

  /* 带进度回调地下载单个文件，resolve ArrayBuffer */
  function fetchWithProgress(url, onProgress) {
    return fetch(url).then(function (resp) {
      if (!resp.ok) throw new Error('下载失败 (' + resp.status + '): ' + url);
      var total = parseInt(resp.headers.get('Content-Length') || '0', 10);
      if (!resp.body || !resp.body.getReader) {
        return resp.arrayBuffer().then(function (buf) {
          if (onProgress) onProgress(buf.byteLength, buf.byteLength);
          return buf;
        });
      }
      var reader = resp.body.getReader();
      var chunks = [];
      var loaded = 0;
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) {
            var buf = new Uint8Array(loaded);
            var off = 0;
            chunks.forEach(function (c) { buf.set(c, off); off += c.length; });
            return buf.buffer;
          }
          chunks.push(r.value);
          loaded += r.value.length;
          if (onProgress) onProgress(loaded, total);
          return pump();
        });
      }
      return pump();
    });
  }

  /* 顺序下载所有分卷并拼接，resolve 完整 data 文件的 Blob URL */
  function loadDataParts(parts, onProgress) {
    // 先 HEAD 获取各分卷大小，用于计算总进度
    return Promise.all(parts.map(function (u) {
      return fetch(u, { method: 'HEAD' }).then(function (r) {
        if (!r.ok) throw new Error('分卷不存在 (' + r.status + '): ' + u);
        return parseInt(r.headers.get('Content-Length') || '0', 10);
      });
    })).then(function (sizes) {
      var totalAll = sizes.reduce(function (a, b) { return a + b; }, 0) || 1;
      var loadedArr = parts.map(function () { return 0; });
      function report() {
        var loadedAll = loadedArr.reduce(function (a, b) { return a + b; }, 0);
        if (onProgress) onProgress(loadedAll / totalAll);
      }
      var buffers = [];
      var chain = Promise.resolve();
      parts.forEach(function (u, i) {
        chain = chain.then(function () {
          return fetchWithProgress(u, function (loaded) {
            loadedArr[i] = loaded;
            report();
          }).then(function (buf) { buffers.push(buf); });
        });
      });
      return chain.then(function () {
        var blob = new Blob(buffers, { type: 'application/octet-stream' });
        return URL.createObjectURL(blob);
      });
    });
  }

  function initGame() {
    var win = document.querySelector('.game-window');
    if (!win) return; // 非首页不执行

    var canvas = document.getElementById('unity-canvas');
    var cover = win.querySelector('.game-cover');
    var progress = win.querySelector('.unity-progress');
    var progressFill = win.querySelector('.unity-progress-fill');
    var progressText = win.querySelector('.unity-progress-text');
    var fsBtn = win.querySelector('.game-fullscreen-btn');

    /* 全屏：已加载 Unity 实例走 SetFullscreen，否则对容器用 Fullscreen API */
    if (fsBtn) {
      fsBtn.addEventListener('click', function () {
        if (unityInstance) {
          unityInstance.SetFullscreen(1);
        } else if (win.requestFullscreen) {
          win.requestFullscreen();
        }
      });
    }

    var base = UNITY_CONFIG.buildDir + '/' + UNITY_CONFIG.buildName;
    var useParts = !UNITY_CONFIG.dataUrlOverride &&
                   UNITY_CONFIG.dataParts && UNITY_CONFIG.dataParts.length > 0;
    /* 用分卷时：0–70% 为分卷下载，70–100% 为 Unity 引擎加载 */
    var unityBase = useParts ? 70 : 0;

    function setProgress(pct, text) {
      pct = Math.max(0, Math.min(100, Math.round(pct)));
      if (progressFill) progressFill.style.width = pct + '%';
      if (progressText) progressText.textContent = text || ('游戏加载中… ' + pct + '%');
    }

    exists(base + '.loader.js').then(function (hasLoader) {
      if (!hasLoader) return; // 未接入 Build，保留占位封面

      // 已检测到构建文件：显示进度条，开始加载
      if (progress) progress.classList.add('show');

      var dataPromise;
      if (UNITY_CONFIG.dataUrlOverride) {
        dataPromise = Promise.resolve(UNITY_CONFIG.dataUrlOverride);
      } else if (useParts) {
        dataPromise = loadDataParts(UNITY_CONFIG.dataParts, function (frac) {
          setProgress(frac * 70, '下载游戏资源… ' + Math.round(frac * 100) + '%');
        });
      } else {
        dataPromise = detectExt(base + '.data');
      }

      Promise.all([
        dataPromise,
        detectExt(base + '.framework.js'),
        detectExt(base + '.wasm')
      ]).then(function (urls) {
        return loadScript(base + '.loader.js').then(function () {
          return createUnityInstance(canvas, {
            dataUrl: urls[0],
            frameworkUrl: urls[1],
            codeUrl: urls[2],
            streamingAssetsUrl: 'StreamingAssets',
            companyName: 'TianGongLu',
            productName: '天工录之岁岁烟火铺',
            productVersion: '1.0'
          }, function (p) {
            setProgress(unityBase + p * (100 - unityBase));
          });
        });
      }).then(function (instance) {
        unityInstance = instance;
        if (progress) progress.classList.remove('show');
        if (cover) cover.style.display = 'none'; // 隐藏占位封面，露出游戏画面
      }).catch(function (err) {
        console.error('Unity WebGL 加载失败：', err);
        if (progress) progress.classList.remove('show');
        if (cover) {
          var sub = cover.querySelector('.game-cover-sub');
          if (sub) sub.textContent = '游戏加载失败，请检查 game/Build 文件与 UNITY_CONFIG 配置';
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', initGame);
})();

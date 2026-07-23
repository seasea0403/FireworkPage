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
   ============================================================ */
(function () {
  'use strict';

  var UNITY_CONFIG = {
    buildDir: 'game/Build',   // Unity Build 文件夹在本站的位置
    buildName: 'PAGE', // TODO: 改成你的 xxx.loader.js 的前缀 xxx
    // data 大文件的独立地址（可选项）。
    // 场景：部署到 GitHub Pages 时，>100MB 的 .data.unityweb 无法随仓库分发
    // （GitHub Pages 不支持 Git LFS，只会返回指针文本），需把该文件上传到
    // GitHub Releases 或其他对象存储，然后把完整下载地址填在这里，例如：
    // dataUrlOverride: 'https://github.com/seasea0403/FireworkPage/releases/download/v1.0/PAGE.data.unityweb'
    // 留空（''）则使用本站 game/Build 下的本地文件（本地预览就是这种情况）。
    dataUrlOverride: ''
  };

  var unityInstance = null;

  function exists(url) {
    return fetch(url, { method: 'HEAD' })
      .then(function (r) { return r.ok; })
      .catch(function () { return false; });
  }

  /* Unity 构建产物可能带 .unityweb / .br / .gz 压缩后缀，依次探测
     （你当前的导出是 .unityweb：gzip 压缩 + JS 解压回退，框架会自行解压） */
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

    exists(base + '.loader.js').then(function (hasLoader) {
      if (!hasLoader) return; // 未接入 Build，保留占位封面

      // 已检测到构建文件：显示进度条，开始加载
      if (progress) progress.classList.add('show');

      Promise.all([
        UNITY_CONFIG.dataUrlOverride
          ? Promise.resolve(UNITY_CONFIG.dataUrlOverride) // data 走外部地址（如 Releases）
          : detectExt(base + '.data'),
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
            var pct = Math.round(p * 100);
            if (progressFill) progressFill.style.width = pct + '%';
            if (progressText) progressText.textContent = '游戏加载中… ' + pct + '%';
          });
        });
      }).then(function (instance) {
        unityInstance = instance;
        if (progress) progress.classList.remove('show');
        if (cover) cover.style.display = 'none'; // 隐藏占位封面，露出游戏画面
      }).catch(function (err) {
        console.error('Unity WebGL 加载失败：', err);
        if (progress) progress.classList.remove('show');
        if (progressText) progressText.textContent = '';
        if (cover) {
          var sub = cover.querySelector('.game-cover-sub');
          if (sub) sub.textContent = '游戏加载失败，请检查 game/Build 文件与 UNITY_CONFIG 配置';
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', initGame);
})();

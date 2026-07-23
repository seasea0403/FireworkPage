# FireworkPage

《天工录之岁岁烟火铺》游戏官网 —— 纯静态 HTML/CSS/JS，无需构建工具。

## 页面

| 文件 | 栏目 |
|---|---|
| `index.html` | 官网首页（主视觉 / 开局动画 / Unity 游戏窗口 + NPC、烟花图鉴轮播 / 数据栏） |
| `story.html` | 故事背景（剧情截图轮播 / 剧情梗概 / 李畋立绘专区） |
| `culture.html` | 上栗烟花（非遗科普 + 五组实景轮播） |
| `about.html` | 关于我们（联系方式 / 品牌二维码） |

## 本地预览

WebGL 加载与视频都依赖 HTTP 协议，**不要双击 file:// 打开**，请在项目根目录起一个静态服务器：

```bash
# 任选其一
python -m http.server 8000
npx serve .
```

然后访问 `http://localhost:8000`。

## Unity WebGL 接入（三步）

1. Unity 编辑器中：`File → Build Settings → WebGL → Switch Platform → Build`，导出 WebGL 包。
2. 把导出产物里的 **`Build/` 文件夹整个**拷入本站 `game/` 目录（即 `game/Build/xxx.loader.js`、`xxx.data`、`xxx.framework.js`、`xxx.wasm`，`.br`/`.gz` 压缩后缀也支持，会自动探测）。
3. 打开 `js/unity-loader.js`，把顶部 `UNITY_CONFIG.buildName` 改成 `xxx.loader.js` 的前缀 `xxx`。

完成后再访问首页，左侧游戏窗口会自动加载游戏（带进度条），右下角全屏按钮 hover 显示。
未放入 Build 时，游戏窗口保持「游戏即将上线」占位封面，不影响其他功能。

### data 大文件的分卷方案（当前项目正在使用）

`PAGE.data.unityweb` 约 113MB，超过 GitHub 单文件 100MB 限制（GitHub Pages 也不支持 Git LFS），因此仓库里放的是两个分卷：

```
game/Build/PAGE.data.unityweb.part1  (60 MiB)
game/Build/PAGE.data.unityweb.part2  (约 48 MiB)
```

`js/unity-loader.js` 加载时会按 `UNITY_CONFIG.dataParts` 的顺序下载分卷、在浏览器内拼接成完整文件（Blob URL）再交给 Unity，玩家无感知。本地保留的完整 `PAGE.data.unityweb` 已被 `.gitignore` 忽略，不会提交。

重新导出游戏后需要重新分卷：

```bash
cd game/Build
split -b 60M -d PAGE.data.unityweb PAGE.data.unityweb.part
# 把生成的 .part00/.part01 重命名为 .part1/.part2
# 校验：cat PAGE.data.unityweb.part1 PAGE.data.unityweb.part2 | cmp - PAGE.data.unityweb
```

若分卷数量变化，同步修改 `js/unity-loader.js` 里的 `dataParts` 列表。

## 素材替换清单（同名覆盖即可，支持换成 png/jpg/mp4，记得同步改 HTML 里的扩展名）

| 路径 | 用途 |
|---|---|
| `assets/video/bg-fireworks.mp4` | 全站循环烟花背景视频（缺失时自动降级为 CSS 夜空渐变） |
| `assets/video/opening.mp4` | 首页开局动画视频 |
| `assets/img/logo/game-logo.png` | 游戏主 LOGO（导航 + 首页）✅ 已接入真实素材 |
| `assets/img/hero/hero-main.png` | 首页主视觉插画（NPC 群像 + 烟花夜空）✅ 已接入真实素材 |
| `assets/img/cover/opening-cover.svg` | 开局动画封面 |
| `assets/img/cover/game-cover.svg` | 游戏窗口占位封面 |
| `assets/img/npc/npc-1~9.png` | NPC 形象轮播 ✅ 已接入真实素材 |
| `assets/img/fireworks/fw-1~4.jpg` | 烟花图鉴轮播 ✅ 已接入真实素材 |
| `assets/img/story/story-1~3.svg` | 剧情截图轮播 |
| `assets/img/story/litian.png` | 李畋立绘 ✅ 已接入真实素材 |
| `assets/img/culture/statue-*.svg` | 李畋雕像实拍 |
| `assets/img/culture/history-*.svg` | 传统生产老照片 |
| `assets/img/culture/factory-*.svg` | 现代工厂实拍 |
| `assets/img/culture/park-*.svg` | 花炮文化园区实景 |
| `assets/img/culture/show-*.svg` | 大型烟花表演实拍 |
| `assets/img/qrcode/qrcode.svg` | 品牌二维码 |

## 占位数据修改位置

- 全网预约人数：`index.html` 中 `data-count="1280000"`
- 今日 / 累计游玩人次：`index.html` 中 `data-count="8642"` / `data-count="3568720"`
- 联系电话、邮箱：`about.html` 联络信息卡片
- 接真实接口时：`js/common.js` 里 fetch 后改写元素的 `data-count` 再触发动画即可（详见文件内注释）

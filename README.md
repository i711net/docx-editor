# 在线文档编辑器（DOCX Editor）

一个基于浏览器的 Word / WPS 兼容文档编辑器：直接在网页里打开、编辑、保存 `.docx` 文件，不需要任何后端服务器，适合部署为纯静态站点（Cloudflare Pages / Vercel / Netlify 均可）。

支持：文字格式（字体/字号/颜色/高亮/加粗斜体下划线等）、对齐与段落样式、项目符号/编号列表、表格、图片、页眉页脚、批注（评论）、修订（Track Changes / 建议模式）、目录大纲、查找替换、打印、多语言界面（已启用简体中文）。

界面基于开源项目 [`eigenpal/docx-editor`](https://github.com/eigenpal/docx-editor)（Apache-2.0 协议）的 `@eigenpal/docx-editor-react` 组件构建，本仓库只是围绕它做的一个可直接部署的最小外壳应用（`src/App.tsx`）。所有文档处理都在浏览器本地完成，文件不会被上传到任何服务器。

### 打开 .doc / PDF / HWP（工具栏"打开 DOC/PDF/HWP"按钮）

除了原生的 `.docx` 编辑，工具栏还加了一个按钮，可以打开三类"非原生"文件。这三类严格来说技术上完全不同，下面如实说明各自能做到什么程度：

| 格式 | 能做到什么 | 做不到什么 |
| --- | --- | --- |
| **WPS Office 文档**（`.docx`） | WPS 现代版本默认就是标准 OOXML，和 Word 的 `.docx` 完全一致，**已经原生支持**，不需要任何转换。 | 如果是上世纪 90 年代~2000 年代的旧版 `.wps` 二进制格式，目前没有任何开源库能解析，业界通行做法是丢给云端转换服务——本项目没有做这个。 |
| **PDF** | 用 [pdf.js](https://mozilla.github.io/pdf.js/) 提取文字内容，按行间距/字号变化启发式地拼回自然段落，转换成可以像 Word 一样自由编辑、真正重新排版的文档。 | 这是"近似还原"，不是像素级还原：多栏排版、表格、图片目前不会被保留，复杂版式的分段可能不够准确。真正做到"点开 PDF 原地改字、自动重排"这件事，连 Adobe Acrobat 都没有完全做到，开源生态里也没有成熟方案——所以这里选择的是转换路线，而不是假装能做到做不到的事。 |
| **旧版 `.doc`**（Word 97-2003 二进制格式） | 用 [`word-extractor`](https://github.com/morungos/node-word-extractor) 提取纯文字内容（分段准确，因为文件本身就有清晰的段落边界）。 | 不保留任何格式（字体、颜色、表格、图片全部丢失），纯文本导入。 |
| **HWP / HWPX**（韩国"한글"文档） | 用 [`@rhwp/core`](https://github.com/edwardkim/rhwp)（MIT 协议，Rust+WASM）在浏览器本地渲染，可以**只读预览原始排版**（分页、缩放）；点击"转换为可编辑文档"可以把文字提取出来，导入到同一个 docx 编辑器里自由编辑。 | 预览是只读的——rhwp 底层其实有一套编辑 API，但那是面向程序调用的低层 API（按 section/段落/字符偏移量操作），不是一套现成的"点哪改哪"交互，要做成真正的所见即所得 HWP 编辑器是一个独立的大工程，这里没有做。如果你需要**保留原始 HWP 格式**编辑并存回 `.hwp`，作者本人做了一个更完整的方案 [`@rhwp/editor`](https://www.npmjs.com/package/@rhwp/editor)，但它是把一个完整的编辑器界面通过 iframe 嵌入进来，默认会连接到作者托管在 `edwardkim.github.io` 的页面（也可以自建替换 `studioUrl`）——考虑到隐私和"完全离线自包含"的定位，本项目默认没有接入这个，只用了纯本地运行的 `@rhwp/core`。 |

也就是说：**.docx 是完整体验，PDF/.doc/HWP 是"转换成可编辑文档"体验**——内容找回来了，但原始版式不是全部都能保留。这是经过调研后判断更现实、更诚实的方案，而不是画一个"什么都能编辑"的饼。

## 本地运行

需要 Node.js 18+。

```bash
npm install
npm run dev
```

打开 <http://localhost:5173> 即可使用。

## 构建生产版本

```bash
npm run build
```

产物输出在 `dist/` 目录，是完全静态的文件（HTML/JS/CSS），可以直接丢进任意静态网站托管服务。

## 部署到 Cloudflare Pages

### 方式一：通过 GitHub 自动构建（推荐）

1. 把这个项目上传/推送到你自己的 GitHub 仓库。
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers 和 Pages** → **创建应用程序** → **Pages** → **连接到 Git**。
3. 选择刚才的 GitHub 仓库，构建设置填写：
   - **框架预设**：Vite
   - **构建命令**：`npm run build`
   - **构建输出目录**：`dist`
4. 点击部署，Cloudflare 会自动安装依赖、执行构建，完成后给你一个 `*.pages.dev` 的访问地址。之后每次 `git push` 都会自动重新部署。

### 方式二：本地构建后直接上传

```bash
npm install
npm run build
npx wrangler pages deploy dist --project-name=docx-editor
```

首次运行 `wrangler` 会提示登录 Cloudflare 账号（浏览器授权）。

## 项目结构

```
├── index.html              # 页面入口，加载了工具栏图标所需的 Material Symbols 字体
├── src/
│   ├── main.tsx             # React 挂载入口
│   ├── App.tsx               # 编辑器外壳：初始化 DocxEditor、文件打开路由、"保存"下载逻辑
│   ├── HwpViewer.tsx / .css   # HWP/HWPX 只读预览视图
│   ├── lib/
│   │   ├── buildDocumentFromParagraphs.ts  # 把一组段落文字拼装成合法的 Document 对象
│   │   ├── pdfImport.ts                     # PDF → 段落文字（pdf.js + 启发式分段）
│   │   ├── docImport.ts                     # 旧版 .doc → 段落文字（word-extractor）
│   │   └── hwp.ts                           # HWP/HWPX 解析、渲染、文字提取（@rhwp/core）
│   ├── App.css / index.css
├── public/
│   └── favicon.svg
├── package.json
└── vite.config.ts             # 含 vite-plugin-node-polyfills（word-extractor 需要 Buffer 等 Node 内置模块的浏览器 polyfill）
```

## 关于"保存"

编辑器内 `文件 → 保存`（或 Ctrl/Cmd+S）会把当前文档打包成标准 `.docx` 字节数据，`src/App.tsx` 里的 `handleSave` 负责把它转成浏览器下载——保存下来的文件可以直接用 Word、WPS 打开，格式不会丢失。已经过实测验证（真实生成的 `.docx` 可被 python-docx / Word 正常解析)。

## 自定义方向

- `src/App.tsx` 里的 `<DocxEditor>` 组件支持大量 props（作者名、只读模式、水印预设、批注/修订回调、自定义字体列表等），完整列表见 `node_modules/@eigenpal/docx-editor-react/dist/index.d.ts` 或 [官方文档](https://www.docx-editor.dev/docs)。
- 如果想默认打开一个模板文件而不是空白文档，把模板 `.docx` 放进 `public/`，改成用 `useEffect` 异步 `fetch` 该文件并传给 `documentBuffer`。
- 想要多人协同编辑，需要额外接入 Yjs + 一个同步后端（比如 Cloudflare Durable Objects），这超出了本仓库的最小外壳范围，可参考 `@eigenpal/docx-editor-core` 的 `externalPlugins` / `y-prosemirror` 用法。

## 依赖与协议

- [`@eigenpal/docx-editor-react`](https://www.npmjs.com/package/@eigenpal/docx-editor-react) / `-core` / `-i18n` — Apache License 2.0，作者 [eigenpal](https://github.com/eigenpal)（[docx-editor.dev](https://www.docx-editor.dev/)）。
- [`pdfjs-dist`](https://www.npmjs.com/package/pdfjs-dist)（Mozilla PDF.js）— Apache License 2.0。注意本仓库特意锁定在 `4.x` 系列（见下方"已知坑"），没有用最新的 `6.x`。
- [`word-extractor`](https://www.npmjs.com/package/word-extractor) — MIT License。
- [`@rhwp/core`](https://www.npmjs.com/package/@rhwp/core) — MIT License，作者 [Edward Kim](https://github.com/edwardkim/rhwp)。
- 本仓库的胶水代码（`src/` 下的文件）同样以 Apache License 2.0 发布，见 `LICENSE`。

## 已知坑 / 排查笔记

- **`@eigenpal/docx-editor-*` 在 npm 上被标记为 deprecated**：核心编辑器库的作者正在把包名从 `@eigenpal/docx-editor-*` 迁移到 `@docx-editor.dev/*`（前面提到的"品牌重塑"）。截至本项目构建时，`@eigenpal/docx-editor-react@1.9.0`（本仓库实际使用、且经过充分测试确认可用的版本）已经被标记为 deprecated，但新的 `@docx-editor.dev/*` 包目前还只是占位（几乎是空文件，不能用）。也就是说：**现在能用的就是 `@eigenpal/*`，能力和功能都没问题，只是 npm 会有一条 deprecated 警告**。等作者真正把代码发布到新包名下之后，迁移大概率只是把 import 路径里的包名换一下（API 应该是同一套），到时候关注一下 [官方仓库](https://github.com/eigenpal/docx-editor) 的动态即可。
- **不要升级 `pdfjs-dist` 到 `6.x`**：实测 `6.1.200` 的 worker 里用了 `Map.prototype.getOrInsertComputed`（一个还没有普及的很新的 JS 引擎特性），在目前主流浏览器上会直接报错 `getOrInsertComputed is not a function`，PDF 打开会失败。本仓库锁定在 `4.10.38`，这个问题不存在。以后升级前先拿真实 PDF 测一下。
- **HWP 没有拿到真实样本文件做端到端测试**：`@rhwp/core` 的接入是按官方文档 API 做的，也验证过 WASM 能正常初始化、对不支持的文件能给出清晰的报错（不会崩溃），但没能找到一个真实 `.hwp`/`.hwpx` 文件跑通"打开并看到内容"这一步。建议你部署后用自己手头的真实 HWP 文件测一下；如果解析出问题，大概率是 `src/lib/hwp.ts` 里的调用方式需要微调，可以对照 `node_modules/@rhwp/core/README.md`。

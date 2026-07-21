# 万能阅读编辑器（DOCX Editor / Reader）

一个基于浏览器的 Word / WPS 兼容"阅读编辑器"：核心是直接在网页里打开、编辑、保存 `.docx` 文件，同时也能**读**多种常见文件格式（PDF、旧版 .doc、韩国 HWP、EPUB、TXT、图片），不需要任何后端服务器，适合部署为纯静态站点（Cloudflare Pages / Vercel / Netlify 均可）。

定位：先做成一个"什么格式都能打开看"的万能阅读器，再逐步把能转成可编辑文档的格式打通。目前的状态是——**.docx 原生完整编辑；PDF/.doc/HWP/EPUB/TXT 可以"转换成可编辑文档"再编辑；图片可以直接插入文档；EPUB 还额外提供一个真正的分页阅读器（翻页、目录）**。

支持：文字格式（字体/字号/颜色/高亮/加粗斜体下划线等）、对齐与段落样式、项目符号/编号列表、表格、图片、页眉页脚、批注（评论）、修订（Track Changes / 建议模式）、目录大纲、查找替换、打印、多语言界面（已启用简体中文）。

界面基于开源项目 [`eigenpal/docx-editor`](https://github.com/eigenpal/docx-editor)（Apache-2.0 协议）的 `@eigenpal/docx-editor-react` 组件构建，本仓库只是围绕它做的一个可直接部署的外壳应用（`src/App.tsx`）。所有文档处理都在浏览器本地完成，文件不会被上传到任何服务器。

### 打开其他格式（工具栏"打开 DOC/PDF/HWP/EPUB/TXT/图片"按钮）

除了原生的 `.docx` 编辑，工具栏还有一个按钮，可以打开六类"非原生"文件。这些格式严格来说技术上完全不同，下面如实说明各自能做到什么程度：

| 格式 | 能做到什么 | 做不到什么 |
| --- | --- | --- |
| **WPS Office 文档**（`.docx`） | WPS 现代版本默认就是标准 OOXML，和 Word 的 `.docx` 完全一致，**已经原生支持**，不需要任何转换。 | 如果是上世纪 90 年代~2000 年代的旧版 `.wps` 二进制格式，目前没有任何开源库能解析，业界通行做法是丢给云端转换服务——本项目没有做这个。 |
| **PDF** | 打开 PDF 时会弹出选择框，两种模式都支持：① 用 [pdf.js](https://mozilla.github.io/pdf.js/) 提取文字内容，按行间距/字号变化启发式地拼回自然段落，转换成可以像 Word 一样自由编辑、真正重新排版的文档；② 把每一页原样渲染成图片整页嵌入文档，版式 100% 还原（适合扫描件、复杂排版、或者根本不需要改文字，只是想要一份可以用 Word/WPS 打开的副本）。 | 方式①是"近似还原"，不是像素级还原：多栏排版、表格、图片目前不会被保留，复杂版式的分段可能不够准确。方式②反过来——版式完美但文字不可编辑/不可选中/不可搜索。真正做到"点开 PDF 原地改字、自动重排"这件事，连 Adobe Acrobat 都没有完全做到，开源生态里也没有成熟方案，所以这里给你两条路线选，而不是假装能做到做不到的事。 |
| **旧版 `.doc`**（Word 97-2003 二进制格式） | 用 [`word-extractor`](https://github.com/morungos/node-word-extractor) 提取纯文字内容（分段准确，因为文件本身就有清晰的段落边界）。 | 不保留任何格式（字体、颜色、表格、图片全部丢失），纯文本导入。 |
| **HWP / HWPX**（韩国"한글"文档） | 用 [`@rhwp/core`](https://github.com/edwardkim/rhwp)（MIT 协议，Rust+WASM）在浏览器本地渲染，可以**只读预览原始排版**（分页、缩放）；点击"转换为可编辑文档"可以把文字提取出来，导入到同一个 docx 编辑器里自由编辑。 | 预览是只读的——rhwp 底层其实有一套编辑 API，但那是面向程序调用的低层 API（按 section/段落/字符偏移量操作），不是一套现成的"点哪改哪"交互，要做成真正的所见即所得 HWP 编辑器是一个独立的大工程，这里没有做。如果你需要**保留原始 HWP 格式**编辑并存回 `.hwp`，作者本人做了一个更完整的方案 [`@rhwp/editor`](https://www.npmjs.com/package/@rhwp/editor)，但它是把一个完整的编辑器界面通过 iframe 嵌入进来，默认会连接到作者托管在 `edwardkim.github.io` 的页面（也可以自建替换 `studioUrl`）——考虑到隐私和"完全离线自包含"的定位，本项目默认没有接入这个，只用了纯本地运行的 `@rhwp/core`。 |
| **EPUB**（电子书） | 用 [`epubjs`](https://github.com/futurepress/epub.js) + [`react-reader`](https://github.com/happyr/react-reader) 提供一个**真正的分页阅读器**（翻页、点目录跳章节），完全在浏览器本地解析，不连接任何外部服务；阅读之外也可以点"转换为可编辑文档"把全书文字按章节/段落提取出来导入 docx 编辑器。 | 阅读模式下是只读的（这本来就是电子书阅读器的正常形态，不是缺陷）；转换成可编辑文档后，原书的排版、字体、图片、章节分页信息都不会保留，只剩下文字内容按段落排列。 |
| **TXT**（纯文本） | 直接按空行/换行切分成段落，导入 docx 编辑器，**可以直接编辑**——这是六种格式里转换最直接、最不会失真的一种。 | 纯文本本来就不含任何格式信息，没有"丢失格式"的问题；但如果原 txt 用了非 UTF-8 编码，浏览器按 UTF-8 解码可能会有乱码，建议先把源文件转成 UTF-8。 |
| **图片**（jpg/png/gif/webp/bmp） | 提供一个带缩放（放大/缩小/重置）的独立查看器；点"插入到新文档"会把图片整张嵌入一个新的 docx 文档里（用的是与 PDF-转图片相同的 `DocumentAgent.insertImage` 路径，已验证导出的 `.docx` 里 `word/media/` 包含正确的图片文件）。 | 目前是"整图插入新文档"，还没做"插入到当前正在编辑的文档光标位置"这种更细粒度的操作；也没有 OCR（图片文字识别），如果图片里是文字且需要变成可编辑文字，需要额外接入 OCR 服务，本项目没有做。 |

也就是说：**.docx 是完整体验，PDF/.doc/HWP/EPUB/TXT 是"转换成可编辑文档"体验，图片是"插入"体验**——内容找回来了，但原始版式不是全部都能保留。这是经过调研后判断更现实、更诚实的方案，而不是画一个"什么都能编辑"的饼。

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
│   ├── EpubViewer.tsx / .css  # EPUB 分页阅读视图（react-reader）
│   ├── ImageViewer.tsx / .css # 图片查看视图（缩放 + 插入到新文档）
│   ├── lib/
│   │   ├── buildDocumentFromParagraphs.ts  # 把一组段落文字拼装成合法的 Document 对象
│   │   ├── buildDocumentFromImages.ts       # 把一组整页图片拼装成合法的 Document 对象（DocumentAgent.insertImage）
│   │   ├── pdfImport.ts                     # PDF → 段落文字（pdf.js + 启发式分段）
│   │   ├── pdfImageImport.ts                # PDF → 每页一张 PNG 图片（pdf.js canvas 渲染）
│   │   ├── docImport.ts                     # 旧版 .doc → 段落文字（word-extractor）
│   │   ├── hwp.ts                           # HWP/HWPX 解析、渲染、文字提取（@rhwp/core）
│   │   ├── epubImport.ts                    # EPUB → 按章节/段落提取文字（epubjs）
│   │   └── imageFileImport.ts               # 读取图片文件为 dataURL + 原始像素尺寸
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
- [`epubjs`](https://www.npmjs.com/package/epubjs) — BSD-2-Clause License。
- [`react-reader`](https://www.npmjs.com/package/react-reader) — ISC License（基于 epubjs 的 React 阅读器组件）。
- 本仓库的胶水代码（`src/` 下的文件）同样以 Apache License 2.0 发布，见 `LICENSE`。

## 已知坑 / 排查笔记

- **`@eigenpal/docx-editor-*` 在 npm 上被标记为 deprecated**：核心编辑器库的作者正在把包名从 `@eigenpal/docx-editor-*` 迁移到 `@docx-editor.dev/*`（前面提到的"品牌重塑"）。截至本项目构建时，`@eigenpal/docx-editor-react@1.9.0`（本仓库实际使用、且经过充分测试确认可用的版本）已经被标记为 deprecated，但新的 `@docx-editor.dev/*` 包目前还只是占位（几乎是空文件，不能用）。也就是说：**现在能用的就是 `@eigenpal/*`，能力和功能都没问题，只是 npm 会有一条 deprecated 警告**。等作者真正把代码发布到新包名下之后，迁移大概率只是把 import 路径里的包名换一下（API 应该是同一套），到时候关注一下 [官方仓库](https://github.com/eigenpal/docx-editor) 的动态即可。
- **不要升级 `pdfjs-dist` 到 `6.x`**：实测 `6.1.200` 的 worker 里用了 `Map.prototype.getOrInsertComputed`（一个还没有普及的很新的 JS 引擎特性），在目前主流浏览器上会直接报错 `getOrInsertComputed is not a function`，PDF 打开会失败。本仓库锁定在 `4.10.38`，这个问题不存在。以后升级前先拿真实 PDF 测一下。
- **HWP 没有拿到真实样本文件做端到端测试**：`@rhwp/core` 的接入是按官方文档 API 做的，也验证过 WASM 能正常初始化、对不支持的文件能给出清晰的报错（不会崩溃），但没能找到一个真实 `.hwp`/`.hwpx` 文件跑通"打开并看到内容"这一步。建议你部署后用自己手头的真实 HWP 文件测一下；如果解析出问题，大概率是 `src/lib/hwp.ts` 里的调用方式需要微调，可以对照 `node_modules/@rhwp/core/README.md`。
- **图片插入用的是 `DocumentAgent.insertImage`，不是手搓 JSON**：一开始尝试直接拼装 `{ type: 'image', ... }` 这样的内容节点，但图片要真正存进 `.docx` 还需要在 `word/_rels/document.xml.rels` 和 `[Content_Types].xml` 里正确注册关系和媒体文件，手工拼很容易拼出一个"看起来对、存出来是坏的"文件。改用官方提供的 `DocumentAgent.insertImage(position, dataUrl, options)`（immutable、链式调用）之后，实测导出的 `.docx` 里 `word/media/image1.png` 等都被正确写入——如果你要扩展"插入图片"相关的功能，建议继续走这条路径，不要绕过它直接改 JSON。
- **epubjs 的 `Section#load()` 不返回 `Document`，返回的是 `<html>` 根 `Element`**：`epubjs` 的类型定义容易让人以为 `section.load()` resolve 出来的是一个标准 `Document`（可以直接 `.body.querySelectorAll(...)`），但读源码（`node_modules/epubjs/src/section.js`）会发现它内部 resolve 的其实是 `xml.documentElement`，也就是 `<html>` 这个 `Element` 本身，没有 `.body` 属性。第一版 `epubImport.ts` 就因为写了 `doc.body.querySelectorAll(...)` 而在运行时永远拿到 `undefined`、静默返回空段落（不会报错，只是提取不到任何文字）——这类"不报错但结果是空的"问题最容易被忽略，本仓库是通过 Playwright 端到端跑通 EPUB 转换、打印中间产物才定位到的。现在的写法是 `root.querySelector('body') ?? root`，直接在 Element 上查询，已验证能正确提取多章节文字。如果以后升级 `epubjs` 版本，遇到提取结果为空，先怀疑这里。
- **测试用的 EPUB 标题乱码是 fixture 生成问题，不是本项目的 bug**：本仓库用 `pandoc` 在沙箱里生成过测试用的 `.epub`（真实用户文件不会有这个问题）。发现标题页文字（`title_page.xhtml` 里的 `<title>`/`<h1>`）会变成 `����...` 乱码，但用 `unzip` 解压检查后确认：不是本项目读取/渲染出的问题，而是 `pandoc` 在这个沙箱环境的 locale 设置下生成 epub 元数据（`title`/`author`）时，写入文件的字节本身就已经损坏了；同一份 epub 里正文章节（`ch001.xhtml` 等）的中文内容完全正常，恰好印证了问题出在 pandoc 的标题页生成路径，而不是本项目的解析/渲染逻辑。用真实电子书文件测试不会遇到这个问题。

# 万能阅读编辑器（DOCX / Excel / PPT Editor / Reader）

一个基于浏览器的 Office 兼容"阅读编辑器"：可以直接在网页里**新建、打开、编辑、保存** `.docx`（Word）、`.xlsx`（Excel）、`.pptx`（PPT）、`.txt` 文件，同时也能**读**多种其他常见文件格式（PDF、旧版 .doc、韩国 HWP、EPUB、图片），不需要任何后端服务器，适合部署为纯静态站点（Cloudflare Pages / Vercel / Netlify 均可）。

定位：核心可编辑格式（docx / xlsx / pptx / txt）做到接近 Office 基础版的使用体验；其余格式（PDF/.doc/HWP/EPUB/图片）按各自的技术现实，能转成可编辑文档的转换成可编辑文档，转不了的至少提供高保真只读预览。目前的状态是——**.docx 原生完整编辑；.xlsx 原生表格编辑（公式、多工作表、常用格式、插入图表）；.pptx 原生幻灯片编辑（文字/图片/形状/表格、主题、切换效果与动画的应用内播放预览）；.txt 独立纯文本编辑器；docx/xlsx/pptx/txt 都带自动保存草稿；PDF/.doc/HWP/EPUB 可以"转换成可编辑文档"再编辑；图片可以直接插入文档；EPUB 还额外提供一个真正的分页阅读器（翻页、目录）**。

工具栏左上角的"＋ 新建"按钮可以直接新建空白的 Word / Excel / PPT / TXT 文件（PDF、EPUB 不提供"新建空白"选项，原因见下方"打开其他格式"表格——这两种格式本身不适合"从空白开始编辑"）。

**.docx** 支持：文字格式（字体/字号/颜色/高亮/加粗斜体下划线等）、对齐与段落样式、项目符号/编号列表、表格、图片、页眉页脚、批注（评论）、修订（Track Changes / 建议模式）、目录大纲、查找替换、打印、多语言界面（已启用简体中文）。界面基于开源项目 [`eigenpal/docx-editor`](https://github.com/eigenpal/docx-editor)（Apache-2.0 协议）的 `@eigenpal/docx-editor-react` 组件构建。

**.xlsx** 支持：单元格编辑、常用格式（字体/颜色/边框/数字格式）、常用公式函数、多工作表、行列操作、**插入图表**（柱状图/折线图/饼图，见下方说明）、真实 `.xlsx`/`.xls`/`.csv` 文件导入导出。基于 [`@fortune-sheet/react`](https://github.com/ruilisi/fortune-sheet)（Luckysheet 的活跃维护 fork，MIT 协议）+ [`@corbe30/fortune-excel`](https://www.npmjs.com/package/@corbe30/fortune-excel)（MIT 协议，负责与真实 xlsx 字节互转）。**不支持**：数据透视表、条件格式（这些是"进阶版"功能，本项目按基础版定位有意不做）。

**.pptx** 支持：新建/切换/删除幻灯片，插入文字框、图片、矩形/椭圆等简单形状、**表格**，拖拽移动、四角缩放，文字加粗/斜体/下划线/字号/颜色/对齐，形状填充色，幻灯片背景色，**主题模板**（一键套用配色）、**幻灯片切换效果**与**元素进入动画**（在应用内"▶ 播放"预览里生效，见下方说明），真实 `.pptx` 文件导入导出（含表格）。是本项目自研的编辑器（[`react-rnd`](https://www.npmjs.com/package/react-rnd) 做拖拽缩放 + [`pptxgenjs`](https://www.npmjs.com/package/pptxgenjs) 做导出 + 基于 `jszip` 手写的 OOXML 解析器做导入，均为 MIT 协议）。**不支持**：母版/版式编辑、SmartArt（同样是基础版定位有意不做的进阶功能）。

**.txt** 是一个独立的轻量纯文本编辑器（普通 `<textarea>`），新建/打开/编辑/保存都很直接。之所以没有像 PDF/.doc 那样"转换后导入 docx 编辑器编辑"，是因为实测发现 docx 编辑器组件内部的"保存"按钮会无条件额外触发一次它自己的下载（文件名固定为 `.docx`，且没有任何 prop 能关掉这个行为）——如果 txt 复用这个编辑器，每次保存都会静默多下载一个文件名错误的 `.docx`。为了保证"保存 = 生成且只生成这一个 .txt 文件"，txt 用了完全独立、只有一条保存路径的实现。

**自动保存草稿**：docx/xlsx/pptx/txt 四个原生编辑器都会在你编辑时（停顿约 1.5 秒后）把当前内容自动快照到浏览器本地的 IndexedDB 里。如果标签页意外刷新、被关掉，或者浏览器崩溃，下次重新打开同一种编辑器时会看到一条黄色提示条，可以选择恢复或丢弃这份草稿。这纯粹是"防止手滑丢失工作"的安全网，不是版本历史——每种格式只保留最近一份草稿，点了"保存"之后这份草稿会被清除。全程只写在你自己浏览器本地，不涉及任何服务器。

所有文档处理（docx/xlsx/pptx/txt 及其余各格式）都在浏览器本地完成，文件不会被上传到任何服务器。

### 打开其他格式（工具栏"打开 DOCX/DOC/PDF/HWP/EPUB/TXT/XLSX/PPTX/图片"按钮）

除了"＋ 新建"能直接新建的 docx/xlsx/pptx/txt 四种原生格式，工具栏还有一个"打开"按钮，可以打开已有文件，包括其余几类格式。这些格式严格来说技术上完全不同，下面如实说明各自能做到什么程度：

| 格式 | 能做到什么 | 做不到什么 |
| --- | --- | --- |
| **`.docx`**（Word / WPS 现代版本保存的文档） | **原生完整编辑**——用的是编辑器库自己的真实解析器（`parseDocx`），格式/表格/图片/页眉页脚/批注/修订等全部保留，不是文字提取。WPS 现代版本默认存出来的 `.docx` 本来就是标准 OOXML，和 Word 的 `.docx` 完全一致，同一条路径直接打开，不需要任何转换。这个按钮之前只负责"打开其他格式"（PDF/.doc/HWP 等需要转换才能编辑的格式），`.docx` 要靠编辑器自带、藏在"文件 > 打开"菜单里的入口才能打开——两条路径功能上一直没区别，只是这个更显眼的按钮以前点了会提示"不支持"，现在两个入口都能用了。 | 如果是上世纪 90 年代~2000 年代 WPS 的旧版二进制格式（文件后缀通常是 `.wps`，不是 `.docx`），目前没有任何开源库能解析，业界通行做法是丢给云端转换服务——本项目没有做这个。 |
| **PDF** | 打开 PDF 时会弹出选择框，两种模式都支持：① 用 [pdf.js](https://mozilla.github.io/pdf.js/) 提取文字内容，按行间距/字号变化启发式地拼回自然段落，转换成可以像 Word 一样自由编辑、真正重新排版的文档；② 把每一页原样渲染成图片整页嵌入文档，版式 100% 还原（适合扫描件、复杂排版、或者根本不需要改文字，只是想要一份可以用 Word/WPS 打开的副本）。 | 方式①是"近似还原"，不是像素级还原：多栏排版、表格、图片目前不会被保留，复杂版式的分段可能不够准确。方式②反过来——版式完美但文字不可编辑/不可选中/不可搜索。真正做到"点开 PDF 原地改字、自动重排"这件事，连 Adobe Acrobat 都没有完全做到，开源生态里也没有成熟方案，所以这里给你两条路线选，而不是假装能做到做不到的事。 |
| **旧版 `.doc`**（Word 97-2003 二进制格式） | 用 [`word-extractor`](https://github.com/morungos/node-word-extractor) 提取纯文字内容（分段准确，因为文件本身就有清晰的段落边界）。 | 不保留任何格式（字体、颜色、表格、图片全部丢失），纯文本导入。 |
| **HWP / HWPX**（韩国"한글"文档） | 用 [`@rhwp/core`](https://github.com/edwardkim/rhwp)（MIT 协议，Rust+WASM）在浏览器本地渲染，可以**只读预览原始排版**（分页、缩放）；点击"转换为可编辑文档"可以把文字提取出来，导入到同一个 docx 编辑器里自由编辑。 | 预览是只读的——rhwp 底层其实有一套编辑 API，但那是面向程序调用的低层 API（按 section/段落/字符偏移量操作），不是一套现成的"点哪改哪"交互，要做成真正的所见即所得 HWP 编辑器是一个独立的大工程，这里没有做。如果你需要**保留原始 HWP 格式**编辑并存回 `.hwp`，作者本人做了一个更完整的方案 [`@rhwp/editor`](https://www.npmjs.com/package/@rhwp/editor)，但它是把一个完整的编辑器界面通过 iframe 嵌入进来，默认会连接到作者托管在 `edwardkim.github.io` 的页面（也可以自建替换 `studioUrl`）——考虑到隐私和"完全离线自包含"的定位，本项目默认没有接入这个，只用了纯本地运行的 `@rhwp/core`。 |
| **EPUB**（电子书） | 用 [`epubjs`](https://github.com/futurepress/epub.js) + [`react-reader`](https://github.com/happyr/react-reader) 提供一个**真正的分页阅读器**（翻页、点目录跳章节），完全在浏览器本地解析，不连接任何外部服务；阅读之外也可以点"转换为可编辑文档"把全书文字按章节/段落提取出来导入 docx 编辑器。 | 阅读模式下是只读的（这本来就是电子书阅读器的正常形态，不是缺陷）；转换成可编辑文档后，原书的排版、字体、图片、章节分页信息都不会保留，只剩下文字内容按段落排列。 |
| **TXT**（纯文本） | 直接在独立的纯文本编辑器（`TxtEditor`）里打开，**原样、可直接编辑**，保存下来就是一个干净的 `.txt`——不经过 docx 转换，所以也不存在段落切分误差。 | 纯文本本来就不含任何格式信息，没有"丢失格式"的问题；但如果原 txt 用了非 UTF-8 编码，浏览器按 UTF-8 解码可能会有乱码，建议先把源文件转成 UTF-8。 |
| **Excel**（`.xlsx`/`.xls`/`.csv`） | 直接原生打开到表格编辑器里编辑，可以框选一个数据区域插入柱状图/折线图/饼图，保存导出真实 `.xlsx`。 | 插入的图表是**渲染好的静态图片**，不是可以双击改数据联动刷新的原生 Excel 图表对象（本项目的导出链路 `@corbe30/fortune-excel` + `exceljs` 没有写原生图表 XML 的能力——这和早前"PDF 转图片"选项是同一种"诚实地退而求其次"的取舍，见下方"已知坑"）；数据透视表、条件格式不支持（基础版定位）；`.xls`（旧二进制格式）导入没问题，但保存统一另存为 `.xlsx`。 |
| **PPT**（`.pptx`） | 直接原生打开到幻灯片编辑器里编辑（文字/图片/形状/表格的位置、颜色、字体），保存导出真实 `.pptx`（含表格）。 | 幻灯片切换效果、元素进入动画只在本应用自己的"▶ 播放"预览模式里生效，**不会**写入导出的 `.pptx` 文件——用真实 PowerPoint/WPS 打开时，这些元素会原样静止显示（原因见下方"已知坑"）；复杂版式（SmartArt、母版自定义）解析时会被跳过，只保留文字/图片/基础形状/表格，导入后原文件里的这部分视觉效果不会还原。 |
| **图片**（jpg/png/gif/webp/bmp） | 提供一个带缩放（放大/缩小/重置）的独立查看器；点"插入到新文档"会把图片整张嵌入一个新的 docx 文档里（用的是与 PDF-转图片相同的 `DocumentAgent.insertImage` 路径，已验证导出的 `.docx` 里 `word/media/` 包含正确的图片文件）。 | 目前是"整图插入新文档"，还没做"插入到当前正在编辑的文档光标位置"这种更细粒度的操作；也没有 OCR（图片文字识别），如果图片里是文字且需要变成可编辑文字，需要额外接入 OCR 服务，本项目没有做。 |

也就是说：**.docx / .xlsx / .pptx / .txt 是原生完整编辑体验，PDF/.doc/HWP/EPUB 是"转换成可编辑文档"体验，图片是"插入"体验**——内容找回来了，但原始版式不是全部都能保留。这是经过调研后判断更现实、更诚实的方案，而不是画一个"什么都能编辑"的饼。

### 解除文件限制（工具栏"解除文件限制"按钮）

去掉 PDF 的"禁止编辑/打印/复制"限制，或 PPTX 的 PowerPoint"限制编辑"保护——**仅限本来就能正常打开、阅读的文件**，选好文件后立刻在本地处理完成并自动下载一份新文件，不上传、不联网。

**这不是密码破解/找回功能，也刻意没有做成一个。** 如果你的文件是"打开都要密码，而这个密码你忘了"，这个按钮帮不了你——这里没有、以后也不打算做任何形式的密码暴力破解或恢复：技术上对真正加密过的强密码基本不可行，即便对弱密码可行，这个工具也没有办法判断你是不是文件真正的所有者，贸然做一个"破解他人文件密码"的功能不合适。如果是这种情况，建议：先查自己的密码管理器/浏览器保存的密码，找当初设密码的人要，或者走企业 IT 部门的恢复流程。

支持的两种情况，都不需要知道真实密码就能处理，原因不是"绕过"了什么，而是这两种保护机制设计上本来就不需要：

- **PDF**：PDF 规范里的"所有者密码"（owner password）只用来限制打印/编辑/复制，如果文件的"用户密码"（打开密码）是空的——也就是这个文件现在任何人都能直接打开阅读——那么解密所需的密钥推导过程根本不需要用到所有者密码的明文，`qpdf`（本项目用的 [`@neslinesli93/qpdf-wasm`](https://www.npmjs.com/package/@neslinesli93/qpdf-wasm) 就是把这个工具编译成 WASM 拿到浏览器里跑）几十年来一直能在不知道所有者密码的情况下去掉这类限制，这是规范本身的设计，不是安全漏洞。如果文件设置了打开密码（不是空的），处理会明确失败并提示"需要打开密码"，不会尝试猜测或绕过。
- **PPTX**：PowerPoint 的"限制编辑"功能，存的是 `ppt/presentation.xml` 里的一个 `<p:modifyVerifier>` 元素（一段密码的哈希值），PowerPoint 的界面在你点"编辑"之前会检查这个哈希——但它**并不会加密**幻灯片内容本身，整个文件从始至终都是一个完全正常、可以直接读取解析的 OOXML 压缩包。所以去掉限制只需要删除这一个 XML 节点再重新打包，全程不涉及也不需要真实密码。

两种情况处理前后文件内容本身都不会有任何变化，只是去掉了限制标记；如果选中的文件本来就没有设置相应限制，会原样生成一份副本并如实告知。

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
│   ├── App.tsx               # 编辑器外壳：新建/打开文件路由、各编辑器之间的 mode 切换、"保存"下载逻辑
│   ├── NewFileMenu.tsx / .css # 工具栏"＋ 新建"下拉菜单（docx/xlsx/pptx/txt），下拉面板经 createPortal 挂到 document.body
│   ├── DraftBanner.tsx / .css # 各编辑器共用的"检测到自动保存草稿，是否恢复"提示条
│   ├── TxtEditor.tsx / .css   # 独立的纯文本编辑器（textarea，避开 docx 编辑器的双重下载问题）
│   ├── XlsxEditor.tsx / .css  # Excel 表格编辑器（@fortune-sheet/react + @corbe30/fortune-excel + 插入图表对话框）
│   ├── PptxEditor.tsx / .css  # PPT 幻灯片编辑器（react-rnd + pptxgenjs + 自研 pptx 导入解析；表格/主题/切换效果/动画）
│   ├── PptxPresentMode.tsx / .css # "▶ 播放"全屏预览：幻灯片切换动画 + 元素进入动画的实际播放逻辑
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
│   │   ├── imageFileImport.ts               # 读取图片文件为 dataURL + 原始像素尺寸
│   │   ├── pptxModel.ts                     # PPT 编辑器内部数据模型（Presentation/Slide/SlideElement，含表格/主题/切换/动画类型）
│   │   ├── pptxExport.ts                    # 内部数据模型 → 真实 .pptx（pptxgenjs，含表格导出）
│   │   ├── pptxImport.ts                    # 真实 .pptx → 内部数据模型（jszip + DOMParser 手写 OOXML 解析，含表格解析）
│   │   ├── xlsxChart.ts                     # Excel 图表：区域解析（A1:C5）+ 数据提取 + Chart.js 渲染成 PNG
│   │   └── autosave.ts                      # 自动保存草稿的读写（idb-keyval 封装 IndexedDB）+ 防抖工具
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
- [`@fortune-sheet/react`](https://www.npmjs.com/package/@fortune-sheet/react) / `-core` — MIT License（Luckysheet 的活跃维护 fork）。
- [`@corbe30/fortune-excel`](https://www.npmjs.com/package/@corbe30/fortune-excel) — MIT License（内部依赖 `exceljs`，同为 MIT）。
- [`pptxgenjs`](https://www.npmjs.com/package/pptxgenjs) — MIT License。
- [`react-rnd`](https://www.npmjs.com/package/react-rnd) — MIT License。
- [`jszip`](https://www.npmjs.com/package/jszip) — MIT/GPL 双协议，本项目按 MIT 条款使用。
- [`chart.js`](https://www.npmjs.com/package/chart.js) — MIT License，用于 Excel 图表的离屏渲染。
- [`idb-keyval`](https://www.npmjs.com/package/idb-keyval) — Apache License 2.0，自动保存草稿功能对 IndexedDB 的轻量封装。
- [`@neslinesli93/qpdf-wasm`](https://www.npmjs.com/package/@neslinesli93/qpdf-wasm) — ISC License，零依赖，把 [QPDF](https://github.com/qpdf/qpdf)（Apache License 2.0）编译成 WASM 供浏览器使用，"解除文件限制"功能里 PDF 那一半用的就是它。
- 本仓库的胶水代码（`src/` 下的文件）同样以 Apache License 2.0 发布，见 `LICENSE`。

## 已知坑 / 排查笔记

- **工具栏显眼的"打开"按钮其实一直不支持 `.docx`，真正能打开的入口藏在编辑器自己的菜单里（已修复）**：`handleOpenOtherFormat`（`App.tsx` 里工具栏"打开 DOCX/DOC/PDF/…"按钮背后的处理函数）原本只处理 PDF/.doc/HWP 等"需要转换成可编辑文档"的格式，分支列表里从来没有 `.docx`——选中一个 `.docx` 会直接落到最后的 `else`，弹出"暂不支持这个文件类型"，而且这条错误文案自己都写着"支持：.docx（原生编辑）、…"，自相矛盾却没人注意到。`.docx` 其实从一开始就能正常打开和编辑，只是走的是编辑器库（`@eigenpal/docx-editor-react`）自带、通过 `showFileOpen` 这个 prop 开启的"文件 > 打开"菜单项——这个菜单藏在页面左上角不起眼的位置，很容易被当成普通文档标题区，不像工具栏那个按钮一样显眼。两条路径背后用的是同一个解析能力，只是没有被接到同一个入口上。修复直接复用了这个能力：`@eigenpal/docx-editor-core/docx` 这个子路径导出了 `parseDocx(buffer) => Promise<Document>`，就是编辑器自己内部用来解析"打开"菜单选中文件的同一个函数，现在工具栏按钮里新增的 `.docx` 分支直接调用它，解析结果直接 `setInitialDocument`，不经过任何文字提取/转换的中间步骤，格式、表格、图片这些都完整保留。验证时用 Playwright 分别走了"编辑器自带菜单"和"工具栏按钮"两条路径，各自打开一个用 `python-docx` 生成的真实 `.docx`、做了编辑、点保存、再用 `python-docx` 读回下载的文件确认改动真的写进去了；另外也测了一个把 `.txt` 硬改后缀成 `.docx` 的坏文件，确认会给出清晰的"Failed to parse DOCX"报错而不是卡住或崩溃。
- **打开某些 `.doc` 文件会一直显示"正在读取…"卡住不动（已修复，原因值得记一下）**：这不是"文件太大/太复杂所以慢"，而是用于解析旧版 `.doc` 的 [`word-extractor`](https://www.npmjs.com/package/word-extractor) 库自身有一个真实存在的死循环 bug——它内部走 OLE2 复合文档格式时，用来追踪扇区链的 `AllocationTable.getSecIdChain`（见它自己的源码 `lib/ole-allocation-table.js`）只检测"直接自环"（`secId === secIdPrior`），检测不出更长的循环（比如 `5 → 7 → 5 → 7 → …`）。只要 `.doc` 文件内部的扇区分配表有这种稍微不规整/损坏的循环结构——这在辗转多次编辑、被某些工具重新存过的旧 `.doc` 文件里并不罕见——这个循环就会同步地无限跑下去，不断往一个数组里 push，不会抛错也不会停。已经直接在隔离环境里复现过这个死循环（构造一个两步循环的分配表喂给它，CPU 直接跑满、长时间不返回）。因为它是**同步**代码，一旦在主线程跑起来，连 `setTimeout`/`Promise` 式的超时都没有机会被调度——这正是"一直转圈、什么都点不动"在用户眼里的样子。修复方式是把 `.doc` 解析整个挪到 Web Worker 里（`src/workers/docExtractWorker.ts`），由主线程（`src/lib/docImport.ts`）用一个真实的墙钟超时（20 秒）看着它：超时就直接 `worker.terminate()` 强制杀掉这个 worker，返回一条清晰的"文件可能损坏，建议用 Word/WPS 重新另存一遍"提示，而不是让整个标签页卡死。用一个真的 `while(true){}` 死循环 worker 验证过这个机制本身是可靠的——即使 worker 卡死，主线程的计时器照常按节奏触发，`terminate()` 也确实能在超时那一刻把卡住的 worker 杀掉。
- **`.doc` 文件其实是 `.docx` 改的后缀，打开报错 `setImmediate is not defined` → `createInflateRaw is not a function`（已修复）**：有用户反馈"这个本来是 `.docx` 文件，我把后缀改成 `.doc` 就读取不了"——这个场景比想象中常见：不少软件导出时默认写成 `.doc` 后缀，不管内容实际是旧版 OLE2 格式还是新版 OOXML/zip 格式；用户手动改后缀把 `.docx` 文件改名成 `.doc` 也是同一回事。`word-extractor` 自己其实认得出这种情况（内部用魔数判断：开头两字节是不是 `PK`），会在遇到 zip 结构的输入时自动切到它的 `OpenOfficeExtractor`（zip 解析）分支，而不是 OLE2 分支——问题出在这条分支的依赖链在浏览器里没被完整打通，分两层暴露：① `yauzl`/`fd-slicer` 的 `BufferSlicer.read`/`.write` 直接调用裸的全局 `setImmediate`，假设自己跑在 Node 里；这个坑和前面 `Buffer`/`process` 是同一类问题，修法也一样——引入 `setimmediate` 这个包（它的全部作用就是把 `setImmediate`/`clearImmediate` 挂到当前全局上，对 Web Worker 场景有专门支持），在 `docExtractWorker.ts` 里 side-effect 式地 `import 'setimmediate'` 一下就解决了，顺带把 `process`/`setimmediate` 从隐式的传递依赖提升成了 `package.json` 里的直接依赖。② 解决 ① 之后换了个新错误：`n.createInflateRaw is not a function`——根源是 `vite.config.ts` 里 `nodePolyfills({ include: [...] })` 这份清单从一开始就没包含 `'zlib'`，而 `yauzl` 真正解压 zip 内容靠的是 Node 原生 `zlib.createInflateRaw`（真实的 DEFLATE 解压，这个能力没有轻量 polyfill 可以直接替代，得指向一个真正实现了解压算法的 JS 库）。**这里没有选择继续往 zlib polyfill 这个方向深挖**，而是换了个思路：既然已经知道"这是一个 `.doc` 后缀但内容其实是 zip/OOXML 的文件"，与其硬把它塞进 `word-extractor` 那条本来就只是给旧版 WordPerfect/OpenOffice 格式准备、且只能提取纯文字（丢失所有格式）的兜底分支，不如直接复用本项目自己给 `.docx` 按钮准备的原生解析能力（`parseDocx`，见上一条 `.docx` 按钮修复里的说明）——检测方式是新建的 `src/lib/fileSniff.ts` 里的 `looksLikeZipPackage(buffer)`，照抄 `word-extractor` 自己判断用的同一个魔数规则（开头两字节 `0x504b`="PK"，紧接着两字节是 `0x0304`/`0x0506`/`0x0708` 之一），在 `App.tsx` 的 `.doc` 分支里先做这个判断：命中就直接走 `parseDocx`（和 `.docx` 分支共用同一个新提取出来的 `openAsNativeDocx` 辅助函数），不命中才继续走 `word-extractor`。这样不仅绕开了 zlib polyfill 这个坑，结果还更好——原生解析能完整保留格式/表格/图片，而不是 `word-extractor` 那种"只拿到纯文字"的兜底结果。验证时构造了一个真实场景复现文件（把 `python-docx` 生成的真 `.docx` 直接改后缀成 `.doc`，用 `file` 命令确认过内容确实是"Microsoft Word 2007+"），确认不再报错且格式/内容完整保留；同时也回归测试了真实的旧版 OLE2 `.doc` 文件，确认它们仍然正常走 `word-extractor` 分支，没有被新加的判断逻辑误伤。
- **上面这个 worker 改造过程中踩到的两个"全局变量在 worker 里不是全局的"坑**：① `vite-plugin-node-polyfills` 给 `Buffer`/`process` 注入全局这件事，只对**主入口**生效，不会自动延伸到用 `?worker` 单独打包出来的 worker 文件——而 `word-extractor` 的几个内部模块（比如 `ole-header.js` 顶层就有一行 `Buffer.from(...)`）是直接假设 `Buffer`/`process` 是全局存在的，不是通过 import 拿到的局部变量。所以 `docExtractWorker.ts` 里手动 `import { Buffer } from 'buffer'` / `import process from 'process'` 之后，还要再显式赋一遍 `globalThis.Buffer = Buffer` / `globalThis.process = process`。② 更坑的是赋值的**顺序**：ES Module 的静态 `import` 永远会在模块自己的其他顶层语句之前执行（不管写在源码里的第几行），所以哪怕把 `globalThis.Buffer = Buffer` 写在 `import WordExtractor from 'word-extractor'` 上面，实际执行时 `word-extractor` 的模块体还是会先跑，直接报 `ReferenceError: Buffer is not defined`（这是实测踩到的真实报错，不是推测）。解决办法是把 `word-extractor` 改成**动态** `import()`（一条普通表达式，按代码出现的顺序执行，不会被提前），现在进一步改成了只在真正用到时（第一条消息到达时）才动态加载，顺带把 worker 的启动变回完全同步。
- **worker 刚创建就 `postMessage` 发文件过去，偶尔会"石沉大海"——改成握手后才稳**：早期实现是 `new Worker()` 后立刻把文件 `postMessage` 过去，实测发现如果此时 worker 自己的模块代码还没跑到注册 `self.onmessage` 那一行（比如还卡在上面说的动态 `import()` 没 resolve），这条消息会被**直接丢弃**，不是排队等待——主线程和 worker 两边都不会有任何报错，表现就是"选了文件，什么都没发生"，和死循环卡死看起来几乎一样让人摸不着头脑。现在的做法是 worker 自己一准备好（`self.onmessage` 注册完）就主动 `postMessage({type:'ready'})`，主线程收到这个信号之后才真正把文件发过去——把"假设时序没问题"换成了"等对方明确说好了才发"，这个坑以后接入任何 worker 时都值得留意。
- **"＋ 新建"下拉菜单点了没反应，其实是被裁剪/被挡住了**：最早的实现把这个按钮塞进了 `DocxEditor` 组件自带工具栏的 `toolbarExtra` 插槽里，结果发现那一整行工具栏本身带 `overflow-x: auto` 且是固定高度，我们的下拉菜单虽然确实弹出来了，但被这层裁剪挡住，视觉上"点了跟没点一样"。改成放进独立插槽后（不再嵌在那一行里）又发现第二层问题：`DocxEditor` 内部工具栏的某个包裹层建立了自己的 CSS 层叠上下文，导致哪怕下拉菜单 `z-index` 设得很高，点击依然会被库自己的工具栏"拦截"。最终方案：**把"＋ 新建"整体挪到全新的、独立于 `DocxEditor` 的顶部工具条**（`App.tsx` 里的 `.app-topbar`，在所有编辑器/预览模式之上，不管当前是 docx/xlsx/pptx/txt 哪个模式都看得到、点得到），同时下拉面板本身改用 `createPortal` 直接挂到 `document.body` 下，用 `position: fixed` + 触发按钮的实时坐标定位——这样它的层叠上下文就是页面根级别，不会再被任何第三方组件内部的层叠上下文影响。这个坑的教训是：把自定义 UI 塞进大型第三方组件提供的插槽里，永远要额外验证"点击是否真的落到了预期元素上"，而不能只看"UI 是否显示出来了"。
- **`@eigenpal/docx-editor-*` 在 npm 上被标记为 deprecated**：核心编辑器库的作者正在把包名从 `@eigenpal/docx-editor-*` 迁移到 `@docx-editor.dev/*`（前面提到的"品牌重塑"）。截至本项目构建时，`@eigenpal/docx-editor-react@1.9.0`（本仓库实际使用、且经过充分测试确认可用的版本）已经被标记为 deprecated，但新的 `@docx-editor.dev/*` 包目前还只是占位（几乎是空文件，不能用）。也就是说：**现在能用的就是 `@eigenpal/*`，能力和功能都没问题，只是 npm 会有一条 deprecated 警告**。等作者真正把代码发布到新包名下之后，迁移大概率只是把 import 路径里的包名换一下（API 应该是同一套），到时候关注一下 [官方仓库](https://github.com/eigenpal/docx-editor) 的动态即可。
- **不要升级 `pdfjs-dist` 到 `6.x`**：实测 `6.1.200` 的 worker 里用了 `Map.prototype.getOrInsertComputed`（一个还没有普及的很新的 JS 引擎特性），在目前主流浏览器上会直接报错 `getOrInsertComputed is not a function`，PDF 打开会失败。本仓库锁定在 `4.10.38`，这个问题不存在。以后升级前先拿真实 PDF 测一下。
- **HWP 没有拿到真实样本文件做端到端测试**：`@rhwp/core` 的接入是按官方文档 API 做的，也验证过 WASM 能正常初始化、对不支持的文件能给出清晰的报错（不会崩溃），但没能找到一个真实 `.hwp`/`.hwpx` 文件跑通"打开并看到内容"这一步。建议你部署后用自己手头的真实 HWP 文件测一下；如果解析出问题，大概率是 `src/lib/hwp.ts` 里的调用方式需要微调，可以对照 `node_modules/@rhwp/core/README.md`。
- **图片插入用的是 `DocumentAgent.insertImage`，不是手搓 JSON**：一开始尝试直接拼装 `{ type: 'image', ... }` 这样的内容节点，但图片要真正存进 `.docx` 还需要在 `word/_rels/document.xml.rels` 和 `[Content_Types].xml` 里正确注册关系和媒体文件，手工拼很容易拼出一个"看起来对、存出来是坏的"文件。改用官方提供的 `DocumentAgent.insertImage(position, dataUrl, options)`（immutable、链式调用）之后，实测导出的 `.docx` 里 `word/media/image1.png` 等都被正确写入——如果你要扩展"插入图片"相关的功能，建议继续走这条路径，不要绕过它直接改 JSON。
- **epubjs 的 `Section#load()` 不返回 `Document`，返回的是 `<html>` 根 `Element`**：`epubjs` 的类型定义容易让人以为 `section.load()` resolve 出来的是一个标准 `Document`（可以直接 `.body.querySelectorAll(...)`），但读源码（`node_modules/epubjs/src/section.js`）会发现它内部 resolve 的其实是 `xml.documentElement`，也就是 `<html>` 这个 `Element` 本身，没有 `.body` 属性。第一版 `epubImport.ts` 就因为写了 `doc.body.querySelectorAll(...)` 而在运行时永远拿到 `undefined`、静默返回空段落（不会报错，只是提取不到任何文字）——这类"不报错但结果是空的"问题最容易被忽略，本仓库是通过 Playwright 端到端跑通 EPUB 转换、打印中间产物才定位到的。现在的写法是 `root.querySelector('body') ?? root`，直接在 Element 上查询，已验证能正确提取多章节文字。如果以后升级 `epubjs` 版本，遇到提取结果为空，先怀疑这里。
- **`.docx` 编辑器组件的"保存"会额外偷偷再下载一次**：实测发现 `@eigenpal/docx-editor-react` 内部的保存按钮，除了走本项目接的 `onSave` 回调之外，组件自己**还会**再执行一次它自己的 blob 下载，文件名固定为 `xxx.docx`（没有任何文档化的 prop 能关掉）。也就是说，**目前每次点 docx 的"保存"，浏览器实际上会弹出两次下载**——这是这次给 xlsx/pptx/txt 做端到端测试（第一次认真统计"总下载次数"而不是只看第一次下载）时才意外发现的一个预置问题，不是这次改动引入的。已确认的规避方法：txt 不复用这个组件，改用独立的 `TxtEditor`（见上文）。docx 本身这个问题目前**还没有修**，因为没有公开 API 能关闭组件的内部下载逻辑；如果你介意，一个可行方向是 fork 一份 `@eigenpal/docx-editor-react` 去掉那段硬编码逻辑，或者反馈给上游作者。
- **PPT 导入解析是手写的 OOXML 子集解析器，不是完整的 pptx 规范实现**：`src/lib/pptxImport.ts` 只解析了 `<p:sp>`（文字）、`<p:pic>`（图片）和最基础的幻灯片背景色，读取真实第三方生成的复杂 pptx（尤其是用了 SmartArt、图表、动画、自定义母版的）时，这些元素会被直接跳过而不是报错——保留下来的文字和图片位置是准确的，但整体视觉效果不会 1:1 还原。
- **Excel 里未修改过的单元格，重新导出后数字类型可能会变**：`@corbe30/fortune-excel` 在"读入 → 转成内部 sheet 数据 → 再导出"这个链路上，对于用户完全没碰过的原有单元格，实测个别情况下数字会从"数字类型"变成看起来一样但底层是"字符串"的值（Excel 里显示不出区别，但如果导出后的文件要给别的程序按数字类型读取，可能会有影响）。真正编辑过的单元格不受影响。这是第三方库的转换细节，不是本项目代码的问题，暂时按"基础版可用"验收。
- **PPT 切换效果/元素动画为什么只是"应用内预览"，没有写进导出的 .pptx**：真实 PowerPoint 的动画/切换时序信息存在 OOXML 里一套很深、几乎没有文档的结构（`<p:timing>`、`<p:transition>`），而本项目的导出库 `pptxgenjs` 完全没有暴露写这部分 XML 的 API。手写这段 XML 风险很高（时序模型本身就复杂，写错了不是"效果不对"而是"文件可能打不开"），所以这里做的是一个诚实的取舍：切换效果/动画的设置照常保存在我们自己的数据模型里（`Slide.transition` / `SlideElement.animation`），点"▶ 播放"能在应用内看到真实的动画效果（`PptxPresentMode.tsx`），但导出成真实 `.pptx` 后，这些元素在 PowerPoint/WPS 里会原样静止显示——不是"没保存"，是"这一层信息目前没有安全的写入路径"。如果以后有余力啃 `<p:timing>` 这块，`pptxExport.ts` 是要改的地方。
- **Excel 图表用的是 `updateSheet` + 手工构造的 `Image` 对象，不是 fortune-sheet 自带的图表 UI**：查过 `@fortune-sheet/react` 的类型定义和导出的组件列表，这个版本并没有像 Luckysheet 老版本那样自带一个"插入图表"的浮动 DOM 组件；同时 `exceljs`（`@corbe30/fortune-excel` 依赖的库）也没有 `addChart` 一类的 API。所以 `xlsxChart.ts` 走的是：读取所选区域数据 → 用 `chart.js` 在一个离屏 `<canvas>` 上画出图表 → 转成 PNG → 用 `workbookRef.current.updateSheet(...)` 把这张图片作为 `Sheet.images` 里的一个浮动图片对象插入（这个字段本来就是 fortune-sheet 用来承载"插入图片"功能的，插入图表只是复用了同一条路径）。已经过 Playwright + openpyxl 验证：插入的图表在应用内可拖拽/缩放，导出后 `xl/media/` 里能找到对应的真实图片文件，用 Excel/WPS 打开也能看到。局限就是上面表格里写的：这是一张画出来的图，不是能双击改数据的原生图表对象。
- **`saveDraft`/`clearDraft` 之间有一个真实存在过的竞态，已经修**：自动保存草稿用的是"停止输入 1.5 秒后才真正写入 IndexedDB"的防抖策略；如果用户在防抖计时器还没触发前就点了"保存"，"保存"里的 `clearDraft` 会先执行，但那个已经排队的防抖写入依然会在几百毫秒后触发，把刚清掉的草稿又写回去——导致"明明点了保存，下次打开却还提示有草稿要恢复"。用 Playwright 端到端测试（保存后关闭编辑器再重新打开，检查草稿提示条是否还在）才捕捉到这个问题。修复方式是让 `debounce()`（`src/lib/autosave.ts`）返回的函数带一个 `.cancel()` 方法，四个编辑器的"保存"逻辑里都改成先调用 `debouncedAutosave.cancel()` 再调用 `clearDraft`，避免那个排队中的写入在清除之后又抢跑一次。
- **`@neslinesli93/qpdf-wasm` 没有暴露 `print`/`printErr` 回调，出错信息靠临时接管 `console`拿**：这个包把 QPDF 编译成的 Emscripten 模块直接把 stdout/stderr 写到 `console.log`/`console.error`，没有像很多 Emscripten 包那样在初始化配置里留一个 `print`/`printErr` 钩子给调用方接管。`src/lib/pdfUnlock.ts` 的做法是在调用 `qpdf.callMain(...)` 前后临时替换全局 `console.log`/`console.error`（用 `try/finally` 保证无论成功失败都会恢复），把 QPDF 自己打印的诊断文字（比如"密码不对"）收集起来，用来判断失败原因是不是"这个文件需要打开密码"，从而给出更准确的报错文案而不是笼统的"处理失败"。这个包的类型定义（`dist/qpdf.d.ts`）也没声明 `FS.writeFile`（只声明了 `mkdir`/`mount`/`unmount`/`readFile`），但运行时是有这个方法的（官方 README 的用法示例也用了它）——所以对 `FS` 做了一个窄类型的强制转换，而不是把整个 `qpdf` 对象转成 `any`。
- **接入 `qpdf-wasm` 时 `npm audit` 突然多出一堆高危漏洞，排查后确认跟它无关**：`npm install @neslinesli93/qpdf-wasm` 之后 `npm audit` 从原本的"6 low"突然跳到"12 个漏洞（6 low + 2 moderate + 4 high）"，第一反应是怀疑新装的包有问题——但用 `npm view` 确认这个包本身零依赖，再把它卸载重新跑 `npm audit`，同样的 12 个漏洞照样在，证明这次跳变是 npm 漏洞库自身更新（或锁文件里其他既有依赖的版本浮动）导致的，跟这次新增的依赖无关。用不带 `--force` 的 `npm audit fix` 修掉了其中能安全升级的 4 个（`brace-expansion`/`dompurify`/`nanoid`/`postcss`），剩下 2 个高危目前都在传递依赖的深处，且修复需要破坏性降级——`elliptic`（经 `vite-plugin-node-polyfills → node-stdlib-browser → crypto-browserify` 链路引入，上游还没有更高版本能修）和 `image-size`（经 `pptxgenjs` 引入，`npm audit fix --force` 会把 `pptxgenjs` 从 `4.0.1` 强行降到 `1.1.5`，直接砸掉已经验证过的 PPT 导出功能）——两者都不是"装了新包才有的问题"，而是既有依赖树里本来就存在、只是这次 audit 才被翻出来的，暂时按"已知、不做破坏性降级"处理，等上游有兼容版本修复再升级。
- **测试用的 EPUB 标题乱码是 fixture 生成问题，不是本项目的 bug**：本仓库用 `pandoc` 在沙箱里生成过测试用的 `.epub`（真实用户文件不会有这个问题）。发现标题页文字（`title_page.xhtml` 里的 `<title>`/`<h1>`）会变成 `����...` 乱码，但用 `unzip` 解压检查后确认：不是本项目读取/渲染出的问题，而是 `pandoc` 在这个沙箱环境的 locale 设置下生成 epub 元数据（`title`/`author`）时，写入文件的字节本身就已经损坏了；同一份 epub 里正文章节（`ch001.xhtml` 等）的中文内容完全正常，恰好印证了问题出在 pandoc 的标题页生成路径，而不是本项目的解析/渲染逻辑。用真实电子书文件测试不会遇到这个问题。

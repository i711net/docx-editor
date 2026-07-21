# 在线文档编辑器（DOCX Editor）

一个基于浏览器的 Word / WPS 兼容文档编辑器：直接在网页里打开、编辑、保存 `.docx` 文件，不需要任何后端服务器，适合部署为纯静态站点（Cloudflare Pages / Vercel / Netlify 均可）。

支持：文字格式（字体/字号/颜色/高亮/加粗斜体下划线等）、对齐与段落样式、项目符号/编号列表、表格、图片、页眉页脚、批注（评论）、修订（Track Changes / 建议模式）、目录大纲、查找替换、打印、多语言界面（已启用简体中文）。

界面基于开源项目 [`eigenpal/docx-editor`](https://github.com/eigenpal/docx-editor)（Apache-2.0 协议）的 `@eigenpal/docx-editor-react` 组件构建，本仓库只是围绕它做的一个可直接部署的最小外壳应用（`src/App.tsx`）。所有文档处理都在浏览器本地完成，文件不会被上传到任何服务器。

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
├── index.html          # 页面入口，加载了工具栏图标所需的 Material Symbols 字体
├── src/
│   ├── main.tsx         # React 挂载入口
│   ├── App.tsx           # 编辑器外壳：初始化 DocxEditor、处理"保存"下载逻辑
│   ├── App.css / index.css
├── public/
│   └── favicon.svg
├── package.json
└── vite.config.ts
```

## 关于"保存"

编辑器内 `文件 → 保存`（或 Ctrl/Cmd+S）会把当前文档打包成标准 `.docx` 字节数据，`src/App.tsx` 里的 `handleSave` 负责把它转成浏览器下载——保存下来的文件可以直接用 Word、WPS 打开，格式不会丢失。已经过实测验证（真实生成的 `.docx` 可被 python-docx / Word 正常解析)。

## 自定义方向

- `src/App.tsx` 里的 `<DocxEditor>` 组件支持大量 props（作者名、只读模式、水印预设、批注/修订回调、自定义字体列表等），完整列表见 `node_modules/@eigenpal/docx-editor-react/dist/index.d.ts` 或 [官方文档](https://www.docx-editor.dev/docs)。
- 如果想默认打开一个模板文件而不是空白文档，把模板 `.docx` 放进 `public/`，改成用 `useEffect` 异步 `fetch` 该文件并传给 `documentBuffer`。
- 想要多人协同编辑，需要额外接入 Yjs + 一个同步后端（比如 Cloudflare Durable Objects），这超出了本仓库的最小外壳范围，可参考 `@eigenpal/docx-editor-core` 的 `externalPlugins` / `y-prosemirror` 用法。

## 依赖与协议

- [`@eigenpal/docx-editor-react`](https://www.npmjs.com/package/@eigenpal/docx-editor-react) / `-core` / `-i18n` — Apache License 2.0，作者 [eigenpal](https://github.com/eigenpal)（[docx-editor.dev](https://www.docx-editor.dev/)）。
- 本仓库的胶水代码（`src/` 下的文件）同样以 Apache License 2.0 发布，见 `LICENSE`。

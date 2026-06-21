# AGENTS

Escrcpy 是一个基于 pnpm + Turborepo 的 monorepo 项目，提供围绕 scrcpy 的 Android 投屏/控制 Electron GUI。此文件仅记录对 Agent 关键的事实；链接已有文档而非复制内容。总体概览请先阅读 [develop.md](../develop.md)。

## 架构

- [desktop/](../desktop/) 是 Electron 应用。主进程通过 `@escrcpy/electron-setup` 插件化；入口文件为 [desktop/electron/main.js](../desktop/electron/main.js)。
- 渲染窗口是 [desktop/vite.config.js](../desktop/vite.config.js) 中定义的独立 Vite 入口：`main`、`control`、`explorer`、`copilot`、`terminal`、`automation`、`mirror`。
- 窗口模块位于 [desktop/electron/modules/](../desktop/electron/modules/)。主进程功能应注册为模块/服务，而非添加到 preload 脚本。
- [packages/electron-setup/](../packages/electron-setup/) 提供应用/插件/窗口管理基础功能。[packages/electron-ipcx/README.md](../packages/electron-ipcx/README.md) 记录了支持回调的 IPC 机制。
- [packages/wscrcpy/](../packages/wscrcpy/) 包含 scrcpy 会话/客户端逻辑。保留其 `WscrcpySession` 模型和 `DeviceTarget = 'all' | 'primary' | string | string[]` 约定。

## 命令

- 安装：`corepack enable pnpm && pnpm install`。
- 开发：`pnpm dev` 启动 Turbo 管理的应用开发；desktop Vite 服务器使用端口 `1535`。
- 跟踪器：`pnpm build:tracker` 编译 `desktop/electron/modules/sidebar/tracker.cs`（C#，仅 Windows）为 `t.exe`（侧边栏窗口用）。Windows 上需在 `pnpm dev` 前运行，或使用 `pnpm dev:full` 一步完成。
- 代码检查：`pnpm lint` 或 `pnpm lint:fix`。
- 构建：`pnpm build`；平台变体为 `pnpm build:win`、`pnpm build:mac`、`pnpm build:linux`。
- 文档：`pnpm docs:dev`、`pnpm docs:build`、`pnpm docs:preview`。
- i18n 同步：编辑 `desktop/electron/resources/extra/common/locales/*.json` 中的语言键后运行 `pnpm lang-sync`。
- Electron 安装修复：当 Electron 报告安装不完整时运行 `pnpm electron-fix`。
- wscrcpy 类型检查：`pnpm exec tsc -p packages/wscrcpy/tsconfig.json --pretty false`。

目前没有全局测试脚本。修改后先做最小验证，然后运行 `pnpm lint`；打包、Electron 主进程、Vite 配置、依赖或发布相关变更需使用 `pnpm build`。

## Agent 工作流程

- 先批量完成所有编辑。最后只构建一次。不要在单个编辑后反复构建或启动。构建顺序：若修改了 `desktop/electron/modules/sidebar/tracker.cs`，先运行 `pnpm build:tracker`；然后 `cd desktop && npx vite build`；最后 `pnpm lint`。构建通过后，不阻塞启动应用（`cd desktop && pnpm exec electron .`）验证。

## 前端模式

- Vue 代码使用 Vue 3 Composition API 的 `<script setup>`，全局自动导入 Vue、VueUse、Pinia、router、`definePage`、`t`，见 [desktop/src/plugins/internal.js](../desktop/src/plugins/internal.js) 和 [eslint.config.js](../eslint.config.js)。
- 使用 [desktop/vite.config.js](../desktop/vite.config.js) 中已有的别名：`$`、`$root`、`$docs`、`$renderer`、`$electron`、`$control`、`$explorer`、`$copilot`、`$terminal`、`$automation`、`$mirror`。
- 基于文件的路由位于 [desktop/src/views/](../desktop/src/views/)，嵌套的 `components` 文件夹不视为路由。
- Pinia store 位于 [desktop/src/store/](../desktop/src/store/)，使用持久化状态和 `window.$preload.store` 集成 electron-store。参考 [desktop/src/store/device/index.js](../desktop/src/store/device/index.js) 的主模式。
- 样式使用 UnoCSS 工具类和 [desktop/unocss.config.js](../desktop/unocss.config.js) 的项目预设。优先使用本地工具类/样式模式，而非引入新的 UI 系统。

## Electron 与 IPC

- 简单请求-响应通道使用常规的 `ipcRenderer.invoke` / `ipcMain.handle`。
- 当回调或函数需要跨越渲染-主进程边界时，使用 `@escrcpy/electron-ipcx` 的 `ipcxRenderer.invoke` 和 `ipcxMain.handle`。
- 保持 preload 暴露最小化，通过已有中间件路由；渲染代码应使用 `window.$preload` 接口，而非直接 import Electron 主进程模块。
- scrcpy、adb、gnirehtet 的外部二进制路径通过 [desktop/electron/configs/which/](../desktop/electron/configs/which/) 解析，配合 electron-store/用户路径回退。不要硬编码平台路径。

## i18n

- 语言 JSON 存储在 `desktop/electron/resources/extra/common/locales/*.json`；`zh-CN` 是同步的主语言。
- 主进程 i18n 使用 `i18next-fs-backend`，通过 preload 暴露辅助函数，渲染端翻译使用全局 `t` 函数。
- 添加或重命名翻译键后，运行 `pnpm lang-sync`，并检查中文和英文字符串。

## 注意事项

- 在 `desktop/electron/middleware/scrcpy` 中，永远不要直接用 scrcpy 进程对象 resolve ready Promise。它类似于 thenable，Promise 解析会将其采纳，导致 `resolveOnReady` 挂起；用普通数据或 `undefined` resolve。
- Turbo 在 [turbo.json](../turbo.json) 中禁用了 Electron 打包的缓存。不要假设打包输出是可增量或缓存支持的。
- 原生依赖如 `sharp`、Electron、Vite、tsdown、TypeScript 在 [pnpm-workspace.yaml](../pnpm-workspace.yaml) 中被锁定/覆盖；修改需谨慎。
- wscrcpy 中的音频默认 opt-in。Windows 上，音频加控制时 `clipboardAutosync` 应默认为 `false`，因为剪贴板设备消息可能在流持续运行时导致控制器不稳定。
- desktop app 主要是 JavaScript/JSDoc，工作空间包可能是 TypeScript。不要在 desktop 渲染/主应用中添加过严的 TS 假设。
- 新目录和文件使用 kebab-case。
- 修改代码后务必运行 `pnpm lint:fix`，确保无 lint 错误。
- 修改代码后，不同语言使用对应的代码格式化命令格式化代码。如 JS/TS/Vue 用 `pnpm lint:fix`，C# 用 `dotnet format`，Python 用 `ruff format`，Rust 用 `cargo fmt` 等。
- 在 `desktop/src/components/control-bar/control-bar-button.vue` 中，当 `el-button` 处于 `:active` 状态时调用 `trigger()`（通过 `Menu.popup()` 打开原生菜单）会导致状态卡住，因为原生菜单劫持了 `mouseup`。务必先 `blur()`，然后用 `setTimeout(50)` 延迟调用，让浏览器在菜单打开前清除状态。

## 文档链接

- [develop.md](../develop.md) — 开发者设置、架构和贡献基础。
- [README.md](../README.md)、[README-CN.md](../README-CN.md)、[README-RU.md](../README-RU.md) — 面向用户的项目概览。
- [packages/electron-setup/README.md](../packages/electron-setup/README.md) — Electron 插件/窗口框架。
- [packages/electron-ipcx/README.md](../packages/electron-ipcx/README.md) — 友好函数型 IPC 约定。
- [docs/en/](../docs/en/) 和 [docs/zhHans/](../docs/zhHans/) — VitePress 产品文档。

## 调试与构建工作流

### 开发模式（热重载）

```bash
pnpm dev
```

Turbo 启动所有工作空间构建 + Vite 开发服务器（端口 `1535`），然后 `vite-plugin-electron` 启动 Electron。如果 Electron 报 `ERR_CONNECTION_REFUSED`（服务器未就绪），杀掉重试。

### 快速 CSS/JS 构建（不含 electron-builder）

```bash
cd desktop && npx vite build           # ~10s，仅重建渲染层
pnpm --filter escrcpy build            # ~15s，重建渲染层 + 主进程 + preload
```

### 从 dist/ 运行（不打成安装包）

```bash
cd desktop && pnpm exec electron .
```

使用 `dist-electron/main.js` + `dist/` 资源。最快验证：`npx vite build` 然后 `pnpm exec electron .`。

非阻塞启动（不占用终端）：

```powershell
# 从项目根目录
Start-Process -WindowStyle Hidden -FilePath "cmd.exe" -ArgumentList "/c", "pnpm exec electron ." -WorkingDirectory "desktop"
```

### 完整打包（electron-builder）

```bash
pnpm build                             # 所有包 + electron-builder（~2min）
cd desktop && pnpm build:electron      # 仅打包（dist/ 需为最新）
```

输出在 `desktop/dist-release/`。

### 常见问题

- **electron-builder 报 `Access is denied`**：旧的 `Escrcpy.exe` 仍在运行 → `Stop-Process -Name "Escrcpy" -Force`，删除 `dist-release/`，重试。
- **仅 CSS 变更**：只需 `npx vite build`，无需完整构建。
- **缺少 i18n 键**：添加到全部 6 个语言文件后，运行 `pnpm lang-sync`。

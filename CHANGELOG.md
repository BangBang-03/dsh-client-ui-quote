# Changelog

## Unreleased (lab)

### Fixed

- 等待晚到的 `inputTriggers` / `shortcuts` 服务，并在服务提供者卸载时释放旧注册、重载后在新实例注册引用源与四个命令。
- 移除无法通过宿主校验的 Web 默认快捷键；保留 Web 命令及用户自定义能力，桌面仍为 `Alt+Q/C/B/L`。
- 新增 10 项回归断言，覆盖服务晚到、独立替换为新实例、旧实例释放、新实例恰好注册一次、插件卸载清理，以及 Web 无默认绑定。

### Added

- 侧边对话默认改走插件自己的原生右侧栏页签：`quote-sidechat` 页签类型 + `dsh-resource://quote-sidechat/session/…` 资源协议，页体嵌入宿主的 `conversation.content`（`variant: "embedded"`），标题取引用首行，不再依赖 dsh-better-sidebar；宿主缺注册面时退回内置 subagentchat 页，`sideChatBackend: "better"` 才走 better-sidebar 的隐藏线程。
- 离线断言 **584 组**（check 12 + capsule 418 + panel 154）；新增原生页签的地址解析、标题、资源 retain/release、页签注册与卸载断言。

## 0.12.2 — 2026-10-22

### Changed

- 发布工作流：推 `v*` 标签时，除了发 npm `latest`，还会按 `CHANGELOG.md` 同名小节建 GitHub Release（已存在则更新 notes，重跑安全）；`publish-stable` 的 `contents` 权限从 read 提到 write。小节缺失时用一句兜底，不让文档缺失把已发布的 npm 包拖成失败。
- 纯文档提交不再切 lab 预发布：`publish.yml` 对 lab 分支加 `paths-ignore`（`*.md` / `docs/**` / `submission/**` / `.github/**`）；标签推送不受路径过滤影响，发版照常。
- 离线断言 **557 组**（check 12 + capsule 392 + panel 153），`npm test` 全绿。

### Fixed

- 表格里划选的引用不发高亮：Chromium 用 `\t` 分隔同一行的单元格、`\n` 分隔行，高亮却按文本节点直接拼接去找，永远对不上；现在按块级边界（单元格 / 行 / 段落 / 列表项 / `<br>`）还原后再量 Range，跨单元格、跨行、跨段落都能画回来。
- 输入框里已有文字时，引用芯片被粘在最后一句后面：现在引用落到草稿**最上方**，已写的文字另起一行接在下面，光标留在末尾。

## 0.12.1 — 2026-10-20

### Added

- 侧边对话原生降级：没有 `dsh-better-sidebar` 时用 `sessions.fork` 复制主会话历史，并把 fork 开进宿主内置的 `subagentchat` 右侧栏页；引用仍只写进它的草稿，不自动发送。
- 聚合条精确删除：优先调用宿主 conversation shell 的 `consumeToken`（detect 区间 + `draftRev` CAS），并带上芯片后的一个空格；旧宿主才退回「聚焦芯片 + Backspace」。编辑复用同一条路径。
- 芯片插入事件兜底：`shell.insertReference` 优先，`slash/input-insert-reference` 作为兼容通道；两者都不可用才退回纯文本引用块。
- 引用清单页的宿主自检：显示芯片精确删除能力与侧聊后端（better-sidebar / fork 兜底 / 不可用）。
- 评论框打开期间用 `CSS.highlights` 保持原选区高亮，关闭时清理。
- 持久引用高亮改用 `CSS.highlights`：浏览器直接绘制原句，滚动/流式输出/虚拟列表重排都跟手；不支持该 API 的宿主退回浮层矩形，序号徽章两条路径都有。
- `probe().lastFailure`：记录最后一个失败的环节（`source` / `insert` / `remove` / `sidechat`）与一句原因，只记阶段不记正文。
- 24 秒界面轮播 GIF、市场提交 YAML（`submission/`）与 `docs/distribution.md`。

### Changed

- `package.json` 描述不再以 Kimi 开头，改为「把任意选区变成可审阅的引用对象」。
- 离线断言 **549 组**（check 12 + capsule 384 + panel 153）；真浏览器 **51/51**（1600×2000 视口）；隔离 DSH web 实例中 `probe().nativeSideChat === true`。

### Fixed

- 修正「宿主没有删除 reference-chip 的 API」这一旧结论：conversation shell 实际暴露 `consumeToken`。
- 跨消息的选区不再谎报来源：起点与终点不在同一行时，不带轮次/角色、也不写可跳回坐标，原文照常发出。

## 0.12.0 — 2026-10-19

- 原文侧高亮与序号、`引用 ×N` 聚合条、可读来源头、线格式转义、diff 划选、清单多选插入、审阅工作台（状态 / 标签 / 批量）、双语插件页与包描述补齐。

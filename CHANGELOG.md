# Changelog

## Unreleased (lab)

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

# Changelog

## Unreleased (lab)

### Fixed

- 取消侧边对话后原文仍留着高亮：第三项会为引用预先算坐标（跳回与悬停卡片要用它的序号），以前这一步直接落进原文高亮表，于是**只要点过第三项**，那段文字就被画上高亮与序号徽标——即使读者随即把侧边对话关掉、根本没发送。现在这类坐标以 `draft` 记在 `dsh-client-ui-quote:v2:quote-source` 里，`paintAnchors` 跳过它；只有当这句引用真的以胶囊形态出现在某条 transcript（`capsuleFor` 认到同一个 ref）时，`promoteSource` 才把它转正并补画标记。主会话「添加到对话 / 评论」与已发出的旧引用不受影响（它们保存时不带 `draft`）。
- 放弃浮层动作后选区仍在：浮层自己的 `mousedown` 调了 `preventDefault()`（不然点行的一瞬间选区就消失），但退场时没人把它还回去，`Esc` / 取消 / 点别处之后那段文字会以浏览器选区形态一直亮着。`close()` 现在见到 `state.keptSelection` 就 `removeAllRanges()`，动作路径与放弃路径都不再残留选区。
- 同一段文字「先发过、又侧聊一次」时高亮会消失：`draft` 是一次保存的属性，已经转正的坐标被侧聊那次保存覆盖回了草稿——本来亮着的高亮与序号徽标反而灭掉。现在 `draft` 只继承、不覆盖永久标记（`draft === true && 原条目是 draft` 才带上），反向的转正仍由一次普通保存（发送）完成。
- 离线断言 **675 组**（check 12 + capsule 459 + panel 160 + host 44）；新增「草稿坐标不落色 / 转正后才补画（含侧边对话端到端）」「已发出的坐标不会被同一段文字的侧聊保存降级」「`draft` 标记随表持久化，刷新不会复活标记」「放弃动作把保住的选区还回去」五组断言。

### Docs

- README 的侧边对话两处（操作流程第 4 步、实现小节）改回实际形态：引用以**原生芯片**写进侧聊输入框，块引用只是宿主没有芯片面时的兜底；并补上「没发出去的引用不落到原文上」「放弃动作要把选区还回去」两条。同时修掉 `test/panel.mjs` 159 项这个旧数字（实跑 160）。

## 0.12.3 — 2026-10-26

### Added

- 侧边对话默认内置隐藏线程，不再需要安装 dsh-better-sidebar：宿主半注册 `POST /ui-quote/api/sidechat.start`（同源围栏），从在线父会话取最近几轮原话做成一条隐性上下文（不复制日志），用宿主 `agents.create` 建 `origin: "subagent"` 子会话，并在宿主内置 `subagentchat` 页签打开；descriptor 与会话标题使用与 better-sidebar 共享的 `Side: ` 约定，装不装它都不冲突。宿主半不可用（旧宿主 / 父会话不在线 / 创建被拒）时自动退回 `sessions.fork` + 本插件原生 `quote-sidechat` 页签；`sideChatBackend: "better"` 才优先走 better-sidebar。
- 侧边线程记忆与清单：新增 `dsh-client-ui-quote:v1:sidechat-target` 记录隐藏线程的父会话；读取线程时用 subagent 地址 `{parentSessionId, childSessionId, mode:"continuable"}`；线程列表同时扫描会话列表里的 `Side:` 子会话，所以 better-sidebar（或旧版本）创建的线程也能在本插件里打开、带回和导出。
- 离线断言 **667 组**（check 12 + capsule 451 + panel 160 + host 44）；新增原生页签的地址解析、标题、资源 retain/release、页签注册与卸载断言，以及宿主半的隐性上下文合成（只收原话、8000 字上限、超长截断）/ 继承切点与 descriptor 顺序 / 收口回合 / `agents.create` 参数 / 探针与围栏断言。

### Fixed

- 侧聊草稿里的引用看起来像「我自己打的字」：之前只把引用写成 `> 原文` 的块引用塞进输入框，发出去就成了用户自己的话。现在侧聊草稿**优先用原生引用芯片**（`insertReference`，与主输入框同一条路径），芯片可见地属于引用来源、发送时也会还原成线格式；只有宿主没有芯片面时才退回块引用，且第二次追加不会覆盖已有草稿。
- 胶囊的悬停卡片也加了「复制为 Markdown」：同一个 `quoteRowMarkdown` 载荷，无论这条引用有没有坐标都能用（有坐标时出处行就是 `引自第 N 轮 · 助手`）。
- 引用清单每行多一个「复制」：把**单条**引用复制成 Markdown（原文块引用或代码围栏、评论、`引自第 N 轮 · 助手` 出处），可以直接粘进 PR / issue / 别的会话。之前只有整页导出，单条引用拿不出去——这是竞品调研里唯一明确的能力缺口（Aider `/copy-context`、Zed/Cline 的「带出处」都是这个形态）。
- 侧聊页打开后是一片「探索未至之境」欢迎页、输入框里也没有引用：宿主把「一个 turn 都没有」的会话算成 blank，blank 会话渲染欢迎页而不是聊天页（没有输入框，`prefillDraft` 无处可落）。种子现在把隐性上下文包进一个**已收口的小回合**（`turn/start` → `step/start` → 上下文消息 → `step/end` → `turn/end{done}`），会话不再是 blank，页签进正常聊天态；形状版本戳同时升到 v4，之前建出来的空白线程会在下一次点击时被替换。
- 侧边对话只剩**一项**：浮层里「侧边对话」与「另开侧边对话」两个按钮长得一样、语义要读第二行才分得清，现在只留「侧边对话」，一条主会话一条线程（早期按引用分线程的记录仍会识别并复用）。
- 侧聊打开时不再把主会话的历史铺在界面上：种子从「复制父会话整条日志」改成**一条隐性上下文**——先是 session/end-seed{inherited:true} 切点，再是一条 source.kind = session-context 的 user/message（只收用户与助手的原话、最新在后、上限 8000 字，跳过工具事件与注入上下文），最后是 descriptor。模型照旧拿到上下文，侧聊里只折叠成一行「上下文」；同时不再为复制整条日志付一遍 token。
- 侧聊草稿里不再写 `Side conversation boundary.` 那段元文案：「只作背景、别继续执行」的指令挪进隐性上下文，输入框里只剩这条引用本身。
- 隐藏线程的侧聊页一打开就「历史加载失败：subagent descriptor is unavailable」：种子把 `subagent/descriptor` 放在继承前缀里、又用整段种子的长度当 `inheritedEventCount`，宿主的 `api-session-controller` 要求 descriptor 的 `seq` 不小于继承切点，于是整条子会话的历史都读不出来。现在种子先落一条 `session/end-seed { inherited: true }` 标出切点，回合收口、工作目录与 descriptor 全部排在切点之后；嵌套侧聊的父 descriptor 留在继承前缀里，我们自己的那条排在后面（投影按最后一次生效）。
- 修复前造出的坏线程会被反复打开：`sessions.retain` 对它们**照样成功**（只有历史 RPC 拒绝），所以「试开一次」判断不出来。现在客户端给新建的线程盖形状版本戳（`dsh-client-ui-quote:v1:sidechat-target` 里的当前版本，现在是 `v: 4`），只复用自己盖过章的线程；better-sidebar 的、旧版本的、扫描发现的线程一律丢弃重建——一次误杀换永久自愈。
- 正文以 ``` 或 `~~~` 开头的普通引用在回读时丢了首行：识别代码引用只看首行围栏，却没有要求块尾有配对的收尾围栏，于是引用一段 Markdown 源码时那行被当围栏剥掉（只有一行的引用会整条消失，胶囊、悬停卡片与引用清单都少字）。现在围栏必须成对才算传输层——写出去的代码引用收尾围栏始终成对，旧消息解析不变；不成对的孤围栏按正文还原。

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

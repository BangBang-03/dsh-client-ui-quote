# dsh-client-ui-quote

> 在 DSH 里**选中一句话**，浮出「评论 / 添加到对话」，把选区以 DSH 原生**引用芯片**插进输入框 —— 按 Kimi Code 的交互实现的 DSH 客户端插件。

选中正文 → 浮层两个动作 → 引用变成输入框里的行内胶囊（不是纯文本）；发送之后，消息里的引用**依然是胶囊**，不会摊成一屏 `>` 行。

## 功能

| 动作 | 行为 |
| --- | --- |
| **评论** | 浮层就地变成评论框（`写一句评论…` + `取消` / `添加到对话`）。`Enter` 提交、`Esc` 关闭、空评论时确认按钮禁用；输入法组合输入不会误触发。 |
| **添加到对话** | 直接把引用加进输入框，不弹评论框。 |

- 引用以 DSH 原生行内原子节点 `reference-chip` 插入（带图标的胶囊），走「评论」时评论正文作为普通文本紧跟其后，可继续编辑。
- 发送时由 DSH 回调本插件取「模型形态」，落到消息里是 `> ❝ …` 引用块；有评论时接在引用块之后。**消息里那段引用会被就地换成胶囊**
  （`❝` + `引用` + 行数 + 两行截断的正文，点击展开、可复制），你自己写的话保持原样，模型收到的仍是完整引用文本。
- 浮层位置贴着选区上方（上方放不下时挪到下方），配色在运行时从输入卡片 / 正文取样，深浅色主题都适配；中文/英文词条随界面语言切换。
- 芯片通路不可用时（拿不到 DSH 的输入触发服务或会话输入服务）自动退回纯文本形态：`引用：` + `> ` 引用块，评论以 `评论：` 追加。

## 安装

要求：DSH ≥ 0.2.0-rc.2 的 **web / 桌面** 客户端（`package.json` 里 `engines.dsh` 声明的就是实测版本；插件运行在渲染进程里，headless profile 没有 UI）。

### 方式一：link 安装（推荐）

```bash
git clone https://github.com/BangBang-03/dsh-client-ui-quote.git
dsh plugin --profile desktop add link:<clone-path>
```

DSH 会把包记进 profile 的依赖并加入组合包列表，装完在侧边栏 **插件** 页能看到「选中引用 (dsh-client-ui-quote)」，可随时开关。

### 方式二：手工注册为 profile 组合包

1. 把本仓库放到任意目录；
2. 编辑 `<DSH_HOME>/profiles/<profile>/package.json`：
   - `dependencies` 增加 `"dsh-client-ui-quote": "link:<绝对路径>"`（Windows 上用正斜杠，如 `link:C:/path/to/dsh-client-ui-quote`）；
   - `dsh.profile.bundles` 追加 `"dsh-client-ui-quote"`；
3. 重启 DSH（profile 打开 `patchReload` 时也会自动重载）。

**不需要手写 loader 条目**：包自带的 `cordis.patch.yml` 就是组合包层补丁，会插入

```yaml
- insert:
    - id: ui-quote
      name: dsh-client-ui-quote
```

### 卸载

从 `dsh.profile.bundles` 与 `dependencies` 里移除该条目，重启 DSH（link 安装的包目录可以直接删）。

## 使用

1. 在会话正文里**拖动选中**一段文字。选区必须落在会话正文区域里；输入框内的选区属于改稿，不触发。
2. 选区上方浮出浮层，选择 **评论** 或 **添加到对话**。
3. 引用进入输入框（评论模式下评论正文跟在后面），页面选区被清除、焦点交给输入框，可以接着写正式提问。
4. 浮层收起条件：单击别处、选区清空、按 `Esc`、滚动会话、窗口尺寸变化，以及动作完成之后。双击选词不会把浮层关掉。
5. 发送出去以后，消息里那段引用会显示成一颗**胶囊**（`❝ 引用 · N 行` + 两行截断的正文，点击展开、可复制），你自己写的话照旧显示在它下面。
   一条消息里引用了几处，就会出现几颗胶囊，中间的原话留在原来的位置。

## 工作原理

DSH 的输入框是 Lexical，没有 Kimi 的 `quote` 节点，但有一个通用的行内原子节点 `reference-chip`（`@文件` / `@会话` 提及用的就是它），而且**插件可以拥有自己的 chip**：

- 插件注册一个 reference source：

  ```js
  ctx.get("inputTriggers").registerSource({
    trigger: "#", name: "quote",
    candidates: () => [],
    codec: { clipboardText: (ref) => ref, serialize: (ref) => Promise.resolve(String(ref)) }
  });
  ```

  发送时 DSH 按 chip 的 `source` 找到 owner，调用 `codec.serialize(ref)` 取模型形态并替换进草稿。找不到 owner 会用
  `slash: no serializer for reference source "…"` 拒绝整条发送，所以插件在插入 chip 前先确保注册成功，注册不到就整体退回文本形态。
- 放入 chip 走会话输入服务：`ctx.get("conversation").input.shell(sessionId).insertReference(ref, span)`，其中
  `ref = { source, ref, label, appearance, clipboardText }`。`ref` 对 host 不透明，因此引用正文（`> …`）直接放在 `ref` 里，
  codec 保持无状态，草稿刷新后 chip 依然能还原。`appearance` 用 `session`（DSH 只认 `session` / `file` / `folder`），标签是引用正文的单行截断（48 字以内）。
- 浮层是一个挂到 `document.body` 的单例元素，注册在 `conversation.input.overlay` 槽位（会话作用域）的组件渲染 `null`，
  在 `useEffect` 里装配原生 DOM 事件：`selectionchange`（防抖）/ `pointerup` / `keyup` 读选区，`scroll` / `resize` / `Esc` / 外部点击收起。
- 每个会话把自己最新的 `inputActions` 注册进模块级表，浮层只对已注册会话的选区生效，插入时一定写进当前会话的输入框。
- 插件 ctx 存进模块级变量，chip 通路用它惰性解析 `inputTriggers` 与 `conversation` 两个服务：apply 时服务还没就绪也没关系，第一次插入时再试。

### 发送后的胶囊（transcript 侧）

发送出去的用户消息在 DSH 里是**纯文本**：`projectUserText` 只把 `@…` / `/技能` 变成行内 chip，其余原样渲染成
`white-space: pre-wrap` 的文本，`> ` 不会变成引用样式 —— 一屏 `>` 行就是这么来的。要做成 Kimi 那样一颗胶囊，
可用的路只有三条，前两条都被排除了：

- **换成原生 chip**：`@路径` 会渲染成文件 chip，但它是「蓝色文字 + 图标」，没有底/圆角，标签会被
  `split(/[\\/]/).at(-1)` 砍成 basename，点击还会调 `openFile()` 去开一个并不存在的路径；`@[标签](dsh-session:…)`
  的 session 线格式会被 host 的 `parseSessionReferenceText` 解析并在格式非法时抛 `SESSION_REFERENCE_INVALID_REFERENCE`，
  合法的又会真的去抓取被引用会话的 transcript（`MAX_REFERENCES = 3`）—— 语义不对。
- **做成附件**：`fileCard` 是原生卡片，但附件只能由粘贴/拖拽上传通路产生（发的是上传回执，模型要靠工具去读），
  引用正文反而进不了提示词。
- **插件自己画**（本插件采用）：`conversation.chat.node` 是按节点类型路由的 keyed 槽（`user` / `steering` / `context` … 由核心拥有），
  没有「每条消息一个钩子」的位置，所以胶囊画在 transcript 之上：

  - 序列化时在引用块首行留一个**固有标记** `❝`（`> ❝ 第一行`、`> 后续行`），它是刷新/重开之后唯一还能认出「这段是引用」的东西；
  - 客户端插件用 `MutationObserver` 找「只含一个文本子节点、内部有 `❝`、位于 `[data-conversation-content]` 里」的那个 run，
    把整条消息拆成 `前文 / 引用 / 中间文字 / 引用 / 后文` 这样一串分段（`splitQuoteRuns`），给原 run 加 `display:none`，
    在它**前面**按顺序插入自己的元素：每段引用一颗胶囊，每段用户自己的话一个 `span.dshq-body`（保持 `pre-wrap`）——
    所以一条消息里引用了几处，就会出现几颗胶囊，中间的原话留在原来的位置；
  - 全程只隐藏、绝不搬移或删除 React 的节点；胶囊按 run 记账（`Map<run, {text, nodes}>`），文本没变就复用、变了就地重建、
    消息被删就把胶囊一起撤掉，React 重渲染不会出现第二颗胶囊；
  - 胶囊点击展开/收起（有选区时不触发），`复制` 按钮把纯引用正文写进剪贴板；样式用 `data-plugin="dsh-client-ui-quote"` 的
    `<style>` 注入，配色取 `currentColor` 的 `color-mix`，深浅主题都不用额外适配。

### 与 Kimi Code 的对应关系

参照物是 Kimi Code 1.0.4 桌面端 bundle。Kimi 的浮层是 teleport 到 body 的 `.sab`（selection action bar），**一个元素两种模式**：
`menu` 模式两行（`评论` 切到评论模式、`添加到对话` 直接出引用），`comment` 模式为文本域 + `取消` / `添加到对话 ⏎`；
动作经 `onAction` → `insertComposerQuote(quote, comment, source)` 写入 composer，而 Kimi 的引用是 composer schema 里的行内原子节点 `quote`
（DOM 形如 `span.quote-pill[data-quote-text][data-quote-comment]`）。本插件逐条对应到 DSH：`.sab` → 本文的单例浮层，
`quote` 节点 → DSH 的 `reference-chip`，`insertComposerQuote` → `registerSource` + `insertReference` + `codec.serialize`，
发送后留在消息里的 `quote-pill` → transcript 侧的 `.dshq-cap` 胶囊（见上一节）。

## 声明（package.json）

| 字段 | 作用 |
| --- | --- |
| `dsh.bundle.patch` | 指向 `cordis.patch.yml`：作为**组合包层补丁**插入 `ui-quote` 这一行 loader 条目。 |
| `dsh.client.platform: "web"` | 声明浏览器侧 bundle。host 还接受 `dsh.client.inject`（声明依赖的客户端包）、`external`（列非基线模块请求，默认 `[]`）、`immediately`（是否随启动立即实例化，默认 `false`）；本插件只用平台基线模块，故都不声明。 |
| `exports["./client"]` | 必须导出：host 用 `clientExportOf(pkg.exports)` 找 bundle。 |
| `exports["./package.json"]` | 必须导出：插件页元数据要解析 `<pkg>/package.json`。 |
| `exports["./locale/*.json"]` | 必须导出：host 通过 ESM 解析器逐个读语言文件。 |
| `icon` | 卡片图标。**相对路径**（不能绝对路径、不能带协议）、SVG/PNG/JPEG/WebP、≤ 256 KiB、realpath 后必须留在包目录内；host 读成 `data:` URL 交给插件页。 |
| `locale/<lang>.json` | `{"meta": {"title": …, "description": …}}`。`locale/en.json` 是英文锚点（host 以它所在目录为准扫描同目录 `*.json`，语言名取自文件名）；缺 `en.json` 就没词条，`en` 回退到 `package.json` 的 `name` / `description`。 |
| `engines.dsh`（清单根） | 声明兼容的 DSH 版本范围。当前 host 不校验它（声明式）。 |
| `dsh.manifestVersion: 1` | 清单格式号，同样只作文档。 |
| `peerDependencies` | **故意留空**：`@deepseek-ai/dsh*` 的 peer 范围是唯一被强制校验的兼容性字段，范围不满足时 preflight 会在组合期把该行 `disabled`（需要 `dsh plugin allow-version` 或 profile 的 `compatibility.json` 豁免）。本插件只 require 平台基线模块 `react`，不需要 peer。 |

`npm test` 会逐条复核上面这些：补丁文件、三个导出、图标类型与体积、中英词条、以及「没有会被强制校验的 peer」。

## 结构

```
package.json          DSH 插件清单（bundle patch + client 半 + icon + locale 导出）
icon.svg              插件页卡片图标（相对路径、≤ 256 KiB 的 SVG）
cordis.patch.yml      组合包层补丁：插入 ui-quote 这个 loader 条目
lib/index.js          host 半：只声明 apply()，不提供服务
lib/client.js         全部功能：vendor-CJS 工厂 + 浮层 + 输入框芯片 + 发送后胶囊
locale/zh.json        插件页卡片文案（中文）
locale/en.json        插件页卡片文案（英文）
test/check.mjs        离线自检（清单 + 组件契约）
test/dom.mjs          给离线自检用的最小 DOM / MutationObserver 垫片
test/capsule.mjs      离线自检（发送后胶囊，29 项断言）
test/capsule.html     真浏览器里跑同一套胶囊断言（可选）
```

功能完全在浏览器侧：`lib/client.js` 用 `window.__ModuleLoader__.load({ id, factory })` 注册，只 `require("react")`
（平台基线模块），不依赖 react-dom、CSS 文件或 host 半参与序列化；浮层样式是运行时注入的内联 `<style>`，
胶囊样式是 `<style data-plugin="dsh-client-ui-quote">`。

## 自检

```bash
node --check lib/client.js
npm test          # = node test/check.mjs && node test/capsule.mjs
```

`test/check.mjs` 用桩 `window.__ModuleLoader__` / 桩 `react` / 桩 host ctx 加载 bundle，断言模块 id、服务声明、
槽位注册（`conversation.input.overlay` / `quote-selection` / locale `ui-quote`）、两套词条、「组件渲染 null」，
以及 reference source 只注册一次、`codec.serialize` 原样返回模型形态、菜单候选保持为空。
它还会按 host 读取清单的方式复核 `package.json`：`dsh.manifestVersion` / `dsh.client.platform` / `engines.dsh` 的位置、
`dsh.bundle.patch` 指向的补丁文件确实插入了 `ui-quote`、四个 `exports`、图标（相对路径 + 类型 + ≤ 256 KiB）、
`locale/*.json` 的 `meta.title` / `meta.description`，以及「没有会被 preflight 拒绝的 `@deepseek-ai/dsh*` peer」。

`test/capsule.mjs` 在 `test/dom.mjs` 的最小 DOM 上真跑一遍胶囊：把 `check.mjs` 那套桩 ctx 换成会记账的版本，塞进一条
「用户文字 + 序列化引用」的 `span.plainRun`，然后断言 —— 每个引用 run 恰好一颗胶囊、原 run 只是 `display:none` 且仍在文档里、
用户自己的话另起 `span.dshq-body`、胶囊正文等于引用、`复制` 写进剪贴板、React 重渲染不会出现第二颗、引用变了就地重建、
消息被删胶囊一起消失、卸载后 run 与样式表都恢复、手写的 `> ` 引用块不被误伤；一条消息里引用两处时，
两条引用各得一颗胶囊、两颗之间的原话仍在原位、相邻两条引用也不会被吞掉（共 29 项）。
`test/capsule.html` 是同一套断言的真浏览器版，用 `file://` 打开即可（页面会把结果写进标题与 `#probe-out`）。

## 已知限制

- 依赖 DSH 客户端的内部接口（`conversation.input.overlay` 槽位、`inputTriggers.registerSource`、`conversation.input.shell(id).insertReference`、
  `reference-chip` 节点），DSH 升级有可能失效。
- 仅 web / 桌面 profile；选区必须落在会话正文里。
- 引用在输入框里显示为胶囊，编辑器中复制粘贴出去的是它的模型形态文本。
- transcript 胶囊是在 DSH 渲染结果之上做的覆盖层：它只隐藏原节点、不搬移 React 的节点，但若 DSH 改了消息的 DOM 结构
  （`[data-conversation-content]`、纯文本 run 的形态），需要跟着改 `isQuoteRun` / `capsuleFor`。
- 更新**之前**发出的老消息不会被变成胶囊：它们的文本里没有 `❝` 标记，插件无从辨认（重新引用一次即可）。

## License

[MIT](LICENSE)

---

### English

**dsh-client-ui-quote** — select any sentence in a DSH conversation and quote it into the composer, Kimi-Code style.
A floating bar offers **Comment** and **Add to conversation**; the quote becomes DSH's native inline `reference-chip`,
is serialized back into a `> ❝ …` blockquote when you send, and is then drawn as a rounded **capsule** in the transcript
(click to expand, copy button), so a quote never floods the message with `>` lines — the model still receives the full text.
Install with `dsh plugin --profile desktop add link:<clone-path>` (DSH >= 0.2.0-rc.2, web/desktop client).
Test with `npm test`. MIT licensed.

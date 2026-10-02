# dsh-client-ui-quote

> 在 DSH 里**选中一句话**，浮出「评论 / 添加到对话」，把选区以 DSH 原生**引用芯片**插进输入框 —— 按 Kimi Code 的交互实现的 DSH 客户端插件。

选中正文 → 浮层两个动作 → 引用变成输入框里的行内胶囊（不是纯文本），发送时还原为 `> ` 引用块。

## 功能

| 动作 | 行为 |
| --- | --- |
| **评论** | 浮层就地变成评论框（`写一句评论…` + `取消` / `添加到对话`）。`Enter` 提交、`Esc` 关闭、空评论时确认按钮禁用；输入法组合输入不会误触发。 |
| **添加到对话** | 直接把引用加进输入框，不弹评论框。 |

- 引用以 DSH 原生行内原子节点 `reference-chip` 插入（带图标的胶囊），走「评论」时评论正文作为普通文本紧跟其后，可继续编辑。
- 发送时由 DSH 回调本插件取「模型形态」，落到消息里是 `> ` 引用块；有评论时接在引用块之后。
- 浮层位置贴着选区上方（上方放不下时挪到下方），配色在运行时从输入卡片 / 正文取样，深浅色主题都适配；中文/英文词条随界面语言切换。
- 芯片通路不可用时（拿不到 DSH 的输入触发服务或会话输入服务）自动退回纯文本形态：`引用：` + `> ` 引用块，评论以 `评论：` 追加。

## 安装

要求：DSH ≥ 0.2.0-rc.1 的 **web / 桌面** 客户端（插件运行在渲染进程里，headless profile 没有 UI）。

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

### 与 Kimi Code 的对应关系

参照物是 Kimi Code 1.0.4 桌面端 bundle。Kimi 的浮层是 teleport 到 body 的 `.sab`（selection action bar），**一个元素两种模式**：
`menu` 模式两行（`评论` 切到评论模式、`添加到对话` 直接出引用），`comment` 模式为文本域 + `取消` / `添加到对话 ⏎`；
动作经 `onAction` → `insertComposerQuote(quote, comment, source)` 写入 composer，而 Kimi 的引用是 composer schema 里的行内原子节点 `quote`
（DOM 形如 `span.quote-pill[data-quote-text][data-quote-comment]`）。本插件逐条对应到 DSH：`.sab` → 本文的单例浮层，
`quote` 节点 → DSH 的 `reference-chip`，`insertComposerQuote` → `registerSource` + `insertReference` + `codec.serialize`。

## 结构

```
package.json          DSH 插件清单（bundle patch + client 半 + locale 导出）
cordis.patch.yml      组合包层补丁：插入 ui-quote 这个 loader 条目
lib/index.js          host 半：只声明 apply()，不提供服务
lib/client.js         全部功能：vendor-CJS 工厂 + conversation.input.overlay 槽位组件
locale/zh.json        插件页卡片文案（中文）
locale/en.json        插件页卡片文案（英文）
test/check.mjs        离线自检
```

功能完全在浏览器侧：`lib/client.js` 用 `window.__ModuleLoader__.load({ id, factory })` 注册，只 `require("react")`
（平台基线模块），不依赖 react-dom、CSS 文件或 host 半参与序列化；浮层样式是运行时注入的内联 `<style>`。

## 自检

```bash
node --check lib/client.js
npm test
```

`test/check.mjs` 用桩 `window.__ModuleLoader__` / 桩 `react` / 桩 host ctx 加载 bundle，断言模块 id、服务声明、
槽位注册（`conversation.input.overlay` / `quote-selection` / locale `ui-quote`）、两套词条、「组件渲染 null」，
以及 reference source 只注册一次、`codec.serialize` 原样返回模型形态、菜单候选保持为空。

## 已知限制

- 依赖 DSH 客户端的内部接口（`conversation.input.overlay` 槽位、`inputTriggers.registerSource`、`conversation.input.shell(id).insertReference`、
  `reference-chip` 节点），DSH 升级有可能失效。
- 仅 web / 桌面 profile；选区必须落在会话正文里。
- 引用在输入框里显示为胶囊，编辑器中复制粘贴出去的是它的模型形态文本。

## License

[MIT](LICENSE)

---

### English

**dsh-client-ui-quote** — select any sentence in a DSH conversation and quote it into the composer, Kimi-Code style.
A floating bar offers **Comment** and **Add to conversation**; the quote is inserted as DSH's native inline `reference-chip`
and is serialized back into a `> ` blockquote when you send. Install with `dsh plugin --profile desktop add link:<clone-path>`
(DSH >= 0.2.0-rc.1, web/desktop client). Test with `npm test`. MIT licensed.

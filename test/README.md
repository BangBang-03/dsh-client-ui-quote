# test

离线回归网。没有测试框架，全部是 Node 脚本；`npm test` 依次跑三套，共 **587 组**断言。

| 文件 | 组数 | 覆盖 |
| --- | --- | --- |
| `check.mjs` | 12 | 清单字段、`exports`、图标、两份 locale 词典、槽位注册、`codec.serialize`、无强制 peer、`files` 发货白名单、截图被根 README 引用。 |
| `capsule.mjs` | 421 | 输入框 → 发送后链路：线格式、芯片插入、胶囊、悬停卡片、跳回、高亮、草稿聚合条、侧边对话、逐条徽章、diff 引用。 |
| `panel.mjs` | 154 | 引用清单页：解析、搜索、Markdown/JSON 导出、读取、注册、审阅工作台、本机索引、侧线程回流。 |
| `dom.mjs` | — | 最小 DOM / MutationObserver / Range / `localStorage` 垫片。新用到的 DOM API **先补这里**，否则 `capsule.mjs` 在 Node 里直接挂。 |
| `capsule.html` | 51 项 | 真浏览器版，`file://` 直接打开；结果写进页面标题与 `#probe-out`。 |

## 命令

```bash
npm test                 # check + capsule + panel
node test/check.mjs      # 只跑清单/契约
node test/capsule.mjs    # 只跑发送后链路
node test/panel.mjs      # 只跑清单页
```

## 红线

- 新增行为必须带断言；**不许删断言或放宽期望值换绿**。
- 若断言数变化，根 README 四处与 CHANGELOG 一处的数字要同步（587 = 12 + 421 + 154）。
- 测试跑在 `dom.mjs` 垫片上：先垫 API，再写实现，不要反过来为了过测试而改期望。

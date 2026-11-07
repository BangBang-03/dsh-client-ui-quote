# docs

产品说明的主体在根 [`../README.md`](../README.md)；这里放它的深度文档、发布材料与英文版。

| 路径 | 作用 |
| --- | --- |
| [`design.md`](design.md) | 工作原理与取舍：选区读取、线格式、坐标、高亮、侧边线程的种子格式、同类对照、`package.json` 声明。 |
| [`testing.md`](testing.md) | 740 组离线断言的细节、四套测试各自覆盖什么、真浏览器版（51 项）怎么跑。 |
| [`release.md`](release.md) | `link` / `stable` 两种运行方式、推送通道、发布运维备忘。 |
| [`README.en.md`](README.en.md) | 英文版：功能、安装、配置与已知限制的英文说明，与根 README 同一套口径。 |
| [`distribution.md`](distribution.md) | 市场提交用的身份、简介、标签、各渠道状态与检查表；投稿动作需仓库所有者账号。 |
| [`screenshots/`](screenshots/README.md) | 根 README「界面」一节用到的四张截图与 24 秒轮播 GIF。 |

## 约定

- `docs` 在 `package.json` 的 `files` 白名单里，内容会随 npm 包发布；不要往这里放工作稿、报告或临时文件。
- `screenshots/` 下的每个文件都必须在根 README 里被引用——`test/check.mjs` 会逐个核对，新增/删除截图要同步改根 README。
- 根 README 是功能与验收口径的单一来源；这里的文档只做展开，口径不一致时以根 README 的实测记录为准。

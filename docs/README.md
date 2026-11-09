# docs

根 [`README.md`](../README.md) 之外的深度文档、市场材料与英文版。本目录在 `package.json` 的 `files` 白名单里，会随 npm 包发布——只放正式文档，不放工作稿、报告或临时文件。

| 路径 | 作用 |
| --- | --- |
| [`design.md`](design.md) | 工作原理与取舍：选区读取、线格式、坐标、高亮、侧边线程的种子格式、同类对照、`package.json` 声明。 |
| [`testing.md`](testing.md) | 四套离线断言各覆盖什么、真浏览器版（51 项）怎么跑、常见坑。 |
| [`release.md`](release.md) | `link` / `stable` 两种运行方式、推送通道、发布运维备忘。 |
| [`README.en.md`](README.en.md) | 根 README 的英文版，章节与口径一致。 |
| [`distribution.md`](distribution.md) | 市场投稿的身份、简介、标签、各渠道状态与检查表。 |
| [`screenshots/`](screenshots/README.md) | 根 README「界面」一节的截图与轮播 GIF。 |

## 约定

- 根 README 是功能与验收口径的单一来源；这里只做展开，两边不一致时以根 README 的实测记录为准。
- `screenshots/` 下每个文件都必须出现在根 README（`test/check.mjs` 逐个核对），增删素材要同步改根 README。
- 文档之间互相引用用相对路径，保证 npm 包内也能点开。

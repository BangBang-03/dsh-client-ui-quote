# docs

面向发布与市场的材料。产品说明本身在根 [`../README.md`](../README.md)，这里只放它的周边资产。

| 路径 | 作用 |
| --- | --- |
| `distribution.md` | 市场提交用的身份、一句话简介、标签、资产清单与检查表；投稿动作需仓库所有者账号。 |
| [`screenshots/`](screenshots/README.md) | 根 README「界面」一节用到的四张截图与 24 秒轮播 GIF。 |

## 约定

- `docs` 在 `package.json` 的 `files` 白名单里，内容会随 npm 包发布；不要往这里放工作稿、报告或临时文件。
- `screenshots/` 下的每个文件都必须在根 README 里被引用——`test/check.mjs` 会逐个核对，新增/删除截图要同步改根 README。

# submission

插件市场 / 目录的投稿元数据。投稿是**人工动作**，需要仓库所有者账号，CI 不会代发；本目录不在 npm 的 `files` 白名单里，不会随包发布。

| 文件 | 作用 |
| --- | --- |
| `BangBang-03__dsh-client-ui-quote.yml` | awesome-dsh-plugin 的条目：`url`、`name`、`category: ui`、中英双语 `description`。 |

## 渠道状态（2026-10-31 核对）

- **已收录**：awesome-dsh-plugin（PR #6506 已合并，库里仍是旧描述；更新 PR #10188 等合并）、dsh.pub、dsh.market（`curated: false`）、DSH 应用内市场（按包名可搜）。
- **未收录**：dsh-plugin.org（走 issue）、awesome-deepseek-harness（PR #764 等合并）。
- **同名干扰**：`skyhancloud/dsh-client-ui-quote` 是另一个更早的项目；npm 上的 `dsh-client-ui-quote` 属于本仓库。

各渠道入口、可粘贴文案与检查表见 [`../docs/distribution.md`](../docs/distribution.md)。

## 约定

- 描述文案与 `package.json` 的 `description`、根 README 的定位保持一致，功能变了就一起看。
- 版本、安装命令以 `package.json` 与根 README 为准，这里不重复维护。

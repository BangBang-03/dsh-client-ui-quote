# submission

插件市场 / 目录的投稿元数据。投稿是**人工动作**，需要仓库所有者账号，CI 不会代发。

| 文件 | 作用 |
| --- | --- |
| `BangBang-03__dsh-client-ui-quote.yml` | awesome-dsh-plugin 的条目：`url`、`name`、`category: ui`、中英双语 `description`。 |

## 现状（2026-10-31 核对）

各渠道的入口、可粘贴文案与待办细节见 [`../docs/distribution.md`](../docs/distribution.md)。

- **已收录**：
  - awesome-dsh-plugin：PR [#6506](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/6506) 于 2026-10-17 合并，但库里仍是旧描述；更新 PR [#10188](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/10188) 已开、CI 全绿，等合并。
  - dsh.pub（自动收录，详情页 200）、dsh.market（自动收录，`curated: false`）、DSH 应用内市场（按 npm 包名可搜）。
- **未收录**：
  - dsh-plugin.org（走 issue）；
  - awesome-deepseek-harness（PR [#764](https://github.com/0xsline/awesome-deepseek-harness/pull/764) 已开，中英两个 README 各加一行，等维护者合并）。
- **同名干扰**：`skyhancloud/dsh-client-ui-quote` 是另一个项目（2026-08-16 创建，更早），npm 上的 `dsh-client-ui-quote` 是本仓库。

## 约定

- 描述文案与 `package.json` 的 `description`、根 README 的定位保持一致，改功能时一并检查。
- 版本、安装命令等身份信息以 `package.json` 与根 README 为准，这里不重复维护。
- 本目录不在 npm 的 `files` 白名单里，不会随包发布。

# submission

插件市场 / 目录的投稿元数据。投稿是**人工动作**，需要仓库所有者账号，CI 不会代发。

| 文件 | 作用 |
| --- | --- |
| `BangBang-03__dsh-client-ui-quote.yml` | 市场条目：`url`、`name`、`category: ui`、中英双语 `description`。 |

## 约定

- 描述文案与 `package.json` 的 `description`、根 README 的定位保持一致，改功能时一并检查。
- 版本、安装命令等身份信息以 `package.json` 与根 README 为准，这里不重复维护。
- 本目录不在 npm 的 `files` 白名单里，不会随包发布。

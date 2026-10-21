# locale

插件页卡片的本地化元数据，宿主按 `locale/*.json` 扫描。

| 文件 | 作用 |
| --- | --- |
| `en.json` | 扫描锚点（host 以它确认目录存在）；英文 `meta.title` / `meta.description`。 |
| `zh.json` | 中文同名两份文案，另有 `sourceLost`（跳回失败时的提示，需与 `lib/client.js` 里的词典逐字一致）。 |

## 约定

- 两份字典的键必须成对；`test/check.mjs` 会逐键核对，并断言 `sourceLost` 与插件内词典一致。
- 文案改动要三处同改：`lib/client.js` 的 `zh` / `en`、这里的 `zh.json` / `en.json`、`package.json` 的 `description`；行为变了顺带改根 README 的功能表。
- 本目录只放 JSON（可选 README）；不要放脚本或构建产物。

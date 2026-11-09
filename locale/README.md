# locale

插件页卡片的本地化元数据，宿主按 `locale/*.json` 扫描。**插件内界面文案不在这里**——那三份词典在 `lib/client.js` 的 `zh` / `en` / `ru` 里，由 `language` 开关决定。

| 文件 | 作用 |
| --- | --- |
| `en.json` | 扫描锚点（宿主以它确认目录存在）；英文 `meta.title` / `meta.description`。 |
| `zh.json` | 中文两份文案，另有 `sourceLost`（跳回失败时的提示，需与 `client.js` 里的词典逐字一致）。 |
| `ru.json` | 俄语两份文案，同样带 `sourceLost`；键与 `en.json` 一一对应。 |

## 约定

- 三份文件成对维护：新增词条三份一起加；`test/check.mjs` 核对每份的 `meta.title` / `meta.description`，并断言 `sourceLost` 与插件内词典逐字一致。
- 文案改动三处同改：`lib/client.js` 的 `zh` / `en` / `ru`、本目录三份 JSON、`package.json` 的 `description`；行为变了顺带改根 README 的功能表（R15）。
- 本目录只放 JSON 和这份说明，不放脚本或构建产物。

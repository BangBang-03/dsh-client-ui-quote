# .github

GitHub 侧配置。目前只有 CI / 发布工作流，见 [`workflows/README.md`](workflows/README.md)。

| 工作流 | 触发 | 作用 |
| --- | --- | --- |
| `workflows/test.yml` | 每次 push / PR | `node --check lib/client.js` + `npm test`，Node 18 / 20 / 22 矩阵。 |
| `workflows/publish.yml` | `lab` push、`v*` 标签、手动 | `lab` 发预发布到 npm `lab` tag；`v*` 标签发 `latest` 并建 GitHub Release。 |

发布需要仓库 Secret `NPM_TOKEN`（npm Automation token）；缺失时工作流会失败。分支与发布纪律见 [`../AGENTS.md`](../AGENTS.md) 与 [`../../PLUGIN-WORKFLOW.md`](../../PLUGIN-WORKFLOW.md)（工作区根，不在本仓库）。

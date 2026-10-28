# .github/workflows

两条独立通道：测试门与发布门。

## `test.yml`

- 触发：所有 `push` 与 `pull_request`。
- 矩阵：Node 18 / 20 / 22（对应 `engines.node >= 18`）。
- 步骤：`node --check lib/client.js` → `npm test`（696 组离线断言）。
- 插件没有运行期依赖，所以不跑 install。

## `publish.yml`

- `lab` 分支 push：版本盖成「下一个补丁号 + `-lab.<run_number>`」，发到 npm 的 `lab` dist-tag，不碰 `latest`。
- `v*` 标签：发 `latest`，并按 `CHANGELOG.md` 同名小节建/更新 GitHub Release。
- 手动 `workflow_dispatch`：从 `main` 触发时走稳定通道。
- 纯文档提交（`*.md`、`docs/**`、`submission/**`、`.github/**`）的**分支** push 会被 `paths-ignore` 跳过；标签推送不受路径过滤约束。
- 需要 Secret `NPM_TOKEN`；`prepublishOnly` 会先跑完全部离线断言，失败不发包。

改工作流时保持两条线互不覆盖：`lab` 永远只发预发布，稳定版只从 `v*` 标签出。

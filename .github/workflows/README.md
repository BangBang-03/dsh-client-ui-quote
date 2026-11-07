# .github/workflows

两条独立通道：测试门与发布门。

## `test.yml`

- 触发：所有 `push` 与 `pull_request`。
- 矩阵：Node 18 / 20 / 22（对应 `engines.node >= 18`）。
- 步骤：`node --check lib/client.js` → `npm test`（740 组离线断言）。
- 插件没有运行期依赖，所以不跑 install。
- 首次贡献者的 PR 可能停在 `action_required`，需要维护者在 Actions 页点一次 **Approve and run workflows**。

## `publish.yml`

- `v*` 标签：发 npm `latest`，并按 `CHANGELOG.md` 同名小节（`## ${VERSION} `）建/更新 GitHub Release；小节缺失时用一句兜底，不让文档缺失把发布拖失败。
- 手动 `workflow_dispatch`：从 `main` 触发时只重发稳定版；不会建 Release（发布说明这一步只对标签触发）。
- `main` 的普通 push **不发布**，只跑 `test.yml`；需要验证打包产物时在本机 `npm pack` 后装 tarball。
- 需要 Secret `NPM_TOKEN`；`prepublishOnly` 会先跑完全部离线断言，失败不发包。

历史上有一条 `publish-canary`（`main` push → npm `lab` dist-tag 的 `-lab.N` 预发布），2026-10-28 已删除；`lab` dist-tag 冻结在 `0.13.1-lab.61`，不再更新。

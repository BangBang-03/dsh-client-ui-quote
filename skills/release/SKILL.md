---
name: release
description: Use when 用户要求推送 lab、同步或推 main、发版、发布正式版、打 vX.Y.Z 标签、核对 Release 或 npm latest，或排查推送超时、REST 兜底、main 分叉、标签冲突、publish CI 失败（仓库 dsh-client-ui-quote）。
---

# dsh-client-ui-quote：推送与正式发版

## 适用场景

- 「推 lab / 推到开发线」：只推 `lab`，不碰 `main`，不打标签。
- 「同步 main / 推 main / 一起推 main」：`main` 快进到 `lab`，不打标签。
- 「发版 / 发布正式版 / release / 打 vX.Y.Z」：改版本与 CHANGELOG、跑测试、`main` 快进、打标签，CI 发 npm `latest` 与 GitHub Release。
- 发布后核对 Actions、Release、npm `latest`，或排查推送超时、分叉、标签冲突、CI 失败。

不负责：市场投稿、profile 三档切换、宿主安装排障（见 README 与 `docs/distribution.md`）。不主动发版：用户没有明确说「发版 / 打标签 / 推 main」时，只做 `lab` 推送。

## 先读

- `AGENTS.md`：R16/R17（测试与断言数）、R20（分支）、R21（推送通道）、R22（不进仓库的文件）。
- 工作区根 `C:\Users\15812\Desktop\dsh\PLUGIN-WORKFLOW.md`：两条线、`promote.ps1`、REST 兜底与分叉复盘。
- `package.json`、`CHANGELOG.md`、`README.md` 的「开发与发布」段。
- `.github/workflows/publish.yml`：`lab` 发预发布；`v*` 标签发 npm `latest` + GitHub Release；`test.yml` 在每次 push/PR 跑 Node 18/20/22。

## 不可违反

1. **`lab` 是唯一开发线**。所有提交先到 `lab`；`main` 只接受 `--ff-only`，不在上面直接提交、不产生 merge commit。已推送的 `lab` 不 amend、不 rebase、不 force push。
2. **日常只推 `lab`**。`main` 只在发版/里程碑或用户明确说「同步 main / 一起推 main」时追平 `lab`（R20）。
3. **正式标签只在 `main` 头**。标签形状 `vX.Y.Z`；不在 `lab` 打正式标签；标签提交必须与 `main` 同一提交。
4. **版本号必须是正式号**。`package.json` 不能带 `-lab.N`；`package.json` 版本、标签、CHANGELOG 小节、README「稳定版当前」必须逐字一致。
5. **发版前必须全绿**。`node --check lib/client.js && npm test`；发版提交包含 `package.json`，不能用 `-SkipTests`。
6. **CHANGELOG 是 Release notes 的唯一来源**。发版前必须有小节 `## X.Y.Z — YYYY-MM-DD`（`publish.yml` 用 `## ${VERSION} ` 前缀截取）；缺失只会生成兜底说明，视为发版缺陷。
7. **推送通道 git 优先，REST 兜底，同一轮不来回切**（R21）。REST 重建的提交时区归一到 `+0000`，同内容不同 SHA；混推会造出平行提交。
8. **不把工作稿带进仓库或发布**。`promote.ps1` 的 `git status --porcelain` 会连未跟踪文件一起阻塞；`.dsh-quote-work/`、`.mimosa/`、报告、截图先移出仓库或加入 `.gitignore`，不要为发版 `git add -A`（R22）。
9. **不发布未经验证的内容**：CI 失败就定位日志，不手工改已发布资产/标签掩盖失败；标签已存在先确认是否已有成功的 stable 发布（没有就重跑该标签的 workflow，有就换下一个补丁号），绝不移动、复用或删除旧标签。

## 与 dsh-memory 的差异（移植易错）

| 项 | dsh-memory | 本仓库 |
| --- | --- | --- |
| 日常推送 | `tools/push.mjs`，`main` 永远落后一版 | `git push origin lab`；`main` 只在发版/里程碑追平 |
| 发版 | `tools/release.mjs` | 工作区根 `promote.ps1 -Tag vX.Y.Z` |
| 测试 | `node test/run-all.mjs`（14 套 / 563） | `npm test`（check 12 + capsule 436 + panel 153 + host 37 = 638） |
| 发布产物 | GitHub Release；npmjs 可选 | `v*` 标签 → npm `latest` + GitHub Release（notes 来自 CHANGELOG） |
| 未跟踪文件 | `release.mjs` 只拒绝已跟踪改动 | `promote.ps1` 的 `git status` 会阻塞未跟踪文件 |
| 默认 `promote` | `main` 只追上一版 | `promote.ps1` 对 quote 默认把 `main` 追平 `lab` |

## 本机工具

| 工具 | 用途 |
| --- | --- |
| `C:\Users\15812\Desktop\dsh\promote.ps1` | 一键提升：检查 `lab`/干净/`main` 祖先，跑测试，推 `lab`，快进 `main`，推 `main`，可选打标签并核对远端 SHA |
| `...\promote.ps1 -Tag vX.Y.Z` | 正式发版（隐含把 `main` 追平 `lab`） |
| `...\promote.ps1 -Channel rest` | 已知 git 不通，直接走 REST；同轮后续分支不再等 git |
| `...\promote.ps1 -SkipTests` | 只给纯文档推送；发版禁用 |
| `...\promote.ps1 -DryRun` | 只打印步骤，适合发版前核对 |
| `C:\Users\15812\Desktop\dsh\.dsh-quote-work\push-branch.mjs <branch>` | 本机 REST 兜底（不在仓库里）；只推一条分支时会自己 `update-ref` 对齐 |
| `npm test` / `node --check lib/client.js` | 离线断言 638 组 / 语法门 |
| `gh` | 可选；未登录时用 GitHub 网页或 REST，不阻塞发版 |

脚本里 quote 的测试提示仍写着「454 项」，那是旧数字；实际执行的是 `npm test`，以输出为准。

## 日常推 lab（默认）

```bash
cd C:/Users/15812/Desktop/dsh/dsh-client-ui-quote
git checkout lab
git status --porcelain --untracked-files=no   # 开始前已跟踪改动应为空；未跟踪工作稿不要 add
node --check lib/client.js
npm test                        # 当前 638 组；数字变了先按 R17 同步四处 + CHANGELOG
git add <改动文件>              # 不要 git add -A
git commit -m "feat(scope): 中文说明"
git push origin lab
```

- `lab` 推送会触发 `publish-lab`，发 `X.Y.(Z+1)-lab.<run>` 到 npm 的 `lab` dist-tag；这是预期行为。纯 `.md` / `docs/**` / `submission/**` / `.github/**` 改动会被 `paths-ignore` 跳过。
- **不要**顺手运行 `promote.ps1`：它会把 `main` 追平 `lab`。只有用户明确要求同步 `main` 或发版时才用。
- git 推不上去：改用同一轮的 REST 兜底，不要在 REST 之后再 `git push`：

```bash
node C:/Users/15812/Desktop/dsh/.dsh-quote-work/push-branch.mjs lab
```

## 同步 main，不发版

只有用户明确说「同步 main / 推 main / 一起推 main」才做；不打标签、不改版本号。

```bash
git checkout main
git merge --ff-only lab
git push origin main
git checkout lab
```

- 也可以用 `pwsh -File C:\Users\15812\Desktop\dsh\promote.ps1 -Repo dsh-client-ui-quote`；它同时推 `lab`，所以只想要 `lab` 时不要用。
- `publish.yml` 不监听 `main`，但 `test.yml` 会跑；确认 `test` 绿。
- 快进失败 = 两条线已分叉：停下，按「失败处理」查，不要 rebase/force。

## 正式发版

### 0. 预检

```bash
git checkout lab
git status --porcelain                  # 必须为空（含未跟踪）
git fetch origin --prune
git branch --show-current               # lab
node -p "require('./package.json').version"
git merge-base --is-ancestor main lab && echo "main 是 lab 的祖先"
git tag --list 'vX.Y.Z'                 # 本地标签也必须不存在
git ls-remote origin refs/heads/lab refs/heads/main 'refs/tags/vX.Y.Z*'
```

- 目标标签在本地和远端都必须不存在；任一处存在就说明发过了，换下一个补丁号。
- 默认下一个版本是当前补丁号 +1（`0.12.2` → `0.12.3`）；用户指定则按用户。
- 确认 `git credential fill` 能返回 github.com 的 token；`promote.ps1` 的最终 SHA 校验依赖它，缺失会在推送后才报错。
- 可选：`npm pack --dry-run --json` 确认包内没有 `skills/`、工作稿或多余文件（`files` 是白名单）。

### 1. 改版本、CHANGELOG、README

`promote.ps1` 只校验版本与标签，不会替你改这三处；先手工改好再提交。

- `package.json` 的 `version` 改成 `X.Y.Z`（正式号）。
- `CHANGELOG.md`：在 `## Unreleased (lab)` 下面插入 `## X.Y.Z — YYYY-MM-DD`，把本轮条目归到新小节；`Unreleased` 留给下一轮。
- `README.md` 两处：`稳定版当前 **X.Y.Z**` 1 处，安装示例里的 `"dsh-client-ui-quote": "^X.Y.Z"` 1 处。
- 若断言数变化：按 R17 同步 README 四处（`npm test` 入口、工程化第 4 条、自检合计、真机验证）+ CHANGELOG 一处。

### 2. 测试

```bash
node --check lib/client.js
npm test
```

必须全绿；当前是 638 组（check 12 + capsule 436 + panel 153 + host 37）。红就停在 `lab` 修，不 bump、不提交发版号、不打标签。

### 3. 提交

```bash
git add package.json CHANGELOG.md README.md
git commit -m "chore(release): vX.Y.Z"
```

发版提交只包含版本、CHANGELOG、README 的版本/断言数字变化；功能改动应已在之前的提交里。

### 4. 提升并发布

```bash
pwsh -File C:\Users\15812\Desktop\dsh\promote.ps1 -Repo dsh-client-ui-quote -Tag vX.Y.Z
```

它会：检查当前在 `lab`、工作区干净、`main` 是 `lab` 祖先、版本不是预发布、标签不存在；跑 `npm test`；推 `lab`；`main` 快进到 `lab`；推 `main`；在 `main` 头打 `vX.Y.Z` 并推送；核对远端 `lab`/`main`/标签 SHA。

这次 `lab` 推送会先触发 `publish-lab`，按 patch+1 发 `X.Y.(Z+1)-lab.<run>`（目标 `0.12.3` → `0.12.4-lab.N`）；它不是本次正式版，不要拿它当 `0.12.3` 的验收。

如果 git 通道已知不通，第一次就用 `-Channel rest`，不要先跑 auto 再切；同一轮不混用两条通道。

### 5. 验收

```bash
# 三条 ref 应指向同一提交（标签用 ^{} 解引用到提交）
git ls-remote origin refs/heads/lab refs/heads/main 'refs/tags/vX.Y.Z*'
git rev-parse lab main 'vX.Y.Z^{}'

# gh 已登录时
gh run list --workflow publish.yml --limit 5
gh run watch <run-id>
gh release view vX.Y.Z --json isLatest,isPrerelease,isDraft,url,body

# npm 版本（本机直连 npmjs 可能不可达，属已知网络问题）
npm view dsh-client-ui-quote version dist-tags --json
```

逐项核对：

- `publish` 工作流的 stable 任务是**标签触发**的那次并成功（不是 `lab` 的 `publish-lab`）；`test` 工作流绿。
- Release `vX.Y.Z` 存在、非 draft、非 prerelease、是 Latest；notes 与 CHANGELOG 小节一致。
- npm `latest` = `X.Y.Z`；`lab` dist-tag 是新的预发布号。
- 远端 `lab`、`main`、`vX.Y.Z` 指向同一提交（REST 兜底后 SHA 可能与本地提交不同，但三者应一致，且内容等价）。

`gh` 未登录时用 `https://github.com/BangBang-03/dsh-client-ui-quote/actions` 与 `/releases` 网页核对；本机 `npm view` 失败不代表发布失败，用 npmjs 页面或 registry API 复核。

### 6. 收尾

```bash
git checkout lab
git status -sb
```

向用户汇报：版本号、标签提交、`lab` / `main` / 标签的远端 SHA、`publish` 与 `test` 结论、Release 链接、npm `latest` 与 `lab` 预发布号、跳过的检查。本地必须回到 `lab`。

## 失败处理

| 现象 | 处理 |
| --- | --- |
| `npm test` / `node --check` 红 | 停在 `lab` 修复；不 bump、不提交发版号、不打标签 |
| 工作区不干净（含未跟踪） | 先提交或把工作稿移出仓库；不要 `git add -A`，也不要把工作稿塞进发布提交 |
| git 推送超时/认证失败 | 同一轮改走 REST（`promote.ps1 -Channel rest` 或 `push-branch.mjs`）；不要在 REST 成功后再 `git push` |
| `main` 快进失败 | 两线已分叉；停下看 `git diff main lab` 与 `git log --graph --all`，不要 rebase/force/在 main 上手工合并 |
| `promote.ps1` 报版本/标签不一致 | 先改 `package.json` 或标签名；不要带着不一致继续推送 |
| 标签已存在 | 先确认该标签是否已有成功的 stable 发布；没有就重跑该标签的 workflow，有就换下一个补丁号；绝不移动、复用或删除旧标签 |
| `publish-stable` 在 `npm publish` 前失败 | 看日志修复（测试/权限/网络）；标签不动，重跑同一标签的 workflow 是安全的 |
| `npm publish` 已成功、后续 Release 步骤失败 | 不要重发同一版本；经用户同意用 `gh release create/edit` 或网页补齐 notes/Release，或发下一个补丁版；不手工改资产/标签 |
| Release notes 是兜底句 | CHANGELOG 小节标题不符合 `## X.Y.Z ` 前缀；补文档后下一版修正，或经用户同意手工编辑 notes |
| npm 401/403 | 检查仓库 secret `NPM_TOKEN`（2027-01-09 到期）；重签后重跑；不要从本机 `npm publish`（npmjs 本地直连不可达） |
| `publish-lab` 失败 | 不影响标签发版，但要查日志；别假设 stable 一定成功 |
| 远端 SHA 与本地不同 | REST 重建会归一化时区；先 `git fetch`、确认 `git diff <本地> <远端>` 为空，再按 README 的恢复步骤把本地线对齐；没确认前不要 reset |

## 验收清单

### 日常推 lab

- [ ] 当前在 `lab`；已跟踪改动已提交；`node --check` + `npm test` 全绿
- [ ] 提交前缀符合 `feat/fix/docs/test/chore`，未把工作稿带进提交
- [ ] `lab` 已推送；`main` 未动；本地回到 `lab`
- [ ] CI `test` 绿；`publish-lab` 按预期发预发布（纯文档改动跳过）

### 同步 main（不发版）

- [ ] 用户明确要求；`main` 只做 `--ff-only`
- [ ] 没打标签、没改版本号
- [ ] `main` == `lab`；`test` 绿；本地回到 `lab`

### 正式发版

- [ ] `package.json` 版本 = `vX.Y.Z` = CHANGELOG 小节 = README「稳定版当前」
- [ ] `node --check` + `npm test` 全绿（638 组或已按 R17 同步的新数字）
- [ ] 发版提交 `chore(release): vX.Y.Z` 已推 `lab`
- [ ] `main` 快进到 `lab`；标签打在 `main` 头；远端 `lab`/`main`/标签一致
- [ ] `publish-stable` 成功；Release 是 Latest、非 draft/prerelease、notes 来自 CHANGELOG
- [ ] npm `latest` = `X.Y.Z`；`lab` dist-tag 已更新
- [ ] 本地回到 `lab`；没有 amend/rebase/force

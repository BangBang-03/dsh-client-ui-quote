---
name: release
description: Use when 用户要求推送 main、发版、发布正式版、打 vX.Y.Z 标签、核对 Release 或 npm latest，或排查推送超时、REST 兜底、标签冲突、publish CI 失败；也用于发版前做完整的交付自查（A–F 六组闸门）（仓库 dsh-client-ui-quote）。
---

# dsh-client-ui-quote：推送与正式发版

## 适用场景

- 「推 main / 推送」：提交后推 `main`，不打标签；普通 push **只跑测试，不发布**。
- 「发版 / 发布正式版 / release / 打 vX.Y.Z」：改版本与 CHANGELOG、跑测试、提交、推 `main`、打标签，CI 发 npm `latest` 与 GitHub Release。
- 发布后核对 Actions、Release、npm `latest`，或排查推送超时、标签冲突、CI 失败。

不负责：市场投稿、profile 两档切换、宿主安装排障（见 README 与 `docs/distribution.md`）。不主动发版：用户没有明确说「发版 / 打标签」时，只做 `main` 推送。

## 分支拓扑（0.12.9 起）

**GitHub 只有 `main` 一个长期分支**：默认分支、开发线、发版线都是它。产物只有一档，身份靠标签：

| 档位 | 怎么产生 | npm dist-tag | 什么时候用 |
| --- | --- | --- | --- |
| stable | 在 `main` 头打 `vX.Y.Z` 标签 | `latest` | 用户装到的版本（`@latest` / 市场） |

- `main` 的普通 push **只跑测试、不发布**。
- 早先的 canary 频道（`main` 每次 push 发一个 `-lab.N` 到 `lab` dist-tag）已于 2026-10-28 删除：打标签时 `prepublishOnly` 本来就会跑全套断言，验证打包产物在本机 `npm pack` 后装 tarball 即可。`lab` dist-tag 冻结在 `0.13.1-lab.61`，不删，老命令仍可安装但不再更新。
- 产物身份只有一个：**标签**。`main` 不需要「被提升」，提交本身就是发布候选。

## 合并外部 PR

- **squash 优先**：一个 PR 一个可读提交，`vX.Y.Z` 标签直接落在主干提交上。仓库已关掉 merge commit（两条父线会打破「标签 = 某个主干提交」的直觉），保留 rebase 给「多提交且拆分本身有信息量」的 PR。
- squash 的**标题取 PR 标题**、**正文取 PR 描述**，所以 PR 标题要写成仓库的提交口径 `fix(scope): 中文说明`，描述里放验证过程（#1 的描述就是那种）。
- 合并后**自动删除本仓的 head 分支**；fork 里的分支删不到、也不归我们管。
- **署名**：squash 会让提交 author 保持 PR 作者；正文里再补 `Co-authored-by:`，并把贡献者写进 CHANGELOG 与 Release notes。
- **首次贡献者的 CI 会停在 `action_required`**：必须在 Actions 页点 Approve and run workflows，否则测试一次都不会跑（#1 卡了 5 天就是这个原因）。
- 合并前核对：断言数按 R17 同步、没有删断言（把 `web:*` 的期望换成 `desktop:*` 随行为变更走是允许的）、R15 的文案三处同改有没有漏掉 `locale/*.json`。

## 先读

- `AGENTS.md`：R16/R17（测试与断言数）、R20（单 `main`）、R21（推送通道）、R22（不进仓库的文件）。
- 工作区根 `C:\Users\15812\Desktop\dsh\PLUGIN-WORKFLOW.md`：推送通道、`promote.ps1`、REST 兜底与分叉复盘（顶部的双分支拓扑是历史，以本文件为准）。
- `package.json`、`CHANGELOG.md`、`README.md` 的「自检」段与 [`docs/release.md`](../../docs/release.md)。
- `.github/workflows/publish.yml`：`v*` 标签发 npm `latest` + GitHub Release；`main` push 不发布；`test.yml` 在每次 push/PR 跑 Node 18/20/22。

## 不可违反

1. **只有一个长期分支 `main`**。不新建 `lab` / `dev` 长期分支；不把 `main` 当"待验收区"再往回拷。
2. **已推送的 `main` 不 amend、不 rebase、不 force push**。
3. **正式标签只在 `main` 头**。标签形状 `vX.Y.Z`；标签提交必须与 `main` 同一提交。
4. **版本号必须是正式号**。`package.json` 不能带 `-lab.N` 之类的预发布后缀（历史遗留，CI 已不再产生）；`package.json` 版本、标签、CHANGELOG 小节、README「稳定版当前」必须逐字一致。
5. **发版前必须全绿**。`node --check lib/client.js && npm test`；发版提交包含 `package.json`，不能用 `-SkipTests`。
6. **CHANGELOG 是 Release notes 的唯一来源**。发版前必须有小节 `## X.Y.Z — YYYY-MM-DD`（`publish.yml` 用 `## ${VERSION} ` 前缀截取）；缺失只会生成兜底说明，视为发版缺陷。
7. **推送通道 git 优先，REST 兜底，同一轮不来回切**（R21）。REST 重建的提交时区归一到 `+0000`，同内容不同 SHA；混推会造出平行提交。
8. **不把工作稿带进仓库或发布**。`promote.ps1` 的 `git status --porcelain` 会连未跟踪文件一起阻塞；`.dsh-quote-work/`、`.mimosa/`、报告、截图先移出仓库或加入 `.gitignore`，不要为发版 `git add -A`（R22）。
9. **不发布未经验证的内容**：CI 失败就定位日志，不手工改已发布资产/标签掩盖失败；标签已存在先确认是否已有成功的 stable 发布（没有就重跑该标签的 workflow，有就换下一个补丁号），绝不移动、复用或删除旧标签。
10. **打标签前必须完整跑一次交付自查**（下节 A–F 六组），结论随汇报给出。这不是抽查、也不能复用上个版本的结论：任何一项不过就停在 `main` 修完重跑，**不 bump、不提交发版号、不打标签**。

## 发版前交付自查（闸门）

**每次发版都要完整跑一遍，一项不落。** 时点是改完版本 / CHANGELOG / README、`npm test` 跑绿之后，`git commit -m "chore(release): vX.Y.Z"` 之前——此时工作区应当是「只差发版」的状态。`PREV` 始终指上一个发版标签，所以 `git diff "$PREV" -- <path>` 查的是这一版的全部改动（已提交 + 未提交）。

| 组 | 查什么 | 怎么查 | 通过标准 |
| --- | --- | --- | --- |
| A1 | 改动集合只有发版文件 | `git status --porcelain` | 只有 `package.json`、`CHANGELOG.md`、`README.md`、`docs/distribution.md`（断言数变了再加 `docs/design.md`、`test/README.md`、`AGENTS.md`）；**没有 `??` 未跟踪项** |
| A2 | 语法门 | `node --check lib/client.js` | 无输出 |
| A3 | 四套离线断言 | `npm test`；`node test/check.mjs` 数 `OK` 行 | 全绿；四套数字与 `AGENTS.md` R17 记录**逐字一致**（不一致就先按 R17 同步文档，见 B3） |
| A4 | 断言没被削弱 | `git diff "$PREV" -- test/` | 没有删断言、没有把期望改成实际值换绿；新增断言能在 diff 里逐条指出（R16） |
| B1 | 版本五处一致 | `npm pkg get version`；README「稳定版当前」+ 安装示例 `"^X.Y.Z"`；`CHANGELOG.md` 小节；`docs/distribution.md` 版本行 | 同一个 `X.Y.Z` |
| B2 | CHANGELOG 形状 | `grep -n "^## $V " CHANGELOG.md` | 恰好 `## X.Y.Z — YYYY-MM-DD`；`publish.yml` 按 `## ${VERSION} ` 前缀截取 Release notes |
| B3 | 断言数全仓无旧值 | `grep -rn "离线断言" --include=*.md . --exclude-dir=.dsh-memory --exclude-dir=.workbuddy --exclude-dir=.mimosa`，再看各处的「N 组 / N 项」 | 除 `CHANGELOG.md` 历史小节外，所有数字 = 本次实跑总数；覆盖 R17 列出的全部文件 + `docs/testing.md`、`docs/release.md`、`docs/distribution.md`、本 skill 的写法示例、仓库外 `promote.ps1` 提示文案 |
| B4 | 标签空位 | `git tag --list "v$V"`；`git ls-remote --tags origin "refs/tags/v$V*"` | 本地与远端都为空 |
| C1 | 中英（含 ru）词条 | `node test/check.mjs`；本轮 diff | 词典键一致；R15 的 `zh`/`en`、`locale/*.json`、`package.json` description 成对改 |
| C2 | 公开 id 没被顺手改名 | `git diff "$PREV" -- lib/ locale/` | `SOURCE_NAME`、命令、tab kind、class 前缀、存储键前缀与 R10/R14 一致 |
| C3 | README 口径 = 实际行为 | `git log --oneline "$PREV"..HEAD` 逐条对照功能表 / 已知限制 | 每条用户可见改动有对应行；新宿主契约写了出处（R18） |
| D1 | 发货白名单 | `npm pack --dry-run` | 有 `icon.svg`/`lib`/`locale`/`test`/`docs`/`cordis.patch.yml`/README/CHANGELOG/LICENSE；**没有** `skills/`、`AGENTS.md`、`CONTRIBUTING.md`、`submission/`、`.workbuddy/`、`.mimosa/`、报告或截图工作区 |
| D2 | `files` 没被顺手放宽 | `git diff "$PREV" -- package.json` | 只有 `version`（外加本轮明确要发的条目） |
| D3 | 体积同量级 | `npm pack --dry-run` 的 `total files` / `package size` | 与上一版同量级（0.14.1：32 files / 962 kB）；突增就查是不是混进了大文件 |
| E1 | 旧消息还能回读 | capsule 的 wire 组；本轮若碰过 `QUOTE_MARK`/`COMMENT_MARK`/`REPLY_MARK`/`REF_PREFIX`/`REF_LINE`/`escapeBodyLine` | 全绿；碰过就拿一条**旧版本**样本跑 `quoteBlock`/`splitQuoteRuns` round-trip，把结果贴进汇报（R7） |
| E2 | 坐标与本机键没改 | `git diff "$PREV" -- lib/client.js` | 没有改 `dsh-client-ui-quote:v1:`/`v2:` 前缀与 `REF_LINE` 形状（R8/R10） |
| E3 | 降级路径 | `node test/host.mjs`；check 的「no enforced peers」 | 全绿；缺 `webServer`/`agents`/`connection`/`betterSidebar` 仍是静默降级（R13） |
| F1 | 远端形状 | `git ls-remote --heads origin` | 只有 `refs/heads/main` |
| F2 | workflow 没被误改 | `git diff "$PREV" -- .github/` | 无意外改动；改了要能说清动机 |
| F3 | 凭证还在期 | 对照 `docs/release.md` 的运维备忘 | `NPM_TOKEN` 未过期（2027-01-09）；临近先重签并 `gh secret set` |
| F4 | 包外没有泄漏 | `git status --porcelain`；`git ls-files` 里搜报告名 | 没有 `.dsh-quote-work/`、报告、截图工作区进入仓库（R22） |

一键自查（在仓库根执行，输出逐项对照上表）：

```bash
cd C:/Users/15812/Desktop/dsh/dsh-client-ui-quote
PREV=$(git describe --tags --abbrev=0); V=$(node -p "require('./package.json').version")
echo "PREV=$PREV  V=$V"

# A 门禁
git status --porcelain                                  # 只有发版文件，无 ??
node --check lib/client.js && echo "A2 syntax ok"
npm test 2>&1 | grep "checks passed"                    # capsule / panel / host
echo "check: $(node test/check.mjs | grep -c '^OK') 组"  # 期望 12
git diff "$PREV" -- test/ | head -30                    # 期望空，或本轮新增断言

# B 版本与数字
grep -n "稳定版当前" README.md
grep -n '"dsh-client-ui-quote": "\^' README.md
grep -n "^## $V " CHANGELOG.md
grep -rn "离线断言" --include=*.md . --exclude-dir=.dsh-memory --exclude-dir=.workbuddy --exclude-dir=.mimosa | grep -v CHANGELOG.md
git tag --list "v$V"; git ls-remote --tags origin "refs/tags/v$V*"

# C 文案与契约
node test/check.mjs | tail -1
git diff "$PREV" --stat -- lib/ locale/ package.json README.md

# D 包内容
npm pack --dry-run 2>&1 | grep -E "total files|package size"
npm pack --dry-run 2>&1 | grep -E "skills/|AGENTS\.md|CONTRIBUTING\.md|submission/|\.workbuddy/|\.mimosa/"   # 期望无输出

# E 线格式与降级
git diff "$PREV" -- lib/client.js | grep -E "^\+.*(QUOTE_MARK|COMMENT_MARK|REPLY_MARK|REF_PREFIX|REF_LINE|escapeBodyLine|dsh-client-ui-quote:v)"   # 期望无输出
node test/host.mjs | tail -1

# F 发布面
git ls-remote --heads origin                            # 只有 main
git diff "$PREV" --stat -- .github/
git status --porcelain --ignored=matching | head -6     # 只有本地忽略项
```

**判定与留痕**：

- 有红项：先修，再**从 A 组重跑**（改了文档数字也可能又变）。
- 本轮确实不涉及的项可以标「不适用」，但必须写原因，不能留空。
- 结论按组写进汇报：A3 的四个数字、B3 修掉的旧数字、D1 的文件数与体积、E1 是否碰过线格式、不适用项。要落盘就写到仓库外 `.dsh-quote-work/release-check-vX.Y.Z.md`（R22）。
- 自查结论是发版证据，不是礼貌步骤：用户问「自查做了吗」时，要能一句话给出六组结论。

## 与 dsh-memory 的差异（同名脚本，不同拓扑）

`promote.ps1` 由两个仓库共用，**不要顺手把本仓库的单分支改动套到 dsh-memory 上**。

| 项 | dsh-memory | 本仓库 |
| --- | --- | --- |
| 分支 | `lab` 开发 + `main` 备份，`main` 默认只追上一版 | **只有 `main`** |
| 日常推送 | `git push origin lab`；`tools/push.mjs` 兜底 | `git push origin main`；`.dsh-quote-work/push-branch.mjs` 兜底 |
| 发版 | `tools/release.mjs` | 工作区根 `promote.ps1 -Tag vX.Y.Z` |
| 测试 | `node test/run-all.mjs`（14 套） | `npm test`（数字以 R17 记录的实跑结果为准） |
| 发布产物 | GitHub Release；npmjs 可选 | `v*` 标签 → npm `latest` + GitHub Release（notes 来自 CHANGELOG） |
| 未跟踪文件 | `release.mjs` 只拒绝已跟踪改动 | `promote.ps1` 的 `git status` 会阻塞未跟踪文件 |

## 本机工具

| 工具 | 用途 |
| --- | --- |
| `C:\Users\15812\Desktop\dsh\promote.ps1` | 一键提升：检查分支/干净/版本/标签，跑测试，推 `main`，可选打标签并核对远端 SHA |
| `...\promote.ps1 -Tag vX.Y.Z` | 正式发版（推 `main` + 在 `main` 头打标签 + 核对） |
| `...\promote.ps1 -Channel rest` | 已知 git 不通，直接走 REST |
| `...\promote.ps1 -SkipTests` | 只给纯文档推送；发版禁用 |
| `...\promote.ps1 -DryRun` | 只打印步骤，适合发版前核对 |
| `C:\Users\15812\Desktop\dsh\.dsh-quote-work\push-branch.mjs main` | 本机 REST 兜底（不在仓库里）；只推一条分支时会自己 `update-ref` 对齐 |
| `npm test` / `node --check lib/client.js` | 离线断言全绿 / 语法门 |
| `gh` | 可选；未登录时用 GitHub 网页或 REST，不阻塞发版 |

脚本里的测试提示文案（「测试 npm test（… 项）」）只是显示用，执行的是 `npm test`，断言数以输出与 R17 记录的实跑结果为准。

## 日常推 main（默认）

```bash
cd C:/Users/15812/Desktop/dsh/dsh-client-ui-quote
git switch main
git status --porcelain --untracked-files=no   # 开始前已跟踪改动应为空；未跟踪工作稿不要 add
node --check lib/client.js
npm test                        # 数字变了先按 R17 同步四处 + CHANGELOG
git add <改动文件>              # 不要 git add -A
git commit -m "feat(scope): 中文说明"
git push origin main
```

- 推 `main` **只触发 `test`**（Node 18/20/22），不发布任何东西；发版要另外打标签。
- 不要再跑「快进 main」这一步——没有第二条分支了。
- git 推不上去：改用同一轮的 REST 兜底，不要在 REST 之后再 `git push`：

```bash
node C:/Users/15812/Desktop/dsh/.dsh-quote-work/push-branch.mjs main
```

## 正式发版

### 0. 预检

```bash
git switch main
git status --porcelain                  # 必须为空（含未跟踪）
git fetch origin --prune
git branch --show-current               # main
node -p "require('./package.json').version"
git tag --list 'vX.Y.Z'                 # 本地标签也必须不存在
git ls-remote origin refs/heads/main 'refs/tags/vX.Y.Z*'
```

- 远端只应有 `main` 一个分支（`git ls-remote --heads origin`）；若还看到 `lab`，说明收敛没做完，先回到拓扑问题。
- 目标标签在本地和远端都必须不存在；任一处存在就说明发过了，换下一个补丁号。
- 默认下一个版本是当前补丁号 +1（`0.12.8` → `0.12.9`）；用户指定则按用户。
- 确认 `git credential fill` 能返回 github.com 的 token；`promote.ps1` 的最终 SHA 校验依赖它，缺失会在推送后才报错。
- 包内容不在这里细看：第 3 步闸门的 D1–D3 会完整核对 `npm pack --dry-run`（`files` 是白名单）。

### 1. 改版本、CHANGELOG、README

`promote.ps1` 只校验版本与标签，不会替你改这几处；先手工改好再提交。

- `package.json` 的 `version` 改成 `X.Y.Z`（正式号）。
- `CHANGELOG.md`：把 `## Unreleased` 下的本轮条目挪进新的 `## X.Y.Z — YYYY-MM-DD` 小节，`Unreleased` 留 `_（下一轮）_`。
- `README.md` 两处：`稳定版当前 **X.Y.Z**` 1 处，安装示例里的 `"dsh-client-ui-quote": "^X.Y.Z"` 1 处。
- `docs/distribution.md` 的版本行（它自己标注了「发版时同步」）。
- 若断言数变化：按 R17 同步所有写到断言数的文档——`README.md`、`docs/README.en.md`、`docs/design.md`、`docs/testing.md`、`docs/release.md`、`docs/distribution.md`、`test/README.md`、`.github/workflows/README.md` 与 CHANGELOG 当轮小节；改完 `grep -rn "离线断言" --include=*.md .` 复核。

### 2. 测试

```bash
node --check lib/client.js
npm test
```

必须全绿（数字以 README R17 记的实跑结果为准）。红就停在 `main` 修，不 bump、不提交发版号、不打标签。

### 3. 交付自查（必做，完整一次）

按上一节「发版前交付自查」的 A–F 六组逐项过，命令直接复制执行。**不能省、不能抽查、不能拿上个版本的结论复用**；红项修完从 A 组重跑。

结论记在手上，第 7 步汇报时按组给出（A3 的四个数字、B3 修掉的旧数字、D1 的包体积、E1 线格式、不适用项及原因）。

### 4. 提交

```bash
git add package.json CHANGELOG.md README.md docs/distribution.md
# 断言数变了再带上：docs/design.md test/README.md AGENTS.md
git commit -m "chore(release): vX.Y.Z"
```

发版提交只包含版本、CHANGELOG、README 的版本/断言数字变化；功能改动应已在之前的提交里。若 `git status` 里还有 A1 那组连带文件没 add，闸门和 `promote.ps1`（要求工作区干净）都会拦下来。

### 5. 提升并发布

```bash
pwsh -File C:\Users\15812\Desktop\dsh\promote.ps1 -Repo dsh-client-ui-quote -Tag vX.Y.Z
```

它会：检查当前在 `main`、工作区干净、版本不是预发布、标签不存在；跑 `npm test`；推 `main`；在 `main` 头打 `vX.Y.Z` 并推送；核对远端 `main` 与标签 SHA。

这次 `main` 推送**只跑测试**；真正发布的是随后那个 `vX.Y.Z` 标签（一次 npm 发布 + 一个 GitHub Release）。

如果 git 通道已知不通，第一次就用 `-Channel rest`，不要先跑 auto 再切；同一轮不混用两条通道。

### 6. 验收

```bash
# 远端 main 与标签指向同一提交（标签用 ^{} 解引用到提交）
git ls-remote origin refs/heads/main 'refs/tags/vX.Y.Z*'
git rev-parse main 'vX.Y.Z^{}'

# gh 已登录时
gh run list --workflow publish.yml --limit 5
gh run watch <run-id>
gh release view vX.Y.Z --json isLatest,isPrerelease,isDraft,url,body

# npm 版本（本机直连 npmjs 常超时：用 web_fetch 取 registry，或 curl 拉完整 packument）
npm view dsh-client-ui-quote version dist-tags --json
```

逐项核对：

- `publish` 工作流的 **publish-stable**（标签触发的那次）成功；`test` 工作流绿。
- Release `vX.Y.Z` 存在、非 draft、非 prerelease、是 Latest；notes 与 CHANGELOG 小节一致。
- npm `latest` = `X.Y.Z`（npm 是异步分发，几分钟内可见属正常）。
- 远端 `main` 与 `vX.Y.Z` 指向同一提交（REST 兜底后 SHA 可能与本地不同，但两者应一致）。

`gh` 未登录时用 `https://github.com/BangBang-03/dsh-client-ui-quote/actions` 与 `/releases` 网页核对；本机 `npm view` 失败不代表发布失败。

### 7. 收尾

```bash
git switch main
git status -sb
```

向用户汇报：版本号、标签提交、`main` 与标签的远端 SHA、`publish-stable` 与 `test` 结论、Release 链接、npm `latest`、**第 3 步交付自查的六组结论**（含不适用项及原因）、跳过的检查。本地必须回到 `main`。

## 失败处理

| 现象 | 处理 |
| --- | --- |
| `npm test` / `node --check` 红 | 停在 `main` 修复；不 bump、不提交发版号、不打标签 |
| 交付自查有红项（A–F 任一组） | 停在 `main` 修完，**从 A 组重跑**；不 bump、不提交发版号、不打标签；不许「先发再补」 |
| 自查发现文档旧数字或包内容描述不符 | 以 `npm test` 实跑与 `npm pack --dry-run` 为准修文，再重跑 A–F；`docs/release.md`、`docs/distribution.md`、`CONTRIBUTING.md` 是历史漂移点 |
| 工作区不干净（含未跟踪） | 先提交或把工作稿移出仓库；不要 `git add -A`，也不要把工作稿塞进发布提交 |
| git 推送超时/认证失败 | 同一轮改走 REST（`promote.ps1 -Channel rest` 或 `push-branch.mjs main`）；不要在 REST 成功后再 `git push` |
| `promote.ps1` 报版本/标签不一致 | 先改 `package.json` 或标签名；不要带着不一致继续推送 |
| 标签已存在 | 先确认该标签是否已有成功的 stable 发布；没有就重跑该标签的 workflow，有就换下一个补丁号；绝不移动、复用或删除旧标签 |
| `publish-stable` 在 `npm publish` 前失败 | 看日志修复（测试/权限/网络）；标签不动，重跑同一标签的 workflow 是安全的 |
| `npm publish` 已成功、后续 Release 步骤失败 | 不要重发同一版本；经用户同意用 `gh release create/edit` 或网页补齐 notes/Release，或发下一个补丁版；不手工改资产/标签 |
| Release notes 是兜底句 | CHANGELOG 小节标题不符合 `## X.Y.Z ` 前缀；补文档后下一版修正，或经用户同意手工编辑 notes |
| npm 401/403 | 检查仓库 secret `NPM_TOKEN`（2027-01-09 到期）；重签后重跑；不要从本机 `npm publish`（npmjs 本地直连不可达） |
| 远端 SHA 与本地不同 | REST 重建会归一化时区；先 `git fetch`、确认 `git diff <本地> <远端>` 为空，再按 [`docs/release.md`](../../docs/release.md) 的恢复步骤把本地线对齐；没确认前不要 reset |

## 验收清单

### 日常推 main

- [ ] 当前在 `main`；已跟踪改动已提交；`node --check` + `npm test` 全绿
- [ ] 提交前缀符合 `feat/fix/docs/test/chore`，未把工作稿带进提交
- [ ] `main` 已推送；本地在 `main` 且干净
- [ ] CI `test` 绿（`publish` 不会被 push 触发，这是预期）

### 发版前交付自查（A–F，必做）

- [ ] A1 工作区只有发版文件（无 `??` 未跟踪项）；A2 `node --check` 无输出；A3 `npm test` 全绿且四套数字 = R17
- [ ] A4 `git diff $PREV -- test/` 没有删断言或放宽期望
- [ ] B1 版本五处一致；B2 CHANGELOG 小节是 `## X.Y.Z — YYYY-MM-DD`；B3 全仓没有旧断言数残留；B4 标签本地/远端都空
- [ ] C1 词条成对（含 ru）；C2 公开 id / 存储键未变；C3 README 功能表覆盖本轮用户可见改动
- [ ] D1 `npm pack --dry-run` 有该有的、没有 `skills/` `AGENTS.md` `CONTRIBUTING.md` `submission/` 工作稿；D2 `files` 未被放宽；D3 体积同量级
- [ ] E1 线格式组全绿（碰过标记就用旧样本补 round-trip）；E2 坐标键未改；E3 缺服务仍静默降级
- [ ] F1 远端只有 `main`；F2 workflow 未被误改；F3 `NPM_TOKEN` 未过期；F4 仓库里没有工作稿
- [ ] 结论已按组记下（留痕在仓库外）；红项修完已从 A 组重跑，不适用项写了原因

### 正式发版

- [ ] **交付自查 A–F 六组已完整跑过，结论已记录**（红项已从 A 组重跑）
- [ ] `package.json` 版本 = `vX.Y.Z` = CHANGELOG 小节 = README「稳定版当前」
- [ ] `node --check` + `npm test` 全绿（数字按 R17 同步）
- [ ] 发版提交 `chore(release): vX.Y.Z` 已推 `main`
- [ ] 标签打在 `main` 头；远端 `main` 与标签一致
- [ ] `publish-stable` 成功；Release 是 Latest、非 draft/prerelease、notes 来自 CHANGELOG
- [ ] npm `latest` = `X.Y.Z`（异步可见属正常）
- [ ] 本地回到 `main`；没有 amend/rebase/force

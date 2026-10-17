# SIGNAL — 运行手册（Runbook）

最后验证：2026-10-17。以下「已验证」条目均在实际环境中执行通过；「未验证/受限」条目如实标注。

## 1. 本地开发环境要求

- **Node.js ≥ 22.5**（实测 Node 24.21.0）。项目依赖内建 `node:sqlite`。
- **npm**（实测 11.19.0）。
- 操作系统：Windows / macOS / Linux 均可；无原生编译依赖（SQLite 为 Node 内建）。

```bash
npm install        # 安装依赖
npm run dev        # 开发模式（http://localhost:3000）
npm run build      # 生产构建
npm run start      # 生产运行（需先 build）
```

质量命令：

```bash
npm run lint       # ESLint（已通过）
npm run typecheck  # tsc --noEmit（已通过）
npm test           # Vitest（29/29 通过）
npm run build      # Next.js 生产构建（已通过）
```

## 2. 数据库初始化与迁移

- 数据库为单个 SQLite 文件，默认路径 **`.data/signal.db`**（WAL 模式）。
- 首次访问任何数据接口时自动创建目录与全部表（`CREATE TABLE IF NOT EXISTS`，
  即「启动时自动迁移」；schema 只做增量添加，不做破坏性变更）。
- 可通过 `SIGNAL_DB_PATH` 覆盖路径（绝对路径）。
- 当前没有独立的迁移工具或历史版本迁移表；若未来需要破坏性变更，应先新增列/表
  并做数据回填，再删除旧列。

## 3. 必须配置的环境变量

复制 `.env.example` 为 `.env.local`。全部密钥只读自服务端环境变量，绝不进入前端。

| 变量 | 必填 | 说明 |
| ---- | ---- | ---- |
| `GITHUB_TOKEN` | 否 | 提升 GitHub API 限额（60→5000 次/小时）。设置后可在设置页「GitHub 认证」中验证是否生效；Token 只读自服务端，不会返回前端或写入日志。 |
| `RSS_FEEDS` | 否 | 逗号分隔的 RSS/Atom 订阅源；缺省时 RSS 源 unconfigured。 |
| `ARXIV_RSS_CATEGORIES` | 否 | arXiv 每日公告 RSS 分类，默认 `cs.AI,cs.LG,cs.RO,cs.CL,cs.SE`。 |
| `SIGNAL_DISABLED_PROVIDERS` | 否 | 暂停自动采集的来源（`arxiv`/`arxiv-rss`/`github`/`rss`/`hackernews`）。暂停后不发请求、保留历史数据。 |
| `SIGNAL_MIN_REQUEST_INTERVAL_MS` | 否 | 出站请求最小间隔；arXiv 相关来源强制 ≥3000ms。 |
| `LLM_ANALYZER_API_KEY` | 否 | 启用 OpenAI 兼容分析引擎；缺省用内置规则引擎。 |
| `LLM_ANALYZER_BASE_URL` / `LLM_ANALYZER_MODEL` | 否 | LLM 引擎端点与模型。 |
| `SIGNAL_SCHEDULER_ENABLED` | 否 | `true` 启用定时任务（默认关闭）。 |
| `SIGNAL_SCHEDULER_INTERVAL_MS` | 否 | 定时间隔，默认 21600000（6h），最小 15000。 |
| `SIGNAL_ADMIN_TOKEN` | 否 | 设置后，手动更新/后台端点需 Bearer 或 `X-Admin-Token`。 |
| `SIGNAL_DB_PATH` | 否 | SQLite 路径覆盖。 |

## 4. 定时任务的部署方式

- 定时任务为**进程内调度器**（`src/instrumentation.ts` → `startScheduler()`），
  随 `next start` / `next dev` 启动，无需额外进程。
- 开启方式：`SIGNAL_SCHEDULER_ENABLED=true`。每个周期顺序执行
  `sync → analyze → briefing → trends`，每步独立加锁、幂等、写执行记录。
- **并发保护**：`task_locks` 表做租约锁；instrumentation 在多个 worker 中运行时，
  通过「owner 租约」保证同一时刻只有一个 worker 执行周期（已实测：clean boot 下
  单周期只触发一次，冲突时第二个 run 记为 `skipped`，不重复写入）。
- 崩溃恢复：进程被强杀时残留锁会在租约到期（默认 30 分钟）后自动释放；
  owner 租约在 `2×interval + 60s` 后到期，由其他 worker 接管。

## 5. 日志、备份与恢复

- **日志**：Next.js 服务日志输出到 stdout/stderr；任务执行记录存于
  `task_runs`（含 trigger、status、error），数据源错误存于 `provider_errors`。
  未在任何日志中输出密钥或令牌。
- **备份**：复制 `.data/signal.db`（运行中的 `-wal`/`-shm` 会随连接自动 checkpoint；
  稳妥做法是先停服再复制，或用 `sqlite3 .backup`）。
- **恢复**：用备份文件替换 `.data/signal.db` 后重启即可；本地浏览器
  `localStorage` 只存 UI 偏好（主题、设置、订阅），丢失不影响知识库数据。

## 6. API 费用与配额风险

| 来源 | 风险 | 缓解 |
| ---- | ---- | ---- |
| arXiv RSS（rss.arxiv.org） | 与 legacy API 共享限流；单分类 feed 可达 ~1MB、冷缓存约 60s | 串行 + ≥3s 间隔 + 90s 超时；逐分类容错；默认 5 个分类 |
| arXiv 导出 API | 官方条款要求「每 3 秒最多 1 次请求、单连接」；本机 IP 实测长期返回 429/503 | 当前已通过 `SIGNAL_DISABLED_PROVIDERS` 暂停；历史 50 条保留 |
| GitHub | 已认证后 core 5000/h、search 30/min；未认证仅 60/h、10/min（实测 403 即源于此） | 统一 `githubGetJson` 客户端：串行 + ≥1s 间隔；主限流不重试、次限流按 `retry-after` 最多重试 1 次；错误分类并脱敏 |
| Hacker News | Algolia API，免费且较宽松 | 有限重试；失败保留上次数据 |
| RSS 媒体源 | 各站点反爬/限流；单个源失败不影响其他源 | 逐源容错、每源只取最近 30 条、SSRF 校验 |
| LLM | 可选付费；本仓库未配置密钥，未实际调用过 | 缺省用免费规则引擎 |

## 7. 尚未接入或无法保证稳定运行的功能

- **LLM 分析引擎**：接口已实现但未配置密钥、未实际调用验证（默认走规则引擎）。
- **Star 增长趋势（Momentum）**：需要多次历史快照（≥2 次且跨足够时长），
  首次采集后必然显示 unknown——这是预期行为，不是故障。
- **Docker/多实例部署**：未提供、未验证；当前验证的是单机 `npm run build && start`。

## 8. 安全说明

- 所有外部抓取经 `url-guard.ts`：仅 http/https、拒绝内网/保留 IP、DNS 解析校验、
  禁止重定向、拒绝内嵌凭据；外部文本一律作为不可信输入，React 默认转义渲染
  （全项目未使用 `dangerouslySetInnerHTML`）。
- 手动更新/后台端点（sync、analysis/run、trends/collect、tasks/run）经
  `auth.ts` 守卫：跨域 `Origin` 拒绝，可选用 `SIGNAL_ADMIN_TOKEN`。
- 生产依赖 `npm audit --omit=dev`：**0 漏洞**。

## 9. 已知问题清单

1. 定时器在 Next.js 多 worker 下会启动多个 `register()` 实例（已用 owner 租约收敛为
   单一执行，但每个 worker 仍各持一个定时器，属无害的空转）。
2. 进程被强杀时可能残留 30 分钟租约锁（到期自动释放；如需立即恢复可手动
   `DELETE FROM task_locks`）。
3. 中文在 Windows PowerShell 控制台显示为乱码是控制台编码问题，数据库与浏览器
   中为正确 UTF-8（已实测）。
4. GitHub/arXiv 的公开 API 限流会导致单次采集失败；任务会记录错误并保留上次成功数据。
   若本机出口 IP 被 arXiv 封限（返回 `Rate exceeded.`），需等待解封或配置代理，
   arXiv 采集在解封前无法获得新数据（其余来源不受影响）。

## 10. 后续优先级

1. P0：接入真实 LLM 密钥后，验证 LLM 分析路径。
2. P0：将仓库快照累积到数天以上，验证 Momentum 时间序列的真实计算。
3. P1：为定时任务增加邮件/桌面通知与更细粒度的 cron 表达式（当前为固定间隔）。
4. P1：将 `localStorage` 的 UI 偏好迁移到服务端，统一备份面。
5. P2：Dockerfile + compose 化部署与健康检查端点。
6. P2：Playwright 端到端测试（当前为 Vitest 单元测试 29 例）。

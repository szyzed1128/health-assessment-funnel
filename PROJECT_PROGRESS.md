# 健康测评系统：执行进度

## 当前状态

- 总体状态：核心代码已完成，本地验证通过；外部交付项进行中。
- 当前阶段：阶段 5 - 质量、CI、部署与交付证据。
- 最后更新：2026-09-22
- 需求基线：[PROJECT_REQUIREMENTS.md](PROJECT_REQUIREMENTS.md)
- 实施计划：[PROJECT_PLAN.md](PROJECT_PLAN.md)
- 当前待解决项：[PENDING_ISSUES.md](PENDING_ISSUES.md)

## 里程碑看板

| 阶段 | 状态 | 完成条件 | 当前证据 |
| --- | --- | --- | --- |
| 0. 项目基线与工程骨架 | 已完成 | 项目、Prisma、测试基础可运行 | Next.js、TypeScript、PostgreSQL、Prisma、Vitest、Playwright 已配置 |
| 1. 数据模型与会话持久化 | 已完成 | 分步保存与恢复经过测试 | Schema、迁移、API、重复/乱序/并发/恢复测试通过 |
| 2. 服务端健康评估 | 已完成 | 算法与边界测试完成 | BMI、建议摄入量、目标日期、预测点均由服务端计算并持久化 |
| 3. 订阅与模拟支付 | 已完成 | 权限隔离与幂等闭环经过测试 | 免费响应无受保护字段；`/pay` 激活会员；重复事件幂等 |
| 4. 用户 Funnel 与结果展示 | 已完成 | 可完成测评到会员解锁 | 中文前端、刷新恢复、免费/会员结果、重开测评、预测趋势展示 |
| 5. 测试、CI、部署与交付 | 进行中 | `npm test`、GitHub Actions、线上演示均通过 | 本地 `npm test` 与 workflow 文件已完成；公网和真实 CI 记录待外部仓库/部署 |

## PRD 阶段性目标看板

| 目标 | 状态 | 对应阶段 | 验收证据 |
| --- | --- | --- | --- |
| G1. 测评数据持久化与状态恢复 | 已完成 | 阶段 1 | 增量保存、恢复、重复/乱序/并发测试通过 |
| G2. 规范 API 与可扩展数据库模型 | 已完成 | 阶段 0-1 | API 文档、Prisma schema/migration、校验测试、Schema 图 |
| G3. 服务端健康评估与结果持久化 | 已完成 | 阶段 2 | 算法单测、结果持久化测试、边界测试 |
| G4. 订阅鉴权与模拟支付闭环 | 已完成 | 阶段 3 | 权限对照测试、支付幂等测试、端到端升级测试 |
| G5. 自动化测试与持续验证 | 部分完成 | 阶段 5 | `npm test` 本地通过；GitHub Actions 配置已完成；真实 Actions 通过记录待 GitHub 仓库 |

## 当前 PRD 对齐结论

| PRD/用户要求 | 结论 | 证据或缺口 |
| --- | --- | --- |
| 分步保存接口 | 满足 | `PUT /api/sessions/:sessionId/answers/:questionKey`，每步保存并 upsert |
| 进度恢复逻辑 | 满足 | `GET /api/sessions/:sessionId/progress`，前端用 `localStorage` 保存并恢复 `sessionId` |
| 服务端健康评估 | 满足 | 服务端读取已持久化答案，计算 BMI、建议摄入量、目标日期并保存 |
| 免费/会员差异化 API | 满足 | 非会员响应采用 allow-list，不返回 `weeklyForecast`、`recommendedDailyCalories`、`targetDate`、`actionPlan` |
| 模拟支付 `/pay` | 满足 | 支付事件记录、订阅激活、重复事件幂等、跨 Session 冲突拒绝 |
| 一键测试 | 满足 | `npm test` 同时运行 Vitest 与 Playwright |
| CI 加分项 | 本地配置已完成，外部状态待补 | `.github/workflows/ci.yml` 已存在；需推送 GitHub 后取得真实通过状态 |
| 公网演示 URL | 未完成 | 需要部署平台和线上 PostgreSQL |
| 已支付公网测试 Session | 未完成 | 本地已有测试 ID；公网发布后需用 `BASE_URL=... npm run demo:paid-session` 重新生成 |
| README 环境变量说明 | 已完成 | README 已补充 `DATABASE_URL` 说明 |

## 评分维度追踪

| 评分维度 | 状态 | 当前证据/缺口 |
| --- | --- | --- |
| API 设计 | 已完成 | README API 表、资源路径、统一响应结构、API 集成测试 |
| 数据校验 | 已完成 | Zod、领域校验、非法输入测试 |
| 数据库设计 | 已完成 | Prisma schema、迁移、唯一约束、索引、Mermaid Schema 图 |
| 权限校验 | 已完成 | 服务端订阅判断与字段过滤，免费/会员响应测试 |
| 支付闭环 | 已完成 | `/pay`、支付事件幂等、冲突测试、支付后结果升级 |
| 状态与异常 | 已完成 | 刷新恢复、重复/乱序/并发写入、结果作废重算测试 |
| 测试与质量 | 已完成 | `npm test` 本地通过：Vitest 38 个测试、Playwright 1 条 E2E |
| CI | 部分完成 | workflow 文件已完成；真实 Actions 通过状态待 GitHub 仓库 |
| AI 协作效率 | 已完成 | README 已记录 AI 使用复盘和一次被修正的建议 |

## 最新验证记录

| 日期 | 验证项 | 命令/方式 | 结果 |
| --- | --- | --- | --- |
| 2026-09-22 | TypeScript | `npm run typecheck` | 通过 |
| 2026-09-22 | Lint | `npm run lint` | 通过 |
| 2026-09-22 | 一键测试 | `npm test` | 通过，Vitest 9 文件 38 测试，Playwright 1 测试 |

## 剩余推进项

1. 创建或关联 GitHub 仓库，推送当前代码。
2. 等 GitHub Actions 跑完后，把 README 中的 CI 状态改为真实 badge 或 workflow 链接。
3. 选择部署平台并配置线上 PostgreSQL。
4. 部署成功后，把公网演示 URL 写入 README。
5. 对公网环境运行 `BASE_URL=https://你的公网域名 npm run demo:paid-session`，将输出的已支付公网 `sessionId` 写入 README。

## 风险与决策记录

| 日期 | 类型 | 内容 | 影响与处理 |
| --- | --- | --- | --- |
| 2026-09-21 | 决策 | 以两天为实际交付周期。 | 先完成后端闭环、测试与 CI；视觉和扩展题目后置。 |
| 2026-09-21 | 决策 | 竞品用于借鉴数据流与 Funnel 节奏，不做 1:1 复刻。 | 固定最小题集，保留可扩展的数据模型。 |
| 2026-09-21 | 决策 | CI 在 PRD 中是加分项，但项目负责人要求必须完成。 | 本项目按用户验收硬目标推进 CI；表述时不伪装为 PRD 原文。 |
| 2026-09-21 | 决策 | 使用 Next.js App Router + TypeScript、PostgreSQL 16 + Prisma、Zod、Vitest、Playwright。 | 单体全栈架构覆盖 API、持久化、测试与 Funnel。 |
| 2026-09-21 | 决策 | 采用模块化单体而非微服务。 | 单个 Next.js 应用和 PostgreSQL 数据库；按 session、assessment、health、subscription、payment 隔离代码与测试边界。 |
| 2026-09-21 | 决策 | 同会话的并发答案保存采用 PostgreSQL 事务级 advisory lock。 | 同一 `sessionId` 串行更新并重算进度，不阻塞其他会话；并发集成测试通过。 |
| 2026-09-21 | 环境 | Playwright 官方 CDN 下载 Chromium 无进度。 | 切换至 Playwright 国内镜像 `npmmirror.com/mirrors/playwright`，浏览器安装成功。 |

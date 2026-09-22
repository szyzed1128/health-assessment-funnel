# 健康测评系统：执行进度

## 当前状态

- 总体状态：核心代码、GitHub CI、一键 Docker 部署配置、公网部署与线上验收均已完成。
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
| 2. 服务端健康评估 | 已完成 | 算法与边界测试完成 | BMI 预览、目标分流、BMI 建议区间、建议摄入量、系统预计日期、重要日期来源和预测点均由服务端计算或校验，正式结果持久化 |
| 3. 订阅与模拟支付 | 已完成 | 权限隔离与幂等闭环经过测试 | 免费响应无受保护字段；`/pay` 校验模拟支付码后激活会员；重复事件幂等 |
| 4. 用户 Funnel 与结果展示 | 已完成 | 可完成测评到会员解锁 | 中文前端、刷新恢复、BMI 预览、保持体重分流提示页、目标体重建议、重要日期选择、日期来源选择、独立结果页、独立模拟支付页、BMI 区间条、免费/会员结果、重开测评、非线性预测趋势展示 |
| 5. 测试、CI、部署与交付 | 已完成 | `npm test`、GitHub Actions、线上演示均通过 | 本地 `npm test`、真实 GitHub Actions、Docker 一键部署配置与公网部署均已完成 |

## PRD 阶段性目标看板

| 目标 | 状态 | 对应阶段 | 验收证据 |
| --- | --- | --- | --- |
| G1. 测评数据持久化与状态恢复 | 已完成 | 阶段 1 | 增量保存、恢复、重复/乱序/并发测试通过 |
| G2. 规范 API 与可扩展数据库模型 | 已完成 | 阶段 0-1 | API 文档、Prisma schema/migration、校验测试、Schema 图 |
| G3. 服务端健康评估与结果持久化 | 已完成 | 阶段 2 | 算法单测、结果持久化测试、边界测试 |
| G4. 订阅鉴权与模拟支付闭环 | 已完成 | 阶段 3 | 权限对照测试、支付码校验、支付幂等测试、端到端升级测试 |
| G5. 自动化测试与持续验证 | 已完成 | 阶段 5 | `npm test` 本地通过；GitHub Actions 已真实通过 |

## 当前 PRD 对齐结论

| PRD/用户要求 | 结论 | 证据或缺口 |
| --- | --- | --- |
| 分步保存接口 | 满足 | `PUT /api/sessions/:sessionId/answers/:questionKey`，每步保存并 upsert |
| 进度恢复逻辑 | 满足 | `GET /api/sessions/:sessionId/progress`，前端用 `localStorage` 保存并恢复 `sessionId` |
| 服务端健康评估 | 满足 | BMI 预览和最终评估均由服务端计算；最终保存 BMI、建议摄入量、系统预计日期、重要日期来源和实际预测参考日期 |
| 免费/会员差异化 API | 满足 | 非会员响应采用 allow-list，不返回 `weeklyForecast`、`recommendedDailyCalories`、`targetDate`、`requestedTargetDate`、`actionPlan` |
| 模拟支付 `/pay` | 满足 | 根路径 `/pay` 与内部 `/api/pay` 复用同一套支付逻辑；正确支付码才会记录支付事件并激活订阅；错误支付码不落库；重复事件幂等、跨 Session 冲突拒绝 |
| 一键测试 | 满足 | `npm test` 同时运行 Vitest 与 Playwright |
| CI 加分项 | 已满足 | [GitHub Actions 最新运行已通过](https://github.com/szyzed1128/health-assessment-funnel/actions/runs/35687684067) |
| 公网演示 URL | 已完成 | http://47.110.230.230:3000 |
| 已支付公网测试 Session | 已完成 | `a27349cb-7644-4844-94a8-574c58c03d81`；会员结果页 `http://47.110.230.230:3000/result?sessionId=a27349cb-7644-4844-94a8-574c58c03d81` |
| README 环境变量说明 | 已完成 | README 已补充 `DATABASE_URL` 说明 |

## 评分维度追踪

| 评分维度 | 状态 | 当前证据/缺口 |
| --- | --- | --- |
| API 设计 | 已完成 | README API 表、资源路径、统一响应结构、API 集成测试 |
| 数据校验 | 已完成 | Zod、领域校验、非法输入测试 |
| 数据库设计 | 已完成 | Prisma schema、迁移、唯一约束、索引、评估结果必填字段非空约束、Mermaid Schema 图 |
| 权限校验 | 已完成 | 服务端订阅判断与字段过滤，免费/会员响应测试 |
| 支付闭环 | 已完成 | `/pay` 支付码校验、支付事件幂等、冲突测试、支付后结果升级 |
| 状态与异常 | 已完成 | 刷新恢复、重复/乱序/并发写入、结果作废重算测试 |
| 测试与质量 | 已完成 | `npm test` 本地通过：Vitest 11 个文件、79 个测试，Playwright 4 条 E2E |
| CI | 已完成 | workflow 文件已完成，真实 Actions 运行已通过 |
| 一键部署配置 | 已完成 | `Dockerfile` 与 `docker-compose.prod.yml` 已补齐，从 GitHub clone 后可执行 `docker compose -f docker-compose.prod.yml up -d --build` 启动 PostgreSQL、迁移和应用 |
| AI 协作效率 | 已完成 | README 已记录 AI 使用复盘和一次被修正的建议 |

## 最新验证记录

| 日期 | 验证项 | 命令/方式 | 结果 |
| --- | --- | --- | --- |
| 2026-09-22 | TypeScript | `npm run typecheck` | 通过 |
| 2026-09-22 | Lint | `npm run lint` | 通过 |
| 2026-09-22 | 一键测试 | `npm test` | 通过，Vitest 11 个文件 79 个测试，Playwright 4 个测试 |
| 2026-09-22 | 日期与保持体重回归 | `npm run typecheck`、`npm run lint`、`npm test` | 通过；默认日期为当前日期后 14 天，真实日历日期校验通过，正常 BMI 的保持体重会自动持久化并跳过目标体重题 |
| 2026-09-22 | BMI 目标分流回归 | `npm run test:unit`、`npm run test:e2e` | 通过；保持体重按 BMI 低/正常/偏高分流，重定向提示页可恢复，直接低 BMI 减重被服务端拒绝，增重目标区间由服务端校验 |
| 2026-09-22 | 结果页与模拟支付页拆分 | `npm run typecheck`、`npm run lint`、`npm test` | 通过；`/result` 只读服务端结果接口，`/checkout` 输入支付码后调用 `/api/pay` 修改订阅状态 |
| 2026-09-22 | `/pay` 兼容与评估结果非空约束 | `npm run typecheck`、`npm run lint`、`npm test`、`npm run build` | 通过；根路径 `/pay` 复用支付逻辑，`HealthAssessmentResult` 的 BMI、建议摄入量、系统目标日期、实际预测参考日期和预测曲线改为数据库非空 |
| 2026-09-22 | GitHub Actions 首次真实运行 | [CI run 35675226740](https://github.com/szyzed1128/health-assessment-funnel/actions/runs/35675226740)、[修复后 CI run 35675508162](https://github.com/szyzed1128/health-assessment-funnel/actions/runs/35675508162)、[最新 CI run 35687684067](https://github.com/szyzed1128/health-assessment-funnel/actions/runs/35687684067) | 修复 Prisma generate 缺少 `DATABASE_URL` 的 workflow 配置问题后，依赖安装、Playwright、PostgreSQL、类型检查、Lint 和 `npm test` 全部通过 |
| 2026-09-22 | 一键 Docker 部署配置 | `Dockerfile`、`docker-compose.prod.yml`、`deploy.env.example`；本地临时端口 `3010` 验证 | 从 GitHub clone 后可用一条 Docker Compose 命令启动生产服务；容器启动时自动执行 5 个 Prisma 迁移，Next.js 首页返回 `200`，不改变 PostgreSQL/Prisma 的正式持久化方案 |
| 2026-09-22 | 阿里云公网部署 | `http://47.110.230.230:3000`、已支付公网 Session `a27349cb-7644-4844-94a8-574c58c03d81` | ECS Docker Compose 生产栈已启动；PostgreSQL 与 App 容器 healthy；服务器内部和公网首页均返回 `200`；会员结果接口返回 `MEMBER` 和完整预测数据 |

## 剩余推进项

当前阶段 5 已完成。后续若继续优化 UI 或新增用户选项，需重新执行本地 `npm test`、确认 GitHub Actions 通过，并重新部署线上环境。

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
| 2026-09-22 | 决策 | 将日期来源收敛为系统预计日期或重要日期，不再保留独立的自定义目标日期。 | `targetDate` 是系统预计日期，`requestedTargetDate` 是用户重要日期，`targetDateSource` 和 `forecastTargetDate` 明确最终曲线参考。 |
| 2026-09-22 | 决策 | BMI 预览提前到目标体重题之前，但不提前创建正式健康结果。 | 新增 BMI 预览接口；正式评估仍从完整持久化答案重新计算并写入 `HealthAssessmentResult`。 |
| 2026-09-22 | 决策 | 体重目标采用 `goal`、`effectiveGoal`、`goalResolution` 三层状态。 | 用户原始选择可追溯；服务端按中国 BMI 分界执行保持体重分流、低 BMI 减重阻止和目标体重区间校验；中间提示页可刷新恢复。 |
| 2026-09-22 | 决策 | 将结果页和模拟支付页拆分为 `/result?sessionId=...` 与 `/checkout?sessionId=...`。 | 本地验收时可先查看同一 Session 的免费脱敏结果，再用支付码触发 `/pay` 修改数据库订阅状态，回到结果页由后端接口返回会员完整数据。 |

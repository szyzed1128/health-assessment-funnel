# 健康测评系统

一个支持分步保存、断点恢复、服务端健康评估、订阅权限控制与模拟支付闭环的健康测评 Funnel。

本项目以腾讯文档《【睿迄科技】全栈开发 2 天挑战》为唯一需求依据。实施状态与尚未解决事项见 [PENDING_ISSUES.md](PENDING_ISSUES.md)。

## 交付状态

| PRD 交付物 | 当前状态 |
| --- | --- |
| 公网演示链接 | 尚未发布。需要配置实际部署平台与 PostgreSQL 环境后发布，发布前不得视为完成。 |
| GitHub 仓库链接与 CI 通过状态 | 本工作区尚未关联 GitHub 仓库；`.github/workflows/ci.yml` 已配置，推送后会运行。CI 在 PRD 中属于加分项，但本项目按用户验收要求必须完成。 |
| `/pay` 可重放调用 | 已提供，见“模拟支付回放”。 |
| 已支付测试 Session | 本地验收 Session：`5982b21d-ea29-4948-a600-447a9da15809`。使用 `npm run demo:paid-session` 可对目标环境生成随机、独立的已支付 Session；发布后应将实际输出的公网 ID 写入本节。 |
| 数据库 Schema 图 | 已提供，见“数据模型”。 |
| AI 使用复盘 | 已提供，见“AI 使用复盘”。 |

## 技术栈

- Next.js App Router、React、TypeScript
- PostgreSQL 16、Prisma 7
- Zod 服务端请求校验
- Vitest 单元/集成测试、Playwright 浏览器端到端测试
- GitHub Actions CI

## 环境变量

本地开发需要配置 `.env`，可直接参考 [.env.example](.env.example)。

| 变量 | 说明 | 本地默认值 |
| --- | --- | --- |
| `DATABASE_URL` | Prisma 与应用连接 PostgreSQL 的数据库地址。 | `postgresql://health_user:health_password@localhost:5432/health_assessment?schema=public` |

测试命令会通过 `scripts/prepare-test-database.mjs` 使用隔离的 `health_assessment_test` 数据库，不依赖手工修改 `.env`。部署到公网时必须把 `DATABASE_URL` 改为线上 PostgreSQL 连接串。

## 运行项目

前置条件：Node.js 24.19.0+、npm 11+、Docker Desktop。

```bash
docker compose up -d
npm ci
npm run db:deploy
npm run dev
```

打开 `http://localhost:3000`。浏览器会保存匿名 Session ID；刷新或重新打开页面会从后端恢复该会话的答案和进度。普通用户重新测评会生成新的随机 Session，不影响已有用户记录；若通过 API 更改已评估会话的答案，旧结果会在同一事务内作废，必须重新计算。

完成测评后会进入 `http://localhost:3000/result?sessionId=...`。该页面只读取后端结果接口：数据库订阅状态为非会员时显示免费脱敏结果，支付成功后同一个 `sessionId` 才会显示会员完整报告。免费结果页的解锁入口会进入 `http://localhost:3000/checkout?sessionId=...`，本地演示支付码为 `RQKJ-DEMO-2026`。

本项目不允许降级策略：不得用 SQLite、内存或仅前端存储替代 PostgreSQL/Prisma；不得把评估、订阅判断、字段过滤或支付成功判断移到前端；不得以 mock 数据或手工点击替代核心自动化测试。

## BMI 与目标分流

目标相关答案分为三类：`goal` 是用户原始选择，`effectiveGoal` 是服务端根据 BMI 后实际执行的目标，`goalResolution` 是本次是否直接采用、自动保持、重定向或阻止的原因。BMI 使用中国成人标准：低于 18.5 为偏低，18.5 至 24 为正常，24 至 28 为偏高，28 及以上为较高。

选择“保持体重”后，服务端会在保存当前体重的同一事务内生成分流状态：BMI 正常时自动把目标体重保存为当前体重，并跳过目标体重题；BMI 偏低时先展示中间提示页，确认后进入增重目标体重；BMI 偏高或较高时先展示中间提示页，确认后进入减重目标体重。中间提示页本身也是持久化进度的一部分，刷新后会回到该提示页。

直接选择“减重”但 BMI 偏低时，不允许继续减重，页面会提示改为增重或保持体重；即使绕过前端直接调用 API，服务端也会拒绝低 BMI 减重目标。直接选择“增重”会进入增重流程，服务端会校验目标体重必须高于当前体重；当存在健康建议区间时，目标还必须落在该区间内。

## API

所有响应统一为 `{ "data": ... }` 或 `{ "error": { "code", "message" } }`。

| 方法与路径 | 用途 |
| --- | --- |
| `POST /api/sessions` | 创建匿名测评 Session。 |
| `PUT /api/sessions/:sessionId/answers/:questionKey` | 增量保存或覆盖单题答案；若已评估会话变更答案，会作废旧结果并恢复为待评估。 |
| `GET /api/sessions/:sessionId/progress` | 恢复答案、当前步骤和会话状态。 |
| `GET /api/sessions/:sessionId/bmi-preview` | 在身高和当前体重已保存后，返回服务端 BMI 预览及目标体重建议；这不是最终评估结果。 |
| `POST /api/sessions/:sessionId/assessment` | 根据已持久化答案在服务端计算 BMI、建议摄入量、系统目标预测日期、重要日期来源和预测点，并持久化结果。 |
| `GET /api/sessions/:sessionId/result` | 按 `subscription_status` 返回免费脱敏结果或会员完整结果。 |
| `POST /api/pay` | 校验模拟支付码后，原子地记录支付事件并启用 30 天会员状态。 |

免费结果只包含 BMI、摘要、目标体重差与升级提示。会员结果才返回建议摄入量、重要日期、日期来源、实际预测参考日期、系统预计日期和每周预测点；前端也不会为免费用户渲染预测趋势。

## 模拟支付回放

先完成 Session 的所有答案并调用评估接口，再使用唯一的 `paymentEventId` 调用：

```bash
curl -X POST http://localhost:3000/api/pay \
  -H "content-type: application/json" \
  -d '{"sessionId":"替换为已评估的 sessionId","paymentEventId":"替换为新的 UUID","paymentCode":"RQKJ-DEMO-2026"}'
```

支付码错误时不会创建支付事件，也不会激活会员。重复使用同一个 `paymentEventId` 且 Session 相同是幂等的；复用于其他 Session 会返回 `409 CONFLICT`。

生成一个独立的已支付验收 Session：

```bash
npm run demo:paid-session
BASE_URL=https://你的公网域名 npm run demo:paid-session
```

命令会输出可直接查询会员结果的随机 `sessionId`。公网发布后，将该次输出粘贴到本 README 的“交付状态”表中，供验收直接访问。

## 测试与质量保障

一键运行全部自动化测试：

```bash
npm test
```

该命令会先准备隔离的 `health_assessment_test` 数据库，再依次运行：

- Vitest：算法边界、非法输入、BMI 目标分流、分步保存与恢复、乱序/重复/并发写入、评估持久化、订阅脱敏、支付码校验、支付幂等与冲突。目前 10 个文件、75 项测试通过。
- Playwright：浏览器端完成测评、刷新恢复、独立免费结果页、模拟支付页、支付解锁会员结果、预测趋势展示、保持体重自动跳过、日期校验与重新开始。目前 4 项测试通过。

尚未覆盖真实第三方支付网关或真实生产网络故障，因为 PRD 明确要求的是模拟 `/pay` 回调；支付事件的幂等、冲突和事务路径已覆盖。

CI 定义在 `.github/workflows/ci.yml`，在 GitHub 的 push 与 pull request 上执行依赖安装、Chromium 安装、类型检查、Lint 和同一条 `npm test`。CI 在 PRD 中属于加分项，但本项目按用户验收要求必须完成；在仓库推送前不存在真实通过状态。

## 数据模型

```mermaid
erDiagram
  AssessmentSession ||--o{ AssessmentAnswer : stores
  AssessmentSession ||--o| HealthAssessmentResult : produces
  AssessmentSession ||--o| Subscription : owns
  AssessmentSession ||--o{ PaymentEvent : records

  AssessmentSession {
    uuid id PK
    enum status
    int currentStep
    datetime createdAt
  }
  AssessmentAnswer {
    uuid id PK
    uuid sessionId FK
    string questionKey
    enum answerType
    json value
  }
  HealthAssessmentResult {
    uuid id PK
    uuid sessionId FK
    decimal bmi
    int recommendedDailyCalories
    datetime targetDate
    datetime requestedTargetDate
    enum targetDateSource
    datetime forecastTargetDate
    json weeklyForecast
    string algorithmVersion
  }
  Subscription {
    uuid id PK
    uuid sessionId FK
    enum status
    datetime startsAt
    datetime endsAt
  }
  PaymentEvent {
    uuid id PK
    uuid sessionId FK
    string paymentEventId
    enum status
  }
```

`AssessmentAnswer` 采用 `questionKey + answerType + JSON value`，使题目和答案类型可扩展。当前流程会保存用户原始 `goal`，并由服务端派生 `effectiveGoal`、`goalResolution` 与必要时的 `goalResolutionConfirmed`；这些派生答案用于恢复中间提示页、防止前端绕过目标分流。重要日期拆为 `bigDayType`、`bigDayDate` 和 `targetDateSource`：用户可以选择系统预计日期，或使用重要日期作为预测参考。`HealthAssessmentResult.targetDate` 保留服务端系统预计日期，`requestedTargetDate` 保存用户填写的重要日期，`targetDateSource` 保存最终参考来源，`forecastTargetDate` 保存实际用于建议摄入量和曲线的日期；每个 Session 只关联一条最新评估结果和一条订阅记录，支付事件则保留可追溯的幂等键。

## AI 使用复盘

AI 用于协助拆分模块边界、生成 Prisma Schema 草案、梳理评估算法的边界用例、构造并发/支付幂等测试场景，以及检查 API 脱敏字段是否存在反向泄漏。所有生成内容均经过类型检查、数据库集成测试和浏览器端到端测试验证。

一次被否决的建议是：以“用户在页面上没有返回编辑入口”为由，不处理评估后继续调用答案 API 的情况。该方案会让持久化答案和健康结果发生不一致，不符合 PRD 对状态一致性和完整闭环的关注。因此实现改为：在同一数据库事务内更新答案、作废旧结果并恢复为待评估状态；普通用户重新测评仍使用新的随机 Session。

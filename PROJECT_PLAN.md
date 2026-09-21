# 健康测评系统：实施计划

## 执行原则

- 需求与验收依据：[PROJECT_REQUIREMENTS.md](PROJECT_REQUIREMENTS.md)。
- 必须以需求文档中的“PRD 评分矩阵与验收证据”逐项驱动实现与最终自检。
- 以两天紧凑交付为约束；先完成可测试的后端闭环，再完善 Funnel 与视觉。
- 每完成一个阶段，先运行相应测试，再进入下一阶段。
- 任何新增功能不得削弱免费/会员数据隔离、支付幂等性或测试可运行性。
- 每个阶段必须同时通过本计划的完成定义、PRD 对应阶段的逐条技术要求、评分矩阵中的相关维度；任一项未满足，不得进入下一阶段。

## 阶段推进门禁

每个阶段结束时，必须执行以下审查，并在 [PROJECT_PROGRESS.md](PROJECT_PROGRESS.md) 记录结论：

1. 对照 PRD 原文，逐条标记对应阶段的功能点和技术要求为“满足”“部分满足”或“不满足”。
2. 对照本计划的完成定义、接口级验收和测试边界，确认已有可运行证据。
3. 对照评分矩阵，确认 API、数据校验、数据库、状态/异常、权限或支付等相关维度没有遗漏。
4. 检查新增实现是否违反模块依赖、可扩展答案模型或“不允许降级策略”。
5. 只有全部为“满足”且项目负责人 review 通过，才可将阶段从“待评审”改为“已完成”并开始下一阶段。

当前代码已通过阶段 1、阶段 2、阶段 3 和阶段 4 的本地实现审查；历史阶段缺口已在后续更新中关闭。当前剩余推进重点是阶段 5 的外部交付证据：GitHub 仓库、真实 GitHub Actions 通过状态、公网部署、公网已支付测试 Session，以及 README 中对应链接更新。

## 模块化单体架构

本项目采用模块化单体，而不是微服务：所有模块部署在同一个 Next.js 应用中，共享一个 PostgreSQL 数据库，但通过代码边界保持低耦合。这样保留轻量项目的部署和调试效率，同时满足 PRD 对 API、数据库、权限、支付和测试质量的要求。

### 目录规划

```text
src/
  app/
    api/                         # Next.js Route Handlers：HTTP 适配层
    ...                          # Funnel 页面与结果页
  modules/
    session/                     # 匿名会话、进度状态、sessionId
    assessment/                  # 题目定义、答案、增量保存、恢复
    health/                      # BMI、摄入建议、目标日期等纯评估逻辑
    subscription/                # 订阅状态、会员权限策略、字段可见性
    payment/                     # 模拟支付事件、幂等处理、订阅激活
  infrastructure/
    db/                          # Prisma Client 与 repository 实现
    validation/                  # 环境变量和跨模块通用校验
    http/                        # 统一错误/响应工具
  shared/
    types/                       # 小范围跨模块公共类型
    errors/                      # 领域错误类型
```

### 模块职责

| 模块 | 负责 | 不负责 |
| --- | --- | --- |
| `session` | 创建/读取匿名会话、当前步骤和状态 | 计算健康结果、判断支付权限 |
| `assessment` | 题目键、答案类型、答案校验、答案 upsert、进度恢复 | BMI 算法、支付状态变更 |
| `health` | 纯函数评估算法、必填输入判断、结果版本化 | HTTP、直接读取客户端输入、订阅判断 |
| `subscription` | 订阅状态、会员资格、免费/会员字段策略 | 接收支付请求、计算 BMI |
| `payment` | 支付事件校验、幂等键、支付状态和订阅激活 | 直接拼装结果响应、绕过订阅模块 |
| `infrastructure/db` | Prisma Client、事务、repository | 业务决策和权限规则 |
| `app/api` | 参数解析、认证/会话上下文、调用应用服务、HTTP 响应 | 直接编写核心算法和数据库 SQL |

### 依赖方向

```text
页面 / Route Handlers
          ↓
模块应用服务（session / assessment / health / subscription / payment）
          ↓
领域函数与策略（纯函数、类型、规则）
          ↓
repository 接口
          ↓
Prisma / PostgreSQL
```

约束：

- `health` 算法必须是纯函数，可脱离数据库和 HTTP 单独测试。
- `subscription` 是唯一的权限策略来源；结果 API 不得自行判断会员状态。
- `payment` 只能通过订阅模块激活权益，不能直接修改评估结果或向客户端发放字段。
- `assessment` 通过题目键和答案类型支持扩展题目，不把每道题硬编码为一列。
- Route Handler 不得直接访问 Prisma；必须调用模块服务或 repository。
- 模块之间通过显式输入/输出类型通信，不读取彼此内部文件或内部数据库细节。
- 只有确实跨模块复用的类型才放入 `shared`，避免建立万能工具层。

### 测试边界

- `health`：纯单元测试，覆盖正常值和所有算法边界。
- `assessment/session`：服务层和 repository 集成测试，覆盖保存、覆盖、恢复、乱序、并发。
- `subscription/payment`：权限、支付幂等和状态迁移集成测试。
- `app/api`：请求校验、HTTP 状态码、响应字段和错误结构测试。
- `tests/e2e`：只覆盖一条关键用户链路：测评、刷新恢复、免费结果、模拟支付、会员完整结果。

若后续某模块需要拆成独立服务，必须先记录新的部署、通信、鉴权和数据一致性方案；本次两天交付不主动拆分微服务。

## 依赖关系

```text
项目骨架与工具链
        ↓
数据库 Schema 与迁移
        ↓
会话 / 分步答案 / 恢复 API
        ↓
服务端评估算法 ───────────┐
        ↓                 │
订阅鉴权与模拟支付 ←───────┘
        ↓
端到端 Funnel 与结果页
        ↓
自动化测试、CI、部署与交付文档
```

## PRD 阶段性目标

下列目标直接对应 PRD 第二部分“任务目标”和第三部分“核心流程”。阶段状态只能根据完成定义变更，不能依据页面数量或视觉完成度判断。

| 目标编号 | 阶段性目标 | 对应实施阶段 | 完成依据 |
| --- | --- | --- | --- |
| G1 | 测评数据持久化与状态恢复 | 阶段 1 | 增量保存、恢复、重复/乱序/并发测试通过 |
| G2 | 规范 API 与可扩展数据库模型 | 阶段 0-1 | API 契约、Prisma migration、Schema 图与校验测试齐备 |
| G3 | 服务端健康评估与结果持久化 | 阶段 2 | BMI、摄入建议、预测日期均由服务端计算、持久化并通过边界测试 |
| G4 | 订阅鉴权与模拟支付闭环 | 阶段 3 | 免费脱敏、会员完整、支付幂等与权限升级测试通过 |
| G5 | 自动化测试与持续验证 | 阶段 0、5 | `npm test` 与 GitHub Actions 均可稳定通过，README 有覆盖说明 |

## 阶段 0：项目基线与工程骨架

目标：建立可本地运行、可测试、可部署的 TypeScript 全栈项目。

- [x] 初始化 Next.js App Router + TypeScript 项目。
- [x] 配置代码格式化、静态检查与基础环境变量模板。
- [x] 配置 PostgreSQL 与 Prisma。
- [x] 配置测试框架，并保证空测试集/首个 smoke test 可由 `npm test` 运行。
- [x] 建立 `README.md` 初稿，记录本地启动前置条件。

完成定义：新成员按 README 能启动应用，能连接本地数据库，并能运行 `npm test`。

评分门槛：测试命令、环境变量和 API 文档的雏形必须可复现，避免在项目收尾阶段补齐工程证据。

## 阶段 1：数据模型与会话持久化

目标：让匿名用户的每一步测评数据稳定落库且可恢复。

- [x] 定义 Prisma Schema：`AssessmentSession`、`AssessmentAnswer`、`HealthAssessmentResult`、`Subscription`、`PaymentEvent`。
- [x] 将题目键、答案类型和值的校验建模为可扩展答案结构；不得按每题一个数据库列建模。
- [x] 为会话 ID、答案唯一性、支付事件幂等键和订阅状态建立必要约束及索引。
- [x] 创建并执行首个数据库迁移。
- [x] 实现会话创建/获取接口。
- [x] 实现单步骤答案 upsert 接口。
- [x] 实现进度恢复接口，返回已填答案、当前步骤与会话状态。
- [x] 为输入校验、重复提交、乱序提交、恢复流程编写集成测试。

接口级验收：

- [x] `POST /api/sessions` 创建匿名会话并返回不可预测的 `sessionId`。
- [x] `PUT /api/sessions/:sessionId/answers/:questionKey` 接受单题增量答案；重复请求覆盖同题当前值。
- [x] `GET /api/sessions/:sessionId/progress` 返回会话状态、已填答案和下一待填写步骤。
- [x] 所有接口均在服务端验证 `sessionId`、题目键、答案类型、范围与逻辑约束；不接受客户端传入的进度或结果作为可信状态。

完成定义：同一 `sessionId` 刷新后能恢复进度；重复保存不产生重复记录；非法输入被服务端拒绝；新增非核心题目无需更改核心表结构；PRD 阶段目标 G1、G2 的对应证据齐备。

评分门槛：实现需同时满足“API 设计”“数据校验”“数据库设计”“状态与异常”四项评分维度，并为每项留下测试或文档证据。Schema 设计需证明答案可扩展、核心计算输入稳定、重复提交可控。

## 阶段 2：服务端健康评估

目标：基于完整且合法的数据，在服务端计算并持久化健康结果。

- [x] 明确并记录 BMI、建议每日摄入量、目标预测日期的演示算法与假设。
- [x] 实现纯函数评估算法，避免依赖 HTTP、数据库或前端状态。
- [x] 实现触发评估及读取评估结果的服务层/API。
- [x] 仅在必填答案完整、数据合法时允许计算。
- [x] 持久化结果，并保存算法版本或计算时间以便追溯。
- [x] 编写单元测试：正常值、身高/体重/年龄越界、目标体重不合理、缺失答案。

接口级验收：

- [x] `POST /api/sessions/:sessionId/assessment` 仅在必填题目完整且合法时触发/重算评估。
- [x] 评估服务从数据库读取已持久化答案，而非接受客户端上传的 BMI、摄入量或预测日期。
- [x] 计算并保存 BMI、建议每日摄入量、目标预测日期及会员专属预测数据；保存算法版本。
- [x] 对缺失、非法或目标不合理的数据返回一致的业务错误，且不创建不完整结果。

完成定义：前端不能伪造评估结果；算法边界有自动化测试；结果可从数据库重新读取；PRD 阶段目标 G3 达成。

评分门槛：服务端为唯一可信计算源；算法假设、输入范围和异常行为必须可在 README 与测试中审阅。

## 阶段 3：订阅权限与模拟支付闭环

目标：免费摘要与会员完整结果在服务端严格隔离，支付操作可靠地切换权益。

- [x] 定义免费可见字段与会员专属字段清单。
- [x] 实现结果读取的订阅状态校验与字段过滤。
- [x] 实现模拟 `pay` 接口，校验请求并写入支付事件、更新订阅状态。
- [x] 保证相同支付事件重复调用时幂等。
- [x] 编写集成测试：非会员无受保护字段、会员完整返回、支付前后权限切换、重复回调。

接口级验收：

- [x] `GET /api/sessions/:sessionId/result` 总是从服务端读取订阅状态并应用字段可见性策略。
- [x] 非会员响应只含 BMI、摘要、目标差值等允许字段；完整摄入建议、预测日期、预测曲线和行动计划字段完全不出现在响应 JSON 中。
- [x] 有效会员响应包含完整评估报告与预测数据。
- [x] `POST /api/pay` 接收 `sessionId` 与唯一 `paymentEventId`；在事务中记录支付事件、激活订阅并返回结果。
- [x] 相同 `paymentEventId` 再次提交返回幂等成功结果，不重复创建支付事件或订阅权益。

完成定义：直接调用 API 的非会员也拿不到受保护字段；支付成功后同一会话立即获得完整结果；PRD 阶段目标 G4 达成。

评分门槛：同时通过“权限校验”“支付闭环”“状态与异常”评分项；必须有支付前后 API 响应对照和重复回调测试。

## 阶段 4：用户 Funnel 与结果展示

目标：实现一条可完成、可恢复、可模拟付费的移动端优先流程。

- [x] 实现匿名会话初始化与本地 `sessionId` 保存。
- [x] 实现分步问题页面、进度反馈、加载/错误状态。
- [x] 每步选择后调用增量保存；重新进入时调用恢复接口。
- [x] 实现提交并触发服务端评估的流程。
- [x] 实现免费结果页、受保护内容提示与模拟付费入口。
- [x] 实现支付成功后的完整结果展示。
- [ ] 至少插入一个依据用户选择变化的激励/反馈页，借鉴竞品节奏。（非 PRD 核心硬门槛，当前暂不扩大范围）

完成定义：桌面和移动端均可从首次进入走到会员完整结果，且中途刷新不会丢失已填数据。

## 阶段 5：质量、CI、部署与交付

目标：使项目可复现、可验证、可在线审阅。

- [x] 补齐单元测试、API 集成测试和关键流程端到端测试。
- [x] 确保 `npm test` 一键通过。
- [x] 添加 GitHub Actions，在 push 和 pull request 时执行安装、数据库准备和测试。
- [ ] 在 README 加入 CI 徽章或 workflow 链接。（待 GitHub 仓库创建后补真实链接）
- [ ] 部署 PostgreSQL 与应用，验证公网 URL。
- [x] 在 README 给出迁移、启动、测试、部署变量和模拟 `pay` 的 cURL 示例。
- [ ] 创建一个已支付测试 `sessionId` 并记录在 README。（已有本地 ID；公网发布后需重新生成）
- [x] 添加数据库 Schema 图。
- [x] 完成 AI 使用复盘，包括至少一次被否决/修正的建议及理由。

完成定义：线上环境完整走通；CI 通过；审阅者可依据 README 复现核心流程与验证权限差异；PRD 阶段目标 G5 达成。

评分门槛：逐项核对需求文档的评分矩阵，确认每个评分维度对应的证据均已提交、可访问、可运行。

## 两天节奏

| 时间段 | 必须完成 | 可延后 |
| --- | --- | --- |
| 第 1 天上午 | 阶段 0、阶段 1 的 Schema 与会话/答案 API | 视觉细节 |
| 第 1 天下午 | 阶段 1 测试、阶段 2 算法与测试 | 扩展题库 |
| 第 2 天上午 | 阶段 3 权限、支付闭环与测试 | 多个激励页 |
| 第 2 天下午 | 阶段 4 可演示 Funnel、阶段 5 CI/部署/README | 非必要动画 |

## 变更规则

若发现需求需要调整，先在 [PROJECT_PROGRESS.md](PROJECT_PROGRESS.md) 记录原因、影响范围和替代方案，再更新本计划与需求文档。不得在未记录的情况下扩大范围。
## Stage 1 Gate Update (2026-09-21)

The four prior Stage 1 gaps have been resolved: browser-side anonymous-session
recovery, a multi-select answer model, repository boundaries, and cross-field
weight validation. Typecheck, lint, unit/integration tests, and a production
build all pass. The user-review gate remains mandatory: Stage 2 must not start
until the project owner approves Stage 1.
## Stage 1 and 2 Gate Update (2026-09-21)

Stage 1 review passed after the malformed-JSON API validation edge was corrected.
Stage 2 now has a pure `health` domain algorithm, a repository interface and
Prisma implementation, atomic result persistence, and an assessment trigger API.
The output is versioned and the calculation uses only answers stored by Stage 1.

Stage 2 remains pending project-owner review. Do not begin subscription/payment
work until that review is approved.
## Stage 2 Review Passed (2026-09-21)

Stage 2 passed review after its calorie-floor edge case was corrected. Its
server-only algorithm, durable result/session association, result traceability,
and tests meet the Stage 2 gate. The next work is Stage 3; it must establish
the subscription and payment authorization boundary before a result-display UI
can be treated as complete.
## Stage 3 PRD Design Gate (2026-09-21)

The Stage 3 PRD requirements and implementation boundaries are recorded in
`STAGE3_DESIGN.md`. The implementation may begin only under those rules:
server-side allow-list filtering, subscription as the only authorization source,
atomic payment-event/subscription updates, unique event-id idempotency, and
direct API tests proving protected fields are absent for free users.
## Stage 3 Implementation Update (2026-09-21)

Stage 3 implementation is ready for review. The server now exposes
`GET /api/sessions/:sessionId/result` and `POST /api/pay` under the constraints
in `STAGE3_DESIGN.md`. Tests prove the free response omits protected keys rather
than hiding them in the UI, and that payment activation and payment-event retry
are transactionally safe.
## Stage 3 Review Passed (2026-09-21)

Stage 3 passed review after adding the required free-tier upgrade prompt and
post-payment result-route assertion. The next work remains Stage 4: integrate
the assessed, free-result, payment, and member-result APIs into the actual
mobile-first Funnel UI.

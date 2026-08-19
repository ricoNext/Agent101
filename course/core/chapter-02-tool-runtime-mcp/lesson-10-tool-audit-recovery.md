# 第 10 课：建立审计、Trace 与风险回放

> 章节导航：[第二章：Function Calling、Tool Runtime 与 MCP](./index.md)  
> 上一课：[第 9 课：实现 Human-in-the-loop 审批状态机](./lesson-09-hitl-approval.md)<br>
> 下一课：[第 11 课：理解 MCP 协议与 Transport](./lesson-11-mcp-protocol-transport.md)

## 一、你将完成什么

本课围绕“事后能否解释和恢复”完善审批链：

1. 设计记录事实而非复制敏感数据的工具审计事件。
2. 处理审批与重试、幂等、远程 MCP 和异步任务的协作边界。
3. 用状态与实际副作用验证拒绝、过期、重复消费和未知结果。
4. 建立从审计记录回到调用、策略版本和处置结果的查询路径。

完成本课后，你应能说明本课能力在 Tool Runtime 中的位置，并用测试或可查询证据证明它确实生效。

## 二、审计链：记录可核查事实，而不是复制所有数据

普通应用日志用于排障，可能被采样、截断、覆盖或由多个服务随意写入。审计事件回答的是安全和合规问题，因此需要独立的结构、访问控制、保留策略和完整性保障。

### 11.1 最小审计事件

```python
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Mapping


@dataclass(frozen=True)
class AuditEvent:
    event_id: str
    occurred_at: datetime
    event_type: str
    tenant_id: str
    request_id: str
    call_id: str | None
    approval_id: str | None
    actor_id: str | None
    actor_type: str | None
    tool_name: str | None
    tool_version: str | None
    input_digest: str | None
    outcome: str
    policy_id: str | None
    policy_version: str | None
    reason_code: str | None
    metadata: Mapping[str, str]
    previous_hash: str | None = None
    event_hash: str | None = None
```

建议至少记录以下事件：

| 事件 | 何时写入 | 核心事实 |
| --- | --- | --- |
| `tool.authorization_denied` | 授权拒绝 | 规则、资源种类、稳定原因码 |
| `approval.requested` | 创建待审批 | 请求人、工具、风险、到期时间、参数摘要 |
| `approval.approved` | 合格审批人批准 | 审批人、强认证等级、策略版本 |
| `approval.rejected` / `cancelled` / `expired` | 终止 | 谁触发、终止原因、时间 |
| `approval.consumed` | 原子消费成功 | 消费调用与绑定摘要 |
| `tool.started` / `tool.finished` | 副作用尝试与结果 | 尝试序号、幂等键摘要、结果分类 |

审计写入最好采用 outbox 模式：在审批状态变更或业务命令的同一数据库事务中写出不可变 outbox 记录，由可靠投递器送往审计存储。直接在事务提交后异步打印日志，进程崩溃时会留下“状态已改变但没有审计”的缺口。

### 11.2 脱敏与最小化

审计需要可关联，不需要拥有所有原始数据。推荐做法：

- 记录 `input_digest`、字段名称、条目数量与受控资源摘要，而不是完整输入 JSON；
- 对邮箱、手机号、订单号等采用按租户加盐的不可逆标识或局部掩码；
- 不记录认证 Header、Cookie、访问令牌、密钥、完整文件、支付卡信息；
- 将审批备注设为长度限制和敏感词检测对象，必要时加密并限制少数审计员访问；
- 为 `metadata` 定义键白名单，拒绝 Handler 任意追加下游响应或异常堆栈。

脱敏不是把敏感字段叫作 `masked` 就结束。应针对每种工具维护审计字段白名单，并在测试中断言密钥和高敏感字段不可能出现在序列化事件中。

### 11.3 防篡改并不等于“写进数据库”

审计表只要允许普通业务服务执行 `UPDATE` 或 `DELETE`，就无法称为不可篡改。可分层采取：

1. 审计存储只允许追加，应用角色没有更新和删除权限；
2. 写入后转存到权限隔离、版本保留的对象存储或专用日志服务；
3. 将每个事件哈希连接到前一事件或批次根哈希，并把根锚定到独立系统；
4. 定期验证哈希链、事件序号和导出快照，发现缺口立即告警；
5. 把审计读取本身也写入审计事件，并按职责分离限制访问者。

哈希链能发现已保存记录被改写，但不能阻止有高权限的攻击者同时删掉一段尾部事件。因此它必须配合异地存储、最小权限和独立告警，而不能作为唯一保证。

```python
def hash_event(event: AuditEvent, previous_hash: str | None) -> str:
    payload = asdict(event) | {"previous_hash": previous_hash, "event_hash": None}
    return hashlib.sha256(canonical_json(payload)).hexdigest()
```

哈希输入必须包含稳定、规范化的字段，不能包含数据库自动序列化产生的不确定顺序。为高吞吐系统使用按租户或按时间窗口的 Merkle 批次也可以，但必须保留可验证的批次边界与锚定记录。

### 11.4 保留期限、删除请求与访问权

“永久保存”既增加隐私风险，也未必符合法规。为每类事件定义数据分类、保留期限、法务留置规则和到期删除方式。需要删除个人数据时，优先删除或轮换可关联的加密映射与密钥，保留不可逆的安全事件摘要；具体方案应由隐私、法务和安全团队共同确定。

审计访问只能提供最小视图。客服排障看到事件时间、状态和资源摘要即可，安全审计员才可能查看受控理由，任何导出都应再次授权并审计。

## 三、与第 5–6 课可靠性机制协作

审批等待可能持续分钟，而单次工具调用的网络预算通常只有秒级。不要让 Runtime 在 HTTP 请求中阻塞等待人工点击；第一次调用应返回 `confirmation_required` 与审批引用，由任务或客户端在批准后重新提交。

### 12.1 重试规则

| 时点 | 是否可自动重试 | 原因 |
| --- | --- | --- |
| 创建审批请求网络超时 | 可用创建去重键重试 | 可能已创建，需先查询既有记录 |
| `pending` 等待用户 | 否 | 等待不是瞬时故障 |
| 原子消费返回竞争失败 | 否 | 必须查询状态和幂等结果 |
| 消费后执行前本地崩溃 | 不直接重试副作用 | 先查询幂等状态 |
| 已验证的下游瞬时失败 | 仅按工具重试策略 | 每次尝试仍进入 Runtime 授权边界 |

审批一经消费，可靠性执行器不能在每个重试尝试中再次消费同一个记录。应把“获得一次执行权”和“同一幂等意图的受控重试”关联起来：首次尝试消费批准，后续重试使用同一受控执行租约与幂等键，同时每次仍重新检查授权、截止时间与取消。若运行进程重启，恢复器先查询幂等状态，而不是凭空续用批准。

### 12.2 取消

用户在 `pending` 或未消费的 `approved` 阶段取消，可安全转换为 `cancelled`。如果已消费且 Handler 已开始，取消只能尽力传播给下游；对于不能保证回滚的副作用，应返回“执行状态待确认”，通过幂等查询或领域状态查询收敛，而不是声称“已经取消”。

## 四、MCP 与异步任务的审批边界

远程 MCP Server 可能也提供确认弹窗或自己的权限模型，但它不能替代平台审批：平台需要知道是哪个本地用户、为哪次 ToolCall、在什么租户下批准了什么参数。

- 本地 Runtime 先完成授权与审批，再向 MCP Server 发起调用；
- 只下发范围最小、短期的下游凭证，不转发用户原始会话或全局密钥；
- 将远程请求 ID、Server 身份和传输层版本写入审计摘要；
- 远程调用超时后的结果仍归入第 5–6 课的“未知结果”，通过幂等或查询接口确认；
- 若 MCP Server 报告“需要确认”，将其视为额外限制而不是本地审批成功的替代证明。

对于后台任务，批准应绑定稳定的任务步骤 ID 与经过冻结的输入版本。任务恢复时必须重新检查审批、授权、任务归属和资源版本，不能因为 Checkpoint 里保存了 `approved=true` 就继续执行。

## 五、测试：用状态和副作用证明边界

审批代码的测试不能只覆盖“点击批准后返回 200”。要断言每种状态迁移、每条拒绝路径和 Handler 调用次数。

### 14.1 状态机测试

```python
import pytest


@pytest.mark.parametrize(
    ("initial", "command", "expected"),
    [
        (ApprovalStatus.PENDING, "approve", ApprovalStatus.APPROVED),
        (ApprovalStatus.PENDING, "reject", ApprovalStatus.REJECTED),
        (ApprovalStatus.PENDING, "cancel", ApprovalStatus.CANCELLED),
        (ApprovalStatus.APPROVED, "consume", ApprovalStatus.CONSUMED),
    ],
)
def test_valid_transitions(initial: ApprovalStatus, command: str, expected: ApprovalStatus) -> None:
    approval = approval_factory(status=initial)
    assert transition(approval, command, now=NOW).status is expected


@pytest.mark.parametrize(
    ("initial", "command"),
    [
        (ApprovalStatus.REJECTED, "approve"),
        (ApprovalStatus.CONSUMED, "consume"),
        (ApprovalStatus.EXPIRED, "approve"),
        (ApprovalStatus.CANCELLED, "consume"),
    ],
)
def test_terminal_or_invalid_transitions_are_rejected(initial: ApprovalStatus, command: str) -> None:
    with pytest.raises(InvalidApprovalTransition):
        transition(approval_factory(status=initial), command, now=NOW)
```

还要覆盖边界时间：`expires_at == now` 必须过期；不同租户审批人、禁止自我审批、强认证不足、工具版本不同和参数摘要不同都必须拒绝。

### 14.2 并发消费测试

使用真实数据库事务或与生产等价的条件更新语义，同时发起两个消费同一 `approval_id` 的请求：

```python
async def test_only_one_concurrent_consumer_can_execute() -> None:
    approval = await create_approved_request()
    results = await asyncio.gather(
        runtime.invoke(call_for(approval), context_for(approval)),
        runtime.invoke(call_for(approval), context_for(approval)),
        return_exceptions=True,
    )

    assert handler.call_count == 1
    assert sum(result.is_success for result in results if hasattr(result, "is_success")) == 1
```

内存锁不能替代此测试，因为多进程、多副本和崩溃恢复下它不存在。生产使用 PostgreSQL 等数据库时，应在同类数据库中跑并发集成测试。

### 14.3 Runtime 与审计合同测试

至少覆盖下面的验收场景：

1. 未授权调用不会创建审批记录，也不会调用 Handler；
2. 高风险、已授权调用首次返回 `confirmation_required`，重复提交只得到同一待审批请求；
3. 批准后的参数、主体、租户、调用 ID 或工具版本任一变化都会拒绝且不执行；
4. 审批等待期间撤销权限或改变资源状态，二次授权拒绝且 Handler 调用次数为零；
5. 两个并发执行请求只有一个消费成功，另一个不产生副作用；
6. `rejected`、`expired`、`cancelled` 均不可被重放；
7. 消费后超时返回未知结果，查询幂等记录而非重新批准并执行；
8. 每个状态迁移与执行结果都有完整关联 ID 的审计事件；
9. 审计事件序列化后不含令牌、完整地址、密码、原始敏感参数或下游响应；
10. 修改或删除测试审计事件后，完整性校验能够发现哈希链或批次锚点不一致。

为审计事件维护版本化样本。数据字段、原因码、策略版本或事件类型变更时，更新合同并评估下游 SIEM、告警与合规报表的兼容性。

## 六、常见错误与修正

### 15.1 用 `confirmed: true` 作为工具参数

这只是模型可以伪造的字符串或布尔值。改为由审批服务签发、Runtime 回查的持久化审批记录，并绑定本次调用事实。

### 15.2 批准后不再检查权限

审批可能持续几分钟，期间用户或资源状态都可能变化。执行前重新授权；确认从不扩大权限。

### 15.3 只绑定工具名，不绑定参数和版本

批准“退款 100 元”后可能被复用于“退款 10,000 元”，旧工具行为也可能与新版本不同。绑定规范化参数摘要、资源、调用 ID 与精确版本。

### 15.4 先读状态再更新为已消费

并发请求会同时看到 `approved`，导致重复副作用。使用带状态、期限和绑定事实的原子条件更新。

### 15.5 执行失败后恢复为 `approved`

超时和连接断开可能是未知结果。恢复批准会让同一操作再次执行；应该查询幂等记录或领域状态。

### 15.6 审批记录永久有效

旧批准会在权限、价格、资源状态改变后被意外重放。使用短过期时间，并在每次批准、读取和消费时由服务端检查。

### 15.7 以普通日志替代审计

普通日志会采样、泄露数据或被覆盖。审计事件必须结构化、最小化、受访问控制，并有追加与完整性保障。

### 15.8 将完整 ToolCall 和下游响应写进审计

这会把敏感数据复制到更广泛可读的系统。仅记录摘要、计数、允许字段和受控原因码；原文若确有必要，应单独加密和限权保存。

## 七、练习

### 练习 1：实现订单取消确认

为 `cancel_order` 增加审批策略。要求：

1. 仅订单所有者可创建审批请求；
2. 审批摘要显示订单公开编号和取消影响，不显示完整地址；
3. 审批绑定订单 ID、`cancel_reason`、调用 ID、工具版本与五分钟期限；
4. 订单在批准后变为已发货时，二次授权拒绝；
5. 两个并发“确认取消”请求只触发一次取消命令。

### 练习 2：设计大额退款双人审批

为超过 1,000 元的退款设计流程：发起者不可自批，财务角色可批准，并要求近期强认证。思考如何扩展状态模型记录多位批准者、阈值和职责分离，同时保持每个批准决定不可变、可审计。

### 练习 3：审计字段白名单

为 `export_orders` 定义 `AuditEvent` 的字段投影函数。测试导出量、字段集合、租户和审批 ID 均被记录，但客户地址、手机号、支付令牌和完整查询条件永远不会出现在 JSON 序列化结果中。

## 八、完成标准

- 审计事件可关联调用、审批提案、操作者、策略版本、决定和最终结果。
- 敏感参数只保存经过脱敏的摘要或引用，不复制完整载荷。
- 恢复流程先查询幂等记录和下游事实，再决定继续、补偿或人工介入。
- 审批、可靠性和 MCP 场景的状态转换均有自动化测试。

## 九、本课小结

审批与审计至此形成完整闭环：执行前有明确决定，执行中有一次性约束，执行后有可核查事实和恢复路径。下一课开始把本地 Runtime 扩展到 MCP 远程能力。

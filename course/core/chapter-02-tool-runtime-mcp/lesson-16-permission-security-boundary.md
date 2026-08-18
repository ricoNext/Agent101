# 第 16 课：建立权限模型与工具安全边界

> 所属章节：[第二章：Function Calling、Tool Runtime 与 MCP](./index.md)<br>
> 上一课：[第 15 课：处理工具调用的可靠性问题](./lesson-15-tool-call-reliability.md)<br>
> 下一课：[第 17 课：实现 Human-in-the-loop 审批与审计](./lesson-17-approval-audit.md)

## 一、你将完成什么

第 14 课的 Runtime 已检查 `ToolSpec.security.required_permissions`，第 13 课的 Registry 也会把不具备声明权限的工具从模型候选列表中隐藏。这两层都很重要，但它们只能回答一个粗粒度问题：当前主体是否可能使用 `orders:read` 这类能力。

它们不能回答更关键的问题：

1. 这个用户能否读取**这张**订单，而不是租户内任意订单？
2. 同一个 `files:write` 是否只能写入自己的工作区和允许的文件类型？
3. 客服可以看到订单状态时，是否应同时看到地址、手机号和支付信息？
4. 管理员的跨租户排障权限，是否有明确的时间、工单和只读范围？
5. 经过一次重试、降级或 MCP 转发后，授权边界是否仍然存在？

这一课为 `agent-platform` 建立资源级授权层。完成后，你会得到：

1. 一套由可信身份、动作、资源和环境组成的授权请求；
2. 工具级、资源级、字段级三层边界，以及 RBAC 与 ABAC 的分工；
3. 放在 Runtime 中、任何入口都无法跳过的 Policy Enforcement Point（PEP）；
4. 对租户、工作区路径、额度和数据字段的作用域约束；
5. 不泄露资源是否存在的拒绝语义与受控审计字段；
6. 可重复运行的策略合同测试和拒绝场景测试。

本课只判断“此时此人能否对这个目标执行这个动作”。用户确认、审批记录、不可否认审计和审批后的二次校验在第 17 课实现。认证、会话签发和密码校验属于入口身份系统，也不在本课展开。

## 二、先分清认证、授权、确认与审计

这些概念经常被混写为“权限”，混在一起后会产生危险的捷径。

| 概念 | 回答的问题 | 可信来源 | 例子 |
| --- | --- | --- | --- |
| 认证（Authentication） | 你是谁？ | 登录、服务身份、mTLS、签名令牌 | `user-01` 已登录 |
| 授权（Authorization） | 你现在能做什么？ | 策略、角色、资源属性、环境 | 可读自己的订单 |
| 确认（Confirmation） | 你是否明确同意这次风险动作？ | 绑定主体和调用的短期凭证 | 确认取消订单 |
| 审计（Audit） | 后续如何说明发生过什么？ | 受控事件存储 | 谁在何时被何条规则拒绝 |

“用户已经登录”“模型说用户同意”“工具在候选列表中可见”都不等价于授权成功。高风险写操作即使已经通过授权，仍可能需要第 17 课的确认；反过来，用户确认也不能授予其本来没有的资源权限。

```mermaid
flowchart LR
    A[认证中间件] --> B[可信主体]
    C[模型 ToolCall] --> D[输入 Schema 校验]
    B --> E[授权请求]
    D --> E
    E --> F[PEP 与策略引擎]
    F -->|拒绝| G[标准 ToolResult]
    F -->|允许| H[确认检查]
    H --> I[工具实现]
    F -.记录决策事实.-> J[审计事件]
```

授权发生在模型生成参数之后、工具实现之前。模型不是主体，也不能通过参数伪造主体、角色、租户或授权结论。

## 三、威胁模型：工具调用是一份不可信提案

ToolCall 的工具名与参数来自模型，模型输入又可能包含用户文本、网页内容、检索文档和第三方 MCP 返回。因此下列字段即使出现在 JSON Schema 中，也不能被当作可信安全事实：

- `actor_id`、`user_id`、`tenant_id`、`role`、`permissions`；
- `is_admin`、`approved`、`allow_all`、`bypass_policy`；
- 由调用方传入的根目录、数据库过滤条件或原始 SQL；
- “这是紧急情况”“已经得到老板授权”等自然语言说明。

例如这个参数 Schema 在语法上合法，但安全设计有问题：

```json
{
  "type": "object",
  "properties": {
    "actor_id": {"type": "string"},
    "is_admin": {"type": "boolean"},
    "order_id": {"type": "string"}
  },
  "required": ["actor_id", "order_id"]
}
```

模型只要生成 `{"actor_id":"admin","is_admin":true}`，脆弱的 Handler 就可能越权。正确做法是让工具参数只表达业务目标，例如 `order_id`；身份一律从第 14 课的 `ToolExecutionContext` 取得。

### 3.1 可信上下文必须由入口构造

第 14 课中的上下文可以扩展为授权主体，但敏感令牌和原始请求对象仍不应放入其中：

```python
from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class AuthorizationSubject:
    actor_id: str
    tenant_id: str
    principal_type: str  # user、service 或 support_operator
    roles: frozenset[str]
    permissions: frozenset[str]
    session_id: str
    authenticated_at: datetime
    attributes: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class ToolExecutionContext:
    subject: AuthorizationSubject
    environment: str
    request_id: str
    confirmation_token: str | None = None
```

这里的 `attributes` 是经过白名单筛选的属性，例如 `region=cn` 或 `support_case_id=CASE-42`；不能把未验证的 JWT Claims、Cookie 或客户端 Header 整包转入。服务调用也必须有单独的 service principal，不能假装成某位用户或共用一个“超级 Agent”账号。

### 3.2 代理执行不等于权限转移

Agent 是代用户发起工具提案的执行代理，不是独立拥有全部业务权限的管理员。默认有效权限应是用户与服务能力的交集：

```text
有效权限 = 用户被授予的权限 ∩ 当前服务被允许委托的权限 ∩ 工具声明的范围
```

因此，给模型更强的系统 Prompt、为 Agent 配置更高的模型额度，或将其部署在后端网络中，都不应扩大用户可操作的资源范围。

## 四、三层授权边界

把授权拆成层次，既能避免每个 Handler 重复写规则，也能避免用一个 `is_admin` 布尔值承担所有安全决策。

| 层级 | 判断对象 | 示例 | 主要位置 |
| --- | --- | --- | --- |
| 工具级 | 主体能否请求一种能力 | 是否拥有 `orders:read` | Registry + Runtime |
| 资源级 | 主体能否对具体目标操作 | 此订单是否属于该租户和该用户 | PEP + 资源加载器 |
| 字段级 | 主体可见或可修改哪些属性 | 客服不能看到完整手机号 | 输出投影 + 写入白名单 |

### 4.1 工具级：能力不是最终对象权限

第 12 课的 `required_permissions=("orders:read",)` 适合成为第一道快速门槛。它能减少模型可见工具，也能拒绝明显无关的调用。但它无法从 `order_id` 推导订单归属，不能单独保护业务数据。

不要把 Registry 的过滤结果缓存成“已经授权”。工具注册状态会变化，资源归属也会变化；任何可直接到达 Runtime 的入口都必须重新执行工具级与资源级检查。

### 4.2 资源级：动作、资源与关系共同决定

资源级策略至少需要明确：

```text
主体：谁在调用，属于哪个租户，具备什么委托身份
动作：read、cancel、write、export，而不是笼统的 access
资源：订单、文件、项目、密钥等具体对象及其可信属性
环境：生产或测试、时间、来源网络、支持工单等上下文
```

“拥有 `orders:write`”可表示该主体有资格进入取消订单流程；“订单属于 tenant-a、尚未发货、主体是订单所有者或被授予管理关系”才决定其能否取消 `A-1024`。

### 4.3 字段级：读取和写入都要收口

资源级允许读取订单，不代表可以返回其所有字段。输出 Schema 是类型契约，不是数据最小化策略；如果 Schema 含有 `shipping_address`，Handler 仍可能把不该看的地址返回给模型。

字段级控制有两侧：

- **读取投影**：策略允许后，只投影当前主体可见的字段，再进行输出 Schema 校验；
- **写入掩码**：只允许预先定义的可编辑字段，拒绝或忽略客户端尝试写入的服务端字段，如 `tenant_id`、`owner_id`、`status`、`is_admin`。

永远不要先返回完整实体、再希望调用方“不要使用敏感字段”。一旦完整对象进入模型上下文、日志或外部 Provider，请求边界已经失效。

## 五、RBAC 管资格，ABAC 管上下文

角色权限控制（RBAC）和属性权限控制（ABAC）不是互斥选项。实际系统通常用 RBAC 获得稳定、易管理的能力集合，用 ABAC 决定一次调用的资源范围。

### 5.1 RBAC：稳定的岗位能力

```python
ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    "customer": frozenset({"orders:read", "orders:cancel_own"}),
    "support": frozenset({"orders:read", "orders:write"}),
    "finance": frozenset({"orders:read", "refunds:write"}),
}


def derive_permissions(roles: frozenset[str]) -> frozenset[str]:
    return frozenset().union(*(ROLE_PERMISSIONS.get(role, frozenset()) for role in roles))
```

角色是身份系统签发的管理事实，模型不应传入或修改它。生产系统还应拒绝未知角色，或在身份供应商处完成映射；示例中静默返回空集合只是为了展示“未知角色不会意外获得权限”。

RBAC 适合回答“客服可以进入订单处理域吗”，不适合表达“只可在已绑定的支持工单期间读取该订单”。把每一种上下文都编码成新角色，会造成角色爆炸。

### 5.2 ABAC：资源关系和运行时约束

ABAC 使用主体、资源和环境属性表达细节，例如：

| 条件 | 例子 |
| --- | --- |
| 主体属性 | `subject.tenant_id == order.tenant_id` |
| 资源关系 | `subject.actor_id == order.customer_id` |
| 资源状态 | 订单尚未发货才允许取消 |
| 环境条件 | 支持人员只在有效工单和生产环境中可读取 |
| 请求约束 | 导出数量不超过 100，文件不大于 10 MB |

属性必须有来源和完整性。`order.tenant_id` 应来自受控存储，而不是模型参数；`support_case_id` 应由工单服务验证其有效性，不能只验证字符串形状。

### 5.3 先拒绝，再允许

策略应采用默认拒绝（default deny）与显式允许：没有匹配的允许规则就拒绝。不要先写一个广泛的 `allow if has orders:read`，再靠后续例外补洞；规则增加时，新路径很容易绕过例外。

拒绝规则应优先于允许规则。例如被锁定账户、被删除资源、跨租户请求、非生产服务调用生产资源，即使满足一个普通的允许规则也必须拒绝。

## 六、将授权请求做成明确的数据结构

授权逻辑不应在每个工具里写一串嵌套 `if`。先把输入归一化为可审查的请求对象，策略实现才有稳定边界。

```python
from dataclasses import dataclass
from enum import StrEnum
from typing import Any


class Action(StrEnum):
    ORDER_READ = "order.read"
    ORDER_CANCEL = "order.cancel"
    FILE_READ = "file.read"
    FILE_WRITE = "file.write"
    ORDER_EXPORT = "order.export"


@dataclass(frozen=True)
class ResourceRef:
    kind: str
    resource_id: str
    tenant_id: str
    attributes: dict[str, Any]


@dataclass(frozen=True)
class AuthorizationRequest:
    subject: AuthorizationSubject
    action: Action
    resource: ResourceRef
    environment: str
    request_id: str
    call_id: str
    constraints: dict[str, Any]
```

`ResourceRef.attributes` 只能来自可靠的资源加载器或可信基础设施。对还不存在的写入目标，使用已验证的父容器作为资源，例如“tenant-a 的 `reports/` 目录”，而不是把未创建文件的路径声称为一个已加载资源。

`constraints` 存放与动作有关、且经 Schema 校验后仍需授权判断的事实，例如导出行数、目标区域或文件大小上限。它不是一个可任意透传的 `metadata` 黑洞，应按动作建立白名单。

### 6.1 策略返回决策，而不只返回布尔值

布尔值无法说明是否需要隐藏资源存在性、应限制哪些字段，也不利于审计和测试。定义受控的决策类型：

```python
from dataclasses import dataclass
from enum import StrEnum


class DecisionEffect(StrEnum):
    ALLOW = "allow"
    DENY = "deny"


class DenyReason(StrEnum):
    MISSING_CAPABILITY = "missing_capability"
    TENANT_MISMATCH = "tenant_mismatch"
    RESOURCE_RELATION = "resource_relation"
    RESOURCE_STATE = "resource_state"
    SCOPE_VIOLATION = "scope_violation"
    ENVIRONMENT_RESTRICTED = "environment_restricted"


@dataclass(frozen=True)
class AuthorizationDecision:
    effect: DecisionEffect
    policy_id: str
    reason: DenyReason | None = None
    hide_resource_existence: bool = True
    readable_fields: frozenset[str] = frozenset()
    obligations: frozenset[str] = frozenset()

    @property
    def allowed(self) -> bool:
        return self.effect is DecisionEffect.ALLOW
```

`policy_id` 是版本化规则标识，例如 `orders.read.v3`，不是自然语言规则全文。`reason` 供内部日志、指标和有权限的运维视图使用；不应直接回传给模型。`obligations` 可表达“必须限制导出上限”“必须记录支持工单”等强制条件，不能只作为提示信息。

## 七、资源加载本身也是安全边界

常见错误是先用不带范围的查询拿到资源，再在 Python 中比较租户：

```python
# 错误：在读取完整对象之后才判断是否属于当前租户。
order = order_repository.find_by_id(order_id)
if order.tenant_id != context.subject.tenant_id:
    raise PermissionError()
```

即使最终拒绝，这种模式仍可能让缓存、日志、异常和计时差异泄露跨租户信息。优先让数据访问层把租户范围写进查询：

```python
class OrderRepository:
    def find_in_tenant(self, *, tenant_id: str, order_id: str) -> "Order | None":
        return self._db.fetch_one(
            """
            SELECT id, tenant_id, customer_id, status, updated_at
            FROM orders
            WHERE tenant_id = :tenant_id AND id = :order_id
            """,
            {"tenant_id": tenant_id, "order_id": order_id},
        )
```

数据库连接也应绑定租户上下文，或使用行级安全（RLS）作为纵深防御。应用层策略仍有价值，因为它能表达订单所有者、支持工单和字段投影；但不能把“记得每次 WHERE tenant_id”完全寄托在业务代码习惯上。

### 7.1 路径不是普通字符串

文件工具尤其容易被 `../`、符号链接和前缀碰撞绕过。`/workspace/a` 不能通过字符串前缀判断来保护，因为 `/workspace/ab` 也以它开头。

```python
from pathlib import Path


class PathOutsideWorkspace(ValueError):
    pass


def resolve_workspace_path(*, workspace_root: Path, requested_path: str) -> Path:
    root = workspace_root.resolve(strict=True)
    candidate = (root / requested_path).resolve(strict=False)
    try:
        candidate.relative_to(root)
    except ValueError as error:
        raise PathOutsideWorkspace("path escapes workspace") from error
    return candidate
```

对读取已有文件，打开前应再次以 `strict=True` 解析并检查真实路径，以避免解析到打开之间的符号链接替换。对写入新文件，检查已存在父目录的真实路径、禁止不受控符号链接，并使用支持目录文件描述符或原子创建的文件 API 降低 TOCTOU 风险。不要把客户端给出的绝对路径、根目录或 `allow_symlinks=true` 当作正常参数。

### 7.2 资源标识必须在业务域内解析

`order_id`、`project_id`、对象存储键和数据库过滤器都只是候选标识。工具参数校验成功后，仍要由域服务解析为 `ResourceRef`。不要允许工具直接接收任意 SQL、任意 URL 或任意云资源 ARN；若确有集成需求，也必须将其解析并限制到租户、区域、账户和允许的操作集合。

## 八、实现策略引擎：小接口，清楚的依赖

无需一开始引入一门复杂的策略语言。对于当前课程规模，一个明确的 Python 协议和按资源域拆分的策略已经足够，并能在将来替换为 OPA、Cedar 或集中式授权服务。

```python
from typing import Protocol


class AuthorizationPolicy(Protocol):
    def decide(self, request: AuthorizationRequest) -> AuthorizationDecision:
        """只根据可信主体、可信资源和受控约束返回决策。"""


class OrderPolicy:
    def decide(self, request: AuthorizationRequest) -> AuthorizationDecision:
        if request.action not in {Action.ORDER_READ, Action.ORDER_CANCEL}:
            return self._deny("orders.unsupported.v1", DenyReason.SCOPE_VIOLATION)

        if request.subject.tenant_id != request.resource.tenant_id:
            return self._deny("orders.tenant.v1", DenyReason.TENANT_MISMATCH)

        if request.action is Action.ORDER_READ:
            return self._decide_read(request)
        return self._decide_cancel(request)

    def _decide_read(self, request: AuthorizationRequest) -> AuthorizationDecision:
        if "orders:read" not in request.subject.permissions:
            return self._deny("orders.read.v3", DenyReason.MISSING_CAPABILITY)

        is_owner = request.subject.actor_id == request.resource.attributes["customer_id"]
        has_case = request.subject.attributes.get("support_case_id") == request.resource.attributes.get("support_case_id")
        is_support = "support" in request.subject.roles and has_case
        if not (is_owner or is_support):
            return self._deny("orders.read.v3", DenyReason.RESOURCE_RELATION)

        fields = {"order_id", "status", "updated_at"}
        if is_owner:
            fields.add("shipping_address")
        return AuthorizationDecision(
            effect=DecisionEffect.ALLOW,
            policy_id="orders.read.v3",
            readable_fields=frozenset(fields),
        )

    def _decide_cancel(self, request: AuthorizationRequest) -> AuthorizationDecision:
        if "orders:write" not in request.subject.permissions:
            return self._deny("orders.cancel.v2", DenyReason.MISSING_CAPABILITY)
        if request.subject.actor_id != request.resource.attributes["customer_id"]:
            return self._deny("orders.cancel.v2", DenyReason.RESOURCE_RELATION)
        if request.resource.attributes["status"] not in {"pending", "paid"}:
            return self._deny("orders.cancel.v2", DenyReason.RESOURCE_STATE)
        return AuthorizationDecision(
            effect=DecisionEffect.ALLOW,
            policy_id="orders.cancel.v2",
            obligations=frozenset({"require_confirmation"}),
        )

    @staticmethod
    def _deny(policy_id: str, reason: DenyReason) -> AuthorizationDecision:
        return AuthorizationDecision(
            effect=DecisionEffect.DENY,
            policy_id=policy_id,
            reason=reason,
        )
```

示例把支持人员的访问绑定到资源关联的工单，而不是给 `support` 一个无限制的“读所有订单”权限。实际系统不应信任 `resource.attributes["support_case_id"]` 恰好存在；应由独立的工单关系查询确认该工单仍有效、属于当前租户且覆盖该订单。

### 8.1 Policy Decision Point 与 Policy Enforcement Point

上述 `OrderPolicy` 是 Policy Decision Point（PDP）：只做决策。Runtime 中的 PEP 负责在正确的时点调用 PDP、阻止未授权执行，并把决策事实写入 Trace。

| 组件 | 职责 | 不应做什么 |
| --- | --- | --- |
| PEP（Runtime） | 构造请求、调用策略、强制拒绝、记录决策 | 把拒绝改成“建议”或自己猜规则 |
| PDP（策略） | 按规则产生 allow/deny、字段和义务 | 执行业务副作用 |
| 资源加载器 | 受租户约束地取得授权所需属性 | 根据模型参数赋予身份 |
| Handler | 使用已授权资源做业务动作 | 重新信任原始参数绕过授权 |

策略“允许”必须覆盖工具实际会做的动作。一个 `order.read` 决策不能被 Handler 用来顺带取消订单或返回支付卡号；动作拆分和字段投影是防止这类权限扩张的基础。

## 九、把 PEP 接入 Tool Runtime

授权请求必须在输入 Schema 校验后构造，因为此时可以安全读取 `order_id` 的形状；它必须在 Handler 前完成，因为之后可能发生副作用。对于读取资源，先受租户范围加载最小授权属性；对于写入资源，真正写入前应在同一事务或带版本条件的更新中再次验证关键状态，避免授权与写入之间发生竞争。

```mermaid
flowchart TD
    A[ToolCall] --> B[Registry 解析]
    B --> C[输入 Schema 校验]
    C --> D[工具级声明权限]
    D --> E[受限资源加载]
    E --> F[PEP 调用 PDP]
    F -->|deny| G[标准拒绝结果]
    F -->|allow| H[确认与义务检查]
    H --> I[Handler 执行]
    I --> J[字段投影与输出校验]
```

为避免每个 Handler 自己从参数取资源，可为需要资源授权的工具注册一个 request builder：

```python
from collections.abc import Callable


AuthorizationRequestBuilder = Callable[
    [dict[str, object], ToolExecutionContext, str], AuthorizationRequest
]


class ToolAuthorizer:
    def __init__(
        self,
        *,
        builders: dict[tuple[str, str], AuthorizationRequestBuilder],
        policies: dict[str, AuthorizationPolicy],
    ) -> None:
        self._builders = builders
        self._policies = policies

    def authorize(
        self,
        *,
        tool_name: str,
        tool_version: str,
        arguments: dict[str, object],
        context: ToolExecutionContext,
        call_id: str,
    ) -> AuthorizationDecision:
        builder = self._builders.get((tool_name, tool_version))
        if builder is None:
            # 没有资源策略的工具也必须显式注册；默认拒绝。
            return AuthorizationDecision(
                effect=DecisionEffect.DENY,
                policy_id="runtime.missing_authorizer.v1",
                reason=DenyReason.SCOPE_VIOLATION,
            )
        request = builder(arguments, context, call_id)
        policy = self._policies[request.resource.kind]
        return policy.decide(request)
```

在第 14 课的 `ToolRuntime.invoke()` 中，工具级 `required_permissions` 检查后、确认检查前增加：

```python
decision = self._authorizer.authorize(
    tool_name=spec.name,
    tool_version=spec.version,
    arguments=arguments,
    context=context,
    call_id=call.call_id,
)
self._trace.record_authorization(
    request_id=context.request_id,
    call_id=call.call_id,
    policy_id=decision.policy_id,
    effect=decision.effect,
    reason=decision.reason,
)
if not decision.allowed:
    return self._authorization_error(call=call, spec=spec, decision=decision)
if "require_confirmation" in decision.obligations:
    # 第 17 课会验证令牌的主体、调用、版本、过期时间和一次性消费。
    require_confirmation = True
```

真实代码中应将 `require_confirmation` 与 `spec.security.requires_confirmation` 合并为“任一要求即必须确认”，而不是让策略义务覆盖工具契约。一个常见做法是在 Authorizer 返回的决策中携带义务，在 Runtime 统一执行全部义务；不能让 Handler 忘记执行它们。

### 9.1 授权不足时的稳定错误语义

工具的外部结果必须避免成为资源枚举接口。对按 ID 读取的资源，推荐统一暴露一个不区分不存在和无权访问的领域错误：

```python
def _authorization_error(
    self,
    *,
    call: ToolCall,
    spec: ToolSpec,
    decision: AuthorizationDecision,
) -> ToolResult:
    if decision.hide_resource_existence:
        return self._error(
            call=call,
            spec=spec,
            code="order_not_found",
            message="订单编号不存在，或当前用户无权查看该订单。",
        )
    return self._error(
        call=call,
        spec=spec,
        code="permission_denied",
        message="当前身份不具备执行此操作的权限。",
    )
```

这里的 `order_not_found` 必须是 `ToolSpec.errors` 中已声明的错误，且仅适用于按资源标识读取等确实需要隐藏存在性的场景。对于“尝试调用一个禁止的管理工具”或“导出行数超过上限”，返回通用 `permission_denied` 或 `scope_violation` 更清楚。外部错误码不应包含 `tenant_mismatch`、`not_owner`、内部策略名或角色名。

**不能用延时伪装保护枚举。** 人为 `sleep` 既难以一致，也会消耗并发槽位；正确措施是受租户范围查询、统一外部错误、限流和审计异常探测。

## 十、字段投影与写入约束

### 10.1 在输出 Schema 前执行读取投影

授权决策输出的 `readable_fields` 应由一个显式投影器执行。投影器不应接受调用方指定的字段列表作为最终权限依据。

```python
from typing import Any


def project_order_for_subject(
    *,
    order: dict[str, Any],
    decision: AuthorizationDecision,
) -> dict[str, Any]:
    if not decision.allowed:
        raise RuntimeError("cannot project a denied resource")
    return {
        field: value
        for field, value in order.items()
        if field in decision.readable_fields
    }
```

输出 Schema 应允许策略能合法投影出的形状。若同一工具对不同角色输出结构差异很大，优先拆分成不同目的的工具或使用显式的可选字段，避免用一个“全量订单工具”在不同权限下偷偷返回不稳定对象。无论哪种形式，投影后仍要通过第 14 课的输出校验。

模型需要的字段应当是完成任务所必需的最小集合。例如客服只需知道是否可以取消订单，不需要看到精确收货地址；这既降低隐私泄露，也降低 Prompt 注入后可被外带的数据量。

### 10.2 写入使用允许字段与服务端赋值

不要采用“删除几个危险字段，其余都更新”的黑名单模式。新字段一旦加入实体，便可能被意外开放。使用按工具定义的允许字段：

```python
ALLOWED_PROFILE_PATCH_FIELDS = frozenset({"display_name", "notification_email"})


def select_profile_patch(arguments: dict[str, object]) -> dict[str, object]:
    patch = arguments["patch"]
    if not isinstance(patch, dict):
        raise ValueError("validated schema must provide an object patch")
    unexpected = set(patch) - ALLOWED_PROFILE_PATCH_FIELDS
    if unexpected:
        raise ValueError("patch contains fields not allowed by this tool")
    return {name: patch[name] for name in ALLOWED_PROFILE_PATCH_FIELDS if name in patch}
```

`tenant_id`、资源所有者、审批状态、余额、权限和审计时间应由服务端赋值或通过独立、受控的领域操作变更。即使用户能修改自己的资料，也不能让通用 `update_profile` 接收整个 ORM 对象。

### 10.3 列表与导出是独立的资源范围问题

过滤条件和分页上限也是策略的一部分。不能因为每条订单都经过单项授权，就允许一次导出全部订单：

- 在数据查询前固定 `tenant_id` 和可见范围；
- 对 `limit` 设平台上限，不能让模型请求无限大值；
- 对导出、批量删除等动作使用独立权限、风险和确认策略；
- 不根据调用方传入的 `include_deleted`、`all_tenants`、`fields=*` 扩大范围。

## 十一、租户隔离与作用域约束

租户 ID 是授权输入，不是普通的业务筛选条件。每一条访问路径都应有同样的隔离规则：主库查询、缓存键、搜索索引、对象存储前缀、异步任务、导出文件和 Trace。

```text
tenant_id 应来自可信主体或已验证的委托上下文
缓存键至少包含 tenant_id、资源 ID、策略相关范围
对象存储键固定在 tenants/{tenant_id}/... 前缀下
异步任务载荷保存不可变主体快照或可重新验证的授权引用
```

不要仅在 HTTP 路由层检查一次租户。Tool Runtime 可以被 CLI、队列消费者、MCP Client 或内部测试入口调用，它们都必须传入可信上下文并走同一 PEP。

### 11.1 限额与操作范围

授权不仅是“允许/拒绝”，还包括授权的最大范围。下列约束宜由策略或义务明确表达：

| 动作 | 典型范围约束 |
| --- | --- |
| `order.export` | 最多 100 条，仅当前租户，仅脱敏字段 |
| `file.write` | 仅工作区内、仅 `.md` 和 `.txt`、最大 1 MB |
| `notification.send` | 仅已验证收件人、每小时限额 |
| `refund.create` | 金额不超过岗位额度且币种受限 |

额度检查要使用精确货币类型和服务端订单金额，不能相信模型给出的 `amount` 已经与订单一致。高价值额度通常还需要审批或双人复核，第 17 课会承接这一点。

### 11.2 跨租户支持访问必须显式建模

排障人员确实可能需要跨租户访问，但不能通过赋予 `tenant_id="*"` 或全局管理员角色解决。应使用短期、目的受限的委托上下文：目标租户、支持工单、只读动作集合、失效时间和签发人都必须可验证并记录。策略应默认拒绝跨租户，再只允许这类明确定义的例外。

## 十二、与可靠性机制的边界

第 15 课的可靠性执行器位于 Runtime 外层，但每次尝试都必须重新经过授权边界：

```text
可靠性执行器
    -> Runtime：解析、Schema、工具级授权、资源级 PEP、确认、Handler
    -> 失败分类
    -> 允许时再进入 Runtime
```

原因不是形式主义：重试之间用户可能被禁用、角色可能被回收、资源归属和状态可能变化、确认也可能过期。第一次允许不能变成后续尝试的永久通行证。

以下规则尤其重要：

1. `retryable=true` 只表示故障类别可尝试恢复，绝不表示调用仍有权限；
2. 授权拒绝、作用域拒绝和确认缺失都不可自动重试；
3. 缓存的授权决策必须很短、按主体和资源精确分区，并在权限或资源状态变更时失效；
4. 对写操作，在最终提交点再次满足关键条件，例如 `UPDATE ... WHERE tenant_id = ? AND status = 'pending'`；
5. 幂等键防重复执行，不授予权限，也不能跨主体、租户或动作复用。

### 12.1 授权与并发竞争

授权成功到 Handler 写入之间，订单可能被发货或转移。不要把一次预检查当作永久事实。写入操作应通过事务、乐观锁版本号或条件更新，把“仍满足授权所依赖的状态”和“执行变更”尽量放在同一个原子边界。

例如取消订单的更新条件至少包含订单 ID、租户、当前状态和版本号；影响行数为零时返回领域状态错误或重新读取后作出准确判断，而不是盲目重试取消。

## 十三、不要把安全边界交给 Prompt、工具描述或 MCP

工具描述中写“只能读取自己的订单”有助于模型选择正确工具，但描述不是执行机制。攻击者可以直接构造 ToolCall，旧模型可能忽略描述，远程 MCP Server 也可能提供与描述不一致的能力。

MCP 的 Tools、Resources 和 Prompts 是能力发现与通信协议，不是本地业务授权标准。接入外部 MCP 时，仍需：

- 在本地 Registry 中为远程工具声明最小权限、租户和风险策略；
- 用本地 PEP 判定用户是否能请求该远程能力；
- 为远程调用使用范围最小、短期、可撤销的下游凭证；
- 验证远程返回内容，并按本地字段策略投影后再交给模型；
- 不把用户主会话 Token、数据库密码或全局服务密钥透传给 MCP Server。

“该 MCP Server 已通过网络隔离”也不能代替授权。网络位置最多是环境属性或纵深防御的一层，不是主体与资源关系的证明。

## 十四、策略测试：把拒绝路径当成产品能力

策略变更极易产生越权回归，因此测试应覆盖允许与拒绝的对偶场景，而不只测试“管理员能成功”。先提供固定夹具：

```python
import pytest
from dataclasses import replace


@pytest.fixture
def own_order_request(customer_subject: AuthorizationSubject) -> AuthorizationRequest:
    return AuthorizationRequest(
        subject=customer_subject,
        action=Action.ORDER_READ,
        resource=ResourceRef(
            kind="order",
            resource_id="A-1024",
            tenant_id="tenant-a",
            attributes={
                "customer_id": customer_subject.actor_id,
                "status": "paid",
                "support_case_id": None,
            },
        ),
        environment="production",
        request_id="req-test",
        call_id="call-test",
        constraints={},
    )
```

### 14.1 单元测试规则矩阵

```python
@pytest.mark.parametrize(
    ("mutate", "expected"),
    [
        (lambda request: request, DecisionEffect.ALLOW),
        (
            lambda request: replace(
                request,
                resource=replace(request.resource, tenant_id="tenant-b"),
            ),
            DecisionEffect.DENY,
        ),
        (
            lambda request: replace(
                request,
                resource=replace(
                    request.resource,
                    attributes={**request.resource.attributes, "customer_id": "user-other"},
                ),
            ),
            DecisionEffect.DENY,
        ),
    ],
)
def test_order_read_policy_bounds_resource(
    own_order_request: AuthorizationRequest,
    mutate: object,
    expected: DecisionEffect,
) -> None:
    decision = OrderPolicy().decide(mutate(own_order_request))
    assert decision.effect is expected
```

示例需要 `from dataclasses import replace`。实际测试还应覆盖缺少 `orders:read`、支持工单失效、取消已发货订单、错误环境、字段集合和每条拒绝规则的优先级。不要只断言 `allowed is False`，还要断言策略 ID、是否隐藏资源存在性及义务集合符合预期。

### 14.2 Runtime 集成测试

集成测试验证 PEP 的位置，而不是重复单元测试所有规则：

1. 跨租户 `order_id` 不能到达 Handler，外部结果与不存在订单一致；
2. 未注册 Authorizer 的资源工具默认拒绝，不能悄悄放行；
3. 授权允许但确认缺失时，Handler 仍不执行；
4. 重试前权限被回收时，第二次尝试被拒绝；
5. 输出投影后不含禁止字段，且仍符合输出 Schema；
6. `../`、绝对路径和指向工作区外的符号链接均不能到达文件 Handler。

为每个测试计数 Handler 调用次数。只检查最终错误码不足以证明安全边界真的在副作用之前生效。

### 14.3 策略合同测试与回归样本

当策略服务独立部署或需要兼容多语言实现时，维护一组版本化授权样本：输入主体、资源快照、动作、预期决策、字段与义务。Python Runtime、将来的远程 PDP 和测试 CLI 都应跑同一组样本。

策略变更上线前还应回放脱敏的历史授权事件，统计 allow/deny 的变化。新增允许必须人工审查；新增拒绝也要评估是否会中断正常业务。策略版本写入事件后，才能定位“哪次规则变更导致行为改变”。

## 十五、记录最少但足够的授权事实

第 17 课会建立正式审计链，本课先规定决策 Trace 的最小字段：

| 字段 | 用途 | 注意事项 |
| --- | --- | --- |
| `request_id`、`call_id` | 关联请求与工具调用 | 不使用参数哈希代替调用 ID |
| `actor_id`、`principal_type` | 定位主体 | 访问受控，避免写入原始会话令牌 |
| `tenant_id`、`resource_kind`、资源摘要 | 定位授权范围 | 资源 ID 按敏感等级脱敏或哈希 |
| `action`、`tool_name@version` | 说明请求的能力 | 动作和工具应可映射 |
| `policy_id`、`effect`、内部 `reason` | 分析规则结果 | 原因不直接回传模型 |
| `confirmation_required`、`decision_at` | 衔接确认和时序 | 使用 UTC 时间戳 |

不要把完整工具参数、完整订单、地址、银行卡号、Authorization Header 或下游响应无选择地写入 Trace。审计日志本身也是高价值数据，需要访问控制、脱敏、保留期限和防篡改设计。

对拒绝率突增、某主体对连续资源 ID 的探测、跨租户拒绝、路径穿越尝试等建立指标和告警。安全日志的价值在于发现趋势，不在于把每次失败打印成堆栈。

## 十六、常见错误与修正

### 16.1 只在模型可见性阶段过滤工具

模型可能忽略工具列表、旧任务可以重放调用，内部入口也能绕过发现。因此 Registry 过滤只能减少误用；Runtime PEP 才是强制边界。

### 16.2 将 `actor_id` 放入工具参数

参数属于模型提案，可被伪造。身份、租户和角色必须由入口认证后的上下文提供；工具参数只携带业务目标。

### 16.3 仅检查 `orders:read`

这会让拥有读能力的用户枚举整个租户甚至跨租户资源。至少同时检查租户、资源关系、状态和字段投影。

### 16.4 用 `path.startswith(root)` 做路径白名单

前缀碰撞、`..` 和符号链接都能绕过。先解析真实路径，再通过 `relative_to()` 判断，并在实际打开时防范 TOCTOU。

### 16.5 先读全量数据，再在响应层脱敏

完整对象可能已经进入缓存、日志或模型上下文。查询阶段就限制列和租户，策略允许后再做字段投影。

### 16.6 把授权成功缓存很久

角色、工单、资源状态和租户归属会变化。需要缓存时，使用短 TTL、精确缓存键和撤销失效；高风险写操作在提交点重新验证。

### 16.7 用重试绕过临时授权错误

权限被拒绝通常不是瞬时网络错误。重试既不能获得权限，也可能在权限回收后继续尝试副作用；每次可靠性重试都应回到 Runtime 重新授权。

### 16.8 让远程 MCP Server 代替本地策略

远程服务的认证结果只能是附加信号。平台仍须决定当前用户能否调用、下发何种下游凭证以及哪些结果可回传模型。

## 十七、练习

### 练习 1：为 `get_order` 建立资源级授权

实现一个 `OrderAuthorizationRequestBuilder`，从已校验的 `order_id` 和可信上下文构造请求。要求：

1. 资源加载查询必须带上 `tenant_id`；
2. 所有者可读取订单状态和更新时间；
3. 有效支持工单的客服可读取同样的最小字段；
4. 不存在、跨租户和无关系订单对模型返回同一种外部错误；
5. Handler 在拒绝路径上的调用次数为零。

### 练习 2：为工作区写入工具设计路径策略

为 `write_workspace_file` 设计 Schema、资源解析器和策略。限制相对路径、允许扩展名、最大字节数和工作区归属；分别测试 `../secret.txt`、绝对路径、`workspace2` 前缀碰撞与工作区内指向外部的符号链接。

### 练习 3：设计订单导出义务

新增 `order.export` 动作，要求普通客服最多导出 100 条、字段不含地址，财务角色可导出支付状态但仍不能跨租户。把“最大行数”和“字段投影”表示为决策义务，并在 Runtime 或 Handler 边界强制执行，而不是只写在工具描述里。

## 十八、完成标准

完成本课后，检查以下条目：

- [ ] 身份、租户、角色和权限只来自可信上下文，不来自 ToolCall 参数；
- [ ] 每个资源工具都有显式的动作、资源加载器和授权策略，缺失配置默认拒绝；
- [ ] 工具级、资源级、字段级规则职责清楚，读写都遵循最小权限；
- [ ] 租户约束进入数据库、缓存、对象存储和异步任务等实际数据路径；
- [ ] 路径和资源标识经过域解析，未使用字符串前缀或任意查询作为授权依据；
- [ ] PEP 位于 Handler 之前，拒绝路径不会产生副作用；
- [ ] 外部拒绝语义不会泄露不应暴露的资源存在性，内部 Trace 仍保留受控原因；
- [ ] 重试、幂等、确认与授权的边界明确，每次尝试重新经过 Runtime；
- [ ] 策略有允许、拒绝、字段投影和 Runtime 集成测试。

## 十九、小结

权限不是“模型能否看到一个工具”，而是一次由可信主体、具体动作、真实资源和运行时环境共同决定的安全判定。RBAC 适合表达岗位能力，ABAC 负责租户、所有权、状态、路径、额度和临时委托等细粒度条件；两者一起才能实现最小权限。

在工程上，Policy Decision Point 负责给出版本化决策，Tool Runtime 中的 PEP 负责在所有入口强制执行；资源加载和字段投影同样属于安全边界。拒绝路径要稳定、不可枚举，日志要足够追溯但不复制敏感数据。第 15 课的重试、幂等和降级不会扩大权限，每一次尝试仍必须重新授权。

下一课会在“有权限”之后处理“是否已明确确认”和“如何可审计地留痕”：为高风险工具建立持久化的 Human-in-the-loop 审批状态机与审计记录。

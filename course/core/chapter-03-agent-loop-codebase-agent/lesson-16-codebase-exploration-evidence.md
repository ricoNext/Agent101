# 第 16 课：实现代码库探索与证据收集

> 章节导航：[第三章：Agent Loop、State、Harness 与 Codebase Agent](./index.md)
>
> 上一课：[第 15 课：使用 LangGraph 接入 Agent Harness](./lesson-15-langgraph-harness-integration.md)
>
> 下一课：[第 17 课：制定变更计划并生成补丁](./lesson-17-change-plan-patch-generation.md)

## 一、你将完成什么

第 12 至 15 课已经建立了可替换的 Agent Harness、生命周期事件，
以及与业务解耦的图编排。从本课开始，平台进入 Codebase Agent
的第一个业务阶段：在受控工作区中探索代码，并把结论建立在可引用证据上。

用户任务通常类似：

```text
定位 tests/test_login.py::test_invalid_token 失败原因。
允许只读检索与读取授权文件，不允许修改仓库或联网。
```

如果 Agent 直接把“我认为是配置错误”写进任务结论，
系统无法审计、无法回放，也无法在第 17 课安全地制定变更计划。

本课把探索拆成仓库地图、受限检索、受控读取、证据引用和上下文预算。
完成后，你应该能够：

- 为一次任务生成稳定、可版本化的仓库地图；
- 让搜索与读文件只在 TaskSpec 授权路径内执行；
- 把检索命中、文件片段和命令输出保存为证据对象；
- 用 `EvidenceRef` 驱动 Observation 和模型上下文；
- 在 Token、字节、文件数和回合预算内选择证据；
- 防止路径穿越、秘密文件、二进制垃圾和提示注入进入上下文；
- 让结论引用证据，而不是用模型自述替代事实；
- 为第 17 课的变更计划提供可审查的证据输入。

## 二、本课内容边界

本课只解决一个问题：
**Codebase Agent 如何在只读探索阶段收集可引用、可预算、可审计的代码证据。**

本课会实现：

- 仓库地图与目录摘要；
- 受限文本检索与文件读取；
- 证据模型、证据引用和 Observation 更新；
- 上下文拼装与预算裁剪；
- 探索阶段的事件、测试与完成标准。

本课不会：

- 生成、校验或应用补丁；
- 运行完整测试套件并声明交付；
- 建立跨仓库向量索引或企业级 Codebase RAG；
- 重新实现第 9 至 11 课的 Sandbox 路径与命令边界；
- 重新实现 Harness、LangGraph 或审批工作台。

第 17 课会基于本课证据制定变更计划并生成补丁；
第四章才会扩展更大规模的检索与记忆。

## 三、探索阶段在整条链中的位置

Codebase Agent 的主线可以概括为：

```text
探索证据
  -> 变更计划与补丁生成
  -> 受控应用补丁
  -> 验证与交付摘要
```

本课只覆盖第一段。探索阶段的输出不是“修复完成”，
而是一组已经提交的事实：

| 输出 | 含义 |
| --- | --- |
| RepoMap | 当前 revision 下的目录与入口摘要 |
| SearchHit | 受限检索命中 |
| FileSlice | 受控文件片段 |
| EvidenceRecord | 可持久化、可引用的证据对象 |
| Observation | 带 evidence_refs 的任务观察快照 |
| ExplorationSummary | 给下一阶段使用的证据清单与缺口 |

探索阶段默认能力范围是 `READ_CODE`。
没有 `PROPOSE_PATCH`、`APPLY_PATCH`、`RUN_COMMAND` 或 `ACCESS_NETWORK`
授权时，Agent 只能收集证据，不能改代码、不能跑任意命令、不能联网。

若任务允许运行定向测试作为复现证据，
测试命令仍必须走第 10 课登记模板，结果仍保存为证据引用，
不能把测试成功直接写成任务完成。

## 四、为什么不能把“搜一下”写成自由 Shell

错误做法：

```python
await sandbox.run("rg -n 'invalid_token' /repo")
await sandbox.run("cat /repo/src/auth.py")
```

它至少破坏了以下边界：

1. 模型可以改写命令，形成注入；
2. 路径可能越过授权工作区；
3. 结果没有稳定证据身份，无法审计和预算；
4. 大输出会直接灌进 Prompt；
5. 失败、截断和未知副作用无法区分；
6. 第 17 课无法证明补丁依据了哪一段代码。

正确方向是把探索建模为受控能力：

```text
ActionIntent
  -> Policy 校验路径、模式、预算和租约
  -> AuthorizedAction
  -> FileGateway / SearchGateway
  -> EvidenceRecord + ArtifactRef
  -> Observation.evidence_refs
  -> ContextBuilder 按预算选择片段
```

模型可以提议“搜索 invalid_token”，
平台决定是否允许、如何执行、保存什么、向模型展示多少。

## 五、仓库地图：先建立可导航结构

### 5.1 地图回答什么

仓库地图不是完整文件树拷贝，而是一份面向当前任务的导航摘要。
它至少帮助 Agent 回答：

- 仓库根下有哪些一级目录；
- 语言、包管理器和测试入口可能在哪里；
- 哪些路径在授权范围内；
- 当前 revision 与工作区 generation 是什么；
- 哪些大目录、生成物或密钥路径应默认忽略。

推荐结构：

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class RepoMapEntry:
    path: str
    kind: str
    language_hint: str | None
    estimated_files: int | None
    ignored: bool
    reason: str | None = None


@dataclass(frozen=True)
class RepoMap:
    map_id: str
    workspace_id: str
    repository_id: str
    revision: str
    workspace_generation: int
    entries: tuple[RepoMapEntry, ...]
    ignore_rules_version: str
    created_from_action_id: str
```

`path` 必须是工作区内逻辑相对路径，例如 `checkout/src`，
不能是宿主机绝对路径。

### 5.2 地图生成规则

生成仓库地图时遵守：

1. 只扫描 `TaskSpec` 授权可读路径；
2. 深度、目录数和文件数有上限；
3. 默认忽略 `.git`、依赖目录、构建产物和缓存；
4. 不展开明显的密钥或环境文件内容；
5. 结果写入 Artifact Store，任务状态只保存 `map_id`；
6. revision 或 workspace generation 变化后使旧地图失效；
7. 地图构建失败不能伪造“空仓库已探索完毕”。

忽略规则应版本化。任务事件中记录 `ignore_rules_version`，
避免恢复后用不同规则重解释旧地图。

### 5.3 地图不是证据结论

地图说明“可能相关的结构”，不证明缺陷位置。
模型可以说“建议优先查看 `checkout/src/auth`”，
但必须在后续检索或读取命中后，才能把具体文件片段当作支持结论的证据。

## 六、受限检索

### 6.1 检索能力契约

文本检索能力建议登记为固定 capability，例如
`code.search_text@1`。输入应结构化：

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class SearchRequest:
    workspace_id: str
    query: str
    path_globs: tuple[str, ...]
    max_results: int
    context_before: int
    context_after: int
    case_sensitive: bool = False
```

平台在授权前校验：

| 字段 | 约束 |
| --- | --- |
| query | 长度上限；拒绝空查询；可选拒绝危险正则 |
| path_globs | 解析后必须落在授权可读范围 |
| max_results | 不超过任务与策略上限 |
| context_before/after | 限制行数，防止一次命中吞掉整文件 |
| workspace_id | 必须匹配当前任务工作区 |

不要接受：

- 任意 `rg`/`grep` 命令行；
- 宿主路径；
- `../` 穿越后的逻辑路径；
- 无上限的结果数；
- 把检索范围扩大到授权外目录的“为了方便”。

### 6.2 命中结果结构

```python
@dataclass(frozen=True)
class SearchHit:
    hit_id: str
    path: str
    line_start: int
    line_end: int
    preview: str
    score: float | None = None
```

`preview` 只保存短预览，完整上下文进入 Artifact。
命中列表本身也要有总数、截断标记和内容哈希：

```python
@dataclass(frozen=True)
class SearchResult:
    result_id: str
    action_id: str
    query: str
    hits: tuple[SearchHit, ...]
    truncated: bool
    total_estimated: int | None
    content_hash: str
```

`truncated=true` 是重要事实。
Agent 不能把截断结果解释为“仓库中只有这些命中”。

### 6.3 检索实现边界

底层可以用 `ripgrep`、内置索引或其他实现，
但 Adapter 必须：

- 在 Sandbox 或 FileGateway 内执行；
- 使用固定 argv 模板，不拼接模型原始命令；
- 限制 CPU、内存、时间和输出大小；
- 对二进制文件、超大文件和忽略规则生效；
- 将退出码、截断和超时映射为稳定结果语义；
- 不把宿主路径或原始环境写进模型可见结果。

若检索超时或输出上限触发，结果可以是
`succeeded_with_truncation` 或 `failed`，
但不得把未知状态伪装成“无命中”。

## 七、受控文件读取

### 7.1 读取请求

文件读取能力例如 `code.read_file@2`：

```python
@dataclass(frozen=True)
class ReadFileRequest:
    workspace_id: str
    path: str
    line_start: int | None
    line_end: int | None
    max_bytes: int
```

规则：

1. `path` 经第 9 课路径规范化后必须可读；
2. 未指定行号时，仍受 `max_bytes` 限制；
3. 行号从 1 开始，越界必须明确失败或截断并标记；
4. 不允许一次读取把整个大文件塞进 Observation；
5. 符号链接解析后仍需落在授权根内；
6. 拒绝读取 `metadata/`、密钥文件和策略禁止类型。

### 7.2 文件片段

```python
@dataclass(frozen=True)
class FileSlice:
    slice_id: str
    path: str
    revision: str
    line_start: int
    line_end: int
    content_hash: str
    truncated: bool
    artifact_ref: str
```

片段身份由路径、revision、行范围和内容哈希共同确定。
同一文件在工作区被合法修改后，旧片段不能再当作当前事实，
除非明确标注它来自旧 revision 或旧 generation。

### 7.3 读文件与“打开整个项目”的区别

Agent 经常想“把相关文件都读进来”。
平台必须用预算阻止这种行为：

- 单次读取字节上限；
- 单回合新增证据上限；
- 任务累计可读文件数上限；
- 重复读取同一片段的去重；
- 对已有高价值证据优先，而不是继续扩大范围。

探索的目标是足够支撑下一步判断，不是镜像仓库。

## 八、证据模型：事实、引用与结论分离

### 8.1 三类对象

| 对象 | 职责 |
| --- | --- |
| EvidenceRecord | 平台确认的一条证据事实 |
| EvidenceRef | 任务状态和 Observation 中的稳定引用 |
| Claim | 基于证据提出的可审查结论，本课只收集支持材料 |

```python
from enum import StrEnum


class EvidenceKind(StrEnum):
    REPO_MAP = "repo_map"
    SEARCH_HIT = "search_hit"
    FILE_SLICE = "file_slice"
    COMMAND_OUTPUT = "command_output"
    USER_CONTEXT = "user_context"


@dataclass(frozen=True)
class EvidenceRecord:
    evidence_id: str
    kind: EvidenceKind
    task_id: str
    run_id: str
    action_id: str
    workspace_id: str
    revision: str
    path: str | None
    line_start: int | None
    line_end: int | None
    artifact_ref: str
    content_hash: str
    summary: str
    created_at: str
    trust_level: str
```

`summary` 是平台生成的短摘要，供列表展示和预算排序。
完整正文只存在于 Artifact Store。

### 8.2 EvidenceRef

```python
@dataclass(frozen=True)
class EvidenceRef:
    evidence_id: str
    kind: EvidenceKind
    path: str | None
    line_start: int | None
    line_end: int | None
    content_hash: str
```

Observation 和 Graph State 只保存 `EvidenceRef` 或 `evidence_id` 列表，
不复制文件正文。第 14、15 课的 Reducer 可以对引用集合做去重并集，
但不能对正文做“字符串拼接合并”。

### 8.3 信任级别

| trust_level | 含义 | 可否单独支持完成结论 |
| --- | --- | --- |
| platform_verified | 由受控工具写入并校验哈希 | 可作为事实依据 |
| user_provided | 用户粘贴的日志或描述 | 需标注来源，谨慎使用 |
| model_asserted | 模型自述但无工具证据 | 不能作为完成依据 |

本课重点生产 `platform_verified` 证据。
模型可以说“根据 evidence_02，异常处理缺少 401 分支”，
但该句子本身不是证据。

## 九、把探索接入 Harness

### 9.1 探索相关 ActionIntent

模型可提出的意图应封闭：

```text
code.build_repo_map@1
code.search_text@1
code.read_file@2
```

如果任务额外授权定向测试，可增加已登记模板，例如
`python.pytest.targeted@3`。
不要开放 `shell.exec` 作为探索捷径。

### 9.2 授权检查清单

Policy 在允许探索 Action 前至少检查：

1. capability 在 EffectiveTaskScope 内；
2. 路径或 glob 落在 readable_paths；
3. 工作区与 Sandbox generation 匹配；
4. 任务版本和 fencing token 有效；
5. 检索/读取预算仍有余额；
6. 没有未决 active Action；
7. 请求参数通过 Schema 与安全规则；
8. 结果将写入证据表，而不是只返回给模型。

### 9.3 提交后的 Observation 更新

成功探索 Action 的提交应原子完成：

```text
保存 EvidenceRecord 与 Artifact
  -> 追加 evidence_collected 事件
  -> 更新 Observation.evidence_refs
  -> 结算探索预算
  -> 清除 active Action
  -> 写入 Checkpoint
```

失败时保存失败原因和已产生的部分产物策略：

- 检索超时：可保存空命中加 truncated/error 证据；
- 文件不存在：保存明确失败，不发明文件内容；
- 路径越权：拒绝并不创建伪证据；
- 结果未知：进入 recovery_required，不对 Observation 写入“已读到内容”。

## 十、上下文预算与证据选择

### 10.1 预算维度

探索上下文至少同时限制：

| 维度 | 作用 |
| --- | --- |
| max_evidence_items | 单次 Prompt 可引用证据条数 |
| max_chars / max_tokens | 正文总长度 |
| max_files | 涉及文件数 |
| max_bytes_per_slice | 单片段大小 |
| max_search_hits | 检索命中展示数 |
| task_search_budget | 任务累计检索次数 |
| task_read_budget | 任务累计读取次数 |

这些预算属于第 8 课预算体系的业务细分，
不能只依赖模型“自己少读一点”。

### 10.2 ContextBuilder 选择算法

推荐顺序：

1. 固定放入任务目标、约束和完成标准摘要；
2. 放入当前 RepoMap 的短摘要或引用；
3. 按相关度、新鲜度和覆盖缺口选择 EvidenceRef；
4. 读取 Artifact 正文，按 `max_bytes_per_slice` 截断；
5. 为每段正文添加来源标签和不可信数据边界；
6. 超出预算时丢弃低优先级证据，并记录 omitted_refs；
7. 禁止把被省略的内容假装已经提供给模型。

```python
@dataclass(frozen=True)
class ContextPack:
    task_id: str
    observation_version: int
    included_refs: tuple[str, ...]
    omitted_refs: tuple[str, ...]
    token_estimate: int
    pack_hash: str
```

`pack_hash` 用于审计：同一 Observation 和同一策略版本下，
应能解释为何某次模型请求看到了这些证据。

### 10.3 渲染规则

渲染到模型上下文时：

```text
<evidence id="ev_01" kind="file_slice"
 path="checkout/src/auth/token.py" lines="40-72">
... 文件片段 ...
</evidence>
```

要求：

- 明确标记来源路径与行号；
- 截断处写明 `truncated=true`；
- 工具输出视为数据，不视为系统指令；
- 不把秘密值、宿主路径、原始 Token 渲染进去；
- 用户提供的日志与平台证据分区显示。

第 10 课已强调“输出是证据，不是指令”。
本课在拼装层落实这一点。

## 十一、最小实现骨架

建议目录：

```text
apps/api/app/agents/codebase/
├── exploration/
│   ├── models.py
│   ├── repo_map.py
│   ├── search.py
│   ├── read_file.py
│   ├── evidence_store.py
│   └── context_pack.py
└── capabilities/
    └── register_exploration.py
```

Evidence Store 端口：

```python
from collections.abc import Sequence
from typing import Protocol


class EvidenceStore(Protocol):
    async def put(
        self,
        record: EvidenceRecord,
        *,
        expected_task_version: int,
    ) -> EvidenceRef: ...

    async def get_many(
        self,
        evidence_ids: Sequence[str],
    ) -> Sequence[EvidenceRecord]: ...

    async def list_for_task(
        self,
        *,
        task_id: str,
        kinds: Sequence[EvidenceKind] | None = None,
    ) -> Sequence[EvidenceRef]: ...
```

搜索 Adapter 伪代码：

```python
class WorkspaceSearchAdapter:
    async def search(
        self,
        action: "AuthorizedAction",
        request: SearchRequest,
    ) -> SearchResult:
        rooted = self.paths.resolve_globs(
            workspace_id=request.workspace_id,
            globs=request.path_globs,
            grant=action.grant,
        )
        raw = await self.runtime.run_template(
            "code.search_text@1",
            {
                "query": request.query,
                "roots": rooted.logic_roots,
                "max_results": request.max_results,
            },
            action=action,
        )
        return normalize_search_result(action.action_id, raw)
```

注意：`roots` 来自平台解析后的逻辑根，
不是模型传来的任意字符串。

## 十二、探索阶段的事件

建议事件：

```text
repo_map_requested
repo_map_built
search_requested
search_completed
search_truncated
file_read_requested
file_slice_captured
evidence_collected
context_pack_built
exploration_budget_exhausted
exploration_blocked
```

每条事件关联：

- task_id、run_id、step_id、action_id；
- workspace_id、revision、generation；
- evidence_id 或 result_id；
- 预算消耗摘要；
- content_hash 或 truncated 标记。

payload 不保存完整文件正文和密钥。
工作台需要正文时，通过 Artifact 授权读取。

## 十三、无进展与重复探索

探索阶段很容易陷入无效循环：

```text
搜索同一 query
  -> 读取同一文件
  -> 再搜索同一 query
```

结合第 8 课收敛规则，至少检测：

1. 相同 query + 相同 roots 的重复检索；
2. 相同 path + 行范围的重复读取；
3. 连续多回合未新增高价值 evidence_id；
4. 命中集合 Jaccard 相似度过高；
5. 上下文 pack_hash 连续相同。

无进展时的合法出路：

- 缩小或转换查询；
- 请求用户补充复现信息；
- 在授权下运行定向测试收集新证据；
- 进入人工接管；
- 明确失败并说明证据缺口。

不要在没有新证据时进入第 17 课“生成补丁”。

## 十四、安全与隐私

探索阶段虽多为只读，仍有风险：

| 风险 | 处理 |
| --- | --- |
| 路径穿越 | 第 9 课规范化与授权根校验 |
| 读取 `.env` / 密钥 | 策略拒绝或只返回“受保护文件” |
| 二进制/超大文件 | 类型检查、大小上限、截断 |
| 依赖目录噪声 | ignore rules |
| 提示注入 | 证据按数据渲染，不提升权限 |
| 跨任务泄露 | workspace_id 与 tenant 强绑定 |
| 日志泄宿主路径 | Adapter 内外路径分离 |

“只读”不等于“可读一切”。
有效范围仍是 TaskSpec 与 Policy 的交集。

## 十五、测试

### 15.1 路径与授权

```python
async def test_search_rejects_path_outside_scope() -> None:
    action = authorize_search(globs=("checkout/../../etc/*",))
    with pytest.raises(AuthorizationError):
        await search_adapter.search(action, action.request)


async def test_read_file_rejects_metadata_dir() -> None:
    request = ReadFileRequest(
        workspace_id="ws_1",
        path="metadata/lease.json",
        line_start=1,
        line_end=20,
        max_bytes=4096,
    )
    with pytest.raises(AuthorizationError):
        await read_file(request, grant=read_grant)
```

### 15.2 证据与 Observation

```python
async def test_successful_read_creates_evidence_ref() -> None:
    result = await harness.advance("task-explore-1")
    assert result.kind.value == "progressed"
    snapshot = await store.load("task-explore-1")
    assert snapshot.context_refs
    evidence = await evidence_store.get_many(snapshot.context_refs)
    assert evidence[0].kind is EvidenceKind.FILE_SLICE
    assert evidence[0].path.startswith("checkout/")
```

### 15.3 上下文预算

```python
def test_context_pack_omits_low_priority_when_over_budget() -> None:
    pack = build_context_pack(
        refs=many_refs(30),
        budget=ContextBudget(max_evidence_items=5, max_chars=2000),
    )
    assert len(pack.included_refs) <= 5
    assert pack.omitted_refs
    assert pack.token_estimate <= 2000
```

### 15.4 必测场景

| 场景 | 必须断言 |
| --- | --- |
| 构建 RepoMap | 只含授权路径，含 ignore 与 revision |
| 检索截断 | truncated=true，不宣称穷尽 |
| 读取大文件 | 截断并保留 hash 与行号 |
| 重复读取 | 去重或计入重复预算 |
| 越权路径 | 拒绝且不产生伪证据 |
| 秘密文件 | 拒绝或红色摘要 |
| 提示注入输出 | 不改变 capability |
| 预算耗尽 | 停止探索，保留已有证据 |
| Worker 重启 | 从 EvidenceStore 恢复，不丢引用 |
| 无进展 | 触发收敛，不进入补丁生成 |

## 十六、与第 15、17 课的衔接

第 15 课的图节点可以把探索做成阶段：

```text
load
  -> explore_repo_map
  -> explore_search
  -> explore_read
  -> pack_context
  -> decide_next
       ├── continue_explore
       ├── plan_change   # 第 17 课
       ├── wait_user
       └── stop
```

进入 `plan_change` 前，至少满足：

1. 存在与当前 revision 匹配的 RepoMap 或等价结构摘要；
2. Observation 中有不少于完成标准要求的 platform_verified 证据；
3. 证据缺口已被显式记录，或已足够支撑变更假设；
4. 探索预算未处于未知/恢复中状态；
5. 任务仍具备后续阶段所需 capability。

第 17 课不得在缺少证据引用的情况下，
仅凭模型自然语言“我已经看过代码”生成补丁计划。

## 十七、常见错误

### 17.1 把模型摘要写进 EvidenceStore

证据必须来自受控工具结果或受控用户输入。
模型总结可以展示，不能冒充 platform_verified。

### 17.2 在任务状态中保存整文件

这会撑爆快照、泄露秘密并破坏预算。
状态只保存 EvidenceRef，正文进 Artifact Store。

### 17.3 允许任意 Shell 作为搜索

探索能力必须是登记过的模板或 Gateway，
否则第 9 至 11 课边界会被一句命令绕过。

### 17.4 忽略 truncated

截断后仍宣称“全仓库无更多结果”，
会导致错误补丁和第 19 课虚假验证。

### 17.5 跨 revision 复用片段

工作区更新、输入快照替换或新 checkout 后，
旧 line_start/line_end 可能指向不同代码。
证据必须绑定 revision 与 content_hash。

### 17.6 无证据就进入改码

探索的完成条件是“足够支持下一步”，
不是“模型已经很有信心”。缺少证据时应继续探索、
询问用户或失败，而不是生成补丁。

### 17.7 ContextBuilder 静默丢弃关键证据

可以省略低优先级证据，但必须记录 omitted_refs，
并在必要时告诉模型“还有未装入的证据引用”。

## 十八、课堂练习

1. 为失败测试定位任务设计最低证据集合：
   RepoMap、检索命中、失败测试文件片段各需要什么字段。
2. 设计 `code.search_text@1` 的 Schema 与拒绝用例，
   覆盖空查询、过大 max_results、越权 glob 和危险正则。
3. 实现一个 EvidenceRef 去重函数，
   以 evidence_id 或 content_hash 为准，写清冲突规则。
4. 给定 20 条证据和较小 Token 预算，
   手写一版选择优先级，并说明为何保留复现相关片段。
5. 构造一段工具输出中的提示注入文本，
   说明 ContextBuilder 应如何包裹并测试“权限未被提升”。
6. 画出探索阶段从 ActionIntent 到 Observation 更新的时序，
   标出预算结算与 Checkpoint 位置。
7. 说明何时可以结束探索进入第 17 课，
   以及“无进展但仍想改代码”应如何拒绝。

## 十九、完成标准

完成本课后，你应该能够：

- 在授权工作区内生成版本化 RepoMap；
- 通过受控检索与读文件能力收集代码命中和片段；
- 将结果保存为 EvidenceRecord，并只把 EvidenceRef 写入任务状态；
- 让 Observation 与 ContextPack 基于证据引用，而非整库拷贝；
- 在多维预算下选择、截断和省略证据；
- 拒绝越权路径、秘密文件和任意 Shell 探索；
- 处理截断、重复探索和无进展；
- 用事件与合同测试证明证据可审计、可恢复；
- 为第 17 课提供带 revision 与哈希的证据输入，而不是模型自述。

## 二十、本课小结

Codebase Agent 的第一件事不是改代码，而是建立可引用的事实。
仓库地图提供导航，受限检索与受控读取产生命中和片段，
EvidenceStore 保存平台确认的证据，Observation 只持有引用，
ContextBuilder 在预算内把证据渲染为不可提升权限的数据块。

探索阶段仍然走 Harness：模型提出意图，Policy 收窄范围，
Gateway 在 Sandbox 边界内执行，结果以证据身份进入任务事实。
截断、重复、无进展和越权都必须是显式状态，
不能被“模型很确定”掩盖。

下一课将使用这些证据制定变更计划、划定影响范围，
并生成可校验的补丁候选；没有证据引用的补丁提案应被拒绝。

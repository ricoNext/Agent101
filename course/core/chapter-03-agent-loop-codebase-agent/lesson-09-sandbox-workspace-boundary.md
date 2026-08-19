# 第 9 课：建立 Sandbox 文件与工作区边界

> 章节导航：[第三章：Agent Loop、State、Harness 与 Codebase Agent](./index.md)  
> 上一课：[第 8 课：实现预算、重复检测与收敛终止](./lesson-08-budget-convergence.md)  
> 下一课：[第 10 课：限制 Sandbox 命令、进程与资源](./lesson-10-sandbox-command-resource-boundary.md)

## 一、你将完成什么

第 8 课限制了 Agent 可以消耗多少回合、Token、工具次数和时间，但“允许执行”还不等于“允许触碰任何文件”。如果模型能把 `../../.ssh/id_rsa`、`/tmp/other-task/output` 或一个指向宿主机目录的符号链接传给文件工具，预算再准确也不能阻止越权读写。

本课为文件类 ToolCall 建立工作区边界。完成后，你应该能够：

1. 区分宿主机路径、Sandbox 根目录、任务工作区和产物地址；
2. 为每个任务分配不可越界的工作区身份、租约和生命周期；
3. 拒绝绝对路径、路径穿越、NUL 字节、跨工作区引用和未授权符号链接；
4. 将读、写、创建、删除、重命名和产物发布拆成不同的策略检查；
5. 使用规范化相对路径和目录句柄，降低符号链接与 TOCTOU 竞态风险；
6. 通过临时写入、校验、哈希和原子提交管理可交付文件；
7. 让 Checkpoint、预算、恢复和并发 Worker 都能理解文件副作用；
8. 用合同测试证明任务无法读取其他租户、写入宿主机或伪造已发布产物。

## 二、本课内容边界

本课只解决一个核心问题：**文件类操作最多能触碰哪些对象，平台如何在每次操作前后证明它没有越过工作区边界。**

本课会完成：

- Sandbox、工作区、输入、暂存区和产物目录的职责划分；
- 工作区创建、挂载、租约、回收和审计元数据；
- 路径解析、规范化、符号链接和目录句柄的安全规则；
- 文件读写、删除、重命名和输出发布的能力策略；
- 原子写入、内容哈希、产物清单和不可变发布；
- 工作区并发、任务重启、Checkpoint 与未知文件副作用的协作；
- Repository、FileGateway 和 ArtifactStore 的最小接口及合同测试。

本课不会展开：

- Shell 命令、子进程、CPU、内存、磁盘配额和执行超时；
- 网络出口、DNS、代理、密钥注入和容器网络；
- Docker、虚拟机或操作系统级的完整进程隔离；
- 代码检索、补丁生成、测试命令和 Codebase Agent 的业务策略；
- 对任意不可信宿主机实现“绝对安全”的承诺。

第 10 课会把本课的文件边界扩展到命令和资源；第 11 课处理网络、密钥和 Sandbox 生命周期。今天先保证文件工具不能借助一个字符串参数突破任务边界。

## 三、为什么“传入一个文件路径”不是文件访问策略

文件工具的原型通常只有下面几行：

```python
async def read_file(path: str) -> str:
    return Path(path).read_text()
```

它把至少八个安全决策隐含在一个字符串中：

1. 这个路径属于哪个租户和任务？
2. 它是宿主机路径，还是 Sandbox 内的相对路径？
3. `..`、多余分隔符和 Unicode 变体如何规范化？
4. 最终路径是否经过符号链接跳到了工作区之外？
5. 调用者是否只有读取权限，还是可以写、删、重命名？
6. 读取的文件是否包含密钥、另一个任务的输入或平台内部状态？
7. 写入是否会覆盖用户原始文件，还是只能写入暂存区？
8. 该文件是否真的成为了交付产物，还是只有模型声称“已生成”？

即使应用层先执行 `Path(root, user_path).resolve()`，也不能自动解决所有问题。解析和实际打开文件之间可能发生符号链接替换；多个 Worker 可能同时操作同一目录；挂载点可能把目录带到另一个文件系统。路径字符串只是请求意图，不能作为授权证明。

文件操作应经过一条可观察的控制链：

```text
任务与租户身份
  -> 工作区引用与租约
  -> 相对路径语法校验
  -> 目标能力与文件策略校验
  -> 在 Sandbox 根目录内解析/打开
  -> 执行受限读写
  -> 记录哈希、大小、版本和事件
  -> 需要交付时进入不可变产物存储
```

平台的保证不是“模型不会写坏文件”，而是：**模型给出的路径和操作必须经过平台重新解释，任何不符合任务能力的请求都在文件系统调用前被拒绝。**

## 四、先定义工作区，而不是先定义路径

### 4.1 工作区的四层对象

一个任务至少需要区分以下对象：

| 对象 | 作用 | 是否可被模型直接命名 | 生命周期 |
| --- | --- | ---: | --- |
| Sandbox 实例 | 提供隔离的文件系统和后续命令运行环境 | 否 | 一次运行或租约周期 |
| Task Workspace | 当前任务专属的根目录和能力集合 | 只能用稳定 `workspace_ref` | 任务生命周期 |
| Staging Area | 生成、校验和比较临时文件 | 只能使用受限相对路径 | 一次 Action 或任务生命周期 |
| Artifact Store | 保存已验证的不可变产物 | 只能用 `artifact_id` | 按保留策略保存 |

模型可以请求 `workspace://task-123/src/app.py` 这样的逻辑引用，但不能得到 `/var/lib/agent/sandboxes/tenant-a/task-123/root/src/app.py` 这种宿主机绝对路径。宿主路径只存在于 Sandbox Adapter 内部，并且不应写入模型消息、事件可见 payload 或用户可提交的工具参数。

推荐的逻辑布局如下：

```text
workspace://<workspace_ref>/
├── inputs/       任务输入的只读快照
├── checkout/     任务允许修改的工作副本
├── scratch/      Action 级临时文件
├── outputs/      等待验证和发布的候选产物
└── metadata/     平台维护的清单，默认不对模型开放
```

`inputs/` 与 `checkout/` 不应只是同一目录的两个别名。只读输入快照用于保证任务证据稳定；可修改副本用于让补丁和测试有明确的回滚范围。`metadata/` 存放租约、策略和内容清单，普通文件工具不应允许访问。

### 4.2 工作区身份必须稳定且不可猜测

工作区引用至少应包含：

- `workspace_id`：随机、不可枚举的稳定身份；
- `tenant_id`：与任务和授权绑定的租户身份；
- `task_id`：工作区归属的任务；
- `sandbox_id`：当前物理运行环境；
- `policy_version`：创建时采用的文件能力策略版本；
- `lease_version`：当前可以写入的租约代次；
- `state`：`provisioning`、`ready`、`frozen`、`releasing` 或 `released`。

不要用用户输入的项目名、仓库名或递增整数作为物理目录名。可预测目录名会放大枚举、日志泄露和跨任务误引用的影响；展示名称应与内部引用分开。

### 4.3 工作区租约与任务租约不是同一件事

第 6 课的任务租约控制谁可以推进任务状态；工作区租约控制谁可以在当前物理目录执行文件副作用。通常它们需要关联，但不应混成一个布尔值：

```text
任务 lease(fence=17)
  -> 允许 Worker 读取当前计划和提交任务事件
工作区 lease(write_fence=9)
  -> 允许同一 Worker 对 checkout/outputs 写入
```

任务恢复后，Worker 可能拿到了新的任务 `fencing_token`，但仍需获得当前 Sandbox 的写租约。旧 Sandbox 已释放或物理目录发生变化时，不能仅凭任务状态继续写入旧路径。写入事件应同时记录两个代次，便于判断迟到 Worker 是任务过期、工作区过期，还是两者都过期。

## 五、工作区生命周期

### 5.1 创建和准备

工作区创建是一个可审计的领域操作，不是 `mkdir()` 后返回字符串。最低流程如下：

```text
校验 TaskSpec 与授权范围
  -> 创建随机 workspace_id 和 sandbox_id
  -> 分配物理根目录与挂载策略
  -> 创建固定目录布局
  -> 写入 workspace manifest 和策略版本
  -> 导入只读输入快照
  -> 计算初始清单和容量
  -> 写 workspace.ready 事件
  -> 允许 FileGateway 提供逻辑文件能力
```

准备阶段失败时，不能把一个半创建目录标记为 `ready`。应进入 `provisioning_failed` 或清理后重试，并保留失败原因和已创建资源的回收记录。

### 5.2 冻结、回收和保留

任务进入 `completed`、`failed`、`cancelled` 或 `budget_exhausted` 后，工作区不应立刻删除。至少需要一个短暂的冻结窗口，让平台：

1. 保存最终清单、日志引用和产物引用；
2. 让 Checkpoint 和任务工作台能够读取最后状态；
3. 完成未决文件操作的对账；
4. 根据保留策略决定保留、压缩或删除。

冻结与删除是不同状态：

```text
ready -> frozen -> releasing -> released
          \-> retained_for_debug
```

`frozen` 表示禁止新的业务写入，但允许只读审查和回收器完成收尾；`released` 表示物理路径和写入令牌都已失效。产物已经发布后，删除工作区不能删除产物存储中的不可变对象。

### 5.3 物理目录不应成为长期身份

Sandbox 可能因重启、迁移或回收被重新创建。工作区身份和产物身份必须独立于物理目录：

```text
workspace_id = ws_01...
sandbox_id   = sb_01...       # 一次运行实例
host_root    = /private/...   # 适配器内部地址，禁止外泄
```

恢复时先根据 `workspace_id` 取得新的 Sandbox Adapter，再校验策略版本、工作区清单和当前 lease；不能从旧 Checkpoint 直接读取 `host_root` 并假定它仍然有效。

## 六、路径边界的最小规则

### 6.1 只接受受限的相对路径

文件工具的用户参数建议定义为 `WorkspacePath`，而不是通用 `str`：

```json
{
  "workspace_ref": "ws_01J...",
  "path": "checkout/src/auth/token.py",
  "operation": "read"
}
```

`path` 的最小规则：

1. 必须是 UTF-8 字符串，拒绝 NUL 字节和不可见控制字符；
2. 必须是相对路径，不接受 `/etc/hosts`、`C:\\Windows\\...` 或 `file://`；
3. 统一分隔符和规范化 `.`，拒绝解析后越过根目录的 `..`；
4. 拒绝空路径、根路径和平台保留名称；
5. 限制组件长度、总长度和组件数量，防止异常输入消耗资源；
6. 明确是否允许 Unicode 规范化，比较和存储使用同一规则；
7. 工具参数中不接受宿主路径、符号链接目标或目录句柄编号。

不要通过“把 `..` 替换为空字符串”净化路径。`a/../secret`、编码后的分隔符和不同平台的分隔符会让字符串替换产生错误的授权结果。应该先解析为路径组件，再根据根目录边界作结构化判断。

### 6.2 物理路径必须留在工作区根内

逻辑路径解析至少需要两个检查：

```text
逻辑相对路径
  -> 词法规范化：不能出现越过根的 ..
  -> 物理解析：真实目标必须位于允许根
  -> 操作类型检查：目标存在性和父目录能力符合策略
  -> 使用安全打开方式执行
```

`resolved.is_relative_to(root)`（或等价判断）可以作为教学版的物理包含检查，但它不能独立抵抗打开前后的符号链接替换。生产实现应优先使用目录句柄、`openat`/`*at` 系列调用、`O_NOFOLLOW` 或操作系统提供的等价能力，并让每一步都在已打开的根目录上下文中完成。

### 6.3 符号链接默认拒绝

符号链接会让“路径文本在根内”与“最终目标在根内”分离。默认策略应为：

- `read`：拒绝跟随工作区内指向根外的链接；
- `write`：拒绝通过链接创建或覆盖目标；
- `rename`：源和目标都必须是允许的直接子树；
- `delete`：只删除链接本身或明确允许的工作区内目标；
- `artifact publish`：清单记录真实文件类型，不把链接伪装成普通文件。

如果业务确实需要链接，应把它定义为受控能力，例如只允许指向同一 `inputs/` 快照的已登记目标，并在打开时再次验证目标身份。不要把“链接目标看起来可信”交给模型判断。

### 6.4 挂载点、特殊文件和设备节点

普通代码仓库通常只需要目录和普通文件。文件 Gateway 应默认拒绝：

- 设备节点、套接字、命名管道和其他特殊文件；
- 工作区根下未经登记的挂载点；
- 递归链接到另一个文件系统的目录；
- 超过大小、深度、文件数或磁盘配额的对象。

这些检查不等同于第 10 课的资源限制，但文件策略必须先把对象类型限制住，否则一个看似合法的递归目录操作就可能把资源问题扩大为宿主机访问问题。

## 七、定义文件能力策略

### 7.1 操作不应只有 `allow: bool`

对每个逻辑工作区目录定义能力矩阵：

| 根 | 读文件 | 创建/覆盖 | 删除/重命名 | 发布产物 | 备注 |
| --- | ---: | ---: | ---: | ---: | --- |
| `inputs/` | 是 | 否 | 否 | 可引用 | 输入快照不可变 |
| `checkout/` | 是 | 受任务授权 | 受任务授权 | 先复制到 `outputs/` | 代码工作副本 |
| `scratch/` | 是 | 是 | 是 | 否 | Action 级临时数据 |
| `outputs/` | 是 | 是 | 受限 | 需验证 | 候选产物暂存区 |
| `metadata/` | 平台内部 | 平台内部 | 平台内部 | 否 | 默认不可见 |

还应把“是否覆盖已有文件”“是否递归操作”“是否可以修改权限或时间戳”单独建模。一次 `write_file` 只能拿到完成该动作所需的最小能力，不应自动获得整棵 `checkout/` 的删除权。

### 7.2 目录能力与文件能力分离

“可以写入 `checkout/src`”不等于“可以创建 `checkout/src/../.env`”。能力判定至少需要：

- 规范化后的目标相对路径；
- 目标所在逻辑根和规则；
- 目标当前类型（不存在、普通文件、目录、链接、特殊文件）；
- 父目录是否允许创建；
- 是否覆盖、删除或重命名；
- 任务授权是否覆盖该路径模式。

以 glob 表示业务范围时，必须把 glob 作为策略输入而非直接交给文件系统。`**/*.py` 只表达业务路径集合，仍需经过根目录解析和文件类型检查。

### 7.3 最小能力对象

可以向 FileGateway 传递不可伪造的 capability，而不是让每个工具重复解析租户和任务：

```python
from dataclasses import dataclass
from typing import FrozenSet


@dataclass(frozen=True)
class WorkspaceCapability:
    workspace_id: str
    task_id: str
    tenant_id: str
    write_fence: int
    allowed_roots: FrozenSet[str]
    operations: FrozenSet[str]
    policy_version: int

    def permits(self, root: str, operation: str) -> bool:
        return root in self.allowed_roots and operation in self.operations
```

这个对象只是进程内的授权快照，不是永久权限。每次有副作用的操作仍应检查工作区状态、租约代次和当前任务取消状态。不要把 capability 序列化后让模型回传，也不要把其中的物理路径字段加入模型上下文。

## 八、实现路径解析器

### 8.1 教学版解析器：先拒绝，再规范化

下面代码演示策略顺序。它适合解释接口和测试，不应被误认为已经解决所有操作系统级竞态：

```python
import re
from dataclasses import dataclass
from pathlib import Path


class WorkspacePathError(ValueError):
    pass


@dataclass(frozen=True)
class ResolvedWorkspacePath:
    workspace_id: str
    logical_path: str
    host_path: Path


def parse_workspace_path(path_text: str) -> tuple[str, ...]:
    if not isinstance(path_text, str):
        raise WorkspacePathError("path must be a string")
    if "\x00" in path_text:
        raise WorkspacePathError("NUL byte is not allowed")
    if not path_text or path_text.startswith(("/", "\\")):
        raise WorkspacePathError("path must be relative")
    if len(path_text) > 512:
        raise WorkspacePathError("path is too long")

    normalized = path_text.replace("\\", "/")
    if re.match(r"^[A-Za-z]:($|/)", normalized):
        raise WorkspacePathError("drive-qualified path is not allowed")
    if re.match(r"^[A-Za-z][A-Za-z0-9+.-]*:", normalized):
        raise WorkspacePathError("URI-like path is not allowed")
    parts: list[str] = []
    for part in normalized.split("/"):
        if part in ("", "."):
            continue
        if part == "..":
            if not parts:
                raise WorkspacePathError("path escapes workspace root")
            parts.pop()
            continue
        if any(ord(char) < 32 for char in part):
            raise WorkspacePathError("control character is not allowed")
        if len(part) > 255:
            raise WorkspacePathError("path component is too long")
        parts.append(part)

    if not parts:
        raise WorkspacePathError("workspace root is not a file path")
    return tuple(parts)


def resolve_for_teaching(
    *, workspace_id: str, host_root: Path, path_text: str
) -> ResolvedWorkspacePath:
    parts = parse_workspace_path(path_text)
    root = host_root.resolve(strict=True)
    candidate = (root / Path(*parts)).resolve(strict=False)
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise WorkspacePathError("resolved path escapes workspace root") from exc
    return ResolvedWorkspacePath(
        workspace_id=workspace_id,
        logical_path="/".join(parts),
        host_path=candidate,
    )
```

这段实现有三个教学重点：

1. 先拒绝绝对路径和越过根的 `..`，减少后续歧义；
2. 用结构化组件拼接，不把用户文本直接交给 Shell 或字符串替换；
3. 物理包含检查只是必要条件，实际打开仍需处理符号链接和竞态。

### 8.2 生产实现的打开边界

Linux/Unix 环境下，生产适配器可以围绕已打开的根目录句柄使用 `openat` 系列能力。示意流程如下：

```text
打开 workspace root 目录句柄
  -> 对每个路径组件使用目录句柄相对查找
  -> 中间目录使用 O_DIRECTORY | O_NOFOLLOW
  -> 最终文件按 read/write/create 规则打开
  -> 拒绝符号链接、特殊文件和越界句柄
  -> 用已打开的 fd 读取或写入
```

Python 标准库在不同平台对这些 flags 的覆盖不同，不能在课程代码中假设所有系统行为一致。适配器应把平台差异封装在 `SandboxFileDriver` 内，由合同测试验证“越界路径被拒绝”和“链接替换不会打开根外文件”。如果运行环境不提供可靠的目录句柄能力，应缩小功能、使用更强的 Sandbox 隔离，或把高风险写操作交给人工，而不是继续依赖字符串检查。

### 8.3 不要把 `realpath` 当成事务

下面的模式仍存在竞态：

```python
target = (root / user_path).resolve()
if root not in target.parents:
    raise PermissionError
target.write_text(content)
```

检查完成后，攻击者或另一个 Worker 仍可能替换父目录中的符号链接。教学环境可以在单线程临时目录中使用它帮助理解边界；生产代码要么使用目录句柄和 `O_NOFOLLOW`，要么把工作区放进独立的操作系统隔离层，并在打开后再次确认对象身份。

## 九、设计 FileGateway：所有文件访问的唯一入口

### 9.1 不让业务工具直接调用 `pathlib`

第二章的 Tool Runtime 应把文件工具路由到一个明确的 Gateway。Codebase Agent、恢复器和清理器也应经过同一入口，避免“正常路径有策略、恢复路径直接删文件”的旁路：

```python
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class FileRead:
    workspace_id: str
    logical_path: str
    content: bytes
    sha256: str
    size: int


@dataclass(frozen=True)
class FileWriteResult:
    workspace_id: str
    logical_path: str
    sha256: str
    size: int
    version: int


class FileGateway(Protocol):
    async def read(
        self, *, capability: WorkspaceCapability, path: str
    ) -> FileRead: ...

    async def write_atomic(
        self,
        *,
        capability: WorkspaceCapability,
        path: str,
        content: bytes,
        expected_sha256: str | None = None,
    ) -> FileWriteResult: ...

    async def remove(
        self, *, capability: WorkspaceCapability, path: str
    ) -> None: ...

    async def rename(
        self,
        *,
        capability: WorkspaceCapability,
        source: str,
        destination: str,
    ) -> None: ...
```

Gateway 的职责包括：

- 读取当前工作区状态和写租约；
- 校验能力、路径、文件类型、大小和策略版本；
- 使用 Sandbox File Driver 执行实际操作；
- 计算内容摘要并记录文件版本；
- 写入 `file.read`、`file.write`、`file.removed` 或 `file.renamed` 事件；
- 在预算账本中结算字节数、文件数等消耗；
- 返回逻辑地址和证据，不返回宿主路径。

Gateway 不负责决定“应该修改哪个业务文件”。那是 Planner 和 Codebase Agent 的职责；Gateway 只负责执行经过授权的文件意图。

### 9.2 读取也需要策略

只读不等于无风险。读取可能泄露密钥、个人信息、其他任务的输入，或消耗大量 Token 和磁盘。读取策略至少应限制：

| 限制 | 例子 |
| --- | --- |
| 路径范围 | 只允许 `inputs/`、`checkout/` 中的声明模式 |
| 文件类型 | 拒绝设备、套接字和未知特殊文件 |
| 单文件大小 | 超过上限返回引用或分页读取，不直接塞进模型 |
| 总字节预算 | 接入第 8 课的读字节/Token 预算 |
| 敏感标记 | 密钥、凭证和内部元数据必须脱敏或拒绝 |
| 版本条件 | 需要时要求内容哈希与计划观察一致 |

大文件读取应返回 `artifact_ref`、片段范围和哈希，让上层决定是否把内容装入模型上下文。文件 Gateway 不应为了方便把整个仓库拼成一个字符串。

### 9.3 写入使用临时文件和原子替换

直接覆盖目标文件有三类问题：进程退出可能留下半个文件；并发 Worker 可能互相覆盖；恢复时无法知道目标到底写到了哪一步。推荐协议：

```text
校验写能力、父目录和 expected_sha256
  -> 在同一工作区的 scratch 临时文件写入
  -> flush + fsync（按持久性策略）
  -> 重新读取并校验大小/哈希
  -> 在目标目录内原子 rename/replace
  -> 记录 file.write committed 事件和新版本
```

`expected_sha256` 是乐观并发条件：如果 Agent 基于旧内容生成补丁，而目标文件已被人工或另一个 Worker 改变，Gateway 应拒绝覆盖并返回 `conflict`，而不是静默丢失修改。原子替换只保证单个文件切换，不代表一组文件的业务变更已经整体提交；多文件变更需要工作区版本或后续补丁协议。

一个教学版的核心逻辑可以写成：

```python
from hashlib import sha256


async def write_atomic(
    *,
    capability: WorkspaceCapability,
    path: str,
    content: bytes,
    expected_sha256: str | None,
) -> FileWriteResult:
    ensure_operation(capability, root="checkout", operation="write")
    resolved = resolve_for_teaching(
        workspace_id=capability.workspace_id,
        host_root=workspace_root(capability.workspace_id),
        path_text=path,
    )
    await ensure_parent_directory_is_allowed(resolved)
    current_hash = await hash_if_exists(resolved)
    if expected_sha256 is not None and current_hash != expected_sha256:
        raise FileConflict(path=resolved.logical_path)

    temp = await create_scratch_file(capability)
    await write_and_fsync(temp, content)
    digest = sha256(content).hexdigest()
    await replace_from_scratch(temp, resolved)
    version = await record_file_commit(
        capability=capability,
        logical_path=resolved.logical_path,
        digest=digest,
        size=len(content),
    )
    return FileWriteResult(
        workspace_id=capability.workspace_id,
        logical_path=resolved.logical_path,
        sha256=digest,
        size=len(content),
        version=version,
    )
```

示例中的 `resolve_for_teaching` 和 `replace_from_scratch` 仍需由平台适配器实现安全打开；业务层不能因为“临时文件 + rename”就跳过根目录和租约校验。

## 十、产物管理：写入文件不等于完成交付

### 10.1 候选文件与不可变产物

Agent 可能在 `outputs/` 中生成一个报告、补丁或测试结果，但这仍只是候选文件。产物发布至少要经过：

```text
生成候选文件
  -> 检查路径和文件类型
  -> 读取并计算 sha256、大小、媒体类型
  -> 校验任务完成标准和发布策略
  -> 写入 ArtifactStore（内容寻址）
  -> 创建 manifest 与来源引用
  -> 追加 artifact.published 事件
  -> 返回 artifact_id，而不是宿主路径
```

只有 `artifact.published` 后，任务交付摘要才能说“产物已生成并可下载”。文件存在、模型输出了文件名或 `write_atomic` 成功，都不能替代发布事件。

### 10.2 产物清单

一个产物清单应能回答“内容是什么、来自哪里、经过什么验证”：

```json
{
  "artifact_id": "art_01J...",
  "task_id": "task_01J...",
  "workspace_id": "ws_01J...",
  "logical_path": "outputs/patch.diff",
  "sha256": "...",
  "size": 1842,
  "media_type": "text/x-diff",
  "source_file_version": 12,
  "created_by_action_id": "action_01J...",
  "verified_by": ["diff_syntax", "scope_check"],
  "visibility": "task_owner",
  "retention_class": "task_delivery"
}
```

清单中的 `logical_path` 用于解释来源，内容寻址的对象地址用于读取实际内容。产物内容一旦发布不可覆盖；生成新版本应创建新的 `artifact_id`，并通过 `supersedes_artifact_id` 表达关系。

### 10.3 产物发布和任务完成的顺序

建议顺序如下：

```text
file.write committed
  -> artifact.candidate_registered
  -> 验证结果全部满足完成标准
  -> artifact.published
  -> task.completed
```

如果发布成功但任务状态提交失败，恢复器应根据幂等 `artifact_id` 补齐任务事实；如果任务先标记完成但产物发布尚未提交，不能在交付摘要中宣称产物可用。两者需要在同一任务恢复协议中清楚区分，而不是依赖日志顺序猜测。

## 十一、把工作区元数据持久化

工作区的物理目录、策略和文件版本不能只放在内存。示例模型可放在 `apps/api/app/agents/workspace/models.py`：

```python
from datetime import datetime
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.agents.persistence.models import Base


class WorkspaceRow(Base):
    __tablename__ = "agent_workspaces"
    __table_args__ = (
        UniqueConstraint("task_id", "workspace_generation", name="uq_task_workspace_generation"),
        CheckConstraint("workspace_generation > 0", name="ck_workspace_generation_positive"),
        CheckConstraint("write_fence >= 0", name="ck_workspace_write_fence"),
    )

    workspace_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("agent_tasks.task_id"), index=True)
    tenant_id: Mapped[str] = mapped_column(String(128), index=True)
    sandbox_id: Mapped[str] = mapped_column(String(64), index=True)
    workspace_generation: Mapped[int] = mapped_column(Integer)
    physical_root_ref: Mapped[str] = mapped_column(String(128))
    policy_version: Mapped[int] = mapped_column(Integer)
    write_fence: Mapped[int] = mapped_column(Integer, default=0)
    state: Mapped[str] = mapped_column(String(32), index=True)
    manifest_ref: Mapped[str | None] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    frozen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class WorkspaceFileRow(Base):
    __tablename__ = "agent_workspace_files"
    __table_args__ = (
        UniqueConstraint("workspace_id", "logical_path", name="uq_workspace_logical_path"),
        CheckConstraint("size_bytes >= 0", name="ck_workspace_file_size"),
        CheckConstraint("version >= 0", name="ck_workspace_file_version"),
    )

    file_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("agent_workspaces.workspace_id"), index=True)
    logical_path: Mapped[str] = mapped_column(String(512))
    file_kind: Mapped[str] = mapped_column(String(32))
    sha256: Mapped[str | None] = mapped_column(String(64))
    size_bytes: Mapped[int] = mapped_column(Integer)
    version: Mapped[int] = mapped_column(Integer, default=0)
    state: Mapped[str] = mapped_column(String(32), index=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

`physical_root_ref` 不是直接暴露给模型的路径，而应是由 Sandbox Adapter 解析的内部引用，必要时还可以是加密或短期有效的句柄。`WorkspaceFileRow` 不是文件系统的唯一真相：文件系统可能在进程崩溃后有未登记的内容，所以恢复时需要用清单和扫描结果对账，并把差异标记为 `unreconciled`，不能静默覆盖数据库记录。

### 11.1 文件版本和内容哈希的关系

`version` 表示工作区内该逻辑路径经历了多少次已提交变化；`sha256` 表示某一版本的内容身份。两者用途不同：

| 字段 | 用途 |
| --- | --- |
| `version` | 乐观并发、观察引用和审计顺序 |
| `sha256` | 内容复用、产物寻址和结果去重 |
| `size_bytes` | 预算、展示和异常检测 |
| `state` | `present`、`deleted`、`unreconciled` 等事实 |

相同哈希可以出现在不同路径和不同任务中；相同路径的新版本也可能内容哈希不变（例如重新写入同样内容），策略要根据业务决定是否记录为有意义的变更。不要仅用文件修改时间判断版本或进展。

## 十二、文件动作的事务与恢复协议

### 12.1 Action 前的文件预检查

第 8 课中的预算预留仍需在文件动作前完成，但还要增加文件边界预检查：

```text
检查任务未取消、计划仍活动
  -> 检查任务 lease 与 workspace write_fence
  -> 检查操作预算（次数、字节、文件数）
  -> 校验 workspace_ref、能力和策略版本
  -> 解析相对路径并检查当前文件版本
  -> 创建 file invocation / action 记录
  -> Checkpoint(kind=workspace_action_accepted)
```

这一步只接受动作，不代表文件已经变化。`file.write.accepted`、`file.write.started` 和 `file.write.committed` 应区分记录；恢复器依靠它们判断是否需要扫描、查询或人工处理。

### 12.2 文件写入中的崩溃分类

| 崩溃位置 | 可确认事实 | 默认恢复 |
| --- | --- | --- |
| 预检查后、临时文件创建前 | 目标未写入 | 可在同一 invocation 内继续或取消 |
| 临时文件写入中 | 目标可能未变，scratch 可能残留 | 校验临时文件，必要时清理；不可直接宣称成功 |
| `fsync` 后、rename 前 | 目标旧版本仍可能存在 | 重新检查目标和临时文件身份 |
| rename 已执行、事件未提交 | 文件可能已变更 | 读取目标哈希，与 invocation 预期匹配后补记或标记未知 |
| 事件和文件版本已提交 | 变更已确认 | 直接从 Checkpoint 继续 |

文件系统调用和数据库提交无法天然组成一个跨系统事务。因此要保存 `invocation_id`、预期哈希、临时文件标识和目标版本，并在恢复时做确定性对账。若一个写入可能已经成功但无法确认，宁可进入 `paused(unknown_file_side_effect)`，也不能为了让任务继续而盲目覆盖一次。

### 12.3 恢复扫描的差异处理

工作区恢复器可以对受控目录生成清单：

```text
读取 workspace manifest
  -> 扫描允许目录中的普通文件元数据
  -> 与 WorkspaceFileRow、未决 invocation 比较
  -> 发现 expected == actual：补记 committed
  -> 发现 expected != actual：记录 conflict
  -> 发现未知文件：按目录策略删除、保留隔离或人工接管
```

扫描只能在已经获得有效工作区租约后进行，并且扫描本身受第 8 课的时间、文件数和字节预算限制。不能让一个损坏的工作区扫描无限递归。

## 十三、并发 Worker 与工作区隔离

### 13.1 同一任务最多一个写者

即使任务状态由 lease 保护，文件操作也应使用写 fence 或目录级锁。并发策略可以选择：

- 同一任务只有一个持有 `write_fence` 的 Worker；
- 只读 Worker 可以并行，但读取必须绑定文件版本或观察版本；
- 不同任务使用不同工作区物理根，禁止共享可写目录；
- 产物发布使用内容寻址对象，不通过共享输出目录互相覆盖。

只读并发也可能产生不一致观察。例如一个 Worker 正在写 `checkout/src/a.py`，另一个 Worker 读取到一半旧、一半新的多文件状态。需要跨文件一致快照时，应从 Checkpoint 绑定的工作区版本或冻结快照读取，而不是假设普通文件读取天然形成事务。

### 13.2 重规划不能隐式换工作区

第 7 课的 `P1 -> P2` 只改变计划图，不自动改变工作区身份。若新计划需要全新 checkout、不同基线或更高写权限，应明确创建新 `workspace_generation`，并记录：

```text
P2.parent_plan_id = P1
P2.source_workspace_id = ws-old
P2.target_workspace_id = ws-new
P2.migration_artifacts = [snapshot-1]
```

旧工作区在迁移完成并对账前不能释放。计划替换不能借机把文件历史清零，也不能让新工作区继承超出 TaskSpec 的写权限。新工作区的输入快照、基线哈希和策略版本必须在 Checkpoint 中留下证据。

### 13.3 读写冲突要有明确结果

当 `expected_sha256` 或文件版本不匹配时，Gateway 返回的是可解释的 `file_conflict`，而不是普通 `tool_failed`：

```text
file_conflict
  -> 记录当前哈希和期望哈希（必要时脱敏）
  -> 不覆盖现有文件
  -> 让 Controller 决定重新读取、重规划或请求人工
```

如果一个 Worker 已经失去写 fence，所有新写入都应失败，即使它的本地路径和内容仍然正确。旧 Worker 的迟到结果不能靠“最后写入获胜”解决。

## 十四、与预算、Checkpoint 和终止状态协作

### 14.1 文件资源也要计入预算

第 8 课列出了回合、Token、工具次数和费用。本课至少为文件操作增加这些可观察维度：

| 维度 | 计量对象 | 超限处理 |
| --- | --- | --- |
| `file_read_bytes` | 从工作区读出的字节数 | 拒绝新读取或返回引用 |
| `file_write_bytes` | 写入暂存和目标的字节数 | 拒绝新写入 |
| `file_count` | 创建、扫描或发布的文件数 | 暂停并缩小范围 |
| `artifact_bytes` | 发布到不可变产物存储的字节数 | 允许清理，拒绝新发布 |
| `workspace_lifetime_ms` | 工作区占用时间 | 冻结、回收或人工续期 |

临时文件写入可能产生两次磁盘字节，但业务预算应明确是按逻辑内容、物理写入还是两者分别计量。不要在恢复时重复结算同一个 `invocation_id`；使用第 8 课的账本幂等键和文件事件身份。

### 14.2 Checkpoint 需要携带工作区游标

与文件动作相关的 Checkpoint 至少保存：

```json
{
  "phase": "workspace_action",
  "workspace_id": "ws_01J...",
  "workspace_generation": 1,
  "write_fence": 9,
  "invocation_id": "file-inv-01J...",
  "logical_path": "checkout/src/auth/token.py",
  "expected_sha256": "...",
  "recovery_strategy": "reconcile_file_hash"
}
```

不要把物理根目录写进 Checkpoint 的用户可见部分。恢复器通过 `workspace_id + generation` 重新查找物理适配器，并验证 `write_fence` 仍有效。若工作区已 `released`，恢复器必须创建新工作区或暂停，不能重新使用旧路径。

### 14.3 预算、取消和未知文件副作用的优先级

终止决策应延续第 8 课的固定优先级：

```text
取消请求
  > 未知文件副作用 / 工作区不一致
  > 已满足完成标准
  > 审批等待或策略拒绝
  > 预算耗尽
  > 重复或无进展
  > 继续执行
```

“未知文件副作用”不能被预算耗尽覆盖。即使任务已经没有工具预算，系统仍可消耗受控的恢复预算去读取目标哈希、冻结工作区和记录人工接管所需的证据；这不等于允许继续执行新的业务写入。

## 十五、产物发布接口与事件

可以把候选文件和不可变产物分开建模：

```python
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ArtifactManifest:
    artifact_id: str
    task_id: str
    workspace_id: str
    logical_path: str
    sha256: str
    size: int
    media_type: str
    source_file_version: int


class ArtifactStore(Protocol):
    async def publish(
        self,
        *,
        task_id: str,
        workspace_id: str,
        logical_path: str,
        content: bytes,
        media_type: str,
        source_file_version: int,
        idempotency_key: str,
    ) -> ArtifactManifest: ...

    async def get(self, *, artifact_id: str) -> bytes: ...
```

`publish` 必须是幂等的：相同 `idempotency_key` 和相同内容返回已有 manifest；同一键但内容不同则返回数据不一致错误。读取产物只接受 `artifact_id`，不接受任意物理 URI。ArtifactStore 可由对象存储、数据库或本地内容寻址目录实现，但都要提供访问范围、哈希和保留策略。

文件事件和产物事件建议至少包括：

| 事件 | 表示的事实 |
| --- | --- |
| `workspace.created` | 工作区身份、策略和初始布局已登记 |
| `workspace.frozen` | 禁止新业务写入 |
| `file.read` | 读取了某逻辑路径的版本和字节摘要 |
| `file.write.accepted` | 写入动作通过预检查并有 invocation 身份 |
| `file.write.committed` | 目标内容和文件版本已确认 |
| `file.conflict` | 期望版本与当前版本不一致 |
| `artifact.candidate_registered` | 候选文件已进入发布校验 |
| `artifact.published` | 不可变产物已可由 artifact_id 读取 |
| `workspace.reconciled` | 崩溃后的文件清单与领域记录完成对账 |
| `workspace.released` | 物理工作区已回收，写入权失效 |

事件 payload 中保存逻辑路径、哈希和引用即可；命令原文、密钥内容和完整文件内容应进入受控存储或脱敏摘要。

## 十六、合同测试

### 16.1 路径拒绝测试

```python
import pytest


@pytest.mark.parametrize(
    "path",
    [
        "/etc/passwd",
        "../../secret",
        "checkout/../../secret",
        "checkout\\..\\secret",
        "checkout/file\x00.txt",
        "file://host/path",
        "",
    ],
)
def test_workspace_path_cannot_escape(path):
    with pytest.raises(WorkspacePathError):
        parse_workspace_path(path)
```

还应覆盖：Windows 驱动器前缀、重复分隔符、Unicode 规范化差异、超长路径、空白控制字符和路径组件保留名。测试不应只断言抛了异常，还应断言没有触发底层 File Driver。

### 16.2 符号链接和竞态测试

```python
async def test_symlink_to_host_file_is_rejected(tmp_path, gateway, capability):
    root = tmp_path / "workspace"
    root.mkdir()
    outside = tmp_path / "outside.txt"
    outside.write_text("secret")
    (root / "checkout").symlink_to(tmp_path, target_is_directory=True)

    with pytest.raises(WorkspacePathError):
        await gateway.read(capability=capability, path="checkout/outside.txt")
```

在支持目录句柄的实现中，还要用并发测试在“检查之后、打开之前”替换链接，断言最终不会读取根外文件。若测试平台无法稳定制造竞态，应至少用专门的 Driver 单元测试和操作系统能力文档说明限制，不能因为普通单元测试通过就声称 TOCTOU 已解决。

### 16.3 能力矩阵测试

```python
async def test_inputs_are_read_only(gateway, read_capability):
    await gateway.read(capability=read_capability, path="inputs/spec.json")

    with pytest.raises(PermissionError):
        await gateway.write_atomic(
            capability=read_capability,
            path="inputs/spec.json",
            content=b"changed",
            expected_sha256=None,
        )
```

必须分别测试：只读输入、checkout 受限写入、scratch 删除、outputs 发布前覆盖、metadata 完全拒绝和跨任务 capability。`operations={"read"}` 不能因为路径在允许根内就自动获得 `delete` 或 `publish`。

### 16.4 原子写入和冲突测试

测试应验证：

1. 写入中进程退出不会留下一个被标记为 committed 的半文件；
2. `expected_sha256` 不匹配时原文件内容保持不变；
3. 同一 invocation 重试不会重复增加文件版本或预算账本；
4. rename 成功而事件提交失败时，恢复器能根据哈希补记或暂停；
5. 写 fence 变化后旧 Worker 的写入被拒绝；
6. 同一目录的并发写入不会让数据库版本倒退。

### 16.5 产物幂等与来源测试

```python
async def test_artifact_publish_is_idempotent(artifact_store):
    first = await artifact_store.publish(
        task_id="task-1",
        workspace_id="ws-1",
        logical_path="outputs/report.md",
        content=b"report",
        media_type="text/markdown",
        source_file_version=4,
        idempotency_key="publish:inv-1",
    )
    second = await artifact_store.publish(
        task_id="task-1",
        workspace_id="ws-1",
        logical_path="outputs/report.md",
        content=b"report",
        media_type="text/markdown",
        source_file_version=4,
        idempotency_key="publish:inv-1",
    )

    assert second.artifact_id == first.artifact_id
    assert second.sha256 == first.sha256
```

还要测试相同幂等键但不同内容会被拒绝；跨任务读取 `artifact_id` 会被拒绝；删除工作区后已发布产物仍可按访问策略读取；任务完成事件之前没有 `artifact.published` 时，交付摘要不能标记产物可用。

### 16.6 工作区恢复测试

构造以下崩溃场景并断言恢复结果：

| 场景 | 预期 |
| --- | --- |
| `file.write.accepted`，无 started | 可继续同一 invocation 或取消 |
| scratch 有临时文件，目标旧哈希不变 | 清理临时文件并重试/取消 |
| 目标哈希等于预期，事件缺失 | 补记 committed，不重复覆盖 |
| 目标哈希不同且无权威结果 | `paused(unknown_file_side_effect)` |
| 工作区已 released，任务仍未终态 | 创建新 generation 或人工恢复 |
| 旧 write_fence 写入迟到 | 拒绝，不改变文件版本 |
| 任务已取消但有未决写入 | 冻结、对账、记录取消，不再新写 |

这些测试需要同时检查文件系统状态、任务事件、WorkspaceFileRow、预算账本和 Checkpoint，不能只断言一个 API 返回值。

## 十七、一次完整的文件边界时间线

继续使用“定位登录测试失败并提出小范围修复”的任务：

```text
v01  创建 task-1，分配 ws-1，写入 inputs/ 和 checkout/ 基线
v02  读取 checkout/src/auth/routes.py，记录 sha256=f1
v03  读取 checkout/tests/login_test.py，记录 sha256=f2
v04  Planner 接受 Action：读取 checkout/config/test.toml
v05  文件读取返回 config-missing，追加 file.read 事件
v06  Planner 生成候选补丁到 scratch/patch.diff
v07  FileGateway 校验只允许写 outputs/，将候选写入 outputs/patch.diff
v08  产物校验发现补丁尝试修改授权范围外文件，拒绝 publish
v09  任务重规划，仍使用 ws-1，但旧候选文件标记为 rejected
v10  新 Action 基于 expected_sha256=f1 修改 checkout/src/auth/token.py
v11  rename 成功后进程退出，数据库只有 file.write.started
v12  恢复器读取目标哈希，发现与预期新哈希一致，补记 file.write.committed
v13  运行验证后发布 artifact-1，记录来源 file_version=3
v14  任务完成，冻结 ws-1，保留 artifact-1
```

如果 v11 后目标哈希无法确定，任务必须暂停并标记 `unknown_file_side_effect`。如果 v10 时文件哈希已经变为 `f3`，Gateway 应返回 `file_conflict`，而不是覆盖人工修改。这个时间线说明文件边界和 Agent Loop 的计划、预算、恢复并不是互相独立的模块。

## 十八、与取消、审批和人工接管协作

### 18.1 取消请求

取消请求被接受后：

- 禁止新的写入 Action、计划修订和产物发布；
- 允许受控读取目标哈希、冻结工作区和生成对账清单；
- 已提交的文件版本和预算使用量不可回滚为零；
- 未开始的 scratch 写入可以释放，已开始的写入必须完成对账；
- 工作区进入 `frozen`，清理交给生命周期回收器；
- 任务事件中记录取消请求和工作区冻结的先后关系。

取消不是删除工作区目录。为了审计和人工恢复，冻结窗口内仍要保留足够的 manifest 和产物引用。

### 18.2 审批边界

覆盖 `checkout/`、删除文件、修改受保护目录或发布外部可见产物都可以要求审批。审批对象应绑定：

```text
task_id + plan_id + action_id + workspace_id + logical_path_pattern + expected_version
```

审批通过后如果工作区代次、文件版本、计划版本或授权策略改变，旧审批不能自动复用。审批只授权声明的路径和操作，不把 `checkout/src/a.py` 的批准扩大为整棵工作区的删除权。

### 18.3 人工接管

以下情况应提供清晰的人工接管入口：

- 文件写入的真实结果未知；
- 工作区清单与数据库记录不一致；
- 文件版本冲突无法由 Agent 自动解决；
- 发现根外链接、特殊文件或策略版本不兼容；
- 产物内容已发布但任务状态提交失败；
- 工作区释放后仍有未终结的任务事实。

人工接管界面应展示逻辑路径、哈希、版本、事件和恢复建议，而不是直接展示宿主根目录并让操作员随意执行 Shell。第 21 课会把这些恢复入口纳入任务工作台。

## 十九、常见错误

| 错误 | 正确处理 |
| --- | --- |
| 让模型传入宿主绝对路径 | 只接受 `workspace_ref + 相对路径` |
| 用 `replace("..", "")` 清理路径 | 解析路径组件并拒绝越根 |
| 只做 `resolve()` 就认为安全 | 结合目录句柄、`O_NOFOLLOW` 或更强隔离 |
| 允许工作区内的所有符号链接 | 默认拒绝，受控登记后再允许 |
| 读写都调用同一个 `open()` 包装 | 按能力、目录、文件类型和操作拆分策略 |
| 直接覆盖目标文件 | scratch 写入、校验后原子替换 |
| 用修改时间判断文件版本 | 使用文件版本、哈希和事件 |
| 写入成功就标记任务完成 | 发布不可变产物并通过完成标准验证 |
| 产物保存为任意 URI | 使用 `artifact_id` 和内容寻址对象 |
| 重规划后继续复用旧工作区写 fence | 重新校验 workspace generation 和 lease |
| 删除工作区时删除已发布产物 | ArtifactStore 与工作区生命周期分离 |
| 恢复时直接重放 `file.write` | 先比较目标哈希、invocation 和写 fence |
| 只记录物理路径日志 | 记录逻辑路径、版本、哈希和策略决策 |
| 只限制文件读取，不限制递归扫描 | 限制深度、文件数、字节数并接入预算 |
| 认为只读不会泄露信息 | 敏感目录、文件大小和内容可见性同样受策略控制 |

## 二十、课堂练习

### 练习一：划分工作区目录

为“解释模块行为”和“提出小范围修复”分别设计 `inputs/`、`checkout/`、`scratch/`、`outputs/` 的能力矩阵。说明：

1. 为什么输入快照不能直接指向开发者的工作目录；
2. 哪些目录允许 Agent 写入，哪些只能由平台写入；
3. 产物发布前还需要哪些哈希和验证证据；
4. 任务取消和预算耗尽时各目录如何冻结和回收；
5. 为什么重规划一般不需要新工作区，但改变基线时必须创建新 generation。

### 练习二：审查路径解析

判断以下路径应当返回什么结果，并说明是词法检查、物理检查还是策略检查拒绝：

```text
checkout/src/auth.py
checkout/../inputs/spec.json
checkout/../../etc/hosts
/tmp/other-task/file
checkout/link-to-secret
outputs/report.md/../patch.diff
checkout\\src\\main.py
```

补充一个测试，证明“先 `resolve` 再 `write_text`”仍可能遭遇符号链接竞态，并说明你会选择目录句柄、特权隔离还是人工接管作为修正。

### 练习三：补齐崩溃恢复决策

给定以下事实，返回 `continue`、`reconcile`、`conflict`、`pause` 或 `release`，并写出需要追加的事件：

1. `file.write.accepted`，没有 `started`，目标哈希未变化；
2. `rename` 已返回成功，但数据库事务回滚，目标哈希等于预期；
3. 目标哈希与预期不同，且旧 Worker 的 write fence 已过期；
4. 工作区已冻结，但 ArtifactStore 中存在未关联 manifest 的对象；
5. 任务已取消，仍有一个 `outputs/` 发布 invocation 未知；
6. 新 Worker 发现旧 Worker 在 `scratch/` 留下一个超出预算的大文件。

要求同时说明哪些动作属于恢复预算，哪些动作禁止继续扩大业务副作用。

### 练习四：评审错误实现

指出下面代码至少十个问题，并给出修正方向：

```python
async def apply_agent_file_call(call):
    path = Path("/var/lib/agent") / call["path"]
    if ".." in str(path):
        raise ValueError("bad path")
    path.write_text(call["content"])
    return {"path": str(path), "ok": True}
```

至少应指出：接受宿主路径、错误净化 `..`、没有任务/租户/工作区身份、没有能力矩阵、没有符号链接防护、没有租约代次、没有 expected hash、没有原子写入、没有文件版本和事件、返回宿主路径、没有预算结算、没有产物发布语义、无法在崩溃后恢复。

## 二十一、完成标准

完成本课后，你应该能够：

- 用逻辑 `workspace_ref` 表达任务工作区，而不是向模型暴露宿主机路径；
- 为 Sandbox、任务工作区、暂存区和产物存储定义不同的身份与生命周期；
- 拒绝绝对路径、路径穿越、NUL 字节、根外符号链接和特殊文件；
- 说明 `resolve()`、目录句柄、`O_NOFOLLOW` 和操作系统隔离各自解决什么问题；
- 为读、写、删除、重命名和发布定义最小能力矩阵；
- 通过 Gateway 统一执行文件策略、租约、版本、哈希和事件记录；
- 使用临时文件与原子替换避免半写入和静默覆盖；
- 用 `artifact_id`、manifest 和内容哈希证明产物来源与不可变性；
- 在 Checkpoint 恢复工作区代次、写 fence、文件版本和未决 invocation；
- 对未知文件副作用、版本冲突、取消和预算耗尽进入可解释状态；
- 用路径、符号链接、并发写入、恢复对账和产物幂等测试证明文件边界有效。

## 二十二、本课小结

Sandbox 文件边界可以浓缩为四个问题：

```text
身份：这个文件属于哪个任务和工作区？
范围：这个逻辑路径能否解析到允许的目录？
能力：当前 Action 有权执行这个读写或发布操作吗？
证据：操作后的内容、版本和产物是否被确认并可恢复？
```

工作区把任务和物理文件系统隔开；路径解析把字符串意图转换为受限逻辑地址；能力矩阵把读写删除发布拆成最小权限；原子写入、哈希和 manifest 把文件变化变成可审计事实。租约、写 fence、预算和 Checkpoint 则保证重启、并发和失败不会把一个迟到的 Worker 变成新的越权写者。

因此，文件工具的成功返回不应只是 `{"ok": true}`，而应能够回答：

1. **在哪个工作区、哪个代次、哪个逻辑路径上完成？**
2. **操作前后文件版本和内容哈希是什么？**
3. **这次变化是否已经进入不可变产物，是否满足交付标准？**
4. **如果进程在中间退出，恢复器如何证明目标状态？**

下一课将继续沿着同一边界处理命令、进程、CPU、内存、磁盘和时间。文件 Gateway 保证“能触碰什么”，资源控制器再保证“能运行多久、消耗多少”。

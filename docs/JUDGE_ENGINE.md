# FalJudge 判题引擎深度解析

> 文件: `server/judge.py` | 行数: ~350 | 测试: 35 用例全覆盖

---

## 目录

1. [设计哲学](#1-设计哲学)
2. [类型系统](#2-类型系统)
3. [语法预检查](#3-语法预检查)
4. [AST Import Filter](#4-ast-import-filter)
5. [Harness 构建器](#5-harness-构建器)
6. [子进程隔离执行](#6-子进程隔离执行)
7. [输出比对算法](#7-输出比对算法)
8. [完整判题流程](#8-完整判题流程)
9. [安全分析](#9-安全分析)
10. [已知局限](#10-已知局限)

---

## 1. 设计哲学

判题引擎遵循三个核心原则：

1. **失败快速（Fail Fast）**：语法错误和危险导入在进入子进程之前就被拦截，不浪费进程资源
2. **最小信任（Least Trust）**：用户代码在隔离的临时文件中运行，主进程只读取 stdout/stderr
3. **严格比对（Strict Comparison）**：类型、值、顺序三者必须完全一致，不做"宽松匹配"

### 为什么不复用旧 judge-engine？

旧 `judge-engine/judge/engine.py` 是 stdio 优先设计的，core_code 模式是后期追加的。新引擎从接口到实现都围绕 core_code 模式设计，stdio 作为兼容路径保留。此外，旧引擎已被删除，选择重写而非恢复。

---

## 2. 类型系统

### 2.1 判定状态枚举

```python
class JudgeStatus(Enum):
    ACCEPTED = "Accepted"                    # 所有用例通过
    WRONG_ANSWER = "Wrong Answer"            # 返回值不匹配
    TIME_LIMIT_EXCEEDED = "Time Limit Exceeded"  # 超时
    RUNTIME_ERROR = "Runtime Error"          # 运行异常
    SYNTAX_ERROR = "Syntax Error"            # 语法错误（新增）
```

相比旧系统新增 `SYNTAX_ERROR`——语法错误在提交前由 `ast.parse()` 捕获，不进入子进程。

### 2.2 结果数据结构

```python
@dataclass
class CaseResult:
    case_id: int          # 用例编号 (1-indexed)
    passed: bool          # 是否通过
    runtime_ms: float     # 运行耗时 (毫秒)
    input_display: str    # 输入展示 (JSON 或原始文本)
    expected: str         # 期望输出 (隐藏用例时为空)
    actual: str           # 实际输出
    error: str            # 错误信息 (RE/TLE 时填充)

@dataclass
class JudgeResult:
    status: JudgeStatus   # 最终判定
    passed: int           # 通过用例数
    total: int            # 总用例数
    max_runtime_ms: float # 最大运行耗时
    cases: list           # CaseResult 列表
    error: str            # 全局错误信息 (SE/ImportError 时)
```

### 2.3 力扣风格结果规则

| 规则 | 实现位置 | 说明 |
|------|---------|------|
| 隐藏用例不暴露答案 | `judge()` loop | `is_hidden=true` 时 expected 字段置空 |
| WA 只显示首个失败 case | `judge()` loop | 第一个非隐藏 WA 后 `break` |
| AC 显示用时 | `format_result()` | `max_runtime_ms` 显示运行耗时 |
| SE 不进入子进程 | `judge()` 入口 | `check_syntax()` 在 `_run_subprocess()` 之前 |

---

## 3. 语法预检查

### 实现

```python
def check_syntax(code: str) -> str | None:
    try:
        ast.parse(code)
        return None
    except SyntaxError as e:
        return f"SyntaxError: {e.msg} (line {e.lineno}, col {e.offset})"
```

### 设计考量

- 使用 `ast.parse()` 而非 `compile()` — AST 解析更快且不会触发任何代码执行
- 返回 `str | None` 而非抛异常 — 调用方可以直接判断是否有错误，无需 try/except
- 错误信息包含行号和列号 — 帮助用户在 Monaco 编辑器中定位

### 为什么需要预检查？

如果让语法错误的代码进入子进程，Python 解释器会立即退出（返回非零 exit code），但错误信息不够友好。预检查能：
1. 提供更精确的错误位置
2. 避免不必要的子进程创建
3. 区分 Syntax Error 和 Runtime Error

---

## 4. AST Import Filter

### 封禁模块策略

判题引擎通过静态 AST 分析拦截危险模块导入。封禁 20+ 个模块：

```python
_BLOCKED_MODULES = frozenset({
    # 系统操作
    'os', 'subprocess', 'signal', 'shutil',
    # 网络
    'socket', 'asyncio',
    # 并发/进程
    'multiprocessing', 'threading', 'concurrent',
    # 文件系统
    'pathlib', 'glob', 'fnmatch', 'tempfile',
    # 序列化/代码注入
    'pickle', 'shelve', 'marshal',
    # 动态代码执行
    'code', 'codeop', 'compileall', 'py_compile',
    # 内置命名空间篡改
    'builtins', '__builtins__',
    # 动态导入
    'importlib', 'pkgutil', 'runpy',
    # C 扩展（绕过 Python 层面的所有检查）
    'ctypes',
})
```

### AST 遍历逻辑

```python
def _check_imports(code: str) -> str | None:
    tree = ast.parse(code)
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                name = alias.name.split('.')[0]  # "os.path" → "os"
                if name in _BLOCKED_MODULES:
                    return f"Forbidden import: '{alias.name}'"
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                name = node.module.split('.')[0]
                if name in _BLOCKED_MODULES:
                    return f"Forbidden import: 'from {node.module} import ...'"
    return None
```

### 覆盖范围与局限

| 攻击向量 | 是否拦截 | 说明 |
|---------|---------|------|
| `import os` | ✅ | `ast.Import` 节点 |
| `from os import system` | ✅ | `ast.ImportFrom` 节点 |
| `import os.path` | ✅ | split('.')[0] → "os" |
| `__import__('os')` | ❌ | 函数调用，非 AST 声明 |
| `exec('import os')` | ❌ | 字符串参数，静态分析不可达 |
| `eval('__import__("os")')` | ❌ | 同上 |

**结论：** AST filter 提供针对常见导入攻击的有效防护，但不能替代容器级沙箱。对本地个人工具而言足够安全。

---

## 5. Harness 构建器

### 5.1 Core Code 模式

#### 用户代码格式

```python
class Solution:
    def methodName(self, param1: Type1, param2: Type2) -> ReturnType:
        # 用户实现
        return result
```

#### 系统包装后的代码

```python
{user_code}

import json as _json, sys as _sys, traceback as _tb
try:
    _sol = Solution()
    _args = _json.loads(_sys.stdin.buffer.read().decode())
    _result = _sol.methodName(*_args)
    print(_json.dumps(_result, ensure_ascii=False))
except Exception as _e:
    _tb.print_exc(file=_sys.stderr)
    _sys.exit(1)
```

#### 关键设计决策

| 决策 | 理由 |
|------|------|
| `_json` 前缀 | 避免与用户代码中的变量名冲突（`json`, `sys`, `tb` 是常见变量名） |
| `_sys.stdin.buffer.read().decode()` | Windows 兼容：避免 stdin 编码问题 |
| `*_args` 位置参数解包 | test_case.input 必须是 JSON 数组，按位置传递给方法 |
| `_sys.exit(1)` on exception | 明确告诉主进程"失败了"，与超时区分（exit code = -1） |
| `ensure_ascii=False` | 支持中文等非 ASCII 字符的返回值 |

### 5.2 Stdio 模式（兼容）

```python
def _build_stdio_harness(code: str) -> str:
    return code  # 直接运行，用户代码自己处理 I/O
```

Stdio 模式不做任何包装——用户代码应当包含完整的读取和打印逻辑。这是为了向后兼容 635 道旧题。

---

## 6. 子进程隔离执行

### 实现

```python
def _run_subprocess(code: str, stdin_text: str, timeout: float):
    tmp = tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", delete=False, encoding="utf-8"
    )
    try:
        tmp.write(code)
        tmp.close()  # 关闭文件句柄，Windows 上子进程才能读取

        start = time.perf_counter()
        proc = subprocess.Popen(
            [sys.executable, tmp.name],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        try:
            stdout, stderr = proc.communicate(input=stdin_text, timeout=timeout)
            runtime = (time.perf_counter() - start) * 1000
            return stdout or "", stderr or "", proc.returncode, runtime
        except subprocess.TimeoutExpired:
            proc.kill()           # Windows: TerminateProcess
            proc.communicate()    # 回收僵尸进程
            runtime = (time.perf_counter() - start) * 1000
            return "", "Time Limit Exceeded", -1, runtime
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass  # 文件已被删除或仍被占用（非关键）
```

### 关键设计

| 设计点 | 实现 | 原因 |
|--------|------|------|
| tempfile 而非内存 | `NamedTemporaryFile` | 代码可能很长（几百行），内存文件不可靠 |
| `delete=False` | 手动管理生命周期 | Windows 上子进程需要文件存在才能读取 |
| `text=True` | Popen 的文本模式 | 自动处理编码，简化 stdout/stderr 处理 |
| `perf_counter()` | 高精度计时 | 毫秒级精度，不受系统时间调整影响 |
| `proc.kill()` on timeout | TerminateProcess on Windows | 确保子进程及其子进程被终止 |
| `finally: os.unlink` | 保证清理 | 即使超时或异常也删除临时文件 |

### 超时处理时序

```
时间轴 →
──────────────────────────────────────────────────────>

[Popen]──────────────────[communicate(timeout=2.0)]─────
  │                        │                    │
  │                        │              timeout fired
  │                        │                    │
  │                        │            proc.kill()
  │                        │            proc.communicate() (reap)
  │                        │            os.unlink(tmp)
  │                        │            return ("", "TLE", -1, runtime)
  │                        │
  │              [正常完成路径]
  │              return (stdout, stderr, rc, runtime)
```

---

## 7. 输出比对算法

### 归一化函数

```python
def normalize(value: Any) -> str:
    if not isinstance(value, str):
        value = str(value)
    return value.strip().replace("\r\n", "\n").replace("\r", "\n")
```

### 值匹配函数

```python
def values_match(actual: Any, expected: Any) -> bool:
    # 1. 类型必须完全相同
    if type(actual) != type(expected):
        return False

    # 2. Float: epsilon 容差
    if isinstance(actual, float):
        return abs(actual - expected) < 1e-9

    # 3. List: 长度 + 逐个元素递归比较
    if isinstance(actual, list):
        if len(actual) != len(expected):
            return False
        return all(values_match(a, e) for a, e in zip(actual, expected))

    # 4. Dict: 键集合 + 逐个值递归比较
    if isinstance(actual, dict):
        if set(actual.keys()) != set(expected.keys()):
            return False
        return all(values_match(actual[k], expected[k]) for k in actual)

    # 5. 标量: 直接 ==
    return actual == expected
```

### 比对示例

```python
# ✅ 通过
values_match(42, 42)                                    # int == int
values_match([1, 2, 3], [1, 2, 3])                     # list order match
values_match({"a": 1, "b": [2, 3]}, {"a": 1, "b": [2, 3]})  # nested
values_match(3.141592653589793, 3.141592653589794)     # float epsilon

# ❌ 失败
values_match(42, 42.0)              # int ≠ float (类型不同)
values_match([1, 2, 3], [3, 2, 1])   # 顺序敏感
values_match({"a": 1}, {"a": 1, "b": 2})  # 键数量不同
values_match(3.14, 3.15)            # 浮点差异超过 1e-9
```

---

## 8. 完整判题流程

```
judge(code, config)
│
├─ 1. 读取 config
│     mode = config.get("mode", "stdio")
│     method = config.get("method", "solve")
│     time_limit = config.get("time_limit", 2.0)
│     test_cases = config.get("test_cases", [])
│
├─ 2. 语法预检查 ──────────────────┐
│     err = check_syntax(code)      │ SyntaxError?
│     if err: return SYNTAX_ERROR  ─┤→ 返回 JudgeResult(SE)
│                                    │
├─ 3. 导入安全检查 ─────────────────┐
│     err = _check_imports(code)    │ Forbidden import?
│     if err: return RUNTIME_ERROR ─┤→ 返回 JudgeResult(RE)
│                                    │
├─ 4. 逐用例循环
│     for i, case in enumerate(test_cases):
│     │
│     ├─ 4a. 构建 harness
│     │     if mode == "core_code":
│     │         harness = _build_core_code_harness(code, method, case)
│     │         stdin = json.dumps(case["input"])
│     │     else:
│     │         harness = _build_stdio_harness(code)
│     │         stdin = case["input"]
│     │
│     ├─ 4b. 子进程执行
│     │     stdout, stderr, rc, rt = _run_subprocess(harness, stdin, timeout)
│     │
│     ├─ 4c. 判定
│     │     if rc == -1 (TLE):
│     │         → TIME_LIMIT_EXCEEDED
│     │     elif rc != 0:
│     │         → RUNTIME_ERROR (显示 stderr)
│     │     else:
│     │         actual = json.loads(stdout)   # core_code
│     │            or normalize(stdout)       # stdio
│     │         if values_match(actual, expected):
│     │             → case PASS
│     │         else:
│     │             → WRONG_ANSWER
│     │
│     └─ 4d. 提前退出检查
│           if WA and not case["is_hidden"]:
│               break  # 力扣风格：首个可见失败即停止
│
└─ 5. 返回
      return JudgeResult(status, passed, total, max_runtime, cases, error)
```

---

## 9. 安全分析

### 9.1 攻击面评估

```
┌────────────────────────────────────────────────────┐
│                    攻击面                           │
├──────────────┬─────────────────────┬───────────────┤
│  向量         │  防护               │  残余风险     │
├──────────────┼─────────────────────┼───────────────┤
│ import os    │ AST filter 拦截     │ 无            │
│ import ctypes│ AST filter 拦截     │ 无            │
│ __import__() │ 不拦截              │ 中 (函数调用) │
│ exec()/eval()│ 不拦截              │ 中 (字符串)   │
│ 死循环        │ subprocess timeout  │ 无            │
│ 内存炸弹      │ 无限制              │ 低 (OS管理)  │
│ 磁盘写满      │ tempfile (系统临时) │ 低 (OS管理)  │
│ 网络访问      │ AST filter 拦 socket│ 低            │
│ 读题目文件    │ tempfile 隔离       │ 无            │
└──────────────┴─────────────────────┴───────────────┘
```

### 9.2 安全评级

| 维度 | 评级 | 说明 |
|------|------|------|
| 代码隔离 | ⭐⭐⭐⭐ | 独立进程 + 临时文件 |
| 导入拦截 | ⭐⭐⭐ | AST 静态分析，不覆盖动态调用 |
| 资源限制 | ⭐⭐ | 超时控制，无内存/磁盘限制 |
| 网络隔离 | ⭐⭐⭐ | socket/asyncio封禁，无网络策略 |
| 整体 | ⭐⭐⭐ | 适合本地个人工具，不适合公开判题服务 |

---

## 10. 已知局限

| 局限 | 影响 | 修复方向 |
|------|------|---------|
| `__import__()` 可绕过 AST filter | 恶意代码可导入危险模块 | 运行时 `sys.modules` 检查 |
| `exec()` / `eval()` 不可检测 | 代码可动态执行任意字符串 | 正则匹配 `exec(` / `eval(` 调用 |
| 无内存限制 | 恶意代码可分配大量内存导致 OOM | `resource.setrlimit()` (Linux) / `Job Objects` (Windows) |
| 无磁盘限制 | tempfile 可能被写满 | 预分配固定大小临时目录 |
| Windows 专有进程管理 | `TerminateProcess` 不跨平台 | 用 `psutil` 替代 `os.kill` |

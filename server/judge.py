"""
FalJudge — Python 判题引擎
支持 core_code (LeetCode 模式) 和 stdio (ACM 模式)。
核心代码模式：用户写 class Solution 函数，系统自动传参、调用、比对返回值。
"""
import ast
import json
import os
import subprocess
import sys
import tempfile
import time
import traceback
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


# ═══════════════════════════════════════════════════════════════
# Types
# ═══════════════════════════════════════════════════════════════

class JudgeStatus(Enum):
    ACCEPTED = "Accepted"
    WRONG_ANSWER = "Wrong Answer"
    TIME_LIMIT_EXCEEDED = "Time Limit Exceeded"
    RUNTIME_ERROR = "Runtime Error"
    SYNTAX_ERROR = "Syntax Error"


@dataclass
class CaseResult:
    case_id: int
    passed: bool
    runtime_ms: float
    input_display: str = ""
    expected: str = ""
    actual: str = ""
    error: str = ""


@dataclass
class JudgeResult:
    status: JudgeStatus
    passed: int
    total: int
    max_runtime_ms: float
    cases: list = field(default_factory=list)
    error: str = ""


# ═══════════════════════════════════════════════════════════════
# AST Import Filter — block dangerous modules
# ═══════════════════════════════════════════════════════════════

_BLOCKED_MODULES = frozenset({
    'os', 'subprocess', 'socket', 'ctypes', 'shutil', 'signal',
    'multiprocessing', 'threading', 'concurrent', 'asyncio',
    'pathlib', 'glob', 'fnmatch', 'tempfile',
    'pickle', 'shelve', 'marshal',
    'code', 'codeop', 'compileall', 'py_compile',
    'builtins', '__builtins__',
    'importlib', 'pkgutil', 'runpy',
})


def _check_imports(code: str) -> str | None:
    """Scan AST for dangerous imports. Returns error message or None."""
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return None  # Syntax error handled separately

    for node in ast.walk(tree):
        # import X
        if isinstance(node, ast.Import):
            for alias in node.names:
                name = alias.name.split('.')[0]
                if name in _BLOCKED_MODULES:
                    return f"Forbidden import: '{alias.name}' — module not allowed for security reasons"
        # from X import Y
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                name = node.module.split('.')[0]
                if name in _BLOCKED_MODULES:
                    return f"Forbidden import: 'from {node.module} import ...' — module not allowed"

    return None


# ═══════════════════════════════════════════════════════════════
# Syntax check
# ═══════════════════════════════════════════════════════════════

def check_syntax(code: str) -> str | None:
    """Check Python syntax with ast.parse. Returns error string or None."""
    try:
        ast.parse(code)
        return None
    except SyntaxError as e:
        return f"SyntaxError: {e.msg} (line {e.lineno}, col {e.offset})"


# ═══════════════════════════════════════════════════════════════
# Value normalization & comparison
# ═══════════════════════════════════════════════════════════════

def normalize(value: Any) -> str:
    """Normalize output: strip, normalize line endings, convert to string."""
    if not isinstance(value, str):
        value = str(value)
    return value.strip().replace("\r\n", "\n").replace("\r", "\n")


def _json_serialize(value: Any) -> str:
    """Serialize to JSON string (handles Python types)."""
    return json.dumps(value, ensure_ascii=False)


def values_match(actual: Any, expected: Any) -> bool:
    """Strict value comparison: type + value + order must all match.

    For floats, uses a small epsilon tolerance (1e-9).
    """
    # Both must be exact same type
    if type(actual) != type(expected):
        return False

    # Float comparison with epsilon
    if isinstance(actual, float):
        return abs(actual - expected) < 1e-9

    # List: order-sensitive, element-wise comparison
    if isinstance(actual, list):
        if len(actual) != len(expected):
            return False
        return all(values_match(a, e) for a, e in zip(actual, expected))

    # Dict: key-by-key comparison
    if isinstance(actual, dict):
        if set(actual.keys()) != set(expected.keys()):
            return False
        return all(values_match(actual[k], expected[k]) for k in actual)

    # Scalars: direct comparison
    return actual == expected


# ═══════════════════════════════════════════════════════════════
# Harness builders
# ═══════════════════════════════════════════════════════════════

def _build_core_code_harness(code: str, method: str, case: dict) -> str:
    """Wrap user Solution class into executable script.

    User code:
        class Solution:
            def methodName(self, param1, param2):
                return result

    Generated harness:
        {user_code}
        import json, sys, traceback
        sol = Solution()
        args = json.loads(sys.stdin.read())
        result = sol.methodName(*args)
        print(json.dumps(result))
    """
    inp = json.dumps(case["input"], ensure_ascii=False)
    return (
        f"{code}\n\n"
        f"import json as _json, sys as _sys, traceback as _tb\n"
        f"try:\n"
        f"    _sol = Solution()\n"
        f"    _args = _json.loads(_sys.stdin.buffer.read().decode())\n"
        f"    _result = _sol.{method}(*_args)\n"
        f"    print(_json.dumps(_result, ensure_ascii=False))\n"
        f"except Exception as _e:\n"
        f"    _tb.print_exc(file=_sys.stderr)\n"
        f"    _sys.exit(1)\n"
    )


def _build_stdio_harness(code: str) -> str:
    """For stdio mode, user code already handles I/O — run it directly."""
    return code


# ═══════════════════════════════════════════════════════════════
# Subprocess execution
# ═══════════════════════════════════════════════════════════════

def _run_subprocess(code: str, stdin_text: str, timeout: float) -> tuple[str, str, int, float]:
    """Run Python code in isolated subprocess.

    Returns (stdout, stderr, returncode, runtime_ms).
    On Windows, uses subprocess.Popen + TerminateProcess for reliable cleanup.
    """
    tmp = tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", delete=False, encoding="utf-8"
    )
    try:
        tmp.write(code)
        tmp.close()

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
            # Kill the process group on timeout
            proc.kill()
            proc.communicate()  # reap the process
            runtime = (time.perf_counter() - start) * 1000
            return "", "Time Limit Exceeded", -1, runtime
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


# ═══════════════════════════════════════════════════════════════
# Main judge function
# ═══════════════════════════════════════════════════════════════

def judge(code: str, problem_config: dict) -> JudgeResult:
    """Main entry point — auto-selects mode and judges all test cases.

    problem_config format:
        {
            "mode": "stdio" | "core_code",
            "method": "methodName",         # core_code only
            "time_limit": 2.0,              # seconds
            "test_cases": [
                {"input": ..., "expected_output": ..., "is_hidden": false},
                ...
            ]
        }
    """
    mode = problem_config.get("mode", "stdio")
    method = problem_config.get("method", "solve")
    time_limit = problem_config.get("time_limit", 2.0)
    test_cases = problem_config.get("test_cases", [])

    # 1. Check syntax first (both modes)
    syntax_err = check_syntax(code)
    if syntax_err:
        return JudgeResult(
            status=JudgeStatus.SYNTAX_ERROR,
            passed=0,
            total=len(test_cases),
            max_runtime_ms=0,
            error=syntax_err,
        )

    # 2. Check dangerous imports
    import_err = _check_imports(code)
    if import_err:
        return JudgeResult(
            status=JudgeStatus.RUNTIME_ERROR,
            passed=0,
            total=len(test_cases),
            max_runtime_ms=0,
            error=import_err,
        )

    total = len(test_cases)
    result = JudgeResult(status=JudgeStatus.ACCEPTED, passed=0, total=total, max_runtime_ms=0)

    for i, case in enumerate(test_cases):
        # Build harness based on mode
        if mode == "core_code":
            harness = _build_core_code_harness(code, method, case)
            stdin = json.dumps(case["input"], ensure_ascii=False)
        else:
            harness = _build_stdio_harness(code)
            stdin = case["input"]

        # Display representations
        inp_disp = json.dumps(case["input"], ensure_ascii=False) if mode == "core_code" else case["input"].strip()
        expected_disp = json.dumps(case["expected_output"], ensure_ascii=False) if mode == "core_code" else case["expected_output"]

        cr = CaseResult(
            case_id=i + 1,
            passed=False,
            runtime_ms=0,
            input_display=inp_disp,
            expected=expected_disp,
        )

        stdout, stderr, rc, rt = _run_subprocess(harness, stdin, time_limit)
        cr.runtime_ms = round(rt, 2)
        result.max_runtime_ms = max(result.max_runtime_ms, rt)

        if rc == -1 and "Time Limit Exceeded" in stderr:
            cr.error = "Time Limit Exceeded"
            result.status = JudgeStatus.TIME_LIMIT_EXCEEDED
        elif rc != 0:
            cr.error = stderr.strip()
            result.status = JudgeStatus.RUNTIME_ERROR
            result.error = stderr.strip()
        else:
            # Parse actual output and compare
            actual_str = normalize(stdout)
            expected_val = case["expected_output"]

            if mode == "core_code":
                try:
                    actual_val = json.loads(actual_str)
                except json.JSONDecodeError:
                    cr.error = f"输出不是有效 JSON: {actual_str[:200]}"
                    cr.actual = actual_str
                    result.status = JudgeStatus.RUNTIME_ERROR
                    result.cases.append(cr)
                    continue
                cr.actual = json.dumps(actual_val, ensure_ascii=False)
            else:
                actual_val = actual_str
                expected_val = normalize(str(expected_val))  # normalize expected for stdio too
                cr.actual = actual_str

            if values_match(actual_val, expected_val):
                cr.passed = True
                result.passed += 1
            else:
                result.status = JudgeStatus.WRONG_ANSWER

        result.cases.append(cr)

        # Stop at first visible WA
        if result.status == JudgeStatus.WRONG_ANSWER and not case.get("is_hidden"):
            break

    return result


# ═══════════════════════════════════════════════════════════════
# Formatting
# ═══════════════════════════════════════════════════════════════

def format_result(result: JudgeResult, verbose: bool = False) -> str:
    """Format judge result as readable text."""
    icon = {
        JudgeStatus.ACCEPTED: "[AC]",
        JudgeStatus.WRONG_ANSWER: "[WA]",
        JudgeStatus.TIME_LIMIT_EXCEEDED: "[TLE]",
        JudgeStatus.RUNTIME_ERROR: "[RE]",
        JudgeStatus.SYNTAX_ERROR: "[SE]",
    }

    lines = [
        f"{icon.get(result.status, '??')} {result.status.value}",
        f"   通过: {result.passed}/{result.total}  |  最大耗时: {result.max_runtime_ms:.2f} ms",
    ]

    if result.error:
        lines.append(f"   错误信息:\n{result.error[:300]}")

    if verbose:
        for c in result.cases:
            if c.passed:
                lines.append(f"   Case #{c.case_id} PASS  ({c.runtime_ms:.2f}ms)")
            else:
                lines.append(f"   Case #{c.case_id} FAIL  ({c.runtime_ms:.2f}ms)")
                if c.input_display:
                    lines.append(f"      输入: {c.input_display[:200]}")
                if c.expected:
                    lines.append(f"      期望: {c.expected[:200]}")
                if c.actual:
                    lines.append(f"      实际: {c.actual[:200]}")
                if c.error:
                    lines.append(f"      错误: {c.error[:200]}")

    return "\n".join(lines)

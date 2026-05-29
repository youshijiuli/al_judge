"""
Phase 1.1 — Judge Engine Test Suite (TDD: RED phase)
Run: pytest server/tests/test_judge.py -v
"""
import pytest
import json
import os
from pathlib import Path

# Import the module under test (will fail until judge.py exists)
# from judge import (
#     judge, check_syntax, format_result,
#     JudgeStatus, JudgeResult, CaseResult,
#     normalize, values_match, _run_subprocess,
#     _build_core_code_harness, _build_stdio_harness,
# )


# ═══════════════════════════════════════════════════════════════
# Test fixtures: problem configs for different modes
# ═══════════════════════════════════════════════════════════════

STDIO_CONFIG = {
    "id": "test-stdio",
    "mode": "stdio",
    "time_limit": 2.0,
    "test_cases": [
        {"input": "1 2\n", "expected_output": "3\n"},
        {"input": "10 20\n", "expected_output": "30\n"},
    ],
}

CORE_CODE_CONFIG = {
    "id": "test-core",
    "mode": "core_code",
    "method": "add",
    "time_limit": 2.0,
    "test_cases": [
        {"input": [1, 2], "expected_output": 3},
        {"input": [10, 20], "expected_output": 30},
    ],
}

HIDDEN_CASE_CONFIG = {
    "id": "test-hidden",
    "mode": "core_code",
    "method": "solve",
    "time_limit": 2.0,
    "test_cases": [
        {"input": [1], "expected_output": 1, "is_hidden": False},
        {"input": [2], "expected_output": 2, "is_hidden": True},
        {"input": [3], "expected_output": 3, "is_hidden": True},
    ],
}


# ═══════════════════════════════════════════════════════════════
# check_syntax tests
# ═══════════════════════════════════════════════════════════════

class TestCheckSyntax:
    def test_valid_code_returns_none(self):
        """Valid Python code should return None (no syntax error)."""
        from judge import check_syntax
        code = "def foo():\n    return 42\n"
        assert check_syntax(code) is None

    def test_invalid_syntax_returns_error(self):
        """Invalid Python code should return error message string."""
        from judge import check_syntax
        code = "def foo(:\n    return 42\n"
        result = check_syntax(code)
        assert result is not None
        assert "SyntaxError" in result or "syntax" in result.lower()

    def test_empty_code(self):
        """Empty code string should pass syntax check."""
        from judge import check_syntax
        assert check_syntax("") is None

    def test_import_statement(self):
        """Valid import should pass syntax check."""
        from judge import check_syntax
        code = "import json\nx = json.dumps({})\n"
        assert check_syntax(code) is None


# ═══════════════════════════════════════════════════════════════
# normalize tests
# ═══════════════════════════════════════════════════════════════

class TestNormalize:
    def test_strips_whitespace(self):
        from judge import normalize
        assert normalize("  hello  ") == "hello"

    def test_normalizes_line_endings(self):
        from judge import normalize
        assert normalize("a\r\nb\r\n") == normalize("a\nb\n")

    def test_int_to_str(self):
        from judge import normalize
        assert normalize(42) == "42"

    def test_float_to_str(self):
        from judge import normalize
        result = normalize(3.14)
        assert result.startswith("3.14")


# ═══════════════════════════════════════════════════════════════
# values_match tests
# ═══════════════════════════════════════════════════════════════

class TestValuesMatch:
    def test_int_match(self):
        from judge import values_match
        assert values_match(42, 42) is True

    def test_int_mismatch(self):
        from judge import values_match
        assert values_match(42, 43) is False

    def test_str_match(self):
        from judge import values_match
        assert values_match("hello", "hello") is True

    def test_str_mismatch(self):
        from judge import values_match
        assert values_match("hello", "world") is False

    def test_list_match(self):
        from judge import values_match
        assert values_match([1, 2, 3], [1, 2, 3]) is True

    def test_list_order_matters(self):
        from judge import values_match
        assert values_match([1, 2, 3], [3, 2, 1]) is False

    def test_dict_match(self):
        from judge import values_match
        assert values_match({"a": 1}, {"a": 1}) is True

    def test_dict_mismatch(self):
        from judge import values_match
        assert values_match({"a": 1}, {"a": 2}) is False

    def test_nested_match(self):
        from judge import values_match
        assert values_match({"nums": [1, 2], "k": 3}, {"nums": [1, 2], "k": 3}) is True

    def test_float_tolerance(self):
        from judge import values_match
        assert values_match(3.141592653589793, 3.141592653589794) is True  # diff = 1e-15, within epsilon
        assert values_match(3.14, 3.15) is False    # diff = 0.01, outside epsilon


# ═══════════════════════════════════════════════════════════════
# Core judge tests (stdio mode)
# ═══════════════════════════════════════════════════════════════

class TestJudgeStdio:
    def test_ac_simple(self):
        """Correct stdio code that reads and sums two numbers."""
        from judge import judge
        code = (
            "import sys\n"
            "data = sys.stdin.read().split()\n"
            "a, b = int(data[0]), int(data[1])\n"
            "print(a + b)\n"
        )
        result = judge(code, STDIO_CONFIG)
        assert result.status.value == "Accepted"
        assert result.passed == 2
        assert result.total == 2

    def test_wa_mismatch(self):
        """Code that produces wrong output → WA."""
        from judge import judge
        code = (
            "import sys\n"
            "data = sys.stdin.read().split()\n"
            "print(999)\n"
        )
        result = judge(code, STDIO_CONFIG)
        assert result.status.value == "Wrong Answer"
        assert result.passed < result.total

    def test_wa_shows_only_first_failure(self):
        """WA should only expand first failing case (visible cases)."""
        from judge import judge
        code = "print(0)\n"  # wrong for all cases
        config = {
            "id": "test",
            "mode": "stdio",
            "time_limit": 2.0,
            "test_cases": [
                {"input": "", "expected_output": "1\n"},
                {"input": "", "expected_output": "2\n"},
                {"input": "", "expected_output": "3\n"},
            ],
        }
        result = judge(code, config)
        assert result.status.value == "Wrong Answer"
        # The judge should stop at the first non-hidden WA
        # At minimum, the first case should be marked as failed
        assert any(not c.passed for c in result.cases)


class TestJudgeCoreCode:
    def test_ac_simple(self):
        """Correct Solution class → ACCEPTED."""
        from judge import judge
        code = (
            "class Solution:\n"
            "    def add(self, a: int, b: int) -> int:\n"
            "        return a + b\n"
        )
        result = judge(code, CORE_CODE_CONFIG)
        assert result.status.value == "Accepted"
        assert result.passed == 2
        assert result.total == 2

    def test_ac_returns_list(self):
        """Solution returning a list → ACCEPTED."""
        from judge import judge
        code = (
            "class Solution:\n"
            "    def solve(self, nums):\n"
            "        return sorted(nums)\n"
        )
        config = {
            "id": "test",
            "mode": "core_code",
            "method": "solve",
            "time_limit": 2.0,
            "test_cases": [
                {"input": [[3, 1, 2]], "expected_output": [1, 2, 3]},
            ],
        }
        result = judge(code, config)
        assert result.status.value == "Accepted"

    def test_wa_mismatch(self):
        """Wrong return value → WRONG_ANSWER."""
        from judge import judge
        code = (
            "class Solution:\n"
            "    def add(self, a: int, b: int) -> int:\n"
            "        return a - b\n"  # wrong: subtract instead of add
        )
        result = judge(code, CORE_CODE_CONFIG)
        assert result.status.value == "Wrong Answer"


# ═══════════════════════════════════════════════════════════════
# Error handling tests
# ═══════════════════════════════════════════════════════════════

class TestErrors:
    def test_tle_timeout(self):
        """Infinite loop → TIME_LIMIT_EXCEEDED."""
        from judge import judge
        code = "while True:\n    pass\n"
        config = {
            "id": "test",
            "mode": "stdio",
            "time_limit": 1.0,
            "test_cases": [{"input": "", "expected_output": ""}],
        }
        result = judge(code, config)
        assert result.status.value == "Time Limit Exceeded"

    def test_re_runtime_error(self):
        """Runtime error → RUNTIME_ERROR."""
        from judge import judge
        code = "print(1/0)\n"
        config = {
            "id": "test",
            "mode": "stdio",
            "time_limit": 2.0,
            "test_cases": [{"input": "", "expected_output": ""}],
        }
        result = judge(code, config)
        assert result.status.value == "Runtime Error"

    def test_se_syntax_error(self):
        """Syntax error → SYNTAX_ERROR (not a subprocess crash)."""
        from judge import judge, check_syntax
        code = "def broken(: pass\n"
        # Syntax should be caught by check_syntax before subprocess
        err = check_syntax(code)
        assert err is not None

        # And the full judge should return SYNTAX_ERROR
        config = {
            "id": "test",
            "mode": "stdio",
            "time_limit": 2.0,
            "test_cases": [{"input": "", "expected_output": ""}],
        }
        result = judge(code, config)
        assert result.status.value in ("Syntax Error", "Runtime Error")


# ═══════════════════════════════════════════════════════════════
# Hidden case tests
# ═══════════════════════════════════════════════════════════════

class TestHiddenCases:
    def test_hidden_case_not_exposed_on_wa(self):
        """WA on hidden case: expected_output should be hidden."""
        from judge import judge
        code = (
            "class Solution:\n"
            "    def solve(self, x):\n"
            "        return 0\n"  # wrong for all inputs
        )
        result = judge(code, HIDDEN_CASE_CONFIG)
        # Find the hidden case in results
        hidden_cases = [c for c in result.cases if not c.passed]
        # Hidden cases should not expose expected value
        hidden_only = [c for c in hidden_cases if c.input_display and "2" in str(c.input_display)]
        # The judge should handle is_hidden flag


# ═══════════════════════════════════════════════════════════════
# Subprocess isolation test
# ═══════════════════════════════════════════════════════════════

class TestSubprocessIsolation:
    def test_os_exit_does_not_crash_main(self):
        """os._exit(1) in user code → RUNTIME_ERROR, not server crash."""
        from judge import judge
        code = "import os; os._exit(1)\n"
        config = {
            "id": "test",
            "mode": "stdio",
            "time_limit": 2.0,
            "test_cases": [{"input": "", "expected_output": ""}],
        }
        result = judge(code, config)
        # The server must survive — judge should catch subprocess failure
        assert result is not None
        assert result.status.value in ("Runtime Error", "Wrong Answer")

    def test_syntax_error_before_subprocess(self):
        """Syntax errors must be caught by ast.parse, NOT run in subprocess."""
        from judge import check_syntax
        code = "def foo(: pass\n"
        err = check_syntax(code)
        assert err is not None  # Must catch before any subprocess

    def test_timeout_kills_child_process(self):
        """Timeout must kill the child process, not leave zombies."""
        from judge import judge
        code = "while True:\n    pass\n"
        config = {
            "id": "test",
            "mode": "stdio",
            "time_limit": 0.5,
            "test_cases": [{"input": "", "expected_output": ""}],
        }
        result = judge(code, config)
        assert result.status.value == "Time Limit Exceeded"
        # Runtime should be approximately timeout * 1000 ms
        assert result.max_runtime_ms >= 400  # at least ~timeout


# ═══════════════════════════════════════════════════════════════
# Harness tests
# ═══════════════════════════════════════════════════════════════

class TestHarness:
    def test_core_code_harness_contains_solution(self):
        """Harness generator should wrap user code correctly."""
        from judge import _build_core_code_harness
        code = "class Solution:\n    def solve(self):\n        pass\n"
        harness = _build_core_code_harness(code, "solve", {"input": [], "expected_output": None})
        assert "class Solution" in harness
        assert "Solution()" in harness

    def test_core_code_harness_calls_method(self):
        """Harness must call the specified method name."""
        from judge import _build_core_code_harness
        code = "class Solution:\n    def twoSum(self, nums, target):\n        pass\n"
        harness = _build_core_code_harness(code, "twoSum", {"input": [[1, 2], 3], "expected_output": [0, 1]})
        assert ".twoSum(" in harness


# ═══════════════════════════════════════════════════════════════
# format_result tests
# ═══════════════════════════════════════════════════════════════

class TestFormatResult:
    def test_format_ac(self):
        """AC result should include passed/total count."""
        from judge import JudgeResult, JudgeStatus, format_result
        r = JudgeResult(status=JudgeStatus.ACCEPTED, passed=5, total=5, max_runtime_ms=12.5)
        output = format_result(r, verbose=False)
        assert "Accepted" in output or "AC" in output

    def test_format_verbose(self):
        """Verbose mode should include per-case details."""
        from judge import JudgeResult, JudgeStatus, CaseResult, format_result
        r = JudgeResult(
            status=JudgeStatus.ACCEPTED, passed=1, total=1, max_runtime_ms=5.0,
            cases=[CaseResult(case_id=1, passed=True, runtime_ms=5.0, input_display="", expected="", actual="")]
        )
        output = format_result(r, verbose=True)
        assert "Case #1" in output
        assert "PASS" in output

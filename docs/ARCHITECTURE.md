# FalJudge 架构设计文档

> 版本: 2.0 | 日期: 2026-05-29 | 作者: ZhuanZ

---

## 目录

1. [系统概述](#1-系统概述)
2. [技术栈](#2-技术栈)
3. [项目结构](#3-项目结构)
4. [架构全景图](#4-架构全景图)
5. [数据流设计](#5-数据流设计)
6. [后端设计](#6-后端设计)
7. [前端设计](#7-前端设计)
8. [判题引擎详解](#8-判题引擎详解)
9. [安全模型](#9-安全模型)
10. [API 参考](#10-api-参考)
11. [数据存储规范](#11-数据存储规范)
12. [部署与启动](#12-部署与启动)
13. [测试策略](#13-测试策略)
14. [性能考量](#14-性能考量)
15. [已知局限与改进方向](#15-已知局限与改进方向)

---

## 1. 系统概述

FalJudge 是一个**类力扣（LeetCode）本地判题系统**，专为 Python 算法练习设计。用户以"核心代码模式"提交解题函数（`class Solution`），系统自动构建测试 harness、在隔离子进程中执行、逐用例比对返回值，并输出 AC/WA/TLE/RE/SE 判定结果。

### 核心特性

- **双模式判题引擎**：核心代码模式（LeetCode 风格）+ 标准 I/O 模式（兼容历史题目）
- **635 道内置题目**：来自华为社招 OD 题库，涵盖数组、字符串、动态规划等全品类
- **力扣风格 UI**：暗色主题、表格化题目列表、Monaco 代码编辑器、GitHub 风格热力图
- **全功能管理后台**：题目 CRUD、批量操作、统计看板、增量导入
- **子进程安全隔离**：AST 语法预检查 + 模块导入白名单 + 进程级超时强杀
- **TDD 测试覆盖**：35 个单元测试覆盖判题引擎全部代码路径
- **个人刷题记录**：提交历史、题解笔记（localStorage）、难度完成统计

### 系统边界

```
┌─────────────────────────────────────────────────────────┐
│                     FalJudge 系统                         │
│                                                           │
│  ┌──────────┐    HTTP/JSON    ┌──────────────┐           │
│  │  React    │ ◄────────────► │  FastAPI      │           │
│  │  Frontend │    REST API    │  Backend      │           │
│  │  :5173   │                 │  :8000        │           │
│  └──────────┘                 └──────┬───────┘           │
│                                      │                    │
│                              ┌───────▼───────┐           │
│                              │  Judge Engine │           │
│                              │  subprocess   │           │
│                              │  isolation    │           │
│                              └───────────────┘           │
│                                                           │
│  ┌──────────────────────────────────────────┐            │
│  │  File System Storage                      │            │
│  │  problems/  +  submissions/               │            │
│  └──────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 技术栈

| 层 | 技术 | 版本 | 选型理由 |
|---|------|------|---------|
| **前端框架** | React | 19 | 组件化、生态丰富 |
| **语言** | TypeScript | 6.0 | 类型安全 |
| **构建工具** | Vite | 8.0 | 极速 HMR |
| **CSS** | Tailwind CSS | 4.3 | 原子化样式，暗色主题 CSS 变量 |
| **代码编辑器** | Monaco Editor | - | VS Code 同款，Python 语法高亮 |
| **Markdown 渲染** | react-markdown | 10 | 题目描述渲染 |
| **路由** | react-router-dom | 7 | SPA 路由 |
| **后端框架** | FastAPI | 0.136 | 高性能异步、自动 OpenAPI 文档 |
| **数据校验** | Pydantic | 2 | 请求/响应模型验证 |
| **服务器** | Uvicorn | - | ASGI 服务器 |
| **判题沙箱** | subprocess (标准库) | - | 子进程隔离、零依赖 |
| **语法检查** | ast (标准库) | - | Python 原生 AST 解析 |
| **测试框架** | pytest | 9 | 参数化测试 |
| **类型检查** | tsc --noEmit | - | 前端编译时类型检查 |

---

## 3. 项目结构

```
al_judge/
├── server/                         # 后端（FastAPI）
│   ├── main.py                     # 入口：uvicorn + 端口释放
│   ├── api.py                      # 核心路由：题目浏览、代码提交、提交历史（160行）
│   ├── config.py                   # 共享常量：ROOT、PROBLEMS_DIR、SUBMISSIONS_DIR
│   ├── models.py                   # Pydantic 数据模型
│   ├── judge.py                    # ⭐ 判题引擎（350行，核心模块）
│   ├── requirements.txt            # Python 依赖
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── admin.py                # 管理路由：CRUD、批量操作、导入
│   │   └── stats.py                # 统计路由：热力图、难度分布、趋势
│   └── tests/
│       ├── __init__.py
│       └── test_judge.py           # 判题引擎测试（35 用例）
│
├── frontend/                       # 前端（React + TypeScript + Vite）
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx                # React 入口
│       ├── App.tsx                 # 路由配置
│       ├── index.css               # 全局样式：暗色主题 CSS 变量、Markdown prose
│       ├── types/
│       │   └── index.ts            # TypeScript 类型定义
│       ├── lib/
│       │   ├── api.ts              # API 客户端（HTTP 封装 + 所有端点函数）
│       │   └── tags.ts             # 标签管理（localStorage CRUD）
│       ├── components/
│       │   ├── Layout.tsx          # 页面布局（顶部导航 + Outlet）
│       │   ├── CodeEditor.tsx      # Monaco Editor 封装（vs-dark 主题）
│       │   ├── ResultPanel.tsx     # 判题结果面板（AC/WA/TLE/RE/SE 五种样式）
│       │   ├── StatusBadge.tsx     # 题目状态标签（已通过/已尝试/未开始）
│       │   ├── Heatmap.tsx         # GitHub 风格提交热力图
│       │   ├── SolutionEditor.tsx  # Markdown 题解编辑器
│       │   └── StatsPanel.tsx      # 难度统计面板（进度条）
│       └── pages/
│           ├── Home.tsx            # 个人主页（热力图 + 环形图 + 进度条）
│           ├── ProblemList.tsx     # 题库列表（表格、搜索、分页、标签筛选）
│           ├── ProblemDetail.tsx   # 题目详情（分屏：描述 + 编辑器 + 判题结果）
│           └── AdminPanel.tsx      # 管理后台（双栏 Monaco：config + readme）
│
├── problems/                       # 题目数据（635 目录）
│   └── {problem-id}/
│       ├── config.json             # 题目配置（模式、测试用例、难度等）
│       └── README.md               # 题目描述（Markdown）
│
├── submissions/                    # 提交记录（JSON 文件，gitignore）
│   └── {timestamp}_{problem-id}.json
│
├── import_problems.py              # 题目导入脚本（支持 --incremental --source）
├── .gitignore
├── .github/workflows/ci.yml       # GitHub Actions CI（pytest + tsc + eslint）
├── README.md
└── docs/
    ├── ARCHITECTURE.md             # 本文档
    └── JUDGE_ENGINE.md             # 判题引擎深度解析
```

---

## 4. 架构全景图

```
                          ┌──────────────────────────────────────────┐
                          │              Browser (:5173)              │
                          │                                          │
                          │  ┌────────┐ ┌──────────┐ ┌───────────┐  │
                          │  │  Home   │ │ Problems │ │   Admin   │  │
                          │  │ (个人)  │ │  (题库)  │ │  (管理)   │  │
                          │  └────────┘ └──────────┘ └───────────┘  │
                          │       │           │             │         │
                          │       ▼           ▼             ▼         │
                          │  ┌─────────────────────────────────────┐ │
                          │  │          api.ts (fetch)              │ │
                          │  └─────────────────────────────────────┘ │
                          └──────────────────┬───────────────────────┘
                                             │ HTTP/JSON
                          ┌──────────────────▼───────────────────────┐
                          │            FastAPI (:8000)                │
                          │                                          │
                          │  ┌──────────┐  ┌──────────┐  ┌───────┐  │
                          │  │ api.py   │  │ routes/   │  │routes/│  │
                          │  │(核心路由)│  │admin.py   │  │stats  │  │
                          │  └────┬─────┘  └────┬──────┘  └───┬───┘  │
                          │       │             │              │      │
                          │       ▼             ▼              ▼      │
                          │  ┌─────────────────────────────────────┐ │
                          │  │           judge.py                   │ │
                          │  │  ┌───────────┐  ┌────────────────┐  │ │
                          │  │  │ AST Filter│  │ Subprocess     │  │ │
                          │  │  │ (import   │  │ (Popen +       │  │ │
                          │  │  │  allowlist│  │  TerminateProc)│  │ │
                          │  │  └───────────┘  └────────────────┘  │ │
                          │  └─────────────────────────────────────┘ │
                          └──────────────────┬───────────────────────┘
                                             │ 文件读写
                          ┌──────────────────▼───────────────────────┐
                          │          File System Storage              │
                          │  problems/         submissions/           │
                          │  {id}/config.json  {ts}_{pid}.json       │
                          │  {id}/README.md                          │
                          └──────────────────────────────────────────┘
```

---

## 5. 数据流设计

### 5.1 用户提交判题流程

```
用户点击「提交代码」
        │
        ▼
┌──────────────────┐
│ 1. POST /api/submit │  { problem_id, code }
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ 2. api.py         │  读取 problems/{id}/config.json
│    submit_code()  │  调用 judge(code, config)
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ 3. judge.py       │
│    check_syntax() │  ast.parse(code) → SyntaxError?
│    _check_imports()│  AST walk → 检查危险模块?
└──────┬───────────┘
       │ (语法+导入检查通过)
       ▼
┌──────────────────┐
│ 4. judge.py       │
│    judge() loop   │  对每个 test_case:
│                    │    mode=core_code → _build_core_code_harness()
│                    │    mode=stdio     → _build_stdio_harness()
│                    │    _run_subprocess(harness, stdin, timeout)
│                    │    values_match(actual, expected)
│                    │    WA 且 !is_hidden → break
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ 5. api.py         │  保存 submissions/{ts}_{pid}.json
│    submit_code()  │  返回 JudgeResult
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ 6. 前端            │  ResultPanel 渲染判题结果
│                    │  AC → 绿色面板 + 通过数 + 耗时
│                    │  WA → 红色面板 + 首个失败 case
│                    │  TLE → 黄色面板 + 超时信息
│                    │  RE → 紫色面板 + 异常堆栈
│                    │  SE → 橙色面板 + 语法错误位置
└──────────────────┘
```

### 5.2 管理后台操作流程

```
┌─────────────────┐
│  管理后台 UI     │
│  AdminPanel.tsx  │
└────────┬────────┘
         │
    ┌────┴────┬──────────┬──────────┐
    ▼         ▼          ▼          ▼
┌───────┐ ┌───────┐ ┌────────┐ ┌────────┐
│ 选中   │ │ 编辑   │ │ 批量   │ │ 导入   │
│ 题目   │ │ config │ │ 操作   │ │ 题目   │
└───┬───┘ └───┬───┘ └───┬────┘ └───┬────┘
    ▼         ▼          ▼          ▼
GET admin  PUT admin  POST batch  POST import
/problems  /problems  /problems   (触发
/{id}      /{id}      /batch      import_problems.py)
```

---

## 6. 后端设计

### 6.1 模块职责

| 模块 | 职责 | 行数 |
|------|------|------|
| `server/main.py` | uvicorn 启动、Windows 端口释放 | 29 |
| `server/config.py` | 共享路径常量 | 6 |
| `server/models.py` | Pydantic 请求/响应模型 | 37 |
| `server/api.py` | 核心路由：题目浏览、代码提交、提交历史 | 160 |
| `server/judge.py` | 判题引擎（核心） | 350 |
| `server/routes/admin.py` | 管理 CRUD、批量操作、导入 | 175 |
| `server/routes/stats.py` | 热力图、难度统计、趋势 | 120 |

### 6.2 API 端点总览

#### 用户端点

| Method | Path | 说明 | 请求体 | 响应 |
|--------|------|------|--------|------|
| GET | `/api/problems` | 题目列表 | - | `[{id, title, mode, difficulty, desc_preview, status}]` |
| GET | `/api/problems/{id}` | 题目详情 | - | `{id, title, description, starter_code, public_test_cases, ...}` |
| POST | `/api/submit` | 提交代码 | `{problem_id, code}` | `{id, status, passed, total, max_runtime_ms, cases, error}` |
| GET | `/api/submissions?problem_id=X` | 提交历史 | - | `[{id, problem_id, time, status, ...}]` (最近50条) |

#### 管理端点

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/admin/problems/{id}` | 获取完整题目（含测试用例答案） |
| PUT | `/api/admin/problems/{id}` | 更新题目 config.json |
| PUT | `/api/admin/problems/{id}/readme` | 更新题目 README.md |
| POST | `/api/admin/problems` | 从 Markdown 创建新题目 |
| DELETE | `/api/admin/problems/{id}` | 删除题目（含目录） |
| POST | `/api/admin/problems/batch` | 批量更新难度/标签 |
| GET | `/api/admin/stats` | 题目统计（总数、难度分布、通过率） |
| POST | `/api/admin/import` | 触发增量导入 |

#### 统计端点

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/submissions/heatmap` | 过去365天每日提交计数 |
| GET | `/api/stats/difficulty` | 按难度完成统计 |
| GET | `/api/stats/trend` | 按周通过率趋势（最近26周） |

### 6.3 路由模块化

后端采用 FastAPI Router 模式组织代码：

```python
# server/api.py — 核心应用
app = FastAPI()
app.include_router(admin_router)   # /api/admin/*
app.include_router(stats_router)   # /api/submissions/*, /api/stats/*

# server/routes/admin.py — 管理路由
router = APIRouter(prefix="/api/admin", tags=["admin"])
# 所有 admin 端点注册在此

# server/routes/stats.py — 统计路由
router = APIRouter(prefix="/api", tags=["stats"])
# 热力图、难度统计、趋势端点注册在此
```

共享依赖通过 `server/config.py` 和 `server/models.py` 解耦，避免循环导入。

### 6.4 题目存储格式

```
problems/
└── {problem-id}/
    ├── config.json       # 题目元信息 + 测试用例
    └── README.md         # 题目描述（Markdown）
```

**config.json 结构：**

```json
{
  "id": "two-sum",
  "title": "两数之和",
  "mode": "core_code",
  "method": "twoSum",
  "time_limit": 2.0,
  "difficulty": "easy",
  "description": "two-sum",
  "starter_code": "class Solution:\n    def twoSum(self, nums, target):\n        pass\n",
  "test_cases": [
    {
      "input": [[2,7,11,15], 9],
      "expected_output": [0, 1],
      "is_hidden": false
    },
    {
      "input": [[3,2,4], 6],
      "expected_output": [1, 2],
      "is_hidden": true
    }
  ]
}
```

**模式说明：**

- `core_code`：`input` 为 JSON 数组（函数位置参数），`expected_output` 为 JSON 值
- `stdio`：`input` 为原始字符串（pipe 到 stdin），`expected_output` 为字符串

### 6.5 提交记录格式

```
submissions/
└── {YYYYMMDD_HHMMSS_microseconds}_{problem_id}.json
```

```json
{
  "id": "20260529_182500_123456_two-sum",
  "problem_id": "two-sum",
  "time": "2026-05-29T18:25:00.123456",
  "code": "class Solution:\n    def twoSum(self, nums, target):\n        ...",
  "status": "Accepted",
  "passed": 5,
  "total": 5,
  "max_runtime_ms": 12.5,
  "cases": [
    {
      "id": 1,
      "passed": true,
      "runtime_ms": 2.3,
      "input": "[[2,7,11,15], 9]",
      "expected": "[0, 1]",
      "actual": "[0, 1]",
      "error": ""
    }
  ],
  "error": ""
}
```

---

## 7. 前端设计

### 7.1 组件树

```
App.tsx
├── Layout.tsx (导航栏 + Outlet)
│   ├── Home.tsx
│   │   ├── Heatmap.tsx        (GitHub 风格 7×N 贡献图)
│   │   └── SVG Ring Chart     (完成度环形图)
│   │   └── Progress Bars      (难度进度条)
│   ├── ProblemList.tsx
│   │   ├── StatusBadge.tsx    (已通过/已尝试/未开始)
│   │   ├── Tag Chips          (多选标签筛选)
│   │   └── Pagination         (分页控件)
│   └── AdminPanel.tsx
│       ├── Monaco Editor × 2  (config.json + README.md)
│       ├── Stats Dashboard    (题目统计)
│       └── Import Modal       (增量导入)
│
└── ProblemDetail.tsx (独立路由，无 Layout)
    ├── CodeEditor.tsx         (Monaco vs-dark)
    ├── ResultPanel.tsx        (判题结果)
    ├── SolutionEditor.tsx     (Markdown 题解)
    └── Tag Manager            (标签增删)
```

### 7.2 路由设计

| 路径 | 组件 | 布局 |
|------|------|------|
| `/` | Home | Layout (含导航) |
| `/problems` | ProblemList | Layout (含导航) |
| `/problem/:id` | ProblemDetail | 独立布局（分屏） |
| `/admin` | AdminPanel | Layout (含导航) |

### 7.3 暗色主题设计系统

所有颜色通过 CSS 变量定义在 `index.css`：

```css
:root {
  --bg-primary: #1a1a1a;       /* 主背景 */
  --bg-secondary: #262626;      /* 卡片背景 */
  --bg-tertiary: #2d2d2d;      /* 悬停背景 */
  --bg-hover: #333333;
  --border-primary: #3e3e3e;
  --text-primary: #ebebeb;
  --text-secondary: #a0a0a0;
  --text-tertiary: #6b6b6b;
  --green: #00af9b;             /* 简单/AC */
  --yellow: #ffb800;            /* 中等 */
  --red: #ff2d55;               /* 困难/WA */
  --blue: #4a9eff;              /* 链接/品牌 */
  --purple: #b374ff;            /* RE */
  --orange: #ff8c42;            /* SE */
}
```

### 7.4 数据流

```
用户交互 → React State → api.ts (fetch) → FastAPI → 文件系统
                                                    ↓
React State ← api.ts (JSON) ← FastAPI Response ←───┘
```

- **服务端状态**：通过 `api.ts` 的 fetch 调用获取（题目列表、判题结果、统计数据）
- **客户端状态**：标签通过 `localStorage` 持久化（`tags.ts`）、题解通过 `localStorage` 存储

---

## 8. 判题引擎详解

详见 [JUDGE_ENGINE.md](./JUDGE_ENGINE.md)

### 核心流程概要

```
judge(code, config)
│
├── check_syntax(code)          ← ast.parse()
│   └── SyntaxError → JudgeStatus.SYNTAX_ERROR
│
├── _check_imports(code)        ← AST walk, 20+ blocked modules
│   └── Forbidden import → JudgeStatus.RUNTIME_ERROR
│
└── for case in test_cases:
    │
    ├── mode == "core_code"
    │   └── _build_core_code_harness(code, method, case)
    │       └── {user_code} + Solution().method(*args) wrapper
    │
    ├── mode == "stdio"
    │   └── _build_stdio_harness(code)
    │       └── user code as-is
    │
    ├── _run_subprocess(harness, stdin, timeout)
    │   ├── tempfile.NamedTemporaryFile → .py file
    │   ├── subprocess.Popen([python, tmpfile])
    │   ├── proc.communicate(input=stdin, timeout=timeout)
    │   └── TimeoutExpired → proc.kill()
    │
    └── values_match(actual, expected)
        ├── type(actual) != type(expected) → False
        ├── float → abs(a - b) < 1e-9
        ├── list → len + element-wise recursion
        ├── dict → key set + value-wise recursion
        └── scalar → ==
```

---

## 9. 安全模型

### 9.1 威胁模型

FalJudge 是本地单用户工具，攻击面为：

1. **用户自我攻击**：用户运行自己写的恶意代码（如 `os.remove("/")`）
2. **题目注入**：恶意构造的题目 config.json 包含危险代码
3. **导入投毒**：导入脚本处理外部文件时的路径遍历

### 9.2 防护措施

| 威胁 | 防护层 | 实现位置 |
|------|--------|---------|
| 恶意 import | AST 白名单（20+ 模块封禁） | `judge.py:_check_imports()` |
| 语法错误导致崩溃 | 提交前 ast.parse 预检查 | `judge.py:check_syntax()` |
| 死循环/超时 | 子进程超时强杀 | `judge.py:_run_subprocess()` |
| 子进程逃逸 | process_group + TerminateProcess (Windows) | `judge.py:_run_subprocess()` |
| 文件系统篡改 | 用户代码在 tempfile 中运行，无法访问题目数据 | tempfile.NamedTemporaryFile |
| 资源耗尽 | 单进程单线程，超时自动终止 | subprocess timeout |

### 9.3 AST Import Filter

封禁模块列表（20+）：

```python
_BLOCKED_MODULES = {
    'os', 'subprocess', 'socket', 'ctypes', 'shutil', 'signal',
    'multiprocessing', 'threading', 'concurrent', 'asyncio',
    'pathlib', 'glob', 'fnmatch', 'tempfile',
    'pickle', 'shelve', 'marshal',
    'code', 'codeop', 'compileall', 'py_compile',
    'builtins', '__builtins__',
    'importlib', 'pkgutil', 'runpy',
}
```

**已知局限：** `__import__('os')` 和 `exec()` 不受 AST 静态分析约束。对本地个人工具而言可接受，如需更严格的沙箱，可考虑 Docker/VM 隔离。

---

## 10. API 参考

### 10.1 判题结果结构

```typescript
interface SubmitResult {
  id: string;
  problem_id: string;
  time: string;              // ISO 8601
  code: string;
  status: 'Accepted' | 'Wrong Answer' | 'Time Limit Exceeded'
         | 'Runtime Error' | 'Syntax Error';
  passed: number;
  total: number;
  max_runtime_ms: number;
  cases: CaseResult[];
  error: string;
  syntax_error?: string;     // Syntax Error 时填充
}

interface CaseResult {
  id: number;
  passed: boolean;
  runtime_ms: number;
  input: string;             // JSON 或原始文本
  expected: string;          // 隐藏用例时为空
  actual: string;
  error: string;
}
```

### 10.2 错误处理

| HTTP 状态码 | 场景 |
|------------|------|
| 200 | 正常响应 |
| 404 | 题目不存在 |
| 409 | 创建题目时 ID 冲突 |
| 422 | 请求体格式错误（Pydantic 校验失败） |
| 500 | 服务器内部错误（判题引擎崩溃等） |

---

## 11. 数据存储规范

### 11.1 无数据库设计

FalJudge 采用纯文件系统存储，原因是：
- 单用户本地工具，无需并发控制
- JSON 文件可直接手动编辑和 git 版本管理
- 零外部依赖，部署极简

### 11.2 性能边界

| 操作 | 复杂度 | 当前规模 | 实测延迟 |
|------|--------|---------|---------|
| 题目列表 | O(N) 全扫描 | 636题 | <50ms |
| 提交历史 | O(N) 全扫描 | ~100条 | <10ms |
| 热力图 | O(N) 全扫描 submissions | ~100文件 | <20ms |
| 难度统计 | O(N+M) 扫描 problems + submissions | 636题 + 100提交 | <30ms |

**扩容建议：** 当 submissions > 10,000 条时，可加内存缓存或迁移到 SQLite。

### 11.3 题目 ID 规范

- 支持中文和英文
- 示例：`two-sum`, `100分-MVP争夺战`, `最大社交距离`
- URL 中自动 encodeURIComponent 编码
- 管理后台新建建议用英文 slug

---

## 12. 部署与启动

### 12.1 本地开发

```bash
# 1. 后端
cd server
pip install -r requirements.txt
python main.py                    # http://localhost:8000

# 2. 前端（新终端）
cd frontend
npm install
npm run dev                       # http://localhost:5173
```

### 12.2 导入题目

```bash
# 从 OD_problems 导入
python import_problems.py --source "C:\Users\ZhuanZ\Desktop\OD_problems\problems" --incremental
```

### 12.3 运行测试

```bash
cd server
python -m pytest tests/ -v       # 35 tests
# 带覆盖率:
python -m pytest tests/ -v --cov=judge --cov-report=term
```

### 12.4 生产构建

```bash
cd frontend
npm run build                     # 输出到 frontend/dist/
# 将 dist/ 作为 FastAPI 静态文件托管（见 main.py 注释）
```

---

## 13. 测试策略

### 13.1 测试金字塔

```
        ╱  E2E ╲         手动：启动服务 → 选题 → 提交代码 → 验证判题
       ╱         ╲
      ╱  Integration ╲    TODO: API 端点集成测试
     ╱               ╲
    ╱   Unit (35 tests) ╲  判题引擎全覆盖
   ╱───────────────────────╲
```

### 13.2 单元测试覆盖

| 测试类 | 用例数 | 覆盖范围 |
|--------|--------|---------|
| TestCheckSyntax | 4 | 有效代码、语法错误、空代码、import |
| TestNormalize | 4 | 空白清理、换行归一化、类型转换 |
| TestValuesMatch | 9 | int/str/list/dict/nested/float 全类型 |
| TestJudgeStdio | 3 | stdio 模式 AC、WA、首个失败展示 |
| TestJudgeCoreCode | 3 | core_code 模式 AC(list)、AC(simple)、WA |
| TestErrors | 3 | TLE、RE、SE |
| TestHiddenCases | 1 | is_hidden 不暴露答案 |
| TestSubprocessIsolation | 3 | os._exit 不崩溃、语法预检查、超时杀子进程 |
| TestHarness | 2 | harness 包含 Solution、调用正确方法 |
| TestFormatResult | 2 | 格式化输出正确 |
| **总计** | **35** | |

---

## 14. 性能考量

| 指标 | 目标 | 实际 |
|------|------|------|
| 判题延迟（单 case） | <100ms | ~20-50ms |
| 判题延迟（5 cases） | <500ms | ~100-200ms |
| 题目列表加载 | <100ms | ~50ms (636题) |
| 热力图计算 | <50ms | ~20ms |
| 前端首屏加载 | <2s | ~1s (Vite HMR) |

---

## 15. 已知局限与改进方向

### 当前局限

1. **文件扫描随规模线性退化**：热力图/统计每次请求都全量扫描 submissions 目录
2. **无并发判题**：单用户场景下无影响，但多用户同时提交会排队
3. **Windows 专有端口释放**：`main.py` 的 `free_port()` 使用 Windows cmd 命令
4. **AST filter 不覆盖动态导入**：`__import__()` 和 `exec()` 可绕过
5. **无 Docker 沙箱**：子进程隔离足够个人使用，但不如容器安全
6. **前端无测试**：React 组件缺少 vitest 单元测试

### 改进路线图

| 优先级 | 改进项 | 预期收益 |
|--------|--------|---------|
| P0 | 前端组件测试（vitest + testing-library） | 防止 UI 回归 |
| P1 | 内存缓存层（submissions 统计缓存 5 分钟） | 热力图/统计延迟降 10× |
| P1 | 跨平台端口释放（用 psutil 替代 cmd） | 支持 Linux/macOS |
| P2 | API 集成测试（httpx + pytest） | 端到端验证 |
| P2 | stdio 模式完全废弃（UI 移除选项） | 代码简化 |
| P3 | SQLite 数据存储（可选迁移） | 查询能力、并发安全 |
| P3 | Docker 打包（devcontainer + docker-compose） | 一键部署 |
| P4 | 多语言支持（抽象 BaseJudge 接口） | Java/C++ 判题 |

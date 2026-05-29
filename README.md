# FalJudge — 类力扣 Python 判题系统

一个**本地运行**的 LeetCode 风格在线判题（OJ）系统，专为 Python 算法练习设计。

- 🔒 **纯本地**，无需网络，无需登录
- ⚡ **核心代码模式** — 只写 `class Solution`，系统自动传参、调用、判题
- 🎯 **力扣一致体验** — AC/WA/TLE/RE/SE 判定、隐藏用例、运行时统计
- 📚 **636 道内置题目** — 华为社招 OD 题库，涵盖数组、字符串、动态规划等全品类
- 🌙 **暗色主题** — LeetCode 风格 UI，Monaco 代码编辑器
- 📊 **个人记录** — GitHub 风格热力图、完成度环形图、难度分布统计
- 🛡️ **安全沙箱** — AST 语法检查 + 模块导入白名单 + 子进程隔离

---

## 截图

| 个人主页 | 题库列表 |
|---------|---------|
| 热力图 + 环形图 + 进度条 | 表格化题目列表 + 搜索筛选 |

| 题目详情 | 管理后台 |
|---------|---------|
| 分屏：题目描述 + Monaco 编辑器 + 判题结果 | 双 Monaco 编辑器 + 统计 + 批量操作 |

---

## 快速开始

### 环境要求

- Python 3.10+
- Node.js 18+
- Windows 10+（端口释放逻辑为 Windows 专有，Linux/macOS 可注释掉）

### 1. 克隆项目

```bash
git clone https://github.com/YOUR_USERNAME/al_judge.git
cd al_judge
```

### 2. 安装后端

```bash
cd server
pip install -r requirements.txt
```

### 3. 安装前端

```bash
cd frontend
npm install
```

### 4. 导入题目

```bash
# 从 OD_problems 数据源导入（如有）
python import_problems.py --source "C:\Users\ZhuanZ\Desktop\OD_problems\problems" --incremental
```

### 5. 启动

**终端 1 — 后端：**
```bash
cd server
python main.py
# → http://localhost:8000
# API 文档: http://localhost:8000/docs
```

**终端 2 — 前端：**
```bash
cd frontend
npm run dev
# → http://localhost:5173
```

浏览器打开 http://localhost:5173 即可使用。

---

## 项目结构

```
al_judge/
├── server/                     # 后端（FastAPI）
│   ├── main.py                 # 入口
│   ├── api.py                  # 核心路由：题目、提交、历史
│   ├── judge.py                # ⭐ 判题引擎（核心模块）
│   ├── config.py               # 共享路径常量
│   ├── models.py               # Pydantic 数据模型
│   ├── routes/
│   │   ├── admin.py            # 管理 CRUD、批量操作、导入
│   │   └── stats.py            # 热力图、难度统计、趋势
│   └── tests/
│       └── test_judge.py       # 35 个判题引擎测试
│
├── frontend/                   # 前端（React + TypeScript）
│   └── src/
│       ├── pages/
│       │   ├── Home.tsx        # 个人主页（热力图 + 环形图）
│       │   ├── ProblemList.tsx # 题库列表
│       │   ├── ProblemDetail.tsx# 题目详情 + 编辑器
│       │   └── AdminPanel.tsx  # 管理后台
│       ├── components/
│       │   ├── CodeEditor.tsx  # Monaco 编辑器
│       │   ├── ResultPanel.tsx # 判题结果面板
│       │   ├── Heatmap.tsx     # 提交热力图
│       │   ├── SolutionEditor  # 题解编辑器
│       │   └── StatsPanel.tsx  # 难度统计
│       └── lib/
│           ├── api.ts          # API 客户端
│           └── tags.ts         # 标签管理
│
├── problems/                   # 题目数据（636 目录，gitignore）
│   └── {id}/
│       ├── config.json         # 测试用例 + 元信息
│       └── README.md           # 题目描述
│
├── submissions/                # 提交记录（gitignore）
├── import_problems.py          # 题目导入脚本
├── docs/
│   ├── ARCHITECTURE.md         # 架构设计文档
│   └── JUDGE_ENGINE.md         # 判题引擎深度解析
└── .github/workflows/ci.yml   # CI 流水线
```

---

## 功能概览

### 判题引擎

| 判定 | 缩写 | 触发条件 |
|------|------|---------|
| Accepted | AC | 所有测试用例返回值完全匹配 |
| Wrong Answer | WA | 代码可运行但返回值与期望不一致 |
| Time Limit Exceeded | TLE | 运行时间超过配置阈值（默认 2 秒） |
| Runtime Error | RE | 运行中抛异常（如除零、索引越界） |
| Syntax Error | SE | AST 语法检查失败 |

### 前端页面

| 页面 | 路由 | 功能 |
|------|------|------|
| 个人主页 | `/` | 提交热力图（GitHub 风格 7×N）、完成度环形图、难度进度条 |
| 题库 | `/problems` | 表格化列表、搜索、难度/模式/标签多选筛选、分页 |
| 题目详情 | `/problem/:id` | 分屏布局：Markdown 描述 + Monaco 编辑器 + 代码提交 + 判题结果 + 题解编辑器 |
| 管理后台 | `/admin` | 双 Monaco 编辑器（config.json + README.md） + 统计 + 批量操作 + 导入 |

### API 端点（17 个）

| 类别 | 端点 | 说明 |
|------|------|------|
| 题目 | `GET /api/problems` | 题目列表 |
| 题目 | `GET /api/problems/{id}` | 题目详情 |
| 判题 | `POST /api/submit` | 提交代码判题 |
| 历史 | `GET /api/submissions` | 提交历史 |
| 管理 | `GET/PUT/DELETE /api/admin/problems/{id}` | 题目 CRUD |
| 管理 | `POST /api/admin/problems` | 创建题目 |
| 管理 | `POST /api/admin/problems/batch` | 批量更新 |
| 管理 | `GET /api/admin/stats` | 题目统计 |
| 管理 | `POST /api/admin/import` | 增量导入 |
| 统计 | `GET /api/submissions/heatmap` | 提交热力图 |
| 统计 | `GET /api/stats/difficulty` | 难度分布 |
| 统计 | `GET /api/stats/trend` | 提交趋势 |

---

## 判题流程

```
用户提交代码
  │
  ▼
ast.parse(code)        ← 语法预检查（SyntaxError?）
  │
  ▼
AST walk(code)         ← 导入安全检查（os? subprocess? ctypes?）
  │
  ▼
Build harness          ← 包装用户 Solution 类 + 传参 + 捕获结果
  │
  ▼
subprocess.Popen()     ← 隔离子进程执行，tempfile 写入
  │
  ▼
values_match()         ← 返回值严格比对（类型 + 值 + 顺序）
  │
  ▼
返回 JudgeResult       ← AC / WA / TLE / RE / SE
```

---

## 安全模型

FalJudge 使用多层防御保护主系统：

1. **AST 语法预检查** — `ast.parse()` 拦截语法错误，不进入子进程
2. **导入白名单** — 封禁 `os`, `subprocess`, `socket`, `ctypes` 等 20+ 危险模块
3. **子进程隔离** — 用户代码在 `tempfile` 中运行，无法读取题目数据
4. **超时强杀** — `subprocess.Popen` + `TerminateProcess` (Windows)，防止死循环
5. **进程回收** — `finally: os.unlink(tmp)` 保证临时文件清理

详细安全分析见 [docs/JUDGE_ENGINE.md](./docs/JUDGE_ENGINE.md#9-安全分析)。

---

## 运行测试

```bash
cd server
python -m pytest tests/ -v              # 35 个判题引擎测试
python -m pytest tests/ -v --cov=judge  # 带覆盖率报告
```

---

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 19 + TypeScript 6 + Vite 8 + Tailwind CSS 4 |
| 代码编辑器 | Monaco Editor (`@monaco-editor/react`) |
| 后端 | FastAPI 0.136 + Pydantic 2 + Uvicorn |
| 判题 | ast (标准库) + subprocess (标准库) |
| 测试 | pytest 9 |
| CI | GitHub Actions |

---

## 文档

- [架构设计文档](./docs/ARCHITECTURE.md) — 系统全景、数据流、组件树、API 参考、安全模型
- [判题引擎深度解析](./docs/JUDGE_ENGINE.md) — 类型系统、AST Filter、Harness 构建、子进程隔离、比对算法

---

## 许可

MIT License

## 作者

ZhuanZ

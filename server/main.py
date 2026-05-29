"""FalJudge 后端入口"""
import subprocess
import uvicorn
from api import app


def free_port(port: int):
    """Windows: 用 cmd.exe 杀掉占用指定端口的进程。"""
    try:
        result = subprocess.run(
            ['cmd', '/c', f'netstat -ano | findstr :{port} | findstr LISTENING'],
            capture_output=True, text=True, timeout=5
        )
        for line in result.stdout.splitlines():
            parts = line.strip().split()
            if parts:
                pid = parts[-1]
                subprocess.run(
                    ['cmd', '/c', f'taskkill /F /PID {pid}'],
                    capture_output=True, timeout=5
                )
    except Exception:
        pass


if __name__ == "__main__":
    free_port(8000)
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)

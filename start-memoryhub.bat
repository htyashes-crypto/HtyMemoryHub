@echo off
REM MemoryHub 启动壳。用法:start-memoryhub.bat [工作区根]
REM 各工作区可建快捷方式带各自参数,如:start-memoryhub.bat E:\UnityProject\BoardGameEditor
cd /d %~dp0
if "%~1"=="" (
  uv run memoryhub serve
) else (
  uv run memoryhub serve -w %1
)
pause

@echo off
cd /d "%~dp0"
title 本地服务器

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 没有找到 Node.js。
  echo 请先到 https://nodejs.org/ 安装 LTS 版本，然后重新双击本文件。
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\express\package.json" (
  echo [错误] 依赖还没有安装。
  echo 请先在本文件夹打开终端，执行下面任意一条命令：
  echo     npm install
  echo     pnpm install
  echo.
  pause
  exit /b 1
)

rem 端口已被占用时，直接打开现有站点，避免重复启动
netstat -ano | findstr /C:":3000" | findstr /C:"LISTENING" >nul
if not errorlevel 1 (
  echo.
  echo 服务已经在运行：http://127.0.0.1:3000
  echo 无需重复启动，正在为你打开浏览器...
  start "" "http://127.0.0.1:3000"
  pause
  exit /b 0
)

echo 正在启动本地服务器...
echo.
echo   文化苦旅   http://127.0.0.1:3000
echo   作品详情   http://127.0.0.1:3000/book.html?id=wenhuakulv
echo.
echo 停止服务：关闭这个窗口，或按 Ctrl+C
echo ============================================
echo.

rem Switch console to UTF-8 so Node Chinese logs render correctly
chcp 65001 >nul
node server.js

rem Restore local codepage for the Chinese messages below
chcp 936 >nul
echo.
echo 服务已退出。
echo 如果网站仍能打开，说明端口被另一个实例占用，无需重复启动。
pause

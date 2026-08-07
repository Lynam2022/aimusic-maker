@echo off
title Fresh Upload AiMusic Maker To GitHub
echo =========================================================
echo   DANG XOA LICH SU CU VA DAY FULL CODE MOI NHAT LEN GITHUB...
echo =========================================================
cd /d "%~dp0"

:: Xoa folder .git cu neu co
rmdir /s /q .git 2>nul

:: Khoi tao lai Git repository moi tinh
git init

:: Thiet lap thong tin git
git config user.name "Lynam2022"
git config user.email "lynam2022@gmail.com"

git add .
git commit -m "Fix TypeScript implicit any type error in lyrics route.ts for Render build"
git branch -M main
git remote add origin https://github.com/Lynam2022/aimusic-maker.git
git push -u origin main --force

if %errorlevel% neq 0 (
  echo.
  echo =========================================================
  echo   LOI: Khong the push code len GitHub!
  echo =========================================================
  echo.
  pause
  exit /b %errorlevel%
)

echo.
echo =========================================================
echo   HOAN TAT! Da xoa code cu va day toan bo code moi tinh len GitHub.
echo =========================================================
echo.

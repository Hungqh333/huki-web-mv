@echo off
REM ============================================================================
REM Chay web o may local.
REM
REM Vi sao co file nay: PowerShell tren may nay chan chay script .ps1, ma lenh
REM "npm" tren Windows chinh la mot file nhu vay. Go "npm run dev" se bao
REM "running scripts is disabled on this system". File .bat chay bang cmd.exe
REM nen khong dinh cai chan do.
REM
REM Cach dung: bam doi vao file nay, hoac go "chay-web.bat" trong terminal.
REM Dung server: bam Ctrl+C trong cua so nay.
REM ============================================================================

cd /d "%~dp0"

echo.
echo   Dang khoi dong web o http://localhost:3000
echo   Trang xem truoc: http://localhost:3000/dev/xem-truoc
echo.
echo   Bam Ctrl+C de dung.
echo.

call npm.cmd run dev

REM Giu cua so mo neu co loi, de con doc duoc thong bao.
if errorlevel 1 pause

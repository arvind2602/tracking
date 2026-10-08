@echo off
cd "C:\Users\VIGHNOTECH\Desktop\employee\my-project"
npm run build 2>&1 > build.log
echo EXIT_CODE=%errorlevel% >> build.log
type build.log
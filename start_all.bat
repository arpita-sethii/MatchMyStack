@echo off
REM === Adjust these paths if your folders are elsewhere ===
set BACKEND_DIR=C:\Users\arpit\Desktop\MatchMyStack\backend
set FRONTEND_DIR=C:\Users\arpit\Desktop\MatchMyStack\matchmystack-fd

REM === Start backend in a new cmd window ===
start "" cmd /k "cd /d %BACKEND_DIR% && .venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"

REM === Start frontend in a new cmd window ===
start "" cmd /k "cd /d %FRONTEND_DIR% && pnpm run dev"

REM === Optional: bring main window to front and exit this starter script ===
exit

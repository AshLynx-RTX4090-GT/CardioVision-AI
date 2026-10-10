@echo off
setlocal
cd /d "%~dp0"

set "PYTHON=py -3"
if not exist ".venv\Scripts\python.exe" goto check_artifacts

".venv\Scripts\python.exe" -c "import sklearn, scipy" >nul 2>&1
if not errorlevel 1 set "PYTHON=.venv\Scripts\python.exe"
if "%PYTHON%"=="py -3" call :use_conda_if_available

:check_artifacts

if not exist "models\metrics.json" goto train
if not exist "models\meta.joblib" goto train
if not exist "models\CAD.joblib" goto train
if not exist "models\LAD.joblib" goto train
if not exist "models\LCX.joblib" goto train
if not exist "models\RCA.joblib" goto train
goto serve

:train
echo Trained model artifacts are incomplete. Training the synthetic fallback dataset...
%PYTHON% -m backend.train
if errorlevel 1 (
  echo Training failed.
  exit /b 1
)

:serve
echo Starting CardioVision at http://127.0.0.1:8000
%PYTHON% -m backend.server --host 127.0.0.1 --port 8000
exit /b %errorlevel%

:use_conda_if_available
where conda >nul 2>&1
if not errorlevel 1 set "PYTHON=conda run --no-capture-output -n base python"
exit /b 0

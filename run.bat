@echo off
echo Starting npm install... > run_log.txt
call npm install --no-fund >> run_log.txt 2>&1
echo npm install completed >> run_log.txt
echo Starting dev server... >> run_log.txt
call npm run dev >> run_log.txt 2>&1

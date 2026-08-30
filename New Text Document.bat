@echo off
set "target=%~dp0dist\index.html"
set "shortcut=%userprofile%\Desktop\Rizwan Clothing.lnk"
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%shortcut%'); $s.TargetPath = '%target%'; $s.Save()"
echo Mubarak ho! Desktop par shortcut ban gaya hai.
pause
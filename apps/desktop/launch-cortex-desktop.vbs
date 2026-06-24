Set shell = CreateObject("WScript.Shell")
shell.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""C:\CORTEX\apps\desktop\launch-cortex-desktop.ps1""", 0, False

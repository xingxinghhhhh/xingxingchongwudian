$all = Get-Process | Where-Object { $_.ProcessName -eq 'chrome' -and $_.MainWindowTitle -ne '' }
$all | Select-Object Id, ProcessName, @{N='Title';E={$_.MainWindowTitle}} | Format-Table -AutoSize

Write-Host "---"
Write-Host "Python process 25512 stdin:"
$p = Get-Process -Id 25512 -ErrorAction SilentlyContinue
if ($p) { 
    Write-Host "Running, MainWindowTitle: '$($p.MainWindowTitle)'"
}

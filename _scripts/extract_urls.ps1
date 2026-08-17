$c = Get-Content "C:\Users\Neudron\.local\share\opencode\tool-output\tool_00b1bf7f7001cxr0G0RBg37Gun" -raw
$pattern = "https://calamitymod.wiki.gg/images/[^`""]*"
$matches = [regex]::Matches($c, $pattern)
$matches.Value | Select-Object -First 20
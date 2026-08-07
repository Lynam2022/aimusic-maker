# fix_utf8.ps1 - Fix invalid UTF-8 byte in route.ts
$filePath = "d:\nhac-ai\src\app\api\music\lyrics\route.ts"

Write-Host "Reading file as raw bytes..."
$bytes = [IO.File]::ReadAllBytes($filePath)
Write-Host "File size: $($bytes.Length) bytes"

# Find all non-UTF8-compliant bytes and report them
$badPositions = @()
$i = 0
while ($i -lt $bytes.Length) {
    $b = $bytes[$i]
    if ($b -lt 0x80) {
        $i++  # ASCII - fine
    } elseif ($b -ge 0xC0 -and $b -lt 0xE0) {
        # 2-byte sequence
        if ($i + 1 -lt $bytes.Length -and ($bytes[$i+1] -band 0xC0) -eq 0x80) {
            $i += 2  # valid
        } else {
            $badPositions += $i
            $i++
        }
    } elseif ($b -ge 0xE0 -and $b -lt 0xF0) {
        # 3-byte sequence
        if ($i + 2 -lt $bytes.Length -and ($bytes[$i+1] -band 0xC0) -eq 0x80 -and ($bytes[$i+2] -band 0xC0) -eq 0x80) {
            $i += 3  # valid
        } else {
            $badPositions += $i
            $i++
        }
    } elseif ($b -ge 0xF0) {
        # 4-byte sequence
        if ($i + 3 -lt $bytes.Length) {
            $i += 4
        } else {
            $badPositions += $i
            $i++
        }
    } else {
        # 0x80-0xBF alone is invalid (continuation byte without leader)
        $badPositions += $i
        $i++
    }
}

Write-Host "Bad byte positions: $badPositions"

if ($badPositions.Count -gt 0) {
    # Show context around each bad byte
    foreach ($pos in $badPositions) {
        $lineNum = 1
        for ($j = 0; $j -lt $pos; $j++) { if ($bytes[$j] -eq 10) { $lineNum++ } }
        $bval = $bytes[$pos]
        Write-Host "  Position $pos (line ~$lineNum): 0x$($bval.ToString('X2'))"
        
        # Replace bad byte with UTF-8 space (0x20) or remove it
        $bytes[$pos] = 0x20  # Replace with space
    }
    
    Write-Host "`nReplacing bad bytes with spaces and re-saving..."
    [IO.File]::WriteAllBytes($filePath, $bytes)
    Write-Host "Done! File saved. Bad bytes replaced: $($badPositions.Count)"
} else {
    Write-Host "No bad bytes found - file may already be clean UTF-8"
}

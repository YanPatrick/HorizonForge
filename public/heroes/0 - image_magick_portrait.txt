Para converter uma pasta inteira de uma vez
Abra o PowerShell, navegue até a pasta dos heróis e rode:


$magick = "C:\Program Files\ImageMagick-7.1.2-Q16-HDRI\magick.exe"

Get-ChildItem "C:\Fontes_Javascript\HorizonForge\public\heroes\originals\*" -Include "*.jpg","*.jpeg","*.png","*.webp" |
Where-Object { $_.Length -gt 100KB } |
ForEach-Object {
    $output = "C:\Fontes_Javascript\HorizonForge\public\heroes\$($_.BaseName).webp"
    & $magick $_.FullName -resize "300x>" -quality 92 $output
    Write-Host "OK: $($_.Name) -> $([math]::Round((Get-Item $output).Length/1KB))KB"
}
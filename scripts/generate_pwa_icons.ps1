Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path $env:USERPROFILE ".gemini\antigravity-ide\brain\5a5a5d03-03f9-4c8d-9656-dcf85fbf7029\.user_uploaded\media_1792026328436.png"
Write-Host "Source exists: $(Test-Path $sourcePath)"

$outDir = "d:\Perfil de usuario\Desktop\DulceArte26\public\assets\icons"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$srcImg = [System.Drawing.Image]::FromFile($sourcePath)

$sizes = @(48, 72, 96, 128, 144, 152, 180, 192, 384, 512)

foreach ($s in $sizes) {
    $destBmp = New-Object System.Drawing.Bitmap($s, $s)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($srcImg, 0, 0, $s, $s)
    $g.Dispose()

    if ($s -eq 180) {
        $destBmp.Save("$outDir\apple-touch-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
    }
    $destBmp.Save("$outDir\icon-${s}x${s}.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Dispose()
}

# Maskable icon: 512x512 with safe padding (10%) and cream background #fffaf5
$maskable = New-Object System.Drawing.Bitmap(512, 512)
$gm = [System.Drawing.Graphics]::FromImage($maskable)
$gm.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gm.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$bgColor = [System.Drawing.ColorTranslator]::FromHtml("#fffaf5")
$gm.Clear($bgColor)
$pad = 51
$gm.DrawImage($srcImg, $pad, $pad, 410, 410)
$gm.Dispose()
$maskable.Save("$outDir\maskable-icon-512x512.png", [System.Drawing.Imaging.ImageFormat]::Png)
$maskable.Dispose()

# Favicon 32x32
$fav = New-Object System.Drawing.Bitmap(32, 32)
$gf = [System.Drawing.Graphics]::FromImage($fav)
$gf.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gf.Clear([System.Drawing.Color]::Transparent)
$gf.DrawImage($srcImg, 0, 0, 32, 32)
$gf.Dispose()
$fav.Save("$outDir\favicon-32x32.png", [System.Drawing.Imaging.ImageFormat]::Png)
$fav.Dispose()

# Copy original to assets/images/logo_dulce_arte.png
Copy-Item -Path $sourcePath -Destination "d:\Perfil de usuario\Desktop\DulceArte26\public\assets\images\logo_dulce_arte.png" -Force

$srcImg.Dispose()
Write-Output "ALL_ICONS_SUCCESSFULLY_GENERATED"

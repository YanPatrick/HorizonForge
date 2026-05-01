# battle-swap.ps1
# Alterna entre os arquivos OFICIAIS e os arquivos DEV de batalha.
#
# Uso:
#   .\battle-swap.ps1              - detecta estado e alterna
#   .\battle-swap.ps1 -Init        - cria copias -dev pela primeira vez (sem trocar)
#   .\battle-swap.ps1 -Status      - mostra o estado atual sem fazer nada

param(
    [switch]$Init,
    [switch]$Status
)

$root = Join-Path $PSScriptRoot "public"

$files = @(
    @{ dir = "";    name = "battle.html" },
    @{ dir = "css"; name = "battle.css"  },
    @{ dir = "js";  name = "battle.js"   },
    @{ dir = "";    name = "mobile.css"  },
    @{ dir = "";    name = "mobile.js"   }
)

function Get-FilePath($f, $suffix) {
    $base  = if ($f.dir) { Join-Path $root $f.dir } else { $root }
    $parts = $f.name -split '\.',2
    $fname = if ($suffix) { "$($parts[0])-$suffix.$($parts[1])" } else { $f.name }
    return Join-Path $base $fname
}

$firstFile     = $files[0]
$backupPath    = Get-FilePath $firstFile "backup"
$devPath       = Get-FilePath $firstFile "dev"
$inDevMode     = Test-Path $backupPath
$devFilesExist = Test-Path $devPath

if ($Status) {
    if ($inDevMode) {
        Write-Host "[STATUS] Modo DEV ativo - arquivos oficiais estao em -backup." -ForegroundColor Yellow
    } elseif ($devFilesExist) {
        Write-Host "[STATUS] Modo OFICIAL ativo - arquivos -dev existem e estao aguardando." -ForegroundColor Cyan
    } else {
        Write-Host "[STATUS] Modo OFICIAL ativo - arquivos -dev ainda nao foram criados (rode -Init)." -ForegroundColor Gray
    }
    exit
}

if ($Init) {
    if ($inDevMode) {
        Write-Host "[AVISO] Voce esta em modo DEV. Volte para OFICIAL antes de usar -Init." -ForegroundColor Red
        exit 1
    }
    Write-Host "Criando arquivos -dev a partir dos oficiais..." -ForegroundColor Cyan
    foreach ($f in $files) {
        $src  = Get-FilePath $f $null
        $dest = Get-FilePath $f "dev"
        if (Test-Path $dest) {
            Write-Host "  JA EXISTE: $(Split-Path $dest -Leaf) (pulando)" -ForegroundColor DarkGray
        } else {
            Copy-Item $src $dest
            Write-Host "  CRIADO: $(Split-Path $dest -Leaf)" -ForegroundColor Green
        }
    }
    Write-Host ""
    Write-Host "Pronto! Edite os arquivos -dev e rode .\battle-swap.ps1 para ativa-los." -ForegroundColor Green
    exit
}

if ($inDevMode) {
    Write-Host "Voltando para modo OFICIAL..." -ForegroundColor Cyan
    foreach ($f in $files) {
        $official = Get-FilePath $f $null
        $dev      = Get-FilePath $f "dev"
        $backup   = Get-FilePath $f "backup"
        Rename-Item $official $dev
        Rename-Item $backup   $official
        Write-Host "  $($f.name)" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "OFICIAL ativo. Arquivos -dev preservados para proxima sessao." -ForegroundColor Green
} elseif ($devFilesExist) {
    Write-Host "Ativando modo DEV..." -ForegroundColor Yellow
    foreach ($f in $files) {
        $official = Get-FilePath $f $null
        $dev      = Get-FilePath $f "dev"
        $backup   = Get-FilePath $f "backup"
        Rename-Item $official $backup
        Rename-Item $dev      $official
        Write-Host "  $($f.name)" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "DEV ativo. Edite os arquivos normais e recarregue o browser." -ForegroundColor Yellow
    Write-Host "Rode .\battle-swap.ps1 de novo para voltar ao OFICIAL." -ForegroundColor DarkGray
} else {
    Write-Host "[ERRO] Arquivos -dev nao encontrados. Rode primeiro:" -ForegroundColor Red
    Write-Host "  .\battle-swap.ps1 -Init" -ForegroundColor White
    exit 1
}

param(
    [Parameter(Mandatory = $true)]
    [string]$IpAddress,
    [ValidateRange(1, 65535)]
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
$parsedIp = [System.Net.IPAddress]::None
if (-not [System.Net.IPAddress]::TryParse($IpAddress, [ref]$parsedIp) -or
    $parsedIp.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
    throw "Informe um endereço IPv4 válido da máquina que executa o NetStudy."
}

$projectRoot = Split-Path -Parent $PSCommandPath
$venvPython = Join-Path $projectRoot ".venv\Scripts\python.exe"
$python = if (Test-Path -LiteralPath $venvPython) { $venvPython } else { "python" }
$previousAllowedHosts = [Environment]::GetEnvironmentVariable("DJANGO_ALLOWED_HOSTS", "Process")

Push-Location $projectRoot
try {
    $env:DJANGO_ALLOWED_HOSTS = $IpAddress
    & $python manage.py migrate --noinput
    if ($LASTEXITCODE -ne 0) { throw "Falha ao aplicar as migrations do banco." }

    Write-Host "NetStudy na rede local: http://$($IpAddress):$Port/"
    Write-Host "Mantenha esta janela aberta enquanto outras máquinas acessam o site."
    & $python manage.py runserver "$($IpAddress):$Port"
    if ($LASTEXITCODE -ne 0) { throw "Não foi possível iniciar o servidor nesse IP e porta." }
}
finally {
    [Environment]::SetEnvironmentVariable("DJANGO_ALLOWED_HOSTS", $previousAllowedHosts, "Process")
    Pop-Location
}

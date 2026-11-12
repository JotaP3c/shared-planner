[CmdletBinding()]
param(
    [string]$ArchivePath = 'C:\shared-planner-private\google-calendar-2026.ical.zip',
    [Parameter(Mandatory=$true)][string]$MappingsFile,
    [string]$CredentialsFile = (Join-Path $env:USERPROFILE 'postgres-local\admin-credentials.txt'),
    [string]$ApiBase = 'http://127.0.0.1:8080',
    [int]$Year = 2026,
    [string]$ReportDirectory = 'C:\shared-planner-private\import-reports',
    [switch]$PrepareCalendars,
    [switch]$Apply,
    [switch]$VerifyIdempotence
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$apiUri=[uri]$ApiBase
if(-not $apiUri.IsLoopback -or $apiUri.Scheme -ne 'http'){ throw 'Este operador aceita apenas API local de desenvolvimento.' }
foreach($privatePath in @($ArchivePath,$MappingsFile,$ReportDirectory)){
    $resolved=[IO.Path]::GetFullPath($privatePath)
    $workspaceParent=Split-Path (Split-Path -Parent $PSScriptRoot) -Parent
    foreach($repo in @('shared-planner','shared-planner-backend','shared-planner-frontend')){
        $repoPath=Join-Path $workspaceParent $repo
        if($resolved.StartsWith($repoPath+'\',[StringComparison]::OrdinalIgnoreCase)){ throw 'Fontes e relatorios reais devem ficar fora dos repositorios Git.' }
    }
}
$mappings=Get-Content -LiteralPath $MappingsFile -Raw -Encoding UTF8 | ConvertFrom-Json
if(-not $mappings.confirmed){ throw 'Mapeamento precisa ser confirmado explicitamente antes da operacao.' }
$credentials=@{}
Get-Content -LiteralPath $CredentialsFile -Encoding UTF8 | ForEach-Object { if($_ -match '^\s*(email|password)=(.*)$'){ $credentials[$matches[1]]=$matches[2].Trim() } }
Add-Type -AssemblyName System.Net.Http
Add-Type -AssemblyName System.IO.Compression.FileSystem
$client=[Net.Http.HttpClient]::new()
$client.BaseAddress=$apiUri
$client.Timeout=[TimeSpan]::FromMinutes(5)
function Invoke-Json([string]$Method,[string]$Url,$Body=$null){
    $message=[Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::new($Method),$Url)
    try {
        if($null -ne $Body){ $message.Content=[Net.Http.StringContent]::new(($Body | ConvertTo-Json -Depth 20 -Compress),[Text.Encoding]::UTF8,'application/json') }
        $response=$client.SendAsync($message).GetAwaiter().GetResult()
        try {
            $payload=$response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            if(-not $response.IsSuccessStatusCode){ throw ('HTTP '+[int]$response.StatusCode+' em '+$Url+'; nenhum conteudo privado foi impresso.') }
            if($payload){ return ,($payload | ConvertFrom-Json) }
        } finally { $response.Dispose() }
    } finally { $message.Dispose() }
}
$archive=$null
try {
    $session=Invoke-Json POST '/api/auth/login' @{email=$credentials['email'];password=$credentials['password']}
    $client.DefaultRequestHeaders.Authorization=[Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer',$session.accessToken)
    $users=Invoke-Json GET '/api/users'
    $calendars=Invoke-Json GET '/api/calendars'
    $archive=[IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $ArchivePath).Path)
    $reports=[Collections.Generic.List[object]]::new()
    $summaries=[Collections.Generic.List[object]]::new()
    foreach($mapping in $mappings.calendars){
        $owner=@($users | Where-Object { $_.email -eq $mapping.ownerEmail -and $_.active })
        if($owner.Count -ne 1){ throw ('Proprietario ativo nao identificado inequivocamente: '+$mapping.alias) }
        $targets=@($calendars | Where-Object { $_.ownerEmail -eq $mapping.ownerEmail -and $_.calendarType -eq $mapping.calendarType -and ($mapping.calendarType -eq 'PERSONAL' -or $_.name -eq $mapping.calendarName) })
        if($targets.Count -eq 0 -and $PrepareCalendars -and $mapping.calendarType -eq 'IMPORTED'){
            $created=Invoke-Json POST '/api/calendars' @{name=$mapping.calendarName;calendarType='IMPORTED';ownerEmail=$mapping.ownerEmail}
            $targets=@($created)
            $calendars=@($calendars)+$created
        }
        if($targets.Count -ne 1){ throw ('Calendario destino ausente ou ambiguo: '+$mapping.alias) }
        $target=$targets[0]
        $members=Invoke-Json GET ('/api/calendars/'+$target.id+'/members')
        $otherMembers=@($members | Where-Object { $_.userEmail -ne $mapping.ownerEmail })
        if($otherMembers.Count -gt 0){ throw ('Destino nao e privado do proprietario; revise compartilhamento antes da carga real: '+$mapping.alias) }
        $entries=@($archive.Entries | Where-Object FullName -eq $mapping.archiveEntry)
        if($entries.Count -ne 1){ throw ('Arquivo ICS ausente ou ambiguo: '+$mapping.alias) }
        $reader=[IO.StreamReader]::new($entries[0].Open(),[Text.Encoding]::UTF8)
        try { $ical=$reader.ReadToEnd() } finally { $reader.Dispose() }
        $allowPrivate=$mapping.PSObject.Properties.Name -contains 'privateEventsAuthorized' -and $mapping.privateEventsAuthorized
        $body=@{ical=$ical;sourceCalendarId=$mapping.sourceCalendarId;targetCalendarId=$target.id;zoneId='America/Sao_Paulo';windowStart=('{0}-01-01' -f $Year);windowEnd=('{0}-12-31' -f $Year);mappingConfirmed=$false;privateEventsAuthorized=[bool]$allowPrivate}
        $preview=Invoke-Json POST '/api/calendar-imports/preview' $body
        $result=$null;$repeat=$null
        if($Apply){
            $body.mappingConfirmed=$true
            $result=Invoke-Json POST '/api/calendar-imports/commit' $body
            if($VerifyIdempotence){
                $repeat=Invoke-Json POST '/api/calendar-imports/commit' $body
                if($repeat.imported -ne 0){ throw 'A segunda importacao criou registros; interromper e investigar.' }
            }
        }
        $reports.Add([pscustomobject]@{Alias=$mapping.alias;SourceCalendarId=$mapping.sourceCalendarId;TargetCalendarId=$target.id;Owner=$mapping.ownerEmail;Preview=$preview;Result=$result;Repeated=$repeat})
        $rows=@($preview.rows)
        $summary=[pscustomobject]@{
            Alias=$mapping.alias;InputRecords=([regex]::Matches($ical,'(?m)^BEGIN:VEVENT\r?$')).Count;
            RowsInYear=$rows.Count;Ready=@($rows | Where-Object state -eq 'READY').Count;
            Blocked=[int]$preview.blocked;PreviouslyImported=[int]$preview.duplicates;
            RecurringOccurrences=@($rows | Where-Object { $_.recurrenceId -and $_.state -ne 'BLOCKED' }).Count;
            Imported=if($result){[int]$result.imported}else{0};RepeatImported=if($repeat){[int]$repeat.imported}else{0};RepeatDuplicates=if($repeat){[int]$repeat.duplicates}else{0};
            October=@($rows | Where-Object { $_.startsAt -like "$Year-10-*" -and $_.state -ne 'BLOCKED' }).Count;
            November=@($rows | Where-Object { $_.startsAt -like "$Year-11-*" -and $_.state -ne 'BLOCKED' }).Count;
            December=@($rows | Where-Object { $_.startsAt -like "$Year-12-*" -and $_.state -ne 'BLOCKED' }).Count;
            BlockReasons=@($rows | Where-Object state -eq 'BLOCKED' | Group-Object reason | ForEach-Object { [pscustomobject]@{Reason=$_.Name;Count=$_.Count} })
        }
        $summaries.Add($summary)
    }
    New-Item -ItemType Directory -Path $ReportDirectory -Force | Out-Null
    $reportFile=Join-Path $ReportDirectory ('google-import-'+(Get-Date -Format 'yyyyMMddTHHmmss')+$(if($Apply){'-applied'}else{'-preview'})+'.json')
    [ordered]@{CreatedAt=(Get-Date).ToString('o');Year=$Year;Applied=[bool]$Apply;ArchiveSHA256=(Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256).Hash;Summary=$summaries.ToArray();Calendars=$reports.ToArray()} | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $reportFile -Encoding UTF8
    [pscustomobject]@{ReportFile=$reportFile;Applied=[bool]$Apply;Summary=$summaries.ToArray()} | ConvertTo-Json -Depth 8
} finally {
    if($archive){ $archive.Dispose() }
    $client.Dispose()
}

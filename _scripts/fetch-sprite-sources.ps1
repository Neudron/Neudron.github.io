# fetch-sprite-sources.ps1 — re-download the Calamity source textures that
# _scripts\verify-sprites.mjs checks the shipped crops against.
#
#   powershell -ExecutionPolicy Bypass -File _scripts\fetch-sprite-sources.ps1
#
# Downloads verbatim from github.com/CalamityTeam/CalamityModPublic @ 1.4.4
# into _sources\calamity\ (gitignored — this is the Calamity team's art).
# ~47 files, a few hundred KB total.

$ErrorActionPreference = 'Stop'
$base = 'https://raw.githubusercontent.com/CalamityTeam/CalamityModPublic/1.4.4'
$dir  = Join-Path $PSScriptRoot '..\_sources\calamity'
New-Item -ItemType Directory -Force $dir | Out-Null

$files = @(
  'NPCs/SupremeCalamitas/BrimstoneHeart.png',
  'NPCs/SupremeCalamitas/ForcefieldTexture.png',
  'NPCs/SupremeCalamitas/HoodedHeadIcon.png',
  'NPCs/SupremeCalamitas/HoodlessHeadIcon.png',
  'NPCs/SupremeCalamitas/SepulcherArm.png',
  'NPCs/SupremeCalamitas/SepulcherBody.png',
  'NPCs/SupremeCalamitas/SepulcherBodyAlt.png',
  'NPCs/SupremeCalamitas/SepulcherBodyEnergyBall.png',
  'NPCs/SupremeCalamitas/SepulcherForearm.png',
  'NPCs/SupremeCalamitas/SepulcherHand.png',
  'NPCs/SupremeCalamitas/SepulcherHead.png',
  'NPCs/SupremeCalamitas/SepulcherTail.png',
  'NPCs/SupremeCalamitas/SoulSeekerSupreme.png',
  'NPCs/SupremeCalamitas/SoulSeekerSupremeGlow.png',
  'NPCs/SupremeCalamitas/SupremeCalamitas.png',
  'NPCs/SupremeCalamitas/SupremeCalamitasHooded.png',
  'NPCs/SupremeCalamitas/SupremeCataclysm.png',
  'NPCs/SupremeCalamitas/SupremeCataclysmGlow.png',
  'NPCs/SupremeCalamitas/SupremeCatastrophe.png',
  'NPCs/SupremeCalamitas/SupremeCatastropheGlow.png',
  'NPCs/SupremeCalamitas/SupremePermafrost.png',
  'NPCs/SupremeCalamitas/SupremeShieldBottom.png',
  'NPCs/SupremeCalamitas/SupremeShieldTop.png',
  'NPCs/Polterghast/PolterPhantom.png',
  'NPCs/Polterghast/Polterghast.png',
  'NPCs/Polterghast/PolterghastChain.png',
  'NPCs/Polterghast/PolterghastGlow.png',
  'NPCs/Polterghast/PolterghastGlow2.png',
  'NPCs/Polterghast/PolterghastHook.png',
  'Projectiles/Boss/BrimstoneHellblast.png',
  'Projectiles/Boss/BrimstoneHellblast2.png',
  'Projectiles/Boss/SCalBrimstoneFireblast.png',
  'Projectiles/Boss/SCalBrimstoneGigablast.png',
  'Projectiles/Boss/SupremeCataclysmFist.png',
  'Projectiles/Boss/SupremeCataclysmFistAlt.png',
  'Projectiles/Boss/SupremeCatastropheSlash.png',
  'Projectiles/Boss/SupremeCatastropheSlashAlt.png',
  'Projectiles/Boss/BrimstoneBarrage.png',
  'Projectiles/Boss/PhantomBlast.png',
  'Projectiles/Boss/PhantomBlast2.png',
  'Projectiles/Boss/PhantomGhostShot.png',
  'Projectiles/Boss/PhantomHookShot.png',
  'Projectiles/Boss/PhantomMine.png',
  'Items/Materials/AshesofAnnihilation.png',
  'UI/Rippers/RageBar.png',
  'UI/Rippers/RageBarBorder.png',
  'UI/Rippers/RageFullAnimation.png'
)

$ok = 0; $bad = @()
foreach ($f in $files) {
  $name = Split-Path $f -Leaf
  $dest = Join-Path $dir $name
  curl.exe -s -m 30 -o $dest "$base/$f"
  if ((Test-Path $dest) -and ((Get-Item $dest).Length -gt 100)) { $ok++ }
  else { $bad += $f }
}
Write-Output "downloaded ok=$ok failed=$($bad.Count)"
if ($bad.Count) { $bad | ForEach-Object { Write-Output "  FAILED: $_" }; exit 1 }

Write-Output 'verifying shipped crops against fresh sources...'
node (Join-Path $PSScriptRoot 'verify-sprites.mjs')

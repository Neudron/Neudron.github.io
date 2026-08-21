#!/usr/bin/env python3
"""fetch-calamity-sprites.py — download Calamity Mod sprites from the official repo.

Downloads every .png the site uses from CalamityTeam/CalamityModPublic@1.4.4,
into _scripts/out/calamity-sprites/. Then compares them byte-for-byte with
the ones already in site/img/act4/calamity/.
"""
import urllib.request, json, os, hashlib, sys

REPO = "CalamityTeam/CalamityModPublic"
BRANCH = "1.4.4"
RAW = f"https://raw.githubusercontent.com/{REPO}/{BRANCH}/"
API = f"https://api.github.com/repos/{REPO}/contents/"

OUT = os.path.join(os.path.dirname(__file__), "out", "calamity-sprites")
SITE = os.path.join(os.path.dirname(__file__), "..", "site", "img", "act4", "calamity")
os.makedirs(OUT, exist_ok=True)

# Map: local filename -> (repo path, repo filename)
# Built from the GitHub API listing of NPCs/SupremeCalamitas, NPCs/Polterghast,
# and Projectiles/Boss directories.
SPRITES = {
    # Supreme Calamitas NPC directory
    "SupremeCalamitas.png":          ("NPCs/SupremeCalamitas", "SupremeCalamitas.png"),
    "SupremeCalamitasHooded.png":    ("NPCs/SupremeCalamitas", "SupremeCalamitasHooded.png"),
    "BrimstoneHeart.png":            ("NPCs/SupremeCalamitas", "BrimstoneHeart.png"),
    "ForcefieldTexture.png":         ("NPCs/SupremeCalamitas", "ForcefieldTexture.png"),
    "HoodedHeadIcon.png":            ("NPCs/SupremeCalamitas", "HoodedHeadIcon.png"),
    "HeadIcon.png":                  ("NPCs/SupremeCalamitas", "HeadIcon.png"),
    # Sepulcher (the worm) — in NPCs/SupremeCalamitas
    "SepulcherHead.png":             ("NPCs/SupremeCalamitas", "SepulcherHead.png"),
    "SepulcherBody.png":             ("NPCs/SupremeCalamitas", "SepulcherBody.png"),
    "SepulcherBodyAlt.png":          ("NPCs/SupremeCalamitas", "SepulcherBodyAlt.png"),
    "SepulcherTail.png":             ("NPCs/SupremeCalamitas", "SepulcherTail.png"),
    "SepulcherArm.png":              ("NPCs/SupremeCalamitas", "SepulcherArm.png"),
    "SepulcherForearm.png":          ("NPCs/SupremeCalamitas", "SepulcherForearm.png"),
    "SepulcherHand.png":             ("NPCs/SupremeCalamitas", "SepulcherHand.png"),
    # Polterghast
    "Polterghast.png":               ("NPCs/Polterghast", "Polterghast.png"),
    "PolterghastGlow.png":           ("NPCs/Polterghast", "PolterghastGlow.png"),
    "PolterghastGlow2.png":          ("NPCs/Polterghast", "PolterghastGlow2.png"),
    "PolterghastHook.png":           ("NPCs/Polterghast", "PolterghastHook.png"),
    "PolterghastChain.png":          ("NPCs/Polterghast", "PolterghastChain.png"),
    # Projectiles — need to find exact paths. These are in Projectiles/Boss/
    "BrimstoneBarrage.png":          ("Projectiles/Boss", "BrimstoneBarrage.png"),
    "BrimstoneHellblast2.png":       ("Projectiles/Boss", "BrimstoneHellblast2.png"),
    "SCalBrimstoneFireblast.png":    ("Projectiles/Boss", "SCalBrimstoneFireblast.png"),
    "SCalBrimstoneGigablast.png":    ("Projectiles/Boss", "SCalBrimstoneGigablast.png"),
    "SupremeCataclysmFist.png":      ("Projectiles/Boss", "SupremeCataclysmFist.png"),
    "SupremeCataclysmFistAlt.png":   ("Projectiles/Boss", "SupremeCataclysmFistAlt.png"),
    "SupremeCatastropheSlash.png":   ("Projectiles/Boss", "SupremeCatastropheSlash.png"),
    "SupremeCatastropheSlashAlt.png":("Projectiles/Boss", "SupremeCatastropheSlashAlt.png"),
    "AshesofAnnihilation.png":       ("Projectiles/Boss", "AshesofAnnihilation.png"),
    # Polterghast projectiles
    "PhantomBlast.png":              ("Projectiles/Boss", "PhantomBlast.png"),
    "PhantomBlast2.png":             ("Projectiles/Boss", "PhantomBlast2.png"),
    "PhantomGhostShot.png":          ("Projectiles/Boss", "PhantomGhostShot.png"),
    "PhantomHookShot.png":           ("Projectiles/Boss", "PhantomHookShot.png"),
    "PhantomMine.png":               ("Projectiles/Boss", "PhantomMine.png"),
}

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()

def md5(data):
    return hashlib.md5(data).hexdigest()

results = {"downloaded": [], "same": [], "different": [], "failed": [], "local_only": []}

for local_name, (repo_dir, repo_name) in sorted(SPRITES.items()):
    raw_url = RAW + repo_dir + "/" + repo_name
    local_path = os.path.join(SITE, local_name)
    out_path = os.path.join(OUT, local_name)

    # Download
    try:
        data = fetch(raw_url)
        with open(out_path, "wb") as f:
            f.write(data)
    except Exception as e:
        results["failed"].append((local_name, str(e)[:80]))
        continue

    # Compare with local
    if os.path.exists(local_path):
        local_data = open(local_path, "rb").read()
        if md5(data) == md5(local_data):
            results["same"].append(local_name)
        else:
            results["different"].append((local_name, len(local_data), len(data)))
    else:
        results["local_only"].append(local_name)

# Check for local sprites not in our map
for f in os.listdir(SITE):
    if f.endswith(".png") and f not in SPRITES:
        results["local_only"].append(f + " (not in download map)")

print("=== RESULTS ===")
print(f"Downloaded and identical to local: {len(results['same'])}")
for n in results["same"]: print(f"  ✓ {n}")
print(f"\nDownloaded but DIFFERENT from local: {len(results['different'])}")
for n, old, new in results["different"]: print(f"  ⚠ {n}  local={old}B  repo={new}B")
print(f"\nFailed to download: {len(results['failed'])}")
for n, e in results["failed"]: print(f"  ✗ {n}: {e}")
print(f"\nLocal but not in download map: {len(results['local_only'])}")
for n in results["local_only"]: print(f"  ? {n}")

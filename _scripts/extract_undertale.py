import re

with open(r'C:\Users\Neudron\.local\share\opencode\tool-output\tool_00b299b56001h58pfTRdCzBi9i', 'r', errors='replace') as f:
    c = f.read()

# Look for image URLs from undertale.wiki.gg
matches = re.findall(r'https?://undertale\.wiki\.gg/images/[^"\s]+\.(?:png|gif)', c)
print(f'Found {len(matches)} image URLs from undertale.wiki.gg')
for m in matches[:30]:
    print(m)

# Also search for 'fire' or 'door' in URLs
fire_matches = [m for m in matches if 'fire' in m.lower() or 'door' in m.lower()]
print(f'\nFire/door matches: {len(fire_matches)}')
for m in fire_matches[:10]:
    print(m)
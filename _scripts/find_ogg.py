import re

with open(r'C:\Users\Neudron\.local\share\opencode\tool-output\tool_00b1bf7f7001cxr0G0RBg37Gun', 'r', errors='replace') as f:
    c = f.read()

# Search for .ogg audio URLs
# The wiki might host audio files at /images/ or another path
matches = re.findall(r'https?://[^"\s]+\.ogg[^"\s]*', c)
print(f"Total .ogg matches: {len(matches)}")
for m in matches[:30]:
    print(m)

# Also search for calamitymod domains with ogg
matches2 = re.findall(r'https?://calamitymod[^"\s]+\.ogg[^"\s]*', c)
print(f"\nCalamitymod .ogg matches: {len(matches2)}")
for m in matches2[:10]:
    print(m)
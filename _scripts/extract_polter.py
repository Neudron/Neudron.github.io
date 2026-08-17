import re

with open(r'C:\Users\Neudron\.local\share\opencode\tool-output\tool_00b1bfa110012ND1F3QRMkvIo6', 'rb') as f:
    c = f.read().decode('utf-8', errors='replace')

# Find image URLs
matches = re.findall(r'https?://calamitymod\.wiki\.gg/images/[^"\s]+', c)
png_matches = [m for m in matches if m.endswith('.png') or m.endswith('.gif')]

print(f"Total image URLs: {len(matches)}")
print(f"PNG/GIF URLs: {len(png_matches)}")

# Filter for relevant ones
relevant_keywords = [
    'polter', 'phantom', 'shot', 'blast', 'orb', 'hook', 'chain',
    'potent', 'phase', 'body'
]

for m in png_matches:
    lower = m.lower()
    if any(k in lower for k in relevant_keywords):
        print(m)
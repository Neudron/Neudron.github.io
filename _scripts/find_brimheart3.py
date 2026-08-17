import re

with open(r'C:\Users\Neudron\.local\share\opencode\tool-output\tool_00b1bf7f7001cxr0G0RBg37Gun', 'r', errors='replace') as f:
    c = f.read()

# Search specifically for Heart.png image URL 
matches = re.findall(r'https?://calamitymod\.wiki\.gg/images/[^"\s]+\.png', c)
# Print all png matches that contain 'heart' (case insensitive)
heart_pngs = [m for m in matches if 'heart' in m.lower()]
print(f"PNG with 'heart' in filename: {len(heart_pngs)}")
for m in heart_pngs:
    print(m)

# Also search for just "Heart" as a separate word in the URL
heart_pngs2 = [m for m in matches if re.search(r'[?&]heart|heart[?=&]', m, re.IGNORECASE)]
print(f"\nPNG with heart parameter: {len(heart_pngs2)}")
for m in heart_pngs2:
    print(m)
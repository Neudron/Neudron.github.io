import re
with open(r"C:\Users\Neudron\.local\share\opencode\tool-output\tool_00b1bf7f7001cxr0G0RBg37Gun", "r") as f:
    c = f.read()
# Search for Brimstone Heart image
matches = re.findall(r'https?://calamitymod\.wiki\.gg/images/[^"\s]*Heart[^"\s]*', c)
for m in matches[:10]:
    print(m)
# Also search for just "Heart" in png urls
matches2 = re.findall(r'https?://calamitymod\.wiki\.gg/images/[^"\s]+\.png', c)
png_matches = [m for m in matches2 if 'heart' in m.lower()]
for m in png_matches[:10]:
    print("PNG:", m)
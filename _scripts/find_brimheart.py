import re

with open(r'C:\Users\Neudron\.local\share\opencode\tool-output\tool_00b1bf7f7001cxr0G0RBg37Gun', 'r', errors='replace') as f:
    c = f.read()

# Search for Brimstone Heart
for pattern in ['Brimstone Heart', 'brimstone_heart', 'Brimstone_Hart']:
    idx = c.find(pattern)
    if idx >= 0:
        print(f'Found "{pattern}" at {idx}')
        print(c[max(0,idx-50):idx+100])
        print('---')

# Search for Heart.png near Brimstone
matches = re.findall(r'https?://calamitymod\.wiki\.gg/images/[^"\s]*Heart[^"\s]*', c)
for m in matches[:5]:
    print('Heart URL:', m)

# Also search for just heart in png urls
matches2 = re.findall(r'https?://calamitymod\.wiki\.gg/images/[^"\s]+\.png', c)
png_matches = [m for m in matches2 if 'heart' in m.lower()]
for m in png_matches[:10]:
    print('PNG Heart:', m)
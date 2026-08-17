import re

with open(r'C:\Users\Neudron\.local\share\opencode\tool-output\tool_00b1bf7f7001cxr0G0RBg37Gun', 'r', errors='replace') as f:
    c = f.read()

# Look for any image ref containing "Brimstone" + "Heart"
lines = c.split('\n')
for i, line in enumerate(lines):
    if 'Brimstone' in line and 'Heart' in line:
        start = max(0, i-2)
        end = min(len(lines), i+3)
        for j in range(start, end):
            print(f"Line {j}: {lines[j][:200]}")
        print("---")
        break

# Also search for image URLs with "heart" 
matches = re.findall(r'https?://calamitymod\.wiki\.gg/images/[^"\s]+\.png', c)
for m in matches:
    if 'heart' in m.lower():
        print("PNG with heart:", m)
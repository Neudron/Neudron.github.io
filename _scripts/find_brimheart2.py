import re

with open(r'C:\Users\Neudron\.local\share\opencode\tool-output\tool_00b1bf7f7001cxr0G0RBg37Gun', 'r', errors='replace') as f:
    c = f.read()

# Search for Brimstone Heart image URL pattern
matches = re.findall(r'/images/[^"\s]+\.?[^"\s]*', c)
# Filter for heart or brimstone
relevant = [m for m in matches if 'heart' in m.lower() or 'brim' in m.lower()]
print(f"Heart/brim matches: {len(relevant)}")
for m in relevant[:20]:
    print(m)
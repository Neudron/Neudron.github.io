import re

with open(r'C:\Users\Neudron\.local\share\opencode\tool-output\tool_00b1bf7f7001cxr0G0RBg37Gun', 'r', errors='replace') as f:
    c = f.read()

# Find all image URLs from both domains
matches1 = re.findall(r'https?://calamitymod\.wiki\.gg/images/[^"\s]+\.(?:png|gif)', c)
matches2 = re.findall(r'https?://commons\.wiki\.gg/images/[^"\s]+\.(?:png|gif)', c)
print(f'calamitymod images: {len(matches1)}')
print(f'commons images: {len(matches2)}')
# Show a few from each
print('\nFirst calamitymod:')
for m in matches1[:5]:
    print(m)
print('\nFirst commons:')
for m in matches2[:5]:
    print(m)
# Also search for heart/brim
heart_matches = [m for m in matches1 + matches2 if 'heart' in m.lower() or 'brim' in m.lower()]
print('\nHeart/brim matches:')
for m in heart_matches[:20]:
    print(m)
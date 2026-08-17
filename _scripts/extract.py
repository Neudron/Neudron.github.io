import re, os

filepath = r"C:\Users\Neudron\.local\share\opencode\tool-output\tool_00b1bf7f7001cxr0G0RBg37Gun"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Find all image references from calamitymod.wiki.gg
pattern = r'https?://calamitymod\.wiki\.gg/images/[^\s"]+'
matches = re.findall(pattern, content)
print(f"Found {len(matches)} image URLs")
for i, m in enumerate(matches[:40]):
    print(f"{i+1}: {m}")
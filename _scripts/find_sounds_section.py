import re

with open(r'C:\Users\Neudron\.local\share\opencode\tool-output\tool_00b1bf7f7001cxr0G0RBg37Gun', 'r', errors='replace') as f:
    c = f.read()

idx = c.find('Sounds')
if idx >= 0:
    sounds_section = c[idx:idx+5000]
    print("Sounds section found, length:", len(sounds_section))
    
    ogg_matches = re.findall(r'https?://[^"\s]+\.ogg[^"\s]*', sounds_section)
    print(".ogg in sounds section:", len(ogg_matches))
    
    file_refs = re.findall(r'File:[^"\s]+', sounds_section)
    print("File: refs:", len(file_refs))
    for f in file_refs[:10]:
        print("  ", f[:100])
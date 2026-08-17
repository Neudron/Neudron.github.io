import re

with open(r'C:\Users\Neudron\.local\share\opencode\tool-output\tool_00b1bf7f7001cxr0G0RBg37Gun', 'r', errors='replace') as f:
    c = f.read()

sounds = ['Brimstone Hellblast Cast', 'Brimstone Fireblast Cast', 'Brimstone Fireblast Impact', 
          'Brimstone Gigablast Cast', 'Brimstone Gigablast Impact', 'Whispering Maelstrom Spawn']

for sound in sounds:
    idx = c.find(sound)
    if idx >= 0:
        print(f'Found: {sound}')
    else:
        print(f'Not found: {sound}')
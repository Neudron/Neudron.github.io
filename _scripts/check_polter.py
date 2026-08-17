import re

with open(r'C:\Users\Neudron\.local\share\opencode\tool-output\tool_00b1bfa110012ND1F3QRMkvIo6', 'r', errors='replace') as f:
    c = f.read()

# Look for Polterghast related image refs
for pattern in ['Polterghast.png', 'Phantom_Shot', 'Phantom_Blast', 'Potent_Phantom', 'Phantom_Orb', 'Polterghast_Hook', 'Polterghast_Chain']:
    idx = c.find(pattern)
    if idx >= 0:
        print(f'Found "{pattern}" at position {idx}')
        start = max(0, idx-100)
        end = min(len(c), idx+100)
        print(c[start:end])
        print('---')
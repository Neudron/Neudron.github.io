import urllib.request
import re

url = "https://sprites-resource.com/pc_computer/undertale/sheet/papyrus/"
headers = {'User-Agent': 'Mozilla/5.0'}
req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req, timeout=15) as response:
        html = response.read().decode('utf-8', errors='replace')
        # Find image links
        matches = re.findall(r'https?://[^\"\s]+\.(?:png|gif|jpg)[^\"\s]*', html)
        for m in matches[:30]:
            lower = m.lower()
            if any(x in lower for x in ['fire', 'door', 'armchair', 'chair']):
                print(m)
        print(f"\nTotal matches: {len(matches)}")
except Exception as e:
    print(f"Error: {e}")
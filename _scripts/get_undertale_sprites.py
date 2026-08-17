import urllib.request
import re

url = "https://www.spriters-resource.com/pc_computer/undertale/"
headers = {'User-Agent': 'Mozilla/5.0'}
req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req, timeout=15) as response:
        html = response.read().decode('utf-8', errors='replace')
        # Find image links
        matches = re.findall(r'https?://[^\"\s]+\.(?:png|gif|jpg)', html)
        # Filter for toriel/armchair/firedoor related
        for m in matches[:50]:
            lower = m.lower()
            if any(x in lower for x in ['toriel', 'armchair', 'firedoor', 'new_home', 'home']):
                print(m)
        print(f"\nTotal image URLs: {len(matches)}")
except Exception as e:
    print(f"Error: {e}")
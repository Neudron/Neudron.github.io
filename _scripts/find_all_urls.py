import re

with open(r'C:\Users\Neudron\.local\share\opencode\tool-output\tool_00b1bf7f7001cxr0G0RBg37Gun', 'r', errors='replace') as f:
    c = f.read()

# Search for any URLs ending in .ogg or containing audio patterns
# Also search for "Cast" and "Impact" near potential URLs

# Look for any http URLs in the content
all_urls = re.findall(r'https?://[^"\s]+', c)
print(f"Total URLs: {len(all_urls)}")

# Filter for calamitymod or wiki domains
calamity_urls = [u for u in all_urls if 'calamitymod' in u.lower() or 'wiki.gg' in u.lower()]
print(f"\nCalamity/wiki URLs: {len(calamity_urls)}")
for u in calamity_urls[:30]:
    print(u)

# Look for ogg in any URL
ogg_urls = [u for u in all_urls if '.ogg' in u.lower()]
print(f"\nAll .ogg URLs: {len(ogg_urls)}")
for u in ogg_urls[:20]:
    print(u)
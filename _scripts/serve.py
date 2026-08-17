"""
neu - local dev server.

Python's stock `http.server` sends Last-Modified and nothing else, so a
browser is free to reuse a cached stylesheet or script for the rest of
the session. Firefox is noticeably keener on this than Chromium, which
is exactly how you end up with "it looks right in one browser and stale
in the other" after an edit.

This sends no-store on everything, so a plain refresh always shows the
current files. Nothing else differs from `python -m http.server`.
"""

import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("   " + (fmt % args) + "\n")


socketserver.TCPServer.allow_reuse_address = True

try:
    with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
        print("   caching disabled - a plain refresh always reloads")
        print()
        httpd.serve_forever()
except OSError as e:
    print()
    print("   Could not bind port %d: %s" % (PORT, e))
    print("   Something else is using it. Edit PORT at the top of serve.bat.")
    print()
    input("   Press Enter to close...")
except KeyboardInterrupt:
    pass

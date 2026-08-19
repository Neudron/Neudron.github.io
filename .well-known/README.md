# `.well-known/`

## `discord`

One line: `dh=<hash>`. It is Discord's **domain verification** token. Served
at `https://www.neu.ac/.well-known/discord` it proves to Discord that whoever
controls the Discord profile or server also controls neu.ac, which is what
lets the domain show as a verified link there.

It is a public token by design — the whole point is that anyone, including
Discord, can fetch it. Publishing it leaks nothing.

**Restored 2026-08-17** after sitting in `_removed-from-main/` for a while.
Restoring a verification that already existed is the conservative move: it
costs 43 bytes, nothing on the site reads it, and it only works if it is
sitting at this exact path *before* Discord next checks — so leaving it out
means the verification lapses silently and the fix is only obvious to someone
who remembers this file used to exist.

## `.nojekyll` (in the repo root, not here)

Added at the same time, and worth being accurate about why, because the
obvious explanation is wrong for this repo.

The usual story is "Jekyll eats directories beginning with a dot, so
`.well-known` vanished". That is true of GitHub Pages when the source is set
to **Deploy from a branch** — Jekyll runs, and it drops paths starting with
`.` or `_`.

**This repo does not work that way.** Its Pages source is *GitHub Actions*,
and `.github/workflows/deploy.yml` uploads the checkout as-is with
`actions/upload-pages-artifact`. No Jekyll runs, so dotfiles are already
served and `.nojekyll` changes nothing today.

It is there as insurance. If anyone ever switches the Pages source back to
"Deploy from a branch" — which is the setting most guides tell you to use —
Jekyll starts running and this file is the one thing standing between
`.well-known/discord` and being silently dropped again. Zero bytes for a
failure mode that has, apparently, already happened once.

**To revert either:** delete the file. Nothing references them.

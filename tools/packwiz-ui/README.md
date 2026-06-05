# Packwiz UI

Local browser UI for this modpack.

## Run

```sh
npm run ui
```

Open http://127.0.0.1:4173.

## Notes

- Adding mods calls the local `packwiz` binary. Install `packwiz` and make sure it is in `PATH`.
- Removing mods works for files in `mods/` and refreshes `index.toml` plus the index hash in `pack.toml`.
- Push runs `git add -A`, `git commit -m <message>`, then `git push <remote> <current-branch>`.
- The server binds to `127.0.0.1` and has no auth, so keep it local.

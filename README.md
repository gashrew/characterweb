# CharacterWeb

A book character mapper: characters, relationships, family units, groups, notes, timelines and quotes for each book, drawn as a movable diagram.

Everything runs in the browser. Books are saved in the browser's local storage on each device; use **Export as JSON** / **Import JSON** to move them between devices or keep backups.

Originally built on Manus; moved to a standalone app in October 2026.

## Develop

```
npm install
npm run dev      # local dev server on port 3000
npm run check    # type-check
npm run build    # production build into dist/
```

Pushing to `main` builds and publishes the site to GitHub Pages automatically.

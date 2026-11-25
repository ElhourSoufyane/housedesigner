# HouseDesigner — 2D & 3D Home Planner

A browser and desktop house planner: draw walls, drop doors and windows, paint
floors, and furnish multi-story rooms on a 0.5 m grid — then walk through your
design in first-person 3D with day/night lighting, weather, and live co-op.

## Run it

```
node server.js
```

Then open http://localhost:8000 (2D editor: `index.html`, 3D showroom: `play3d.html`).

No build step required for web — plain HTML/CSS/JS (plus optional Electron & Capacitor wrappers).

## Features

- Multi-floor walls / doors / windows / fences / stairs drawn on a cell grid
- 1,000+ furniture items in a searchable catalog, with colour variants & procedural 3D models
- Wall-mounted items (TVs, cabinets, shelves, sconces, AC units, clocks,
  mirrors, art…) pin to the wall edge and share their cell with floor
  furniture — a dresser can sit under a wall clock
- Tabletop items (laptop, kettle, toaster, vases…) only place on surfaces
- Multi-select: drag a box, then move / copy / rotate / delete as a set
- Fine snap: `H` toggles 0.5 m cells ↔ 0.25 m half-cells (`G` toggles the grid)
- Connected furniture pieces act as one; undo/redo; JSON save/backup files
- First-person 3D walk mode, weather & day/night cycle, and live PeerJS co-op

## Tests

```
npm test              # runs all 6 core suites (geom3d, physics, graphics, smoke, floors, render)
node test-smoke.js    # editor logic
node test-render.js   # every catalog sprite variant
node test-floors.js   # floor material painters
```

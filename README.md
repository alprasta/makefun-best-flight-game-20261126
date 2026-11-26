# Merapi Ridge Run — a bush-plane flight game

A chase-view flight game built for the make.fun bounty
**best-flight-game-20261126-0057** ("Make the best flight game").
You are the bush pilot of the Kutilang-9, a little red prop plane based at
Kalibaru Field in the Aruna valley: thread six glowing rings down the river,
around the shoulder of Mount Aruna and over the town, then bring her home
to the grass strip — gently, on a dwindling tank of fuel. All art is drawn
in code (Canvas 2D, one pinhole camera, a seeded heightmap valley); all
sound is synthesised in WebAudio. There are no images, no libraries and no
network requests.

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/alprasta/makefun-best-flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/alprasta/makefun-best-flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

Or serve `game/` with any static HTTP server and open `game/index.html`.

## How to play

- **Pitch:** `↑` / `↓` or `W` / `S`
- **Bank & turn:** `←` / `→` or `A` / `D`
- **Throttle:** `Shift` to open it, `Ctrl` to close it
- **Brake:** `B` (on the strip) — **Pause:** `P` — **Restart:** `R` — **Mute:** `M`
- **Start:** `Enter` or click

The sortie, in order:

1. **Take off** from Kalibaru Field — full throttle, rotate at about 65 knots.
2. **Thread all six rings** in order. Each one pays +100 and chimes; the
   next ring is always named on the HUD with its distance and a turn arrow.
3. **Land on the strip** — on the runway, slow, level and sinking gently.
   A hard arrival breaks the plane; touching down before the course is
   done just bounces you back into the air, five points of damage poorer.

Fuel is the real enemy: full throttle drinks about 0.55% a second, and an
empty tank leaves you gliding. Below 50 knots the wing stalls and the nose
drops. The sortie clock runs 6 minutes; beat the 4-minute par and the
spare seconds pay out as bonus. A clean landing scores the landing bonus,
the time bonus and whatever fuel is left in the tank.

## The valley

The Aruna valley is one seeded heightmap, the same every run: rolling
fields and forest, a river carving down to the south-west, the town of
Kalibaru beside the strip, and Mount Aruna — a 520 m volcanic cone with a
crater bowl — standing over the north-east horizon. The runway is a 620 m
grass strip flattened into the valley floor.

## Files

- `game/index.html` — the page; `game/src/` holds one file per job:
  `config.js` (tunables), `random.js` (seeded noise), `world.js` (valley,
  rings, town, clouds), `physics.js` (flight model), `render.js` (camera
  and scene), `hud.js` (instruments and screens), `audio.js` (WebAudio
  engine, wind, chimes), `input.js` (keyboard and mouse), `shots.js`
  (deterministic screenshot poses), `main.js` (game loop).
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json` with the vendored library.
- `vendor/makefun-game.ts` — the kit's copy, unchanged.
- `serve.ts` — a tiny static server for local play-testing
  (`node serve.ts`, then http://localhost:8080).
- `shots.json` — the four screenshot poses (`?shot=start|play|mid|end`).

## Screenshots

Taken in headless Chrome from the game's own code at 1280×720:

1. `1-start.jpg` — parked on the strip at Kalibaru, throttle up, title screen.
2. `2-play.jpg` — climbing out after takeoff, first ring ahead over the river.
3. `3-mid.jpg` — banking around Mount Aruna's shoulder, two rings cleared.
4. `4-end.jpg` — landed, course complete, results screen.

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=58yp00jq&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>

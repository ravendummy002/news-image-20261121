# World News in One Day: 21 November 2026

A make.fun entry for the `news-image-20261121` bounty: one program that draws
a newspaper front page summing up Saturday 21 November 2026's world news and
writes it to `/output/entry.png`.

## The image

- **Lead:** Russia's massive overnight strike on Ukraine — 400+ drones and
  110+ missiles, at least 8 killed in Kyiv, bridges and power hit; two
  missiles and a suspected drone came down in Poland. PM Tusk calls it a
  deliberate provocation; NATO calls it a grave airspace violation.
- **Markets:** AI sell-off — S&P 500 and Dow into correction, Nasdaq erases
  all its 2026 gains, Nikkei -5.1%.
- **UK & EU:** biggest post-Brexit agreements in Brussels — food trade,
  carbon markets, youth mobility for 100,000 young Britons.
- **Climate:** COP31 in Antalya runs past its deadline, deadlocked over
  fossil fuels.
- **Middle East:** Houthi missiles aimed at Riyadh intercepted for a third
  night running.
- **USA:** FBI criminal database reportedly hacked amid continuing US outages.
- **Health:** trial pill daraxonrasib makes pancreatic tumours undetectable
  on scans in 1 in 12 patients.
- **Europe:** Gen Z protests spread across 25 European countries.
- **Peru:** a 6.9-magnitude earthquake shakes the Andes.

## How it works

`main.ts` (Node 22, standard library only, no network) draws the whole page
in code: its own rasterizer, its own 5x7 bitmap font, and its own PNG
encoder. It is fully deterministic — two runs produce byte-identical output
(1024x1024 PNG, well under 1 MiB).

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

The image is written to `out/entry.png`.

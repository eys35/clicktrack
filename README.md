# Clicktrack

A daily game: you see a song's title, artist and year, and have six tries to guess its tempo in BPM.

The whole site is two files: `index.html` (the game) and `songs.json` (the song list). It runs on GitHub Pages with no server.

## Run it locally

```bash
python3 -m http.server 8001
```

Then open http://localhost:8001. Opening `index.html` straight from Finder won't work, because the browser blocks it from reading `songs.json`.

## The song list

Each song in `songs.json` looks like this:

```json
{"title":"Mr. Brightside","artist":"The Killers","year":2003,"bpm":148,"verified":false,"date":"2026-10-30"}
```

- `date` is the day it's the daily track. A song with `"date": null` is queued and waits until you schedule it.
- A song has been played once its date is before today.
- `verified` marks BPMs you've checked against a real source. All 73 starting songs were written from memory and still need checking.
- "Play a random one" uses only past tracks and queued songs, so practice never spoils an upcoming day.

## Managing songs

```bash
node tools/songs.mjs status                                   # today's track, played, upcoming, queue
node tools/songs.mjs find brightside                          # is it in the list, and has it played?
node tools/songs.mjs add "Jolene" "Dolly Parton" 1973 111     # add to the queue
node tools/songs.mjs add "Jolene" "Dolly Parton" 1973 111 --date 2027-02-01
node tools/songs.mjs schedule                                 # give queued songs the next open days
node tools/songs.mjs schedule --verified-only                 # ...only the ones you've checked
node tools/songs.mjs verify jolene                            # mark a BPM as checked
node tools/songs.mjs check                                    # validate before pushing
```

You can also edit `songs.json` by hand, including on github.com. Run `check` afterwards: it catches typos, duplicate songs, two songs on one day, and days with no track.

Rules of thumb:

- Don't change today's song or any past one. Players who already played saw the old answer.
- Fixing the BPM of an upcoming song is fine.
- If a day has no song, players get a practice track and a note saying so. `status` warns you when the schedule is about to run out.

## Player stats

When a daily game ends, the game sends one anonymous row to Supabase: the date, a random ID for the browser, the number of guesses, whether the player solved it, whether they needed the tempo-band hint, and how many times they pressed Tap tempo and Hear it. The result card then shows how many guesses the day's players needed, the player's percentile, and their counts against the averages.

Stats stay off until `STATS` in `index.html` has a URL and key. Without them, players still see their own counts, with no comparison.

To turn stats on:

1. Create a free project at https://supabase.com.
2. In the project's SQL editor, run `supabase/schema.sql`.
3. Under Project Settings → API, copy the project URL and the `anon` public key into `const STATS = {url: "...", key: "..."}` near the top of the script in `index.html`, then push.

The anon key is meant to be public. The database only lets players add a result for roughly today, one per browser per day, and never lets anyone read individual rows; the game gets only the day's totals from `day_stats()`. To look at raw results yourself, use the Table editor in Supabase.

Someone determined could still submit fake results with the public key. That's fine for a casual game; if it becomes a problem, add a server-side check later.

## Publishing

Push to the `main` branch. GitHub Pages serves the repo root, so changes to `songs.json` go live within a minute or two.

Everything in `songs.json` is public, including future answers. That's normal for this kind of game, but don't put anything in it you wouldn't want seen.

#!/usr/bin/env node
// Manage songs.json: see what has played, add songs, schedule the queue, and check the file before pushing.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FILE = fileURLToPath(new URL("../songs.json", import.meta.url));
const HELP = `Usage: node tools/songs.mjs <command>

  status                              Today's track, what has played, what is coming up
  find <text>                         Look up a song by title or artist
  add <title> <artist> <year> <bpm>   Add a song to the queue (no date yet)
      [--date YYYY-MM-DD]             ...or schedule it for a specific open day
  schedule [--verified-only]          Give queued songs the next open dates
  verify <text>                       Mark a song's BPM as checked
  check                               Validate songs.json (run before pushing)`;

const load = () => JSON.parse(readFileSync(FILE, "utf8"));
const save = songs => writeFileSync(FILE, "[\n" + songs.map(s => "  " + JSON.stringify(s)).join(",\n") + "\n]\n");
const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const addDays = (key, n) => { const [y, m, d] = key.split("-").map(Number); return iso(new Date(y, m - 1, d + n)); };
const today = iso(new Date());
const label = s => `${s.title} - ${s.artist} (${s.bpm} BPM${s.verified ? ", verified" : ""})`;
const when = s => !s.date ? "queued, no date yet" : s.date < today ? `played ${s.date}` : s.date === today ? "today's track" : `plays ${s.date}`;
const byDate = (a, b) => a.date.localeCompare(b.date);

function problems(songs) {
  const out = [], dates = new Map(), names = new Map();
  songs.forEach((s, i) => {
    const at = `#${i + 1} ${s.title ?? "(no title)"}`;
    for (const k of ["title", "artist"]) if (typeof s[k] !== "string" || !s[k].trim()) out.push(`${at}: missing ${k}`);
    if (!Number.isInteger(s.year) || s.year < 1900 || s.year > 2100) out.push(`${at}: year should be a 4-digit number`);
    if (!Number.isInteger(s.bpm) || s.bpm < 40 || s.bpm > 250) out.push(`${at}: bpm should be a whole number from 40 to 250`);
    if (typeof s.verified !== "boolean") out.push(`${at}: verified should be true or false`);
    if (s.date != null) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date) || addDays(s.date, 0) !== s.date) out.push(`${at}: date should look like 2026-10-30`);
      else if (dates.has(s.date)) out.push(`${at}: ${s.date} is already taken by ${dates.get(s.date)}`);
      else dates.set(s.date, s.title);
    }
    const key = `${s.title}|${s.artist}`.toLowerCase();
    if (names.has(key)) out.push(`${at}: duplicate of #${names.get(key)}`); else names.set(key, i + 1);
  });
  return out;
}

function gaps(songs) {
  const ds = songs.filter(s => s.date && s.date >= today).map(s => s.date).sort();
  const out = [];
  for (let d = today; ds.length && d <= ds.at(-1); d = addDays(d, 1)) if (!ds.includes(d)) out.push(d);
  return out;
}

function find(songs, text) {
  const q = text.toLowerCase(), hits = songs.filter(s => `${s.title} ${s.artist}`.toLowerCase().includes(q));
  if (!hits.length) { console.log(`No song matches "${text}". It isn't in songs.json yet.`); process.exit(1); }
  return hits;
}

const [cmd = "status", ...args] = process.argv.slice(2);
const songs = load();

if (cmd === "status") {
  const played = songs.filter(s => s.date && s.date < today).sort(byDate);
  const now = songs.find(s => s.date === today);
  const upcoming = songs.filter(s => s.date && s.date > today).sort(byDate);
  const queued = songs.filter(s => !s.date);
  const last = upcoming.at(-1)?.date ?? now?.date;
  console.log(`Today (${today}): ${now ? label(now) : "nothing scheduled - players get a practice track"}`);
  console.log(`Played: ${played.length}   Upcoming: ${upcoming.length}   Queued: ${queued.length}   Unverified BPMs: ${songs.filter(s => !s.verified).length}`);
  console.log(last ? `Schedule runs through ${last}.` : "Nothing is scheduled.");
  if (played.length) console.log("\nRecently played:\n" + played.slice(-5).map(s => `  ${s.date}  ${label(s)}`).join("\n"));
  if (upcoming.length) console.log("\nNext up:\n" + upcoming.slice(0, 5).map(s => `  ${s.date}  ${label(s)}`).join("\n"));
  const g = gaps(songs);
  if (g.length) console.log(`\nDays with no track: ${g.join(", ")}`);
} else if (cmd === "find") {
  if (!args.length) throw new Error("find needs some text, like: find brightside");
  for (const s of find(songs, args.join(" "))) console.log(`${label(s)}: ${when(s)}`);
} else if (cmd === "add") {
  const di = args.indexOf("--date"), date = di >= 0 ? args.splice(di, 2)[1] : null;
  const [title, artist, year, bpm] = args;
  if (!bpm) { console.log('add needs: "Title" "Artist" year bpm'); process.exit(1); }
  if (date && date <= today) { console.log(`Pick a date after today (${today}), so nobody's game changes mid-day.`); process.exit(1); }
  const next = [...songs, { title, artist, year: Number(year), bpm: Number(bpm), verified: false, date }];
  const bad = problems(next);
  if (bad.length) { console.log(bad.join("\n")); process.exit(1); }
  save(next);
  console.log(`Added ${label(next.at(-1))}: ${when(next.at(-1))}.`);
} else if (cmd === "schedule") {
  const onlyVerified = args.includes("--verified-only");
  const queue = songs.filter(s => !s.date && (!onlyVerified || s.verified));
  if (!queue.length) { console.log(onlyVerified ? "No verified songs are queued." : "The queue is empty."); process.exit(0); }
  const taken = new Set(songs.map(s => s.date).filter(Boolean));
  let d = addDays(today, 1);
  for (const s of queue) { while (taken.has(d)) d = addDays(d, 1); s.date = d; taken.add(d); console.log(`  ${d}  ${label(s)}`); }
  save(songs);
  console.log(`Scheduled ${queue.length} song${queue.length === 1 ? "" : "s"}.`);
} else if (cmd === "verify") {
  const hits = find(songs, args.join(" "));
  if (hits.length > 1) { console.log("More than one match, be more specific:\n" + hits.map(s => "  " + label(s)).join("\n")); process.exit(1); }
  hits[0].verified = true;
  save(songs);
  console.log(`Marked verified: ${label(hits[0])}`);
} else if (cmd === "check") {
  const bad = problems(songs);
  if (!songs.find(s => s.date === today)) bad.push(`No song is scheduled for today (${today}).`);
  const g = gaps(songs);
  if (g.length) bad.push(`Days with no track: ${g.join(", ")}`);
  console.log(bad.length ? bad.join("\n") : `songs.json looks good: ${songs.length} songs.`);
  process.exit(bad.length ? 1 : 0);
} else {
  console.log(HELP);
  process.exit(cmd === "help" || cmd === "--help" ? 0 : 1);
}

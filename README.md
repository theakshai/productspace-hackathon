# ClipCraft

**One podcast in. A week of content out.** A content repurposing studio with brand memory, for Product Space AI Hackathon Problem Statement 01 (Media). Built by voice with Wispr Flow.

Live app: https://theakshai.github.io/productspace-hackathon/

## Try it in 30 seconds (no API key)

Click **▶ Load demo** at the top right. It loads a real episode processed in ClipCraft (Nikhil Kamath x Sam Altman, People by WTF Ep 13) with a week of sample performance numbers, so you can walk every step without waiting:

1. **Clips**: 5 moments, each with a hook type, hook score and the reason it was picked. Play any clip.
2. **Copy**: Instagram Reels and LinkedIn copy per clip, character limits, `.srt` subtitles, and a 🎙 box to rewrite copy by voice.
3. **Brand voice**: rules learned from the creator's edits and spoken feedback, applied to every future caption.
4. **Calendar**: posts spread over two weeks at each platform's best time. Drag to move, export to Google/Outlook/Apple Calendar (`.ics`).
5. **Performance**: log numbers by voice or by typing. ClipCraft shows what worked (hook type, platform, length), re-ranks the clips, and sends those learnings into the next clip pick.

To process your own podcast, open **Settings**, add a Gemini API key (stored only in your browser), paste a YouTube link or upload a file, and go step by step.

## How each requirement is met

| Requirement | Where |
|---|---|
| Long video/podcast ingestion | Upload (YouTube link or file) → timestamped, speaker-labelled transcript |
| Clip selection with reasons | Clips: reason, hook type and score for every clip |
| Captions and copy per platform | Copy: YouTube Shorts, Instagram Reels, LinkedIn, X, plus `.srt` |
| Brand-voice memory that learns from edits | Voice edits suggest rules; Brand voice learns rules from typed edits too |
| Content calendar | Calendar: auto-schedule, drag to move, `.ics` export |
| Performance feedback loop | Performance: findings, re-ranking, learnings fed into clip selection |
| Natural speech via Wispr Flow | Every input is a dictation box: the clip brief, copy edits, brand rules, performance numbers |

## Stack

React + Vite, Google Gemini API (long video understanding, structured JSON output), browser storage. No backend: your key and data stay in your browser.

See [features.md](./features.md) for the build log.

## Run locally

```bash
npm install
npm run dev
```

Every push to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.

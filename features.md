# ClipCraft — Content Repurposing Studio with Brand Memory

Product Space AI Hackathon · Problem Statement 01 (Media) · Built by voice with Wispr Flow

> Upload one long podcast. Get the best clips with a reason for each, captions and copy for every platform, a posting calendar — and a studio that learns your brand voice from your edits and learns what works from how your posts actually perform.

## How it works

1. **Upload** a 10–20 minute podcast (video or audio).
2. **Tell it what you want, by voice.** Dictate a brief with Wispr Flow: audience, tone, topics to look for.
3. **It transcribes and picks clips**, each with timestamps and a reason.
4. **It writes copy** for each platform in your brand voice.
5. **You edit by voice** ("shorter, no emojis, less corporate"). It learns the rule for next time.
6. **It schedules** the clips on a content calendar.
7. **You log performance.** Future suggestions shift towards what actually worked.

## Tech stack

- React (Vite) single-page app with a simple upload-first UI
- Google Gemini API: long audio/video understanding, timestamped transcript, clip selection and copy generation (structured JSON output)
- Browser storage for brand-voice memory, calendar and performance data
- Wispr Flow for all voice input (building and using the product)

## Features — build order

Each feature is built, tested and committed before the next one starts.

| # | Feature | What "done" looks like | Status |
|---|---------|------------------------|--------|
| F0 | Project setup | React + Vite app runs; deployed link works | ✅ |
| F1 | Upload + ingestion | One upload button for a 10–20 min video or audio file; local preview player; file sent to Gemini with a progress indicator | ✅ |
| F2 | Voice brief | A text box built for Wispr Flow dictation; messy speech ("uh, mostly the AI and jobs bits, for, like, young founders") is turned into a clean structured brief: audience, tone, topics, platforms | ✅ |
| F3 | Timestamped transcript | Full transcript with speaker labels and timestamps; clicking a line seeks the player | ✅ |
| F4 | Clip selection with reasons | 5–8 clips, each with start/end time, title, hook strength score and a written reason for choosing it; "Play clip" jumps the player to that segment | ✅ |
| F5 | Platform captions + copy | Per clip: YouTube Shorts title + description, Instagram Reels caption + hashtags, LinkedIn post, X post; subtitle file (.srt) per clip | ✅ |
| F6 | Voice edits | Creator edits copy directly or dictates feedback; copy is regenerated to match | ✅ |
| F7 | Brand-voice memory | Rules learned from the creator's edits and feedback (e.g. "no emojis", "first line is a question") are stored, shown as an editable list and applied to every future generation | ✅ |
| F8 | Content calendar | Clips auto-scheduled across the next 1–2 weeks by platform; can be moved; export to calendar (.ics) | ✅ |
| F9 | Performance feedback loop | Enter views, likes, comments and saves per posted clip; the app learns what performed (topic, length, hook type, platform) and uses it to rank future clip suggestions, with a visible "what changed and why" | ✅ |
| F10 | Demo mode | One click loads a pre-processed podcast plus sample performance data, so the demo never waits on processing | ✅ |
| F11 | Settings | Gemini API key, default platforms, posting cadence | ✅ |
| F12 | Clip export | Download each clip as its own video file, cut in the browser (uploaded files). YouTube sources open the clip at its timestamp | ✅ |

## Requirement coverage (Problem Statement 01)

| Requirement | Feature |
|-------------|---------|
| Long video or podcast ingestion | F1, F3 |
| Clip selection with reasons given for each choice | F4 |
| Captions and copy tailored to each platform | F5 |
| A brand-voice memory that learns from the creator's edits | F6, F7 |
| A content calendar | F8 |
| A performance feedback loop that changes future suggestions | F9 |
| Natural speech through Wispr Flow as the main input | F2, F6 |

## Voice build log

Every prompt, spec and fix for this project is dictated with Wispr Flow. Screen recordings are linked here as each feature ships.

| Feature | Recording |
|---------|-----------|
| features.md | |

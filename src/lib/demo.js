// F10 demo mode: a podcast that was really processed in ClipCraft (Nikhil Kamath x Sam Altman,
// People by WTF Ep 13), plus sample performance numbers. Loads instantly, needs no API key.
// The transcript keeps only the lines inside the five clips.
import { addDays, autoSchedule, toISODate } from './calendar.js'

const URL = 'https://www.youtube.com/watch?v=SfOaZIGJ_gs'
const ID = 'clip-mvwbh7fr-'

export const DEMO_MEDIA = {
  source: 'youtube',
  kind: 'youtube',
  youtubeId: 'SfOaZIGJ_gs',
  url: URL,
  fileName: 'Sam Altman x Nikhil Kamath: How to Win When AI Changes Everything | People by WTF | Episode 13',
  size: null,
  duration: null,
  demo: true,
  gemini: { uri: URL, mimeType: null, expiresAt: null },
}

const TRANSCRIPT = {
  title: 'Nikhil Kamath x CEO of OpenAI Sam Altman | People by WTF Ep #13',
  durationSeconds: 2712,
  excerpt: true,
  speakers: [
    { id: 'NK', name: 'Nikhil Kamath', role: 'host', color: '#ff8a65' },
    { id: 'SA', name: 'Sam Altman', role: 'guest', color: '#64b5f6' },
  ],
  segments: [
    { start: 73, end: 83, speaker: 'NK', text: "I have the model and I've been playing with it a little bit. How is it different, Sam? I'm not an expert at this, so yeah." },
    { start: 83, end: 113, speaker: 'SA', text: "There's all these ways we can talk about, it's better at this metric, or it can do this amazing coding demo that GPT-4 couldn't. But the thing that has been most striking for me is in ways that are both big and small, going back from GPT-5 to our previous generation model is just so painful. It's just worse at everything, and I've taken for granted that there is a fluency and a depth of intelligence with GPT-5 that we haven't had in any previous model." },
    { start: 429, end: 441, speaker: 'NK', text: 'Is there anything that I could build on top of GPT-5 today as a 25-year-old in India that you think are low-hanging fruits per se, that I should definitely look at?' },
    { start: 441, end: 485, speaker: 'SA', text: "I think you could build an entire startup way more efficiently than you ever could before. Now, this is obviously, I'm biased because this is like near and dear to my heart. But the fact that as a 25-year-old in India or anywhere else, maybe with a couple of friends, maybe just by yourself, you could use GPT-5 to help you write the software for a product much more efficiently, help you handle customer support, help you write marketing and communications plans, help you review legal documents, all of these things that would have taken a lot of people and a lot of expertise, and you now have GPT-5 to help you do all of this, that's pretty amazing." },
    { start: 1177, end: 1192, speaker: 'NK', text: 'So I ponder on this a lot, Sam, kids, why people have kids, and also questions like what happens to religion and marriage tomorrow. Can I ask you why you had a kid?' },
    { start: 1192, end: 1219, speaker: 'SA', text: "Family has always been an incredibly important thing to me, and going like it just it felt like It felt like the most, and I didn't even know how much I underestimated what it was actually going to be like, but it felt like the most important and meaningful and fulfilling thing I could imagine doing, and it has so far, still early, exceeded all expectations." },
    { start: 2140, end: 2146, speaker: 'NK', text: 'Outside of being contrarian, is there anything else that I could do that a model will take longer to learn?' },
    { start: 2146, end: 2172, speaker: 'SA', text: "Look, the models are going to be much smarter than we are, but there's a lot of things that people care about that have nothing to do with intelligence. Maybe there can be an AI podcast host that is much better than you at asking interesting questions and kind of engaging, whatever. And I personally don't think that podcast host, that AI podcast host, is likely to be more popular than you." },
    { start: 2172, end: 2189, speaker: 'SA', text: "People really care about other humans. This is like very deep. People want to know a little bit about your life story, what got you here. They want to be able to like talk to other people about this like shared sense of who you are, and there's like some cultural and social value in that. We are obsessed with other people." },
    { start: 2386, end: 2389, speaker: 'NK', text: 'Is there a reason why they need to have human-like form?' },
    { start: 2389, end: 2419, speaker: 'SA', text: 'Well, you can certainly have non-humanoid forms, but the world is really built for humans. Door handles, steering wheels in cars, factories, a lot of this is built for we\'ve built it for our own kind of morphology. So there will, of course, be other specialized robots, too, but the world is built and, I hope, stays built for for us. So robots that match that form factor seems like a good idea.' },
  ],
  topics: [
    { title: 'Introduction and GPT-5 Capabilities', start: 44, summary: 'Sam Altman and Nikhil Kamath discuss the release and capabilities of GPT-5 compared to previous models.' },
    { title: 'Advice for Young Founders and Essential Skills', start: 197, summary: 'What 25-year-olds should study and focus on: AI fluency, adaptability, and understanding human desire.' },
    { title: 'Early Entrepreneurship and Founder Mindsets', start: 697, summary: "Paul Graham's early praise, founder humility versus bravado, and navigating uncertainty." },
    { title: "Family, Kids, and Society's Future", start: 1128, summary: 'Becoming a parent and the importance of family and human connection in an AI-driven future.' },
    { title: 'Economic Impact of AI and Deflation', start: 1385, summary: 'Whether AI causes deflation, challenges capitalism, or increases social safety nets.' },
    { title: 'Building Defensible Businesses and Hardware Form Factors', start: 1772, summary: 'Durable moats on top of AI models, ambient hardware companions and robotics.' },
    { title: "Fusion Energy and India's AI Opportunity", start: 2574, summary: "Fusion's role in climate change and India's potential as an AI powerhouse." },
  ],
}

const CLIPS = [
  { id: ID + 0, title: "Why AI Won't Replace Human Creators", start: 2140, end: 2189, topic: 'Human Connection vs AI Intelligence', hookType: 'contrarian', hookScore: 9, quote: 'People really care about other humans. This is like very deep.', reason: 'Addresses the fear of AI replacing creators with a counterintuitive, comforting insight. The conversational tone and focus on human connection make it ideal for discussion on LinkedIn and Instagram.', keep: true },
  { id: ID + 1, title: 'What Makes GPT-5 Truly Different', start: 73, end: 113, topic: 'GPT-5 Capabilities', hookType: 'bold claim', hookScore: 9, quote: 'Going back from GPT-5 to our previous generation model is just so painful.', reason: "Nikhil asks the question on every tech enthusiast's mind and Sam answers with a candid, visceral comparison. High curiosity, instant authority.", keep: true },
  { id: ID + 2, title: 'Build a One-Person Startup with GPT-5', start: 429, end: 485, topic: 'Entrepreneurship and Startups', hookType: 'advice', hookScore: 8, quote: 'I think you could build an entire startup way more efficiently than you ever could before.', reason: 'Actionable Q&A for aspiring founders on LinkedIn: how a single person can now run work that used to need a whole company.', keep: true },
  { id: ID + 3, title: 'Why Sam Altman Had a Kid', start: 1177, end: 1219, topic: 'Family and Life Purpose', hookType: 'emotional', hookScore: 8, quote: 'It felt like the most important and meaningful and fulfilling thing I could imagine doing.', reason: 'A vulnerable personal question that shows a rarely seen, human side of Sam. Strong emotional resonance for Instagram.', keep: true },
  { id: ID + 4, title: 'Why Robots Must Look Human', start: 2386, end: 2419, topic: 'Humanoid Robotics', hookType: 'question', hookScore: 8, quote: 'The world is really built for humans.', reason: 'An intuitive question answered with first-principles reasoning. Quick, satisfying payoff for a general audience.', keep: true },
]

const BRIEF = {
  summary: "Clips that start with Nikhil's question and move to Sam's answer, for Instagram Reels and LinkedIn.",
  audience: 'General social media audience interested in conversational podcast highlights.',
  goal: 'Engage followers and drive interest across Instagram and LinkedIn.',
  tone: ['conversational'],
  topics: ["Q&A moments that start with Nikhil's question and lead into Sam's answer"],
  avoid: [],
  platforms: ['instagram_reels', 'linkedin'],
  clipCount: 5,
  clipLengthSeconds: { min: 30, max: 60 },
  corrections: [],
  assumptions: ['5 clips, 30–60 seconds, conversational tone (not specified)'],
}

const SPEECH =
  "Tell me what the video is about, and are there any clips I can post on Instagram and LinkedIn? Make sure to start with Nikhil's question and move to Sam's answer."

const IG0_ORIGINAL =
  'Will AI really replace human creators? OpenAI CEO Sam Altman says no. Even if an AI podcast host asks better questions, it will not be more popular. Why? Because humans care deeply about other humans, their stories, and shared connections. Do you agree with Sam? Let us know in the comments and follow for more insights.'
const LI0 =
  'Can an AI host ever truly replace a human creator? OpenAI CEO Sam Altman believes the answer is no. Even if future models become smarter and conduct flawless interviews, Sam explains that people care about something deeper: other humans. We crave shared life stories, relatable experiences, and cultural connection. Intelligence is only part of why we listen. Do you think you would ever feel the same connection to an AI creator as a human one? #AI #Leadership #CreatorEconomy'
const TAGS0 = '#samaltman #nikhilkamath #peoplebywtf #podcastclips #ai #contentcreators #humanconnection #creatoreconomy #futureofai #podcasthighlights'

const COPY = {
  platforms: ['instagram_reels', 'linkedin'],
  byClip: {
    [ID + 0]: {
      platforms: {
        instagram_reels: {
          caption: 'Can AI replace human creators? OpenAI CEO Sam Altman explains that while AI models will surpass human intelligence, audiences fundamentally value human connection, lived experience, and shared cultural stories over pure capability.',
          hashtags: TAGS0,
        },
        linkedin: { post: LI0 },
      },
      original: { instagram_reels: { caption: IG0_ORIGINAL, hashtags: TAGS0 }, linkedin: { post: LI0 } },
      edits: [{ kind: 'voice', platform: 'instagram_reels', feedback: 'Make the Instagram Reels shorter, more professional, and informative.', changes: 'Shortened the caption and made it more professional and informative.', at: '2026-10-31T11:38:41.094Z' }],
      history: [{ platform: 'instagram_reels', fields: { caption: IG0_ORIGINAL, hashtags: TAGS0 } }],
    },
    [ID + 1]: {
      platforms: {
        instagram_reels: {
          caption: 'What makes GPT-5 genuinely different from past models? OpenAI CEO Sam Altman says the biggest difference is simple: going back to previous generation models feels painful. With GPT-5, there is a level of fluency and depth of intelligence that makes older tools feel worse at everything. Save this reel to stay updated on the frontier of AI.',
          hashtags: '#samaltman #gpt5 #openai #chatgpt #technews #futureoftech #generativeai #peoplebywtf #artificialintelligence #techinnovation',
        },
        linkedin: { post: 'What makes GPT-5 fundamentally different from earlier models? OpenAI CEO Sam Altman shares that the real test is how painful it feels to step backward. Sam notes that going back to previous generation models highlights just how fluent and deeply intelligent GPT-5 really is across the board. Once you experience that leap, older models simply feel inadequate. How do you anticipate next-generation intelligence shifting your day-to-day workflow? #OpenAI #ArtificialIntelligence #GPT5' },
      },
    },
    [ID + 2]: {
      platforms: {
        instagram_reels: {
          caption: 'Can a 25-year-old build an entire company alone today? OpenAI CEO Sam Altman says yes. With GPT-5, a solo founder can write code, handle customer support, draft marketing plans, and review legal documents faster than ever before. What would you build first with this power? Drop your startup ideas in the comments and follow for more.',
          hashtags: '#samaltman #solofounder #startups #entrepreneurship #gpt5 #businessgrowth #buildinpublic #openai #peoplebywtf #techstartups',
        },
        linkedin: { post: 'Could a single founder now run an entire enterprise? OpenAI CEO Sam Altman points out that tools like GPT-5 allow solo entrepreneurs to build startups far more efficiently than ever before. From writing software and managing customer support to developing marketing plans and reviewing legal contracts, one person can handle what used to require an entire department. Would you feel confident launching a solo startup powered by AI today? #Startups #Entrepreneurship #Productivity' },
      },
    },
    [ID + 3]: {
      platforms: {
        instagram_reels: {
          caption: 'Why did OpenAI CEO Sam Altman decide to start a family? When asked by Nikhil Kamath, Sam shared that family has always been deeply important to him. Having a child felt like the most meaningful and fulfilling thing he could imagine doing, and he says it has exceeded all expectations. Save this video for a rare reminder of what truly matters.',
          hashtags: '#samaltman #nikhilkamath #fatherhood #familyfirst #perspective #lifelessons #peoplebywtf #mindset #podcastmoments #meaningfulconversations',
        },
        linkedin: { post: 'What brings the ultimate sense of meaning outside of building world-changing technology? When asked why he decided to have a child, OpenAI CEO Sam Altman shared that family has always been central to his life. Sam reflected that having a kid felt like the most important and fulfilling thing he could imagine doing, and so far it has exceeded every expectation. How do you maintain focus on personal fulfillment while pursuing ambitious professional goals? #Leadership #Family #WorkLifeBalance' },
      },
    },
    [ID + 4]: {
      platforms: {
        instagram_reels: {
          caption: 'Why do robots need to look like humans? OpenAI CEO Sam Altman explains that our physical world is engineered around our morphology. Door handles, steering wheels, and factory equipment were all designed for the human form factor, making humanoid robots the most practical fit. What are your thoughts on humanoid robots? Share in the comments below.',
          hashtags: '#samaltman #robotics #humanoidrobots #futureofwork #techtrends #openai #engineering #peoplebywtf #automation #hardware',
        },
        linkedin: { post: 'Why should robots be designed with a human form? OpenAI CEO Sam Altman explains that the reasoning is purely practical: our physical world is built specifically for human morphology. From factory doors and tools to steering wheels, our infrastructure is designed for human hands and movement, making humanoid robots an ideal fit. Do you think humanoid robots will integrate smoothly into modern workplaces? #Robotics #Engineering #FutureOfWork' },
      },
    },
  },
}

export const DEMO_BRAND_RULES = [
  ['Always credit the guest by name', 'typed'],
  ['Always start with a hook or a question', 'typed'],
  ['Keep each clip under a minute', 'typed'],
  ['One idea per post; never mix several points', 'typed'],
  ['Keep captions professional and informative', 'voice'],
]

// Sample numbers: contrarian and question hooks win, emotional hooks lag, Reels get more reach.
const HOOK_LIFT = { contrarian: 2.4, question: 1.6, 'bold claim': 1.15, advice: 1.0, emotional: 0.6 }
const PLATFORM_REACH = { instagram_reels: 9000, linkedin: 3200, youtube_shorts: 6000, x: 2000 }

function sampleMetrics(post, clip, i) {
  const lift = HOOK_LIFT[clip.hookType] || 1
  const wobble = 0.9 + ((i * 37) % 21) / 100
  const views = Math.round((PLATFORM_REACH[post.platform] || 3000) * lift * wobble)
  const rate = 0.035 * Math.sqrt(lift)
  return {
    views,
    likes: Math.round(views * rate),
    comments: Math.round(views * rate * 0.12),
    saves: Math.round(views * rate * (post.platform === 'instagram_reels' ? 0.35 : 0.1)),
  }
}

// Builds every piece of app state. The schedule starts a week ago, so the past week is
// already "posted" and has numbers, and the next week is still to come.
export function buildDemo(now = new Date()) {
  const today = toISODate(now)
  const posts = autoSchedule({ clips: CLIPS, platforms: COPY.platforms, today: addDays(now, -7) }).map((p) =>
    p.date < today ? { ...p, status: 'posted' } : p,
  )
  const byId = Object.fromEntries(CLIPS.map((c) => [c.id, c]))
  const metrics = {}
  posts.forEach((p, i) => {
    if (p.status === 'posted') metrics[p.id] = sampleMetrics(p, byId[p.clipId], i)
  })
  const stamp = now.toISOString()
  return {
    media: DEMO_MEDIA,
    speech: SPEECH,
    brief: BRIEF,
    transcript: { ...TRANSCRIPT, mediaUri: URL, createdAt: stamp },
    clips: { mediaUri: URL, items: CLIPS, createdAt: stamp },
    copy: { mediaUri: URL, ...COPY, createdAt: stamp },
    schedule: { mediaUri: URL, posts, createdAt: stamp },
    performance: { mediaUri: URL, metrics },
  }
}

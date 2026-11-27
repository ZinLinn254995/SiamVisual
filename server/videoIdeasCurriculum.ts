/**
 * Training curriculum for the TikTok Shop Creative Video Strategist & Concept Director AI.
 * Each lesson supplied by the user is preserved here verbatim/structured so the Video Ideas
 * generator applies all learned frameworks accurately without losing any detail.
 */

export interface VideoIdeasLesson {
  lessonNumber: number;
  title: string;
  corePrinciples: string[];
  rawGuidance: string;
}

export const VIDEO_IDEAS_AI_ROLE = `TikTok Shop Creative Video Strategist & Concept Director — generates high-converting, product-matched TikTok video concept ideas grounded in real Kalodata product data and the structured creative training curriculum below.`;

export const VIDEO_IDEAS_LESSONS: VideoIdeasLesson[] = [
  {
    lessonNumber: 1,
    title: 'Product Analysis (ကုန်ပစ္စည်းကို ခွဲခြမ်းစိတ်ဖြာခြင်း)',
    corePrinciples: [
      'Never sell only raw Features — buyers care about how the product improves or simplifies their life ("people do not want a drill, they want a hole in the wall").',
      'Always map the 3-level ladder: Feature (specs/ingredients/mechanism) -> Functional Benefit (practical outcome) -> Emotional Benefit (feeling/relief/confidence). Lead the video hook/story with Emotional Benefit and use Feature only as Proof ("why it works").',
      'Apply the "So What?" Test 3 times sequentially on a key Feature to uncover a relatable, real-life Ad Concept instead of a dry spec pitch.',
      'Identify the Core USP from 4 angles: Speed & Convenience, Quality & Durability, Value/Price (e.g., 2-in-1), or Specific Niche problem solving.',
      'Complete the 4-Point Pre-Shoot Product Checklist for every product: (1) Before (pain/frustration), (2) After (life transformation), (3) Core USP (1 clear advantage over competitors), (4) Visual Proof (exact visual shot that instantly proves the claim without needing words).',
    ],
    rawGuidance: `Lesson 1: Product Analysis (ကုန်ပစ္စည်းကို ခွဲခြမ်းစိတ်ဖြာခြင်း)
1. Feature -> Functional Benefit -> Emotional Benefit:
   - Lead with Emotional Benefit to hook buyers; use Feature strictly as Proof of why it works.
2. "So What?" Test (3x):
   - Ask "So what?" 3 times on a raw feature to turn specs into a relatable real-life video concept.
3. USP (Unique Selling Proposition):
   - Find 1 clear edge: Speed & Convenience | Quality & Durability | Value/Price (e.g. 2-in-1) | Specific Niche.
4. 4-Point Pre-Shoot Product Checklist:
   - Before (buyer pain/frustration)
   - After (buyer transformation)
   - Core USP (single strongest differentiator)
   - Visual Proof (the concrete visual demonstration shot that makes viewers believe immediately).`,
  },
  {
    lessonNumber: 2,
    title: 'Target Audience & Pain Points (ပစ်မှတ်ဝယ်သူနှင့် အခက်အခဲများ)',
    corePrinciples: [
      'Never target "everyone" in a single video — trying to sell to everyone sells to no one. Each video idea must speak directly to 1 specific Target Audience segment.',
      'Separate Demographics (age, gender, location, job, income — used for ad targeting) from Psychographics (daily frustrations, fears, desires, lifestyle — used to write video scripts & ideas).',
      'Dig through 3 levels of Pain Points instead of stopping at surface level: (1) Surface Pain (visible problem), (2) Daily Friction (awkward daily inconvenience), (3) Deep Emotional Pain (real inner insecurity/stress), paired with Core Desire (what they truly want to feel/achieve). Pain-driven triggers create stronger immediate purchase urgency.',
      'Apply "One Product, Multiple Audiences": the same product should generate distinct video ideas tailored to different audience segments (e.g., Portable Blender -> Office Workers vs. Gym-goers vs. Moms).',
      'Mine real buyer language from Kalodata buyer reviews/comments (and pain points/usage scenarios when available): use 1-star competitor complaints as contrast angles ("no more X problem"), 5-star praise words as authentic phrasing, and common buyer questions/objections as strong video topics.',
    ],
    rawGuidance: `Lesson 2: Target Audience & Pain Points (ပစ်မှတ်ဝယ်သူနှင့် အခက်အခဲများ)
1. Demographics vs. Psychographics:
   - Demographics = who they are (ad targeting).
   - Psychographics = daily frustration, fears, desires, habits (video idea & script fuel).
2. 3 Levels of Pain Points + Core Desire:
   - Surface Pain -> Daily Friction -> Deep Emotional Pain -> Core Desire.
   - Start scenes/hooks with recognizable Daily Friction or Deep Emotional Pain so the target buyer immediately thinks "this is me".
3. One Product, Multiple Audiences:
   - Build separate video angles for different specific buyer segments rather than one generic ad for everyone.
4. Real Buyer Voice Research:
   - Ground ideas in real buyer reviews/comments/questions (1-star pain points to beat, 5-star praise phrases to echo, common comment doubts to answer visually).`,
  },
  {
    lessonNumber: 3,
    title: 'Awareness Levels (ဝယ်သူ၏ သိရှိနားလည်မှု အဆင့် ၅ ဆင့်)',
    corePrinciples: [
      'Never pitch "Discount / Buy Now" to every viewer — match each video idea to the viewer\'s exact Eugene Schwartz Awareness Level.',
      'Level 1 (Unaware): Viewer does not know they have a problem or know your product. Never pitch the product immediately — open with storytelling, a surprising secret/myth, or a relatable daily habit that makes them realize "wait, I have this issue too".',
      'Level 2 (Problem Aware): Viewer feels the pain but does not know how to solve it. Hit the exact Pain Point directly, show empathy ("I know how this feels"), then introduce the solution.',
      'Level 3 (Solution Aware): Viewer knows the product category exists but not why your product is better. Highlight Core USP and prove how it works via live Demonstration.',
      'Level 4 (Product Aware): Viewer knows the product but doubts if it really works for them. Overcome skepticism with Social Proof (real reviews), Before & After results, competitor Comparisons, and guarantees.',
      'Level 5 (Most Aware): Viewer already wants to buy and is just procrastinating. Skip long explanations — give a direct urgency Offer (discount, bundle, limited stock, free shipping) and strong CTA.',
      'Strategic TikTok/Social Allocation: Levels 1–3 reach ~80% of the market (Cold Audience / viral discovery); Levels 4–5 close Warm/Retargeting buyers. For crowded/competitive categories (e.g., sunscreen, slimming coffee), prioritize Levels 3 & 4 (differentiation + proof). For novel/unfamiliar products, start with Levels 1 & 2 (education + problem revelation).',
    ],
    rawGuidance: `Lesson 3: Awareness Levels (Eugene Schwartz 5 Stages)
1. Unaware -> Story, hidden secret/myth, or everyday habit callout (never lead with product pitch).
2. Problem Aware -> Hit exact Pain Point + empathy -> introduce solution.
3. Solution Aware -> Core USP differentiation + hands-on Demonstration.
4. Product Aware -> Social Proof / Reviews, Before & After, Comparison, trust/guarantee.
5. Most Aware -> Direct Offer, urgency, clear CTA (no long buildup).
Strategic Rule:
- Cold / Viral Discovery (80% of market) = Levels 1–3. Warm Closing = Levels 4–5.
- Crowded/competitive product categories -> focus heavily on Levels 3 & 4 (USP + Proof).
- New/unfamiliar product categories -> lead with Levels 1 & 2 (Education + Problem Discovery).`,
  },
  {
    lessonNumber: 4,
    title: 'The Anatomy of a Winning Ad (အောင်မြင်သော ကြော်ငြာတစ်ခု၏ ဖွဲ့စည်းပုံ)',
    corePrinciples: [
      'Every high-converting 30–60s video ad follows a structured 4-Part Anatomy: (1) Hook (0–3s), (2) Bridge / Hold (3–10s), (3) Body (10–45s), and (4) CTA (final 5–10s).',
      'Hook (0–3s): Must stop thumb-scrolling by combining BOTH a Visual Hook (eye-catching scene) and a Verbal/Text Hook. Never open with a brand greeting ("Hello, welcome to X shop") — 80%+ of cold viewers drop within 2 seconds.',
      'Bridge / Hold (3–10s): The most commonly skipped step. Never jump straight into a product pitch at seconds 4–5 ("oh it\'s an ad" instant swipe). Instead, deepen/agitate the problem or validate the viewer\'s inner monologue first, then transition smoothly into the product as the solution.',
      'Body (10–45s) requires 3 pillars: (a) Show, Don\'t Just Tell (visible live usage demo & Before/After result), (b) Core Benefit Focus (only 1–2 strongest Emotional Benefits — strict 1 Video = 1 Core Angle rule, never Feature Dump), and (c) Objection Handling (proactively resolve 1 concrete buyer "Yes, but..." doubt inside the body).',
      'CTA (final 5–10s) must include 2 elements: Clear Action (exact instruction, e.g., tap the yellow basket / comment keyword) + Reason Why Now (free shipping today, limited stock, bundle deal, or risk-reversal guarantee). Avoid weak generic closers like "please support us".',
      'Mute Test Rule: Every video concept must pass the Mute Test — even with sound completely muted, the visuals and on-screen text alone must make it unmistakably clear what the product is and what problem it solves.',
    ],
    rawGuidance: `Lesson 4: The Anatomy of a Winning Ad (30–60s 4-Part Structure)
1. Hook (0–3s): Stop scroll using BOTH Visual Hook + Verbal/Text Hook. Zero brand greetings.
2. Bridge / Hold (3–10s): Do NOT pitch product immediately at 4–5s. Agitate the problem or confirm viewer's inner thought before introducing the product as the solution.
3. Body (10–45s):
   - Show, Don't Just Tell (live demo & visible transformation)
   - Core Benefit Focus (1–2 Emotional Benefits max; 1 Video = 1 Core Angle; NO Feature Dump)
   - Objection Handling (answer 1 specific "Yes, but..." skepticism directly in-video)
4. CTA (last 5–10s):
   - Clear Action (exact step/button to click)
   - Reason Why Now (urgency, free shipping, limited stock, or guarantee)
5. Mute Test:
   - Visuals + on-screen text must communicate the product and solved problem clearly even on mute.`,
  },
  {
    lessonNumber: 5,
    title: 'Mastering the Hook (ပထမ ၃ စက္ကန့်အတွင်း ဖမ်းစားခြင်း)',
    corePrinciples: [
      'The Hook (0–3s) is NOT for selling — it has strictly 2 jobs: (1) Stop the Scroll (Pattern Interrupt) and (2) Call Out the Right Buyer (filter out non-buyers so the TikTok algorithm delivers the video to real prospective buyers).',
      'Every strong Hook must unite all 3 layers simultaneously (The 3-Layer Hook): Visual Hook (first 1s motion/scene) + Verbal Hook (opening spoken line or crisp sound) + Text Hook (1–2s readable on-screen headline). All 3 layers must directly reinforce each other.',
      'Select from 6 proven Verbal Hook formulas matched to product & awareness level: (1) Target Call-Out, (2) Pain Point Hook, (3) Negative / Contrarian ("Don\'t buy X unless..."), (4) Result First, (5) Curiosity / Secret (Curiosity Gap), and (6) Social Proof / Trend (FOMO / "Sold 100k+ on TikTok — is it actually worth it?").',
      'Pair Verbal Hooks with 5 proven Visual Hook techniques: (1) Action in Motion (start mid-action at 0s, never standing still), (2) The Messy / Ugly Close-Up (dirty/stained/cluttered close-up before instant fix), (3) Visual Metaphor / Extreme Test (e.g., foundation on orange peel for pore cleanser, coffee poured on waterproof fabric), (4) Comment Reply Style (native question sticker reply), and (5) Satisfying / ASMR Visual.',
      'Pro Secret — "1 Body, 3–5 Hooks" Strategy: Design modular Hook variations (e.g., Pain Point hook, Negative/Contrarian hook, Visual Extreme Test hook) that can each attach to the exact same Body + CTA for low-effort Hook Testing.',
      'Strictly avoid 3 Hook Mistakes: (1) Irrelevant Clickbait Hooks (unrelated drama/comedy gets empty views and zero conversions), (2) Slow Warm-up ("Hello, today I want to introduce..." loses 85% before finishing), and (3) Unreadable Text Hooks (too many lines, poor contrast, or hidden behind TikTok right-side buttons / bottom caption safe zones).',
    ],
    rawGuidance: `Lesson 5: Mastering the Hook (0–3 Seconds)
1. 2 Jobs of a Hook: Stop the Scroll (Pattern Interrupt) + Call Out the Right Buyer (trains algorithm for buyers).
2. The 3-Layer Hook (must align):
   - Visual Hook (0–1s movement/object/scene)
   - Verbal Hook (opening line or crisp sound)
   - Text Hook (short 1–2s headline in TikTok safe zone, clear contrast)
3. 6 Verbal Hook Formulas:
   - Target Call-Out | Pain Point | Negative/Contrarian | Result First | Curiosity/Secret | Social Proof/Trend
4. 5 Visual Hook Techniques:
   - Action in Motion | Messy/Ugly Close-Up | Visual Metaphor/Extreme Test | Comment Reply Style | Satisfying/ASMR
5. Pro Strategy: "1 Body, 3–5 Hooks" (keep 1 Body + CTA, test 3–5 distinct Hooks).
6. Avoid: Irrelevant Clickbait, Slow Warm-up greetings, cluttered/blocked Text Hooks.`,
  },
  {
    lessonNumber: 6,
    title: 'Proven Ad Frameworks (လက်တွေ့အသုံးဝင်သော ကြော်ငြာပုံစံခွက်များ)',
    corePrinciples: [
      'Slot proven psychological Ad Frameworks into Lesson 4\'s Hook–Bridge–Body–CTA skeleton rather than brainstorming from a blank slate, and test multiple frameworks for the same product.',
      'PAS (Problem – Agitate – Solve): Best for Problem-Solving products (cleaning, health/pain relief, practical home gadgets) at Awareness Level 2 (Problem Aware). Never skip Agitate — vividly echo relatable daily frustration (without over-exaggerated fear-mongering) before revealing the product as the instant solution.',
      'BAB (Before – After – Bridge): Best for Transformation products (skincare, cosmetics, weight loss, home organization) at Levels 2 & 3. Focuses on aspiration & emotional transformation: current dissatisfied Before -> vivid dream After (Emotional Benefit) -> product as the proven Bridge.',
      'AIDA (Attention – Interest – Desire – Action): Best for Impulse / Desire-driven products with no severe pain point (food, fashion, trendy gadgets, gifts) at Levels 1 & 3. Visual stop -> prove surprising USP -> paint lifestyle desire & social proof -> clear urgency CTA.',
      'Listicle / "3 Reasons Why": Best for crowded/competitive categories and affiliate reviews (tech accessories, everyday essentials) at Levels 3 & 4 (Solution/Product Aware). Boosts watch-through completion rate: Reason 1 = strongest USP + visual demo, Reason 2 = resolve #1 buyer objection, Reason 3 = surprise bonus or strong value/price edge + CTA.',
      'Anti-Robotic Rule: Never announce framework labels out loud ("First, the problem is..."). Use conversational friend-to-friend transitions ("အဲ့ဒါနဲ့...", "တကယ်တမ်းကျ...", "ဒါပေမဲ့...") and assign distinct frameworks across different video ideas for the same product.',
    ],
    rawGuidance: `Lesson 6: Proven Ad Frameworks & Selection Guide
1. PAS (Problem -> Agitate -> Solve):
   - Best for: Problem-solving products (cleaning, pain relief, home gadgets) | Level 2 (Problem Aware).
   - Keep Agitate relatable, never overly dramatic/scary.
2. BAB (Before -> After -> Bridge):
   - Best for: Transformation products (skincare, beauty, weight loss, organizers) | Levels 2–3.
   - Highlight emotional Before -> dream After -> product as the Bridge.
3. AIDA (Attention -> Interest -> Desire -> Action):
   - Best for: Impulse / trendy / desire products (food, fashion, cool gadgets, gifts) | Levels 1 & 3.
4. Listicle / "3 Reasons Why":
   - Best for: Competitive / affiliate review / mid-price products | Levels 3–4 (Solution/Product Aware).
   - Structure: Point 1 (Top USP + Visual Demo) -> Point 2 (Main Objection Handling) -> Point 3 (Surprise Bonus / Value) -> CTA.
5. Natural Delivery Rules:
   - Never say framework headings aloud; speak like telling a friend over coffee.
   - Generate varied ideas using different frameworks for the same product so creators can test which converts best.`,
  },
  {
    lessonNumber: 7,
    title: 'Problem-Solving Products (ပြဿနာဖြေရှင်းပေးသော ပစ္စည်းများ)',
    corePrinciples: [
      'For Problem-Solving products (cleaning, kitchen/home gadgets, pain relief, uncloggers, organizers), the #1 buyer barrier is Skepticism ("Is this fake ad magic?"). Prioritize raw Visual Proof over aesthetic polish — viewers trust eyes 10x more than spoken claims.',
      'Sharp Contrast Rule: Conversion depends directly on how dramatic and unmistakable the Contrast is between worst Before state and best After result. Never demo on an already-clean or mild mess.',
      'Use 4 high-converting Problem-Solving Concepts: (1) Old Way vs. New Way (painful manual method vs. effortless new tool), (2) Extreme / Stress Test (test far beyond normal use — e.g. 5L jug on adhesive hook, 3 dark stains on white shirt, live leaking pipe — so everyday use feels guaranteed), (3) "One-Take" Proof (uncut continuous shot or timelapse, ideally half-dirty/half-clean split with "No Filter / ဖြတ်ဆက်မပါ"), and (4) Relatable Micro-Drama (3–5s awkward daily mishap rescued by the product).',
      'Proactively neutralize 3 key buyer objections inside the Body: (1) Complexity Doubt (show 1-hand use or 3 easy steps, no tools/drilling), (2) After-Use Doubt (include a 2s clip showing effortless rinsing/washing or compact storage), and (3) Durability Doubt (physically tap/bend/press material or demonstrate waterproof/heatproof build).',
      'Avoid 3 Problem-Solving Mistakes: (1) Demoing on clean surfaces (zero contrast), (2) Over-polished studio TV-commercial look (raw authentic home/phone-shot vibe earns far higher trust), and (3) Hiding the payoff until the last 3 seconds (show the product working in-action within the first 0–3s, then explain).',
    ],
    rawGuidance: `Lesson 7: Problem-Solving Products (Module 3: Product-Specific Concepts)
1. Core Barrier: Skepticism ("Does it really work?"). Core Weapon: Show, Don't Tell + Sharp Before/After Contrast.
2. 4 Winning Concepts:
   - Old Way vs. New Way (painful old habit vs. fast product demo)
   - Extreme / Stress Test (push beyond everyday difficulty to prove effortless power)
   - One-Take Proof (uncut continuous demo or timelapse + "No Filter / ဖြတ်ဆက်မပါ", e.g., half-clean contrast)
   - Relatable Micro-Drama (3–5s awkward everyday mishap -> product rescue)
3. 3 Body Objections to Crush Visually:
   - Complexity Doubt (easy 3-step / 1-hand setup)
   - After-Use Doubt (mandatory 2s easy rinse/clean/store shot)
   - Durability Doubt (physical thickness/tap/squeeze/waterproof proof)
4. Avoid: Testing on clean surfaces, overly slick studio TV-ad style (prefer Raw & Authentic home setting), delaying the action result until the end of the video.`,
  },
  {
    lessonNumber: 8,
    title: 'Impulse Buy & Trendy Products (မြင်မြင်ချင်း ဝယ်ချင်စိတ်ဖြစ်စေသော ပစ္စည်းများ)',
    corePrinciples: [
      'Impulse Buy & Trendy items (cute lamps, novelty mugs, trendy mini gadgets, desk decor, viral phone cases/accessories) sell on "Want" (Excitement, Novelty, FOMO), NOT "Need". Never invent a fake heavy problem.',
      'Two-Brain Battle & 15–30s Speed Rule: Peak the Emotional Brain before the Logical Brain ("do I really need this?") wakes up. Keep videos punchy at 15–30 seconds. Formula: Instant Excitement + Small Logical Excuse > Price Hesitation.',
      'Use 4 high-converting Impulse Concepts: (1) Instant "Wow" Reveal (show the single most magical/aesthetic trick at 0–2s with zero intro), (2) Viral Bandwagon / FOMO ("sold out 3x / everyone on TikTok is buying this" + genuine excited Unboxing/Reaction), (3) Escalating Value ("And that\'s not all!" — stack surprising 2-in-1 / 3-in-1 uses step-by-step), and (4) Gift / Mood-Booster Angle (frame as a guaranteed-hit gift for partner/friend to spark shares & tags, or a tiny daily mood-lift reward).',
      'Kill Buyer\'s Guilt with 3 tools: (1) Price Anchoring (compare cost to everyday spending like "less than 2 cups of coffee"), (2) The Logical Excuse (highlight 1 small practical function even for a 90% aesthetic item so Logical Brain approves), and (3) Immediate Trigger (credible urgency like popular color selling out fastest, flash voucher, or 2-pack bundle).',
      'Match sub-category visual styles: Mini Gadgets -> Instant Action Demo; Cute Desk Decor -> Before/After Vibe Shift; Novelty Gifts -> Reaction & Tag-a-Friend; Viral Accessories -> Fast Color/Style Haul + "Which color would you pick?" comment hook.',
      'Avoid 3 Impulse Mistakes: (1) Over-explaining specs in a 60–90s video (kills impulse), (2) Fake urgency ("only 3 left!" repeatedly ruins trust — use believable color/voucher/seasonal triggers), and (3) Copying the exact same viral unboxing late in the trend (stand out with "Honest test: worth the hype?" or "Cheap vs. Premium comparison").',
    ],
    rawGuidance: `Lesson 8: Impulse Buy & Trendy Products (Module 3: Product-Specific Concepts)
1. Psychology: "Want" > "Need". Keep duration tight (15–30s) so Emotional Brain buys before Logical Brain overthinks.
2. 4 Winning Concepts:
   - Instant "Wow" Reveal (0–2s magic/aesthetic hook, zero intro)
   - Viral Bandwagon / FOMO (crowd demand, restock buzz + excited unboxing/reaction)
   - Escalating Value ("Wait, it ALSO does this!" — layer surprising secondary functions)
   - Gift / Mood-Booster Angle (partner/friend gift with Reaction/Tag-a-Friend or small self-reward)
3. Killing Buyer's Guilt:
   - Price Anchoring (e.g., "less than 2 coffees")
   - Logical Excuse (1 practical use so Logical Brain says yes)
   - Immediate Trigger (believable color sellout / voucher / bundle)
4. Sub-category angles: Mini Gadgets (Instant Action), Desk Decor (Vibe Shift), Novelty Gifts (Reaction/Share), Accessories (Color Haul + comment poll).
5. Avoid: Long spec explanations, fake scarcity, copycat unboxings late in a trend (pivot to "Worth the hype?" honest test or comparison).`,
  },
  {
    lessonNumber: 9,
    title: 'Aesthetic, Fashion & Lifestyle Products (အလှအပ၊ ဖက်ရှင်နှင့် လူနေမှုပုံစံ ပစ္စည်းများ)',
    corePrinciples: [
      'Aesthetic, Fashion & Lifestyle products (clothing, shoes, bags, watches, jewelry, perfume, cosmetics, home decor) sell on Identity & Aspiration ("Upgraded Self"), never dry specs like "100% cotton".',
      'Every video idea must trigger at least 1 of 3 emotions: (1) Confidence & Flattery (looks slimmer, taller, brighter), (2) Status & Good Taste (affordable yet looks expensive — Clean Look / Minimalist / Old Money vibe), or (3) Lifestyle Mood (Pinterest / calm cafe aesthetic).',
      'Use 4 high-converting Fashion/Lifestyle Concepts: (1) 1 Piece, 3 Ways / GRWM (style 1 item for Office, Weekend Cafe, and Dinner/Date to triple perceived value), (2) Real-Body Flattery (address real insecurities like petite height <5\'2", belly/thigh/arm flattery instead of skinny model shots), (3) Occasion & Scenario Storytelling (open with a vivid moment — elevator perfume compliment, job interview confidence, wedding outfit panic), and (4) Vibe & Sensory Immersion (for candles, mugs, minimalist decor: less pushy talk, warm morning light, sensory sound + minimal text).',
      'Crush 3 mandatory online fashion/lifestyle doubts visually: (1) Fit & Sizing Doubt (display wearer height/weight/size on screen e.g. 5\'3" | 52kg | Size M + show side/back/sitting/walking movement), (2) Quality & Texture Doubt (mandatory 3s Texture Close-Up: fabric stretch/wrinkle test, lining & stitching flip, zipper pull & leather press), and (3) Practicality Doubt ("What Fits Inside" bag test with phone/wallet/power bank, pressing shoe sole softness, makeup/perfume Wear Test & scent-scene imagery).',
      'Avoid 3 Aesthetic/Fashion Mistakes: (1) Static photo slideshows (always show real fabric drape, movement, and light reflection), (2) Heavy color filters that distort True Color (shoot in Natural Daylight to avoid returns), and (3) Zero Lifestyle Context (never film clothes on a hanger or bags on the floor — show a real person wearing/using them in a relatable cafe, office, or styled room).',
    ],
    rawGuidance: `Lesson 9: Aesthetic, Fashion & Lifestyle Products (Module 3: Product-Specific Concepts)
1. Psychology: Identity & Aspiration ("Upgraded Self") -> deliver Confidence & Flattery, Status & Good Taste, or Lifestyle Mood.
2. 4 Winning Concepts:
   - 1 Piece, 3 Ways / GRWM (Office, Weekend Cafe, Date — triples perceived value)
   - Real-Body Flattery (petite, belly/arm/thigh flattering proof on relatable body types)
   - Occasion & Scenario Storytelling (elevator compliment, interview, wedding invite)
   - Vibe & Sensory Immersion (warm natural light, ASMR texture/pour/spray, minimal text, non-salesy tone)
3. 3 Doubts to Crush Visually:
   - Fit & Sizing (height/weight/size tag on screen + 360°/walk/sit movement)
   - Quality & Texture (3s macro close-up: stretch, crumple, lining/stitching, zipper/material thickness)
   - Practicality ("What Fits Inside" for bags, insole softness press for shoes, wear-test/2 skin tones for makeup, Space Glow-Up Before/After for home decor)
4. Avoid: Static photo slideshows, heavy color-distorting filters (use Natural Daylight), shooting without real-life lifestyle context.`,
  },
  {
    lessonNumber: 10,
    title: 'High-Ticket & Trust-Based Products (ဈေးကြီးသော နှင့် ယုံကြည်မှုလိုအပ်သော ပစ္စည်းများ)',
    corePrinciples: [
      'High-Ticket & Trust-Based covers BOTH high-priced goods (tech, home appliances, furniture) AND moderate-priced high-risk categories (skincare, supplements, weight management, mother & baby, clinics/courses/services). Logical Brain is fully active — goal is Trust >> Perceived Risk, never pushy hard-selling.',
      'Combine at least 2–3 of the 4 Pillars of Trust in every concept: (1) Authority & Mechanism (explain WHY/HOW it works — ingredients, tech, lab/FDA/ISO), (2) Real Social Proof (ordinary relatable user & long-term results), (3) Radical Honesty (admit 1 minor drawback or who should NOT buy), and (4) Risk Reversal (warranty, replacement, after-sales service, free consultation, or trial size).',
      'Use 4 high-converting High-Ticket/Trust Concepts: (1) "Educate to Sell" (explain root cause of problem + Unique Mechanism to earn expert trust), (2) Documentary / Progress Log (unfiltered, same-lighting Day 1 -> Day 14 -> Day 30 realistic journey), (3) Honest Disqualification ("Do NOT buy this if..." reverse psychology filtering), and (4) Founder Story / Behind-the-Scenes (sourcing, lab/QC checks, service center).',
      'Reframe higher prices using 3 Price Justification Tactics: (1) Cost-Per-Use Breakdown (price divided over lifespan/warranty -> "less than 1 bottle of water/day"), (2) Anchor Against Expensive Alternative (clinic treatment cost or 3 months of cafe coffee), and (3) Cost of Buying Cheap (repeated replacements or skin/health damage from cheap alternatives).',
      'Duration, CTA & Funnel Rules: High-Ticket/Trust videos perform best at 45–90 seconds (buyers want thorough clarity), paired with Low-Friction CTAs (free consultation, check warranty/specs, trial pack) and a multi-video trust sequence (Video 1: Education/Mechanism -> Video 2: User Review/Case Study -> Video 3: FAQ + Offer).',
      'Strictly avoid Miracle Claims ("100% acne gone in 3 days", "lose 10 lbs in 1 week") — they trigger skepticism AND violate TikTok/Meta ad policies. Always set realistic, compliant expectations.',
    ],
    rawGuidance: `Lesson 10: High-Ticket & Trust-Based Products (Module 3: Product-Specific Concepts)
1. Scope: Expensive items (appliances, tech, furniture) + High-Risk items (skincare, supplements, mother & baby, services). Goal: Trust >> Perceived Risk.
2. 4 Pillars of Trust (use 2–3): Authority & Mechanism | Real Social Proof | Radical Honesty | Risk Reversal (warranty/trial/service).
3. 4 Winning Concepts:
   - Educate to Sell (root cause + Unique Mechanism)
   - Documentary / Progress Log (unfiltered Day 1 -> Day 14 -> Day 30)
   - Honest Disqualification ("Don't buy this if..." — builds massive credibility)
   - Founder Story / Behind-the-Scenes (QC, ingredients, service center)
4. 3 Price Justification Tactics: Cost-Per-Use | Anchor vs. Expensive Alternative | Cost of Buying Cheap.
5. Sub-category angles: Skincare/Supplements (Mechanism + Progress Log + Disqualification), Tech/Appliances (Head-to-Head + Cost-Per-Use + Warranty), Courses/Services (Value-First Teaching + Case Study), Mother & Baby (Safety Proof + Mom-to-Mom review).
6. Rules: 45–90s length OK, Low-Friction CTA, 3-step funnel (Educate -> Case Study -> FAQ/Offer), ZERO miracle/policy-violating claims.`,
  },
  {
    lessonNumber: 11,
    title: 'Food & Beverage (အစားအသောက်နှင့် ဖျော်ရည်များ)',
    corePrinciples: [
      'Food & Beverage relies on Sensory Translation: viewers cannot smell or taste through screens, so Sight + Sound must trigger immediate brain taste memory and Craving (the fastest human impulse).',
      'Activate the 4 Craving Triggers in every F&B concept: (1) Texture & ASMR Sound (crunch, sizzle, slice, ice drop & pour), (2) Motion & Pull (rising steam, cheese/meat pull, slow sauce pour, Cross-Section Reveal), (3) Abundance & Generosity (packed fillings, generous portions), and (4) Freshness & Color Contrast (vivid golden, green, red contrasts).',
      'Use 4 high-converting F&B Concepts: (1) The "First Bite" Hook (0–3s close-up crunch/bite triggering Mirror Neurons with genuine natural reaction), (2) The "Making-Of" / Process Flow (fast-paced fresh prep -> cook -> slice -> pack, triggering hunger AND proving hygiene silently), (3) The Craving Moment / Pairing Angle (4 PM office hunger, rainy day comfort, lazy no-cook meal with hot rice), and (4) The Craft & Secret Ingredient Story (USP like homemade 3-hour sauce, zero preservatives, stays crispy when cool, fresh oil daily).',
      'Crush 3 F&B buyer doubts visually: (1) Portion & Value Doubt (show scale in hand, overflowing container, cross-section filling ratio), (2) Hygiene & Safety Doubt (show gloves, clean surfaces, clear oil, sealed packaging — never just claim "clean"), and (3) Taste & Delivery Doubt (use vivid sensory taste/texture words like crispy-outside/juicy-inside, non-greasy, separate sauce + 2s packaging durability shot).',
      'Match sub-category angles: Fried/Crispy -> ASMR Crunch + Pull; Freshly Prepped -> Prep-to-Slice Reveal; Packaged/Jarred Snacks & Sauces -> "1 Jar, 3 Ways + Pantry Staple" (pair with hot rice, noodles, fried egg); Drinks/Coffee -> Pour & Swirl ASMR.',
      'Avoid 3 F&B Mistakes: (1) Empty words like "so delicious" (describe exact texture/aroma/flavor contrast instead), (2) Dim or cold blue lighting (always use Natural Daylight or warm side lighting so food looks vibrant and appetizing), and (3) Unclear/missing order CTA while craving peaks (include price + instant order action immediately).',
    ],
    rawGuidance: `Lesson 11: Food & Beverage (Module 3: Product-Specific Concepts)
1. Core Weapon: Sensory Translation (Sight + Sound -> Craving).
2. 4 Craving Triggers: Texture & ASMR Sound | Motion & Pull (steam, cheese pull, pour, cross-section) | Abundance & Generosity | Freshness & Color Contrast.
3. 4 Winning Concepts:
   - First Bite Hook (0–3s close-up crunch/bite + genuine Mirror Neuron reaction)
   - Making-Of / Process Flow (fast fresh prep -> slice -> pack; proves hygiene + sparks craving)
   - Craving Moment / Pairing Angle (4 PM hunger, rainy weather, lazy day with hot rice)
   - Craft & Secret Ingredient Story (homemade process, zero preservatives, unique crispiness/recipe USP)
4. 3 Doubts to Crush Visually: Portion/Scale (hand scale + cross-section) | Hygiene (gloves, clean prep, sealed pack) | Taste & Delivery (vivid texture/flavor descriptors + 2s secure packaging shot).
5. Sub-category angles: Crispy/Fried (ASMR Crunch + Pull), Fresh Prep (Prep-to-Slice Reveal), Packaged/Jarred Foods (1 Jar, 3 Ways + Pantry Staple), Beverages (Pour & Swirl ASMR).
6. Avoid: Generic "delicious" adjectives, dim/blue lighting (use warm/daylight side lighting), unclear order CTA.`,
  },
  {
    lessonNumber: 12,
    title: 'Creative Angles & UGC (မတူညီသော ရှုထောင့်များနှင့် သုံးစွဲသူပုံစံ ကြော်ငြာများ)',
    corePrinciples: [
      'Distinguish Hook vs. Creative Angle: Hook = 0–3s scroll-stopper; Creative Angle = the entire video\'s core buying Motivation & Perspective. Changing music, font, or color filter is NOT a new angle — only changing WHY the buyer wants it creates a genuinely new angle that beats Ad Fatigue and unlocks new buyer segments.',
      'Generate diverse non-overlapping video ideas for a single product across 6 Proven Creative Angles: (1) The Skeptic Converted ("didn\'t believe the hype until I tried it"), (2) Us vs. Them / Comparison, (3) Money-Saving / Value (Logical Brain ROI), (4) The Gift / For Someone Else (mom/dad/partner gift angle), (5) Day-in-the-Life / Mini Vlog (woven naturally into a daily routine), and (6) Common Mistake / Myth (exposes why their usual habit fails).',
      'Beat Ad Blindness with UGC (User-Generated Content) using 4 proven formats: (1) Talking-Head Honest Review (highest trust), (2) POV / Hands-Only Unboxing & Demo (faceless, fast production), (3) Green Screen / Comment Reply (answering real buyer questions/reviews), and (4) Two-Character Skit (fast relatable banter, high shares).',
      'Apply 5 Authentic UGC Secrets so concepts never feel like fake paid ads: (1) Friend-to-friend spoken tone (zero formal broadcaster phrasing), (2) Tidy but real home/desk/car setting, (3) The Flaw-Trust Hack (mention 1 tiny honest downside that reinforces a benefit, e.g., tight lid = zero leaks), (4) Native TikTok subtitles & casual handheld phone feel, and (5) Product naturally visible in-hand/in-use within the first 0–3s.',
      'Strict Angle Discipline: 1 Video = 1 Focused Angle (never mash 3–4 angles into one 30s clip, which dilutes the message), and always propose at least 3 genuinely distinct Creative Angles per product so creators never abandon a good product after 1 video.',
    ],
    rawGuidance: `Lesson 12: Creative Angles & UGC (Module 4: Scaling & Diversity)
1. Creative Angle != Hook or Edit tweak. A true Angle changes the buyer's core Motivation/Story.
2. 6 Proven Angles for 1 Product:
   - The Skeptic Converted | Us vs. Them Comparison | Money-Saving / Value | The Gift / For Someone Else | Day-in-the-Life Mini Vlog | Common Mistake / Myth
3. 4 High-Converting UGC Formats (beat Ad Blindness):
   - Talking-Head Honest Review | POV / Hands-Only Unboxing & Demo (faceless) | Green Screen / Comment Reply | Two-Character Skit
4. 5 Authentic UGC Secrets:
   - Friend-to-friend casual tone (no formal ad voice)
   - Real lived-in environment (room/kitchen/desk/car)
   - The Flaw-Trust Hack (1 tiny honest flaw -> 100% credibility)
   - Native platform subtitles & casual handheld vibe
   - Product visible naturally in first 0–3s
5. Strict Rules: 1 Video = 1 Focused Angle. Always generate >=3 distinct Angles to test before judging a product.`,
  },
  {
    lessonNumber: 13,
    title: 'Analyzing & Scaling (ကြော်ငြာရလဒ်ကို သုံးသပ်ခြင်းနှင့် အဆင့်မြှင့်တင်ခြင်း)',
    corePrinciples: [
      'Judge ad performance using the 4 Core Metrics in sequence — never fall into the Vanity Metrics Trap (views/likes without sales): (1) Hook Rate / 3s Retention (>=25–30% ads; >=60–70% organic 3s retention), (2) Hold Rate / Avg Watch Time (>=30–50% of video duration), (3) CTR / Product Click Rate (>=1.5–2% paid; >=3–5% TikTok Shop organic), and (4) CVR (conversion from product page clicks to checkout).',
      'Apply the Ad Diagnosis Matrix to fix only the leaking stage instead of trashing a whole video: Low Hook Rate -> keep Body, swap 3 new Hooks; Good Hook + Low Hold -> tighten Bridge & show product action before 5s; Good Hold + Low CTR -> add stronger USP/objection handling + sharper CTA/Offer; Good CTR + Low CVR -> pre-qualify price value in-video & audit product page/reviews/voucher.',
      'Mine Comments as Qualitative Gold: (1) Buyer Questions ("does it wash off?", "okay for tan skin?") -> 1 comment represents ~50 silent hesitant buyers -> turn directly into Comment Reply Hook videos; (2) Skeptical/Critical Comments -> never delete; overlay comment on screen and shoot an Extreme Proof reply video (highest-converting format); (3) Buyer Praise Phrases -> copy exact natural phrasing into future hooks & scripts.',
      'Scale Winning Ads proactively BEFORE Ad Fatigue hits ("Always Be Testing") using 3 Iteration Steps: (1) Hook Iterations (fastest — keep winning Body + CTA identical, shoot 3–5 new Hooks), (2) Format Refresh (same winning script/angle, switch visual format e.g. POV Hands-Only -> Talking-Head Review or Comparison), and (3) Angle & Audience Expansion (carry the winning core insight into adjacent buyer segments like Office Workers -> Long-Distance Drivers -> Gift for Mom).',
    ],
    rawGuidance: `Lesson 13: Analyzing & Scaling (Module 4: Data Diagnosis & Iteration)
1. 4 Core Metrics: Hook Rate (0–3s) -> Hold Rate (Watch Time) -> CTR (Product Click) -> CVR (Checkout). Never judge by Views/Likes alone.
2. Ad Diagnosis Matrix:
   - Low Hook -> keep Body, test 3 new Hooks
   - Good Hook + Low Hold -> fix Bridge, show action before 5s
   - Good Hold + Low CTR -> strengthen USP/objection handling + Offer/CTA
   - Good CTR + Low CVR -> pre-frame price value in-video + fix Shop page/reviews
3. Comment Goldmine:
   - Questions -> Comment Reply Hook videos
   - Skepticism/Criticism -> Extreme Proof reply videos
   - Praise words -> Reuse exact buyer vocabulary in next Hooks
4. 3-Step Scaling & Iteration (beat Ad Fatigue while winning):
   - Step 1: Hook Iterations (3–5 new Hooks on same Body + CTA)
   - Step 2: Format Refresh (same angle, new visual format: POV -> Talking-Head / Comparison)
   - Step 3: Angle & Audience Expansion (expand winning insight to adjacent buyer groups).`,
  },
];

export function buildVideoIdeasSystemInstruction(): string {
  const curriculumBlocks = VIDEO_IDEAS_LESSONS.map(
    (lesson) => `### Lesson ${lesson.lessonNumber}: ${lesson.title}\n${lesson.rawGuidance}`
  ).join('\n\n');

  return `ROLE:
${VIDEO_IDEAS_AI_ROLE}

You have been thoroughly trained on the 13-Lesson TikTok Shop & Social Ad Creative Strategy Curriculum below.
You MUST actively apply these exact frameworks, buyer psychology rules, category playbooks, hook structures, UGC authenticity principles, and scaling methods, grounded strictly in the product's REAL Kalodata metrics and Kalodata Deep Data (revenue channels, daily trend, creator count, buyer reviews/pain points, usage scenarios, seller highlights & description).

IMPORTANT DISTINCTION & DELIVERABLES:
- Your job IS to think like a veteran TikTok Shop Creative Strategist & Concept Director:
  1. Reason explicitly from Kalodata Deep Data (sales velocity, video vs. live/mall revenue mix, price/commission payout, buyer pain points, highlights, and usage scenarios) — never invent unverified statistics.
  2. Deliver actionable Summary Strategies (Executive Ad Strategy, Kalodata Data Play, Creative Execution Strategy, Testing & Funnel Strategy) so the creator knows exactly how to turn this product into winning commercial ads.
  3. Deliver a Thailand TikTok Shop SEO Pack (3 high-CTR Thai video/cover titles, complete Thai description/caption with soft ตะกร้าเหลือง CTA, high-intent Thai hashtags, search keywords, and SEO posting guidance) PLUS concept-level SEO for each idea.
  4. Design 3 genuinely distinct Video Ideas (Idea 1, Idea 2, Idea 3) spanning different Creative Angles, Awareness Levels, and UGC formats so each Idea can subsequently be turned into its own dedicated Video Plan & AI Prompts.

COMPLETE 13-LESSON TRAINING CURRICULUM:
${curriculumBlocks}`;
}












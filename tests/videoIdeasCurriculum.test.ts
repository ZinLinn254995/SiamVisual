import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  buildVideoIdeasSystemInstruction,
  VIDEO_IDEAS_AI_ROLE,
  VIDEO_IDEAS_LESSONS,
} from '../server/videoIdeasCurriculum.ts';
import { VideoStudioView } from '../src/components/VideoStudioView.tsx';
import { TRANSLATIONS } from '../src/i18n.ts';
import { buildExternalAiChatPrompt } from '../src/lib/aiChatPromptBuilder.ts';
import {
  buildBackupPayload,
  getIdeaPlansForProduct,
  loadIdeaPlansCache,
  parseBackupFile,
  persistIdeaPlansCache,
  saveIdeaPlanForProduct,
  upsertHistoryEntry,
} from '../src/lib/storage.ts';
import type {
  ProductItem,
  SavedHistoryEntry,
  VideoAdPlan,
  VideoIdeasStrategyPack,
} from '../src/types.ts';

function buildSampleVideoIdeasPack(): VideoIdeasStrategyPack {
  return {
    playbookCategory: 'problem_solving',
    playbookReason: {
      my: 'ပြဿနာဖြေရှင်းပစ္စည်းဖြစ်၍ Visual Proof နှင့် Contrast ကို ဦးစားပေးရမည်။',
      en: 'Problem-solving item requiring sharp Visual Proof and Before/After contrast.',
    },
    kalodataEvidenceSummary: {
      my: 'Kalodata 7-day Video Revenue 68% ရှိပြီး Video 42 ခုမှ ရောင်းအားမြင့်နေသောကြောင့် Problem-Solution Demo သည် အထိရောက်ဆုံးဖြစ်သည်။',
      en: 'Kalodata shows 68% 7-day Video Revenue share across 42 videos, confirming Problem-Solution Demo drives conversion.',
    },
    productAnalysis: {
      coreFeature: { my: 'အပူချိန် ၁၅ စက္ကန့်အတွင်း တက်သည်', en: 'Heats up in 15 seconds' },
      functionalBenefit: {
        my: 'မီးပူခုံမလိုဘဲ ချိတ်လျက်တိုက်နိုင်',
        en: 'Steams clothes on hanger without ironing board',
      },
      emotionalBenefit: {
        my: 'မနက်တိုင်း အချိန်မလုဘဲ ယုံကြည်မှုရှိရှိ ထွက်နိုင်',
        en: 'Leave home confident without morning rush',
      },
      coreUsp: {
        my: '၁၅ စက္ကန့်အမြန်အပူတက် + ရေစက်မကျ',
        en: '15s fast heat + zero water droplets',
      },
      visualProofIdea: {
        my: 'ကြေမွနေသောရှပ်အင်္ကျီကို တစ်ဆက်တည်း ဆွဲပြန့်ပြခြင်း',
        en: 'One-take steam glide over deeply wrinkled shirt',
      },
    },
    targetAudience: {
      primaryBuyer: {
        my: 'မနက်အလုပ်နောက်ကျတတ်သော ရုံးဝန်ထမ်းများ',
        en: 'Busy office workers rushing mornings',
      },
      painPointLadder: {
        my: 'အင်္ကျီကြေ -> မီးပူခုံထုတ်ရပင်ပန်း -> အလုပ်နောက်ကျစိတ်ဖိစီး',
        en: 'Wrinkled shirt -> board hassle -> morning stress',
      },
      buyerVoiceInsight: {
        my: 'ရေစက်ကျပြီး အင်္ကျီစိုမှာ စိုးရိမ်ကြသည်',
        en: 'Buyers worry about water spitting onto fabric',
      },
    },
    summaryStrategies: {
      executiveSummary: {
        my: 'မနက်ခင်းအလုပ်များသူများအတွက် ၁၅ စက္ကန့်အမြန်မီးပူတိုက်နိုင်မှုကို Visual Proof ဖြင့် ဦးစားပေးကြော်ငြာပါ။',
        en: 'Focus ad creative on 15-second wrinkle removal proof for rushed morning office workers.',
      },
      kalodataDataPlay: {
        my: 'Video Channel မှ ဝင်ငွေ 68% ရရှိနေ၍ Short-Form Demo Video များကို Creator များနှင့် ပူးပေါင်းတင်ရန် သင့်တော်သည်။',
        en: 'With 68% revenue coming from short videos, prioritize creator-style native product demo clips.',
      },
      creativeExecutionStrategy: {
        my: '0-3s တွင် ရှပ်အင်္ကျီအကြေနှင့် မီးပူခုံအခက်အခဲကိုပြပြီး 4-15s တွင် One-Take Steam Glide + Dry Tissue Test ကို ပြသပါ။',
        en: 'Open 0-3s on wrinkled collar struggle, then prove zero droplets with dry tissue test in 4-15s.',
      },
      testingAndFunnelStrategy: {
        my: 'Idea 1 (Problem Aware), Idea 2 (Product Proof), Idea 3 (Travel/Compact Angle) တို့ကို Hook 3 မျိုးစီဖြင့် A/B Test လုပ်ပါ။',
        en: 'A/B test Idea 1, Idea 2, and Idea 3 with 3 hook variants across awareness stages.',
      },
    },
    seoPack: {
      titlesTh: [
        'เตารีดไอน้ำพกพา รีดเรียบใน 15 วิ ไม่ต้องใช้โต๊ะรีด',
        'รีวิวเตารีดไอน้ำมินิ แก้ผ้าอับยับตอนเช้าทันเวลา',
      ],
      titlesMeaning: {
        my: '၁၅ စက္ကန့်အတွင်း ပြန့်စေသော မီးပူခုံမလို ခရီးဆောင်ရေနွေးငွေ့မီးပူ',
        en: 'Portable steamer smooths in 15s without an ironing board',
      },
      descriptionTh:
        'เตารีดไอน้ำพกพา Mini Steamer Pro ร้อนไว 15 วิ ไม่ต้องกางโต๊ะรีด พิกัดตะกร้าเหลืองเลย',
      descriptionMeaning: {
        my: 'မနက်အလုပ်သွားခါနီး မီးပူခုံထုတ်ဖို့ အချိန်မရှိသူများအတွက် ၁၅ စက္ကန့်အတွင်း ပြန့်ပေးမယ့် Mini Steamer Pro။',
        en: 'Mini Steamer Pro heats up in 15 seconds for effortless wrinkle removal before work without an ironing board.',
      },
      hashtags: ['#เตารีดไอน้ำพกพา', '#ของใช้ในบ้าน', '#tiktokshopth', '#รีวิวของดี'],
      keywords: ['เตารีดไอน้ำพกพา', 'mini steamer', 'รีดผ้าไม่ยับ'],
      postingTip: {
        my: 'ရုံးသွားချိန် 07:30-08:30 ICT နှင့် ညနေ 19:00-21:00 ICT တွင် တင်ပါ။',
        en: 'Post during 07:30-08:30 ICT morning rush or 19:00-21:00 ICT evening browse.',
      },
    },
    concepts: [
      {
        title: {
          my: 'မနက် ၁၀ မိနစ် ပိုအိပ်ရမယ့် နည်းလမ်း',
          en: 'Sleep 10 Minutes Longer Every Morning',
        },
        targetSegment: { my: 'ရုံးဝန်ထမ်းများ', en: 'Office commuters' },
        awarenessLevel: 'problem_aware',
        framework: 'PAS',
        creativeAngle: { my: 'Old Way vs. New Way', en: 'Old Way vs. New Way' },
        ugcFormat: { my: 'POV / Hands-Only Demo', en: 'POV / Hands-Only Demo' },
        recommendedDuration: '30–40s',
        kalodataBasis: {
          my: 'Kalodata Video Revenue ฿180K နှင့် Daily Steady Trend ကြောင့် ရုံးဝန်ထမ်း Pain Point Demo ကို အဓိကထားသည်။',
          en: 'Backed by Kalodata ฿180K video revenue and steady 7d demand focusing on morning office pain point.',
        },
        visualShootingTips: {
          my: 'အနီးကပ် Macro Lighting ဖြင့် ရေနွေးငွေ့ထွက်ပုံနှင့် စက္ကူအဖြူပေါ် ရေစက်မကျပုံကို ရှင်းရှင်းလင်းလင်း ရိုက်ပါ။',
          en: 'Shoot close-up side light to capture crisp steam plume and dry tissue water-spot test.',
        },
        hook3Layer: {
          hookType: { my: 'Pain Point + Action in Motion', en: 'Pain Point + Action in Motion' },
          visualHook: {
            my: 'အင်္ကျီအကြေကြီးကို တစ်ချက်ဆွဲပြန့်ပြနေပုံ',
            en: 'Steaming deeply wrinkled shirt mid-action',
          },
          verbalHook: {
            my: 'မနက်အလုပ်နောက်ကျနေပြီဆိုမှ အင်္ကျီကကြေနေတာ ကြုံဖူးလား?',
            en: 'Ever late for work and your shirt is totally wrinkled?',
          },
          textHook: {
            my: 'မီးပူခုံမလိုဘဲ ၁၅ စက္ကန့်နဲ့ ပြန့်!',
            en: 'Wrinkle-free in 15s, no board!',
          },
        },
        bridgeHold: {
          my: 'မီးပူခုံထုတ်ရ အပူစောင့်ရနဲ့ ၁၅ မိနစ်ကုန်တယ်မလား?',
          en: 'Dragging out a heavy ironing board wastes 15 minutes.',
        },
        bodyPlan: {
          my: 'One-Take တိုက်ပြပြီး ရေစက်မကျကြောင်း စက္ကူပေါ်စမ်းပြပါ။',
          en: 'One-take glide demo plus dry-tissue test to crush wet-spot doubt.',
        },
        ctaAction: {
          my: 'မနက်တိုင်းအချိန်သက်သာချင်ရင် အောက်ကခြင်းတောင်းဝါထဲ ဝင်ကြည့်လိုက်ပါ။',
          en: 'Tap the yellow basket below to save time every morning.',
        },
        muteTestVisual: {
          my: 'အသံပိတ်ကြည့်ရင်တောင် အကြေကနေ ချက်ချင်းပြန့်သွားတာ မြင်သာသည်။',
          en: 'Before/After wrinkle removal is unmistakable on mute.',
        },
        extraHookVariations: {
          my: [
            'ဒီမီးပူလေးကို မဝယ်နဲ့... မနက်တိုင်း ၁၅ မိနစ်စောထချင်ရင်ပေါ့',
            'ရေစက်ကျလား စက္ကူအဖြူပေါ် တကယ်စမ်းပြမယ်',
          ],
          en: [
            'Do not buy this unless you hate ironing boards',
            'Testing if it spits water on dry tissue',
          ],
        },
        seo: {
          titleTh: 'เตารีดไอน้ำพกพา รีดง่ายใน 15 วิ ก่อนไปทำงาน',
          titleMeaning: {
            my: 'အလုပ်မသွားခင် ၁၅ စက္ကန့်အတွင်း လွယ်ကူစွာမီးပူတိုက်နည်း',
            en: 'Easy 15s steam before work',
          },
          descriptionTh:
            'เช้าเร่งรีบแค่ไหนเสื้อก็เรียบได้ ไม่ต้องกางโต๊ะรีด #เตารีดไอน้ำพกพา',
          descriptionMeaning: {
            my: 'မနက်အလျင်လိုနေလည်း မီးပူခုံမလိုဘဲ အင်္ကျီပြန့်စေမယ်',
            en: 'Smooth shirts in rushed mornings without an ironing board',
          },
          hashtags: ['#เตารีดไอน้ำพกพา', '#ชีวิตคนทำงาน'],
          keywords: ['เตารีดพกพา', 'รีดผ้าเร็ว'],
        },
      },
    ],
    scalingPlan: {
      commentMiningIdeas: {
        my: ['ပိုးသားအင်္ကျီ လောင်လားမေးတဲ့ Comment ကို လက်တွေ့ပြန်ရိုက်ပြရန်'],
        en: ['Reply to silk-fabric safety comments with live test'],
      },
      iterationRoadmap: {
        my: 'Step 1: Hook ၃ မျိုးပြောင်း -> Step 2: Talking-Head Review ပြောင်းရိုက် -> Step 3: ခရီးသွားသူများအတွက် ချဲ့ထွင်ပါ။',
        en: 'Step 1: Swap 3 Hooks -> Step 2: Talking-Head format -> Step 3: Expand to frequent travelers.',
      },
      watchOuts: {
        my: ['အကြေမရှိတဲ့ အင်္ကျီအပြန့်ပေါ် စမ်းမပြပါနဲ့'],
        en: ['Never demo on an already-flat shirt'],
      },
    },
  };
}

function buildSampleIdeaPlan(productId = 'test_vi_01'): VideoAdPlan {
  return {
    id: 'plan_idea_0',
    productId,
    ideaIndex: 0,
    createdAt: '2026-11-26T12:00:00.000Z',
    conceptTitle: { my: 'Idea 1 Master Plan', en: 'Idea 1 Master Plan' },
    conceptSummary: {
      my: 'မနက်ခင်း အင်္ကျီကြေပြဿနာကို ၁၅ စက္ကန့် Steam Proof ဖြင့် ဖြေရှင်းပြသည့် Video Plan။',
      en: 'Video Plan proving 15-second wrinkle removal for morning commuters.',
    },
    visualDirection: {
      my: 'Side-lit 9:16 macro steam contrast shot.',
      en: 'Side-lit 9:16 macro steam contrast shot.',
    },
    productionStrategy: {
      my: 'Kalodata Video Revenue 68% အပေါ်အခြေခံ၍ 30s Direct-to-Camera + Voiceover/Text pacing ဖြင့် ထုတ်လုပ်ပါ။',
      en: 'Grounded in 68% Kalodata Video Revenue share with 30s native demo + Thai on-screen captions.',
    },
    hooks: [
      {
        title: { my: 'Hook 1', en: 'Hook 1' },
        visualAction: { my: 'Wrinkled collar close-up', en: 'Wrinkled collar close-up' },
        onScreenTextTh: 'รีบแค่ไหนเสื้อก็เรียบใน 15 วิ',
        onScreenTextMeaning: { my: '15s smooth', en: 'Smooth in 15s' },
      },
    ],
    storyboard: [
      {
        timeRange: '0-3s',
        sceneVisual: { my: 'Steam blast over wrinkled linen', en: 'Steam blast over wrinkled linen' },
        cameraMove: { my: 'Push-in', en: 'Push-in' },
        soundDesign: {
          my: 'Crisp steam hiss + Thai voiceover hook',
          en: 'Crisp steam hiss + Thai voiceover hook',
        },
        onScreenTextTh: 'ไม่ต้องกางโต๊ะรีด!',
        onScreenTextMeaning: { my: 'No ironing board needed!', en: 'No ironing board needed!' },
      },
    ],
    aiVideoPrompts: [
      {
        label: { my: 'Shot 1 AI Video Prompt', en: 'Shot 1 AI Video Prompt' },
        prompt:
          'Vertical 9:16 realistic commercial shot of compact mini steamer smoothing linen shirt in warm morning window light.',
      },
    ],
    aiImagePrompts: [
      {
        label: { my: 'Thumbnail Keyframe Prompt', en: 'Thumbnail Keyframe Prompt' },
        prompt:
          'Split frame 9:16 studio photograph showing wrinkled vs steamed shirt collar with mini steamer.',
      },
    ],
    seo: {
      titlesTh: ['เตารีดไอน้ำพกพา 15 วิ เรียบกริบ'],
      titlesMeaning: { my: '၁၅ စက္ကန့်အတွင်း ပြန့်စေမည်', en: 'Smooth in 15s' },
      captionTh: 'ไม่ต้องง้อโต๊ะรีดผ้าแล้ว ตัวเดียวจบทุกเช้า #เตารีดไอน้ำพกพา',
      captionMeaning: { my: 'One device replaces ironing board', en: 'One device replaces ironing board' },
      hashtags: ['#เตารีดไอน้ำพกพา', '#tiktokshopth'],
      keywords: ['เตารีดไอน้ำพกพา', 'mini steamer'],
      postingTip: { my: 'Post 08:00 ICT', en: 'Post 08:00 ICT' },
    },
  };
}

function makeProduct(withPack: boolean): ProductItem {
  return {
    id: 'test_vi_01',
    thaiTitle: 'เตารีดไอน้ำพกพา Mini Steamer Pro',
    clearTitle: { my: 'Mini Steamer', en: 'Mini Steamer' },
    whatItIs: { my: 'Portable steamer', en: 'Portable steamer' },
    whySilentWorks: { my: 'Visual demo', en: 'Visual demo' },
    category: 'home',
    categoryLabel: { my: 'အိမ်သုံး', en: 'Home Supplies' },
    shopName: 'ThaiHome Official',
    priceThb: 299,
    commissionRate: 15,
    commissionThb: 45,
    visualTags: ['demo'],
    kalodataMetrics: {
      salesVolume7d: 920,
      revenueThb7d: 275080,
      videoRevenueThb7d: 187054,
      liveRevenueThb7d: 55000,
      shoppingMallRevenueThb7d: 33026,
      videoCount: 42,
      liveCount: 6,
      creatorCount: 19,
      revenueGrowthRate: 18.4,
      dateRange: 'last7Day',
      revenueTrendThb: [35000, 37000, 38500, 39000, 41000, 42000, 42580],
    },
    aiAnalysis: {
      analyzedAt: '2026-11-26T10:00:00.000Z',
      dataSnapshot: {
        hasSalesMetrics: true,
        hasDetails: true,
        hasSpecs: false,
        hasComments: false,
      },
      cleanName: {
        my: 'เตารีดไอน้ำพกพา Mini Steamer Pro',
        en: 'เตารีดไอน้ำพกพา Mini Steamer Pro',
      },
      ...(withPack ? { videoIdeasPack: buildSampleVideoIdeasPack() } : {}),
      productOverview: { my: 'legacy', en: 'legacy' },
      salesAndPricingAudit: { my: 'legacy', en: 'legacy' },
      profitCalculation: { my: 'legacy', en: 'legacy' },
      silentVideoVerdict: { my: 'legacy', en: 'legacy' },
      visualAngles: { my: [], en: [] },
      deepDataSpecsAudit: { my: '', en: '' },
      deepDataBuyerAudit: { my: '', en: '' },
      risks: { my: [], en: [] },
      missingDataNotes: { my: [], en: [] },
      decision: 'strong_go',
      bottomLine: { my: 'legacy', en: 'legacy' },
    },
  };
}

test('VIDEO_IDEAS_LESSONS preserves all 13 lessons and includes Kalodata deep grounding + Summary Strategies + SEO', () => {
  assert.equal(VIDEO_IDEAS_LESSONS.length, 13);
  for (let i = 1; i <= 13; i++) {
    assert.equal(VIDEO_IDEAS_LESSONS[i - 1].lessonNumber, i);
    assert.ok(VIDEO_IDEAS_LESSONS[i - 1].corePrinciples.length >= 4);
  }
  const instruction = buildVideoIdeasSystemInstruction();
  assert.ok(instruction.includes(VIDEO_IDEAS_AI_ROLE));
  for (let i = 1; i <= 13; i++) {
    assert.ok(instruction.includes(`### Lesson ${i}:`), `Missing Lesson ${i} in system instruction`);
  }
  assert.ok(instruction.includes('Kalodata Deep Data'));
  assert.ok(instruction.includes('Summary Strategies'));
  assert.ok(instruction.includes('TikTok Shop SEO Pack'));
});

test('VideoStudioView removes legacy Video Kit / VisualStyle selector, fixes empty gap below title, and renders per-idea plans + SEO + Summary Strategies', () => {
  const t = TRANSLATIONS.my;
  const productWithPack = makeProduct(true);
  const samplePlan = buildSampleIdeaPlan(productWithPack.id);

  // Confirm legacy Video Kit subpage & VisualStyle selector were completely removed from translations & component
  assert.equal((t.studio.subpages as Record<string, string>).kit, undefined);
  assert.equal((t as unknown as Record<string, unknown>).styles, undefined);
  const studioSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/VideoStudioView.tsx'),
    'utf8'
  );
  assert.ok(!studioSource.includes("activeSubpage === 'kit'"));
  assert.ok(!studioSource.includes('VisualStyle'));
  assert.ok(!studioSource.includes('onSelectStyle'));
  // Empty gap fix: thumbnail uses md:row-span-2 while title container uses auto_1fr grid rows
  assert.ok(studioSource.includes('md:grid-rows-[auto_1fr]'));
  assert.ok(studioSource.includes('md:w-32 md:h-32 md:row-span-2'));

  const commonProps = {
    isSaved: false,
    ideaPlans: {},
    generatingIdeaIndex: null,
    planErrorByIdea: {},
    isEnrichingProduct: false,
    isAnalyzingProduct: false,
    enrichError: null,
    analysisError: null,
    cameFromHistory: false,
    language: 'my' as const,
    kalodataStatus: { connected: false, keySource: 'none' as const, maskedKey: null, balance: null },
    kalodataLimits: { maxSpendCredits: null, minBalanceReserve: null, trackedSpentCredits: 0 },
    t,
    onBack: () => {},
    onToggleSave: () => {},
    onGenerateIdeaPlan: () => {},
    onFetchDeepInsights: async () => {},
    onAnalyzeProduct: async () => {},
    onOpenScoreDetails: () => {},
  };

  // Pre-plan Idea 1 view: Kalodata basis, Shooting Tips, Concept SEO, and Generate Video Plan CTA
  const withPackHtml = renderToStaticMarkup(
    React.createElement(VideoStudioView, {
      ...commonProps,
      product: productWithPack,
      initialSubpage: 'ideas',
      initialIdeasTab: 'idea_0',
    })
  );
  assert.ok(withPackHtml.includes(t.studio.analysisReBtn));
  assert.ok(withPackHtml.includes('เตารีดไอน้ำพกพา Mini Steamer Pro'));
  assert.ok(withPackHtml.includes('PAS (Problem–Agitate–Solve)'));
  assert.ok(withPackHtml.includes(t.studio.generateIdeaPlanBtn(1)));
  assert.ok(withPackHtml.includes('Kalodata Video Revenue'));
  assert.ok(withPackHtml.includes('Macro Lighting'));
  assert.ok(withPackHtml.includes('เตารีดไอน้ำพกพา รีดง่ายใน 15 วิ ก่อนไปทำงาน'));

  // Rendered Video Plan for Idea 1 across Script / Prompts / SEO sections
  const planScriptHtml = renderToStaticMarkup(
    React.createElement(VideoStudioView, {
      ...commonProps,
      product: productWithPack,
      ideaPlans: { 0: samplePlan },
      initialSubpage: 'ideas',
      initialIdeasTab: 'idea_0',
      initialPlanSection: 'script',
    })
  );
  assert.ok(planScriptHtml.includes('id="sec-script"'));
  assert.ok(planScriptHtml.includes(t.studio.regenerateIdeaPlanBtn));
  assert.ok(planScriptHtml.includes('Idea 1 Master Plan'));

  const planPromptsHtml = renderToStaticMarkup(
    React.createElement(VideoStudioView, {
      ...commonProps,
      product: productWithPack,
      ideaPlans: { 0: samplePlan },
      initialSubpage: 'ideas',
      initialIdeasTab: 'idea_0',
      initialPlanSection: 'prompts',
    })
  );
  assert.ok(planPromptsHtml.includes('id="sec-prompts"'));
  assert.ok(planPromptsHtml.includes('Shot 1 AI Video Prompt'));

  // Summary Strategies tab
  const summaryTabHtml = renderToStaticMarkup(
    React.createElement(VideoStudioView, {
      ...commonProps,
      product: productWithPack,
      initialSubpage: 'ideas',
      initialIdeasTab: 'summary',
    })
  );
  assert.ok(summaryTabHtml.includes(t.studio.videoIdeas.executiveSummaryLabel));
  assert.ok(summaryTabHtml.includes(t.studio.videoIdeas.kalodataDataPlayLabel));
  assert.ok(summaryTabHtml.includes(t.studio.videoIdeas.creativeExecutionStrategyLabel));
  assert.ok(summaryTabHtml.includes(t.studio.videoIdeas.testingAndFunnelStrategyLabel));

  // TikTok SEO Pack tab
  const seoTabHtml = renderToStaticMarkup(
    React.createElement(VideoStudioView, {
      ...commonProps,
      product: productWithPack,
      initialSubpage: 'ideas',
      initialIdeasTab: 'seo',
    })
  );
  assert.ok(seoTabHtml.includes(t.studio.videoIdeas.seoPackTitle));
  assert.ok(seoTabHtml.includes('เตารีดไอน้ำพกพา รีดเรียบใน 15 วิ ไม่ต้องใช้โต๊ะรีด'));
  assert.ok(seoTabHtml.includes('#เตารีดไอน้ำพกพา'));

  // Legacy cache fallback without videoIdeasPack
  const legacyHtml = renderToStaticMarkup(
    React.createElement(VideoStudioView, {
      ...commonProps,
      product: makeProduct(false),
      initialSubpage: 'ideas',
    })
  );
  assert.ok(legacyHtml.includes(t.studio.analysisBtn));
});

test('buildExternalAiChatPrompt includes Kalodata deep grounding, Summary Strategies, and TikTok SEO Pack', () => {
  const prompt = buildExternalAiChatPrompt(makeProduct(true));
  assert.ok(prompt.includes('Saved SiamVisual AI Video Ideas Strategy'));
  assert.ok(prompt.includes('problem_solving'));
  assert.ok(prompt.includes('Video Concept 1'));
  assert.ok(prompt.includes('Kalodata Evidence Summary (EN)'));
  assert.ok(prompt.includes('Summary Strategy — Executive (EN)'));
  assert.ok(prompt.includes('Pack Thai SEO Titles:'));
  assert.ok(prompt.includes('Data Basis:'));
  assert.ok(prompt.includes('Thai SEO Title:'));
});

test('storage merges Idea 1/2/3 plans onto one history entry and round-trips ideaPlansCache in backups', () => {
  const storageMap = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storageMap.set(key, value);
    },
    removeItem: (key: string) => {
      storageMap.delete(key);
    },
  };
  (globalThis as unknown as { localStorage: typeof mockStorage }).localStorage = mockStorage;

  const product = makeProduct(true);
  const plan0 = buildSampleIdeaPlan(product.id);
  const plan1: VideoAdPlan = { ...buildSampleIdeaPlan(product.id), id: 'plan_idea_1', ideaIndex: 1 };
  const plan2: VideoAdPlan = { ...buildSampleIdeaPlan(product.id), id: 'plan_idea_2', ideaIndex: 2 };

  saveIdeaPlanForProduct(product.id, 0, plan0);
  saveIdeaPlanForProduct(product.id, 1, plan1);
  const mergedForProduct = saveIdeaPlanForProduct(product.id, 2, plan2);
  assert.equal(Object.keys(mergedForProduct).length, 3);
  assert.equal(getIdeaPlansForProduct(product.id)[1]?.id, 'plan_idea_1');

  let entries: SavedHistoryEntry[] = [];
  entries = upsertHistoryEntry(entries, {
    id: `prod_${product.id}`,
    savedAt: plan0.createdAt,
    product,
    ideaPlans: { 0: plan0 },
  });
  entries = upsertHistoryEntry(entries, {
    id: `prod_${product.id}`,
    savedAt: plan1.createdAt,
    product,
    ideaPlans: { 1: plan1 },
  });
  assert.equal(entries.length, 1);
  assert.ok(entries[0].ideaPlans?.[0]);
  assert.ok(entries[0].ideaPlans?.[1]);

  const backupJson = JSON.stringify(buildBackupPayload({ entries }));
  persistIdeaPlansCache({});
  assert.deepEqual(loadIdeaPlansCache(), {});

  const parsed = parseBackupFile(backupJson);
  assert.ok(parsed);
  assert.ok(parsed.ideaPlansCache?.[product.id]?.[2]);
  assert.equal(parsed.entries.length, 1);
  assert.ok(parsed.entries[0].ideaPlans?.[1]);
});


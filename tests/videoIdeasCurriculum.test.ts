import assert from 'node:assert/strict';
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
import type { ProductItem, VideoIdeasStrategyPack } from '../src/types.ts';

function buildSampleVideoIdeasPack(): VideoIdeasStrategyPack {
  return {
    playbookCategory: 'problem_solving',
    playbookReason: {
      my: 'ပြဿနာဖြေရှင်းပစ္စည်းဖြစ်၍ Visual Proof နှင့် Contrast ကို ဦးစားပေးရမည်။',
      en: 'Problem-solving item requiring sharp Visual Proof and Before/After contrast.',
    },
    productAnalysis: {
      coreFeature: { my: 'အပူချိန် ၁၅ စက္ကန့်အတွင်း တက်သည်', en: 'Heats up in 15 seconds' },
      functionalBenefit: { my: 'မီးပူခုံမလိုဘဲ ချိတ်လျက်တိုက်နိုင်', en: 'Steams clothes on hanger without ironing board' },
      emotionalBenefit: { my: 'မနက်တိုင်း အချိန်မလုဘဲ ယုံကြည်မှုရှိရှိ ထွက်နိုင်', en: 'Leave home confident without morning rush' },
      coreUsp: { my: '၁၅ စက္ကန့်အမြန်အပူတက် + ရေစက်မကျ', en: '15s fast heat + zero water droplets' },
      visualProofIdea: { my: 'ကြေမွနေသောရှပ်အင်္ကျီကို တစ်ဆက်တည်း ဆွဲပြန့်ပြခြင်း', en: 'One-take steam glide over deeply wrinkled shirt' },
    },
    targetAudience: {
      primaryBuyer: { my: 'မနက်အလုပ်နောက်ကျတတ်သော ရုံးဝန်ထမ်းများ', en: 'Busy office workers rushing mornings' },
      painPointLadder: { my: 'အင်္ကျီကြေ -> မီးပူခုံထုတ်ရပင်ပန်း -> အလုပ်နောက်ကျစိတ်ဖိစီး', en: 'Wrinkled shirt -> board hassle -> morning stress' },
      buyerVoiceInsight: { my: 'ရေစက်ကျပြီး အင်္ကျီစိုမှာ စိုးရိမ်ကြသည်', en: 'Buyers worry about water spitting onto fabric' },
    },
    concepts: [
      {
        title: { my: 'မနက် ၁၀ မိနစ် ပိုအိပ်ရမယ့် နည်းလမ်း', en: 'Sleep 10 Minutes Longer Every Morning' },
        targetSegment: { my: 'ရုံးဝန်ထမ်းများ', en: 'Office commuters' },
        awarenessLevel: 'problem_aware',
        framework: 'PAS',
        creativeAngle: { my: 'Old Way vs. New Way', en: 'Old Way vs. New Way' },
        ugcFormat: { my: 'POV / Hands-Only Demo', en: 'POV / Hands-Only Demo' },
        recommendedDuration: '30–40s',
        hook3Layer: {
          hookType: { my: 'Pain Point + Action in Motion', en: 'Pain Point + Action in Motion' },
          visualHook: { my: 'အင်္ကျီအကြေကြီးကို တစ်ချက်ဆွဲပြန့်ပြနေပုံ', en: 'Steaming deeply wrinkled shirt mid-action' },
          verbalHook: { my: 'မနက်အလုပ်နောက်ကျနေပြီဆိုမှ အင်္ကျီကကြေနေတာ ကြုံဖူးလား?', en: 'Ever late for work and your shirt is totally wrinkled?' },
          textHook: { my: 'မီးပူခုံမလိုဘဲ ၁၅ စက္ကန့်နဲ့ ပြန့်!', en: 'Wrinkle-free in 15s, no board!' },
        },
        bridgeHold: { my: 'မီးပူခုံထုတ်ရ အပူစောင့်ရနဲ့ ၁၅ မိနစ်ကုန်တယ်မလား?', en: 'Dragging out a heavy ironing board wastes 15 minutes.' },
        bodyPlan: { my: 'One-Take တိုက်ပြပြီး ရေစက်မကျကြောင်း စက္ကူပေါ်စမ်းပြပါ။', en: 'One-take glide demo plus dry-tissue test to crush wet-spot doubt.' },
        ctaAction: { my: 'မနက်တိုင်းအချိန်သက်သာချင်ရင် အောက်ကခြင်းတောင်းဝါထဲ ဝင်ကြည့်လိုက်ပါ။', en: 'Tap the yellow basket below to save time every morning.' },
        muteTestVisual: { my: 'အသံပိတ်ကြည့်ရင်တောင် အကြေကနေ ချက်ချင်းပြန့်သွားတာ မြင်သာသည်။', en: 'Before/After wrinkle removal is unmistakable on mute.' },
        extraHookVariations: {
          my: ['ဒီမီးပူလေးကို မဝယ်နဲ့... မနက်တိုင်း ၁၅ မိနစ်စောထချင်ရင်ပေါ့', 'ရေစက်ကျလား စက္ကူအဖြူပေါ် တကယ်စမ်းပြမယ်'],
          en: ['Do not buy this unless you hate ironing boards', 'Testing if it spits water on dry tissue'],
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

test('VIDEO_IDEAS_LESSONS preserves all 13 lessons and builds complete system instruction', () => {
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
});

test('VideoStudioView renders 13-lesson Video Ideas pack cleanly and handles legacy cache safely', () => {
  const t = TRANSLATIONS.my;
  const commonProps = {
    isSaved: false,
    plan: null,
    style: 'cinematic' as const,
    savedStyles: [],
    isGenerating: false,
    isEnrichingProduct: false,
    isAnalyzingProduct: false,
    enrichError: null,
    analysisError: null,
    error: null,
    cameFromHistory: false,
    language: 'my' as const,
    kalodataStatus: { connected: false, keySource: 'none' as const, maskedKey: null, balance: null },
    kalodataLimits: { maxSpendCredits: null, minBalanceReserve: null, trackedSpentCredits: 0 },
    t,
    onBack: () => {},
    onToggleSave: () => {},
    onSelectStyle: () => {},
    onConfirmGenerate: () => {},
    onFetchDeepInsights: async () => {},
    onAnalyzeProduct: async () => {},
    onOpenScoreDetails: () => {},
  };

  const withPackHtml = renderToStaticMarkup(
    React.createElement(VideoStudioView, { ...commonProps, product: makeProduct(true) })
  );
  assert.ok(withPackHtml.includes('AI ဖြင့် Video Ideas စဉ်းစားမယ်'));
  assert.ok(withPackHtml.includes('เตารีดไอน้ำพกพา Mini Steamer Pro'));
  assert.ok(withPackHtml.includes('PAS (Problem–Agitate–Solve)'));
  assert.ok(withPackHtml.includes('1 Body, 3 Hooks'));

  const legacyHtml = renderToStaticMarkup(
    React.createElement(VideoStudioView, { ...commonProps, product: makeProduct(false) })
  );
  assert.ok(legacyHtml.includes('Video Ideas စဉ်းစားမယ် (0 cr)'));
});

test('buildExternalAiChatPrompt includes VideoIdeasStrategyPack summary when present', () => {
  const prompt = buildExternalAiChatPrompt(makeProduct(true));
  assert.ok(prompt.includes('Saved SiamVisual AI Video Ideas Strategy'));
  assert.ok(prompt.includes('problem_solving'));
  assert.ok(prompt.includes('Video Concept 1'));
});

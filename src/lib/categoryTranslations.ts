import type { KalodataCategoryItem } from '../types.ts';

function normalizeCategoryKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`,/()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Comprehensive Thailand TikTok Shop Level-1 Category Myanmar Translations
const CATEGORY_NAME_MY_MAP: Record<string, string> = {
  all: 'အားလုံး',
  'beauty and personal care': 'အလှကုန်နှင့် တစ်ကိုယ်ရေသုံး',
  'womenswear and underwear': 'အမျိုးသမီးအဝတ်နှင့် အတွင်းခံ',
  'womenswear and fashion': 'အမျိုးသမီးဖက်ရှင်',
  'women s wear and underwear': 'အမျိုးသမီးအဝတ်နှင့် အတွင်းခံ',
  'food and beverages': 'အစားအသောက်နှင့် အဖျော်ယမကာ',
  'food and beverage': 'အစားအသောက်နှင့် အဖျော်ယမကာ',
  'home supplies': 'အိမ်သုံးပစ္စည်းများ',
  'phones and electronics': 'ဖုန်းနှင့် အီလက်ထရွန်းနစ်',
  'automotive and motorcycle': 'ကားနှင့် ဆိုင်ကယ်သုံး',
  'automotive and moto': 'ကားနှင့် ဆိုင်ကယ်သုံး',
  health: 'ကျန်းမာရေး',
  'menswear and underwear': 'အမျိုးသားအဝတ်နှင့် အတွင်းခံ',
  'men s wear and underwear': 'အမျိုးသားအဝတ်နှင့် အတွင်းခံ',
  'sports and outdoor': 'အားကစားနှင့် ပြင်ပသုံး',
  'sports and outdoors': 'အားကစားနှင့် ပြင်ပသုံး',
  'home improvement': 'အိမ်ပြုပြင်မွမ်းမံရေး',
  'fashion accessories': 'ဖက်ရှင် အသုံးအဆောင်',
  'pet supplies': 'အိမ်မွေးတိရစ္ဆာန်သုံး',
  'baby and maternity': 'ကလေးနှင့် မိခင်သုံး',
  'mother and baby': 'မိခင်နှင့် ကလေးသုံး',
  'mom and baby': 'မိခင်နှင့် ကလေးသုံး',
  'household appliances': 'အိမ်သုံးလျှပ်စစ်ပစ္စည်း',
  'home appliances': 'အိမ်သုံးလျှပ်စစ်ပစ္စည်း',
  'luggage and bags': 'ခရီးဆောင်အိတ်နှင့် အိတ်များ',
  'bags and luggage': 'အိတ်နှင့် ခရီးဆောင်အိတ်',
  shoes: 'ဖိနပ်များ',
  'tools and hardware': 'လက်နက်ကိရိယာနှင့် ဟာ့ဒ်ဝဲ',
  kitchenware: 'မီးဖိုချောင်သုံး',
  'textiles and soft furnishings': 'အထည်အလိပ်နှင့် အိမ်အလှဆင်',
  furniture: 'ပရိဘောဂ',
  'computers and office equipment': 'ကွန်ပျူတာနှင့် ရုံးသုံးပစ္စည်း',
  'computer and office equipment': 'ကွန်ပျူတာနှင့် ရုံးသုံးပစ္စည်း',
  'toys and hobbies': 'ကစားစရာနှင့် ဝါသနာသုံး',
  'kids fashion': 'ကလေးဖက်ရှင်',
  'kids s fashion': 'ကလေးဖက်ရှင်',
  'children s fashion': 'ကလေးဖက်ရှင်',
  'jewelry accessories and derivatives': 'လက်ဝတ်ရတနာနှင့် အလှဆင်',
  'jewelry and accessories': 'လက်ဝတ်ရတနာနှင့် အလှဆင်',
  'books magazines and audio': 'စာအုပ်နှင့် မီဒီယာ',
  'books and magazines': 'စာအုပ်နှင့် မီဒီယာ',
  collectibles: 'စုဆောင်းပစ္စည်းများ',
  'muslim fashion': 'မွတ်စလင်ဖက်ရှင်',
  'virtual products': 'ဒစ်ဂျစ်တယ်ပစ္စည်းများ',
  'pre owned': 'တစ်ပတ်ရစ်ပစ္စည်းများ',
  'audio and video': 'အသံနှင့် ဗီဒီယိုပစ္စည်း',
  'cameras and photography': 'ကင်မရာနှင့် ဓာတ်ပုံပစ္စည်း',
  watches: 'နာရီများ',
  eyewear: 'မျက်မှန်များ',
  'home and garden': 'အိမ်နှင့် ဥယျာဉ်သုံး',
  'home and living': 'အိမ်နှင့် နေထိုင်မှုသုံး',
  'office and school supplies': 'ရုံးနှင့် ကျောင်းသုံးပစ္စည်း',
  'stationery and office supplies': 'စာရေးကိရိယာနှင့် ရုံးသုံး',
  'personal care': 'တစ်ကိုယ်ရေသုံးပစ္စည်း',
  snacks: 'မုန့်နှင့် သရေစာ',
};

const CATEGORY_ID_MY_MAP: Record<string, string> = {
  '': 'အားလုံး',
  '601450': 'အလှကုန်နှင့် တစ်ကိုယ်ရေသုံး',
  '600001': 'အိမ်သုံးပစ္စည်းများ',
  '600024': 'မီးဖိုချောင်သုံး',
  '601739': 'ဖုန်းနှင့် အီလက်ထရွန်းနစ်',
  '601152': 'အမျိုးသမီးအဝတ်နှင့် အတွင်းခံ',
  '700645': 'ကျန်းမာရေး',
  '602118': 'အိမ်မွေးတိရစ္ဆာန်သုံး',
  '605196': 'ကားနှင့် ဆိုင်ကယ်သုံး',
};

const HAS_MYANMAR_SCRIPT = /[\u1000-\u109F]/;

export function translateCategoryNameToMyanmar(
  englishName: string,
  categoryId?: string
): string {
  const normalized = normalizeCategoryKey(englishName);
  if (normalized && CATEGORY_NAME_MY_MAP[normalized]) {
    return CATEGORY_NAME_MY_MAP[normalized];
  }
  if (categoryId !== undefined && CATEGORY_ID_MY_MAP[categoryId]) {
    return CATEGORY_ID_MY_MAP[categoryId];
  }
  return englishName;
}

export function localizeCategoryItem(item: KalodataCategoryItem): KalodataCategoryItem {
  const currentMy = item.label?.my?.trim() || '';
  const currentEn = item.label?.en?.trim() || currentMy;

  if (currentMy && HAS_MYANMAR_SCRIPT.test(currentMy)) {
    return item;
  }

  const translatedMy = translateCategoryNameToMyanmar(currentEn, item.id);
  if (translatedMy === currentMy) {
    return item;
  }

  return {
    ...item,
    label: {
      my: translatedMy,
      en: currentEn,
    },
  };
}

export function localizeCategories(items: KalodataCategoryItem[]): KalodataCategoryItem[] {
  return items.map(localizeCategoryItem);
}

export interface InferredCategoryInfo {
  visualGroup: KalodataCategoryItem['visualGroup'];
  label: { my: string; en: string };
  matched: boolean;
}

const SPECIFIC_CATEGORY_RULES: Array<{
  en: string;
  my: string;
  visualGroup: KalodataCategoryItem['visualGroup'];
  nameMatch: RegExp;
  productMatch: RegExp;
}> = [
  {
    en: 'Beauty & Personal Care',
    my: 'အလှကုန်နှင့် တစ်ကိုယ်ရေသုံး',
    visualGroup: 'beauty',
    nameMatch: /beauty|personal care/,
    productMatch:
      /beaut|skincare|cosmet|serum|cream|lotion|lip|lipstick|tint|gloss|sunscreen|spf|shampoo|conditioner|soap|body wash|cleanser|toner|mask|makeup|mascara|eyeliner|blush|powder|foundation|concealer|perfume|deodorant|toothpaste|toothbrush|whitening|acne|hair oil|เซรั่ม|ครีม|โลชั่น|ลิป|กันแดด|แชมพู|ครีมนวด|สบู่|มาส์ก|มาร์ค|สกินแคร์|บำรุงผิว|ผิวหน้า|ผิวกาย|เครื่องสำอาง|น้ำหอม|ยาสีฟัน|แปรงสีฟัน|แป้งพัฟ|บลัชออน|มาสคาร่า|อายไลเนอร์|รองพื้น|คลีนซิ่ง|โทนเนอร์|ลดสิว|ฝ้า|กระ|ขาวใส|ผมร่วง|บำรุงผม|โรลออน|สครับ|ออยล์บำรุง/,
  },
  {
    en: 'Food & Beverages',
    my: 'အစားအသောက်နှင့် အဖျော်ယမကာ',
    visualGroup: 'wellness',
    nameMatch: /food|beverage|snack/,
    productMatch:
      /\bfood\b|beverage|snack|coffee|matcha|cocoa|tea|drink|candy|chocolate|cookie|biscuit|chip|sauce|chili|noodle|ramen|honey|nut|almond|dried fruit|jerky|seasoning|ขนม|กาแฟ|ชาไทย|ชาเขียว|มัทฉะ|โกโก้|อาหาร|เครื่องดื่ม|น้ำผลไม้|น้ำพริก|บะหมี่|มาม่า|ช็อกโกแลต|คุกกี้|ถั่ว|ลูกอม|เยลลี่|น้ำผึ้ง|ปลากรอบ|หมูแผ่น|หมูฝอย|ซอส|ผงปรุงรส|ชาชง|นมผงชง|เครื่องปรุง/,
  },
  {
    en: 'Health',
    my: 'ကျန်းမာရေး',
    visualGroup: 'wellness',
    nameMatch: /\bhealth\b/,
    productMatch:
      /\bhealth\b|vitamin|collagen|supplement|protein|whey|probiotic|prebiotic|fiber|detox|gluta|zinc|calcium|omega|fish oil|massage|inhaler|balm|herbal|medical|patch|วิตามิน|คอลลาเจน|อาหารเสริม|สุขภาพ|โปรตีน|เวย์|ไฟเบอร์|ดีท็อกซ์|กลูต้า|ซิงค์|แคลเซียม|โพรไบโอติก|นวด|ยาดม|ยาหม่อง|สมุนไพร|แผ่นแปะ|พลาสเตอร์|น้ำมันเหลือง|บำรุงสายตา|บำรุงกระดูก|ลดน้ำหนัก/,
  },
  {
    en: 'Pet Supplies',
    my: 'အိမ်မွေးတိရစ္ဆာန်သုံး',
    visualGroup: 'pet',
    nameMatch: /\bpet\b/,
    productMatch:
      /\bpet\b|\bcat\b|\bdog\b|kitten|puppy|litter|collar|leash|แมว|หมา|สุนัข|สัตว์เลี้ยง|ทรายแมว|อาหารแมว|อาหารสุนัข|ขนมแมว|ขนมหมา|ปลอกคอ|กระบะทราย/,
  },
  {
    en: 'Baby & Maternity',
    my: 'ကလေးနှင့် မိခင်သုံး',
    visualGroup: 'wellness',
    nameMatch: /baby|maternity|mother|mom|kids/,
    productMatch:
      /\bbaby\b|infant|maternity|diaper|pampers|stroller|newborn|breast pump|kids|toddler|เด็ก|ทารก|ผ้าอ้อม|แพมเพิส|นมผง|แม่และเด็ก|ขวดนม|เครื่องปั๊มนม|รถเข็นเด็ก|ทิชชู่เปียกเด็ก|ชุดเด็ก/,
  },
  {
    en: 'Automotive & Motorcycle',
    my: 'ကားနှင့် ဆိုင်ကယ်သုံး',
    visualGroup: 'gadget',
    nameMatch: /automotive|motorcycle|moto/,
    productMatch:
      /automotive|motorcycle|\bmoto\b|helmet|dashcam|car wash|car holder|wiper|tire|engine oil|รถยนต์|รถมอเตอร์ไซค์|มอเตอร์ไซค์|หมวกกันน็อค|แต่งรถ|ล้างรถ|เคลือบสีรถ|น้ำมันเครื่อง|กล้องติดรถ|ที่วางมือถือในรถ|น้ำหอมรถยนต์/,
  },
  {
    en: 'Shoes',
    my: 'ဖိနပ်များ',
    visualGroup: 'fashion',
    nameMatch: /\bshoes\b/,
    productMatch:
      /shoe|sneaker|sandal|slipper|boot|heel|loafer|insole|รองเท้า|รองเท้าผ้าใบ|รองเท้าแตะ|รองเท้าส้นสูง|รองเท้าคัชชู|พื้นรองเท้า/,
  },
  {
    en: 'Luggage & Bags',
    my: 'ခရီးဆောင်အိတ်နှင့် အိတ်များ',
    visualGroup: 'fashion',
    nameMatch: /luggage|bags/,
    productMatch:
      /backpack|luggage|suitcase|wallet|tote|crossbody|shoulder bag|handbag|purse|pouch|กระเป๋า|กระเป๋าสะพาย|กระเป๋าตังค์|กระเป๋าสตางค์|กระเป๋าเดินทาง|กระเป๋าเป้|กระเป๋าถือ/,
  },
  {
    en: 'Fashion Accessories',
    my: 'ဖက်ရှင် အသုံးအဆောင်',
    visualGroup: 'fashion',
    nameMatch: /fashion accessories|jewelry|watches|eyewear/,
    productMatch:
      /jewelry|necklace|earring|bracelet|sunglass|eyewear|\bwatch\b|smartwatch|baseball cap|belt|hair clip|แว่นตา|แว่นกันแดด|นาฬิกา|ต่างหู|สร้อยคอ|สร้อยข้อมือ|แหวน|กำไล|หมวกแก๊ป|เข็มขัด|กิ๊บติดผม|ยางมัดผม/,
  },
  {
    en: 'Menswear & Underwear',
    my: 'အမျိုးသားအဝတ်နှင့် အတွင်းခံ',
    visualGroup: 'fashion',
    nameMatch: /menswear|men s wear/,
    productMatch:
      /menswear|men's|for men|boxer|เสื้อผู้ชาย|กางเกงผู้ชาย|กางเกงในชาย|บ็อกเซอร์|เสื้อเชิ้ตชาย|เสื้อโปโลชาย/,
  },
  {
    en: 'Womenswear & Underwear',
    my: 'အမျိုးသမီးအဝတ်နှင့် အတွင်းခံ',
    visualGroup: 'fashion',
    nameMatch: /womenswear|women s wear|fashion/,
    productMatch:
      /womenswear|women|dress|skirt|blouse|bra|lingerie|underwear|panties|cardigan|jeans|legging|hoodie|t-shirt|shirt|pants|shorts|jacket|sock|bodysuit|ชุดชั้นใน|บรา|เสื้อใน|กางเกงใน|เดรส|กระโปรง|เสื้อครอป|เสื้อยืด|เสื้อเชิ้ต|เสื้อคลุม|เสื้อแฟชั่น|กางเกงยีนส์|กางเกงขายาว|กางเกงขาสั้น|กางเกงเอวสูง|ชุดเซ็ต|ชุดนอน|ถุงเท้า|บอดี้สูท|คาร์ดิแกน/,
  },
  {
    en: 'Household Appliances',
    my: 'အိမ်သုံးလျှပ်စစ်ပစ္စည်း',
    visualGroup: 'gadget',
    nameMatch: /household appliances|home appliances/,
    productMatch:
      /appliance|mini fan|portable fan|vacuum|blender|hair dryer|air fryer|air purifier|steamer|steam iron|kettle|rice cooker|coffee maker|humidifier|พัดลม|พัดลมพกพา|เครื่องดูดฝุ่น|เครื่องปั่น|ไดร์เป่าผม|เครื่องหนีบผม|เครื่องม้วนผม|หม้อทอดไร้น้ำมัน|หม้อไฟฟ้า|หม้อหุงข้าว|เครื่องฟอกอากาศ|เตารีด|เตารีดไอน้ำ|กาต้มน้ำ|เครื่องทำน้ำแข็ง|เครื่องชงกาแฟ/,
  },
  {
    en: 'Phones & Electronics',
    my: 'ဖုန်းနှင့် အီလက်ထရွန်းနစ်',
    visualGroup: 'gadget',
    nameMatch: /phones|electronics|computer|audio|camera/,
    productMatch:
      /phone|iphone|samsung|android|ipad|tablet|charger|cable|type-c|earbud|headphone|airpod|speaker|powerbank|power bank|bluetooth|mouse|keyboard|camera|tripod|microphone|screen protector|adapter|โทรศัพท์|มือถือ|ไอโฟน|เคสไอโฟน|เคสมือถือ|ฟิล์มกระจก|สายชาร์จ|หัวชาร์จ|หูฟัง|พาวเวอร์แบงค์|แบตสำรอง|ลำโพง|บลูทูธ|กล้องวงจรปิด|กล้อง|ขาตั้งกล้อง|ไมโครโฟน|คีย์บอร์ด|เมาส์/,
  },
  {
    en: 'Sports & Outdoor',
    my: 'အားကစားနှင့် ပြင်ပသုံး',
    visualGroup: 'wellness',
    nameMatch: /sports|outdoor/,
    productMatch:
      /sport|fitness|yoga|gym|camp|camping|tent|outdoor|dumbbell|bicycle|cycling|fishing|badminton|กีฬา|ออกกำลังกาย|แคมป์|เต็นท์|โยคะ|เสื่อโยคะ|ดัมเบล|จักรยาน|ตกปลา|แบดมินตัน|ชุดกีฬา/,
  },
  {
    en: 'Kitchenware',
    my: 'မီးဖိုချောင်သုံး',
    visualGroup: 'home',
    nameMatch: /kitchen/,
    productMatch:
      /kitchen|frying pan|non-stick|pot|knife|tumbler|thermos|water bottle|lunch box|dish|plate|bowl|cutting board|ครัว|กระทะ|หม้อ|มีดทำครัว|จาน|ชาม|แก้วเก็บความเย็น|แก้วน้ำ|ขวดน้ำ|กระติกน้ำ|ทัพพี|เขียง|กล่องถนอมอาหาร|กล่องข้าว/,
  },
  {
    en: 'Textiles & Soft Furnishings',
    my: 'အထည်အလိပ်နှင့် အိမ်အလှဆင်',
    visualGroup: 'home',
    nameMatch: /textiles|soft furnishings/,
    productMatch:
      /bedding|bed sheet|pillow|blanket|curtain|rug|carpet|towel|mattress|ผ้าปูที่นอน|หมอน|หมอนข้าง|ผ้าห่ม|ผ้านวม|ผ้าม่าน|พรม|ผ้าเช็ดตัว|ปลอกหมอน|ท็อปเปอร์/,
  },
  {
    en: 'Furniture',
    my: 'ပရိဘောဂ',
    visualGroup: 'home',
    nameMatch: /furniture/,
    productMatch:
      /furniture|table|desk|chair|sofa|shelf|rack|cabinet|wardrobe|shoe rack|เฟอร์นิเจอร์|โต๊ะ|เก้าอี้|โซฟา|ชั้นวางของ|ชั้นวาง|ตู้เสื้อผ้า|ตู้เก็บของ|เตียงนอน|ราวตากผ้า/,
  },
  {
    en: 'Tools & Hardware',
    my: 'လက်နက်ကိရိယာနှင့် ဟာ့ဒ်ဝဲ',
    visualGroup: 'home',
    nameMatch: /tools|hardware|home improvement/,
    productMatch:
      /\btool\b|hardware|drill|wrench|screwdriver|solar light|led strip|bulb|lamp|faucet|shower head|glue|sealant|tape|สว่าน|ไขควง|เครื่องมือช่าง|ไฟโซล่าเซลล์|โซล่าเซลล์|หลอดไฟ|โคมไฟ|ก๊อกน้ำ|ฝักบัว|กาว|เทปกาว|ปลั๊กไฟ|ปลั๊กพ่วง/,
  },
  {
    en: 'Home Supplies',
    my: 'အိမ်သုံးပစ္စည်းများ',
    visualGroup: 'home',
    nameMatch: /home supplies|home and living|home and garden/,
    productMatch:
      /detergent|fabric softener|laundry|tissue|wet wipe|mop|broom|storage box|organizer|hanger|trash bag|garbage|air freshener|cleaning|sponge|น้ำยาซักผ้า|น้ำยาปรับผ้านุ่ม|ผงซักฟอก|ทิชชู่|กระดาษทิชชู่|ไม้ถูพื้น|ไม้กวาด|กล่องเก็บของ|ไม้แขวนเสื้อ|ถุงขยะ|ปรับอากาศ|ทำความสะอาด|น้ำยาล้างจาน|น้ำยาล้างห้องน้ำ|ฟองน้ำ|ร่ม|ผ้าอนามัย/,
  },
];

export const KNOWN_TH_CATEGORY_ID_MAP: Record<
  string,
  { en: string; my: string; visualGroup: KalodataCategoryItem['visualGroup'] }
> = {
  '601450': { en: 'Beauty & Personal Care', my: 'အလှကုန်နှင့် တစ်ကိုယ်ရေသုံး', visualGroup: 'beauty' },
  '600001': { en: 'Home Supplies', my: 'အိမ်သုံးပစ္စည်းများ', visualGroup: 'home' },
  '600024': { en: 'Kitchenware', my: 'မီးဖိုချောင်သုံး', visualGroup: 'home' },
  '601739': { en: 'Phones & Electronics', my: 'ဖုန်းနှင့် အီလက်ထရွန်းနစ်', visualGroup: 'gadget' },
  '601152': { en: 'Womenswear & Underwear', my: 'အမျိုးသမီးအဝတ်နှင့် အတွင်းခံ', visualGroup: 'fashion' },
  '700645': { en: 'Health', my: 'ကျန်းမာရေး', visualGroup: 'wellness' },
  '602118': { en: 'Pet Supplies', my: 'အိမ်မွေးတိရစ္ဆာန်သုံး', visualGroup: 'pet' },
  '605196': { en: 'Automotive & Motorcycle', my: 'ကားနှင့် ဆိုင်ကယ်သုံး', visualGroup: 'gadget' },
  '700437': { en: 'Food & Beverages', my: 'အစားအသောက်နှင့် အဖျော်ယမကာ', visualGroup: 'wellness' },
  '824328': { en: 'Menswear & Underwear', my: 'အမျိုးသားအဝတ်နှင့် အတွင်းခံ', visualGroup: 'fashion' },
  '601226': { en: 'Shoes', my: 'ဖိနပ်များ', visualGroup: 'fashion' },
  '601352': { en: 'Luggage & Bags', my: 'ခရီးဆောင်အိတ်နှင့် အိတ်များ', visualGroup: 'fashion' },
  '601303': { en: 'Fashion Accessories', my: 'ဖက်ရှင် အသုံးအဆောင်', visualGroup: 'fashion' },
  '603014': { en: 'Sports & Outdoor', my: 'အားကစားနှင့် ပြင်ပသုံး', visualGroup: 'wellness' },
  '602284': { en: 'Baby & Maternity', my: 'ကလေးနှင့် မိခင်သုံး', visualGroup: 'wellness' },
  '600942': { en: 'Household Appliances', my: 'အိမ်သုံးလျှပ်စစ်ပစ္စည်း', visualGroup: 'gadget' },
  '600154': { en: 'Home Improvement', my: 'အိမ်ပြုပြင်မွမ်းမံရေး', visualGroup: 'home' },
  '604206': { en: 'Tools & Hardware', my: 'လက်နက်ကိရိယာနှင့် ဟာ့ဒ်ဝဲ', visualGroup: 'home' },
  '600002': { en: 'Textiles & Soft Furnishings', my: 'အထည်အလိပ်နှင့် အိမ်အလှဆင်', visualGroup: 'home' },
  '604453': { en: 'Furniture', my: 'ပရိဘောဂ', visualGroup: 'home' },
};

/**
 * Accurately infers a Thailand TikTok Shop product's real L1 category from:
 * 1) Kalodata L1 Category ID,
 * 2) Kalodata Category Name hint,
 * 3) Rich Thai + English title/shop keywords.
 * Never falsely defaults unknown products to "Home & Kitchen".
 */
export function inferSpecificProductCategory(params: {
  categoryId?: string;
  categoryHint?: string;
  thaiTitle?: string;
  englishTitle?: string;
  shopName?: string;
}): InferredCategoryInfo {
  const cleanId = params.categoryId?.trim();
  const cleanHint = params.categoryHint?.trim() || '';

  // 1. Exact Kalodata L1 category hint when provided
  if (cleanHint) {
    const normHint = normalizeCategoryKey(cleanHint);
    const ruleByHint = SPECIFIC_CATEGORY_RULES.find((r) => r.nameMatch.test(normHint));
    const byId = cleanId ? KNOWN_TH_CATEGORY_ID_MAP[cleanId] : undefined;
    return {
      visualGroup: ruleByHint?.visualGroup ?? byId?.visualGroup ?? 'home',
      label: {
        my: translateCategoryNameToMyanmar(cleanHint, cleanId),
        en: cleanHint,
      },
      matched: true,
    };
  }

  // 2. Exact known Kalodata L1 category ID
  if (cleanId && KNOWN_TH_CATEGORY_ID_MAP[cleanId]) {
    const known = KNOWN_TH_CATEGORY_ID_MAP[cleanId];
    return {
      visualGroup: known.visualGroup,
      label: { my: known.my, en: known.en },
      matched: true,
    };
  }

  // 3. Match against Thai + English title & shop keywords
  const haystack = [params.thaiTitle, params.englishTitle, params.shopName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  for (const rule of SPECIFIC_CATEGORY_RULES) {
    if (rule.productMatch.test(haystack)) {
      return {
        visualGroup: rule.visualGroup,
        label: { my: rule.my, en: rule.en },
        matched: true,
      };
    }
  }

  // 4. Honest fallback when truly unclassifiable (NEVER lie with "Home & Kitchen")
  return {
    visualGroup: 'home',
    label: { my: 'အထွေထွေ (TikTok Shop)', en: 'General' },
    matched: false,
  };
}

export function isLegacyDefaultHomeLabel(label?: { my?: string; en?: string }): boolean {
  if (!label) return true;
  const en = normalizeCategoryKey(label.en || '');
  const my = (label.my || '').trim();
  return (
    !en ||
    en === 'home and kitchen' ||
    en === 'general' ||
    my === 'အိမ်သုံးနှင့် မီးဖိုချောင်'
  );
}

export function doesProductMatchCategory(
  product: {
    id: string;
    thaiTitle: string;
    clearTitle: { my: string; en: string };
    category: KalodataCategoryItem['visualGroup'];
    categoryLabel: { my: string; en: string };
    kalodataCategoryId?: string;
    aiAnalysis?: { cleanName: { my: string; en: string } };
  },
  category: KalodataCategoryItem
): boolean {
  if (!category.id) return true;

  // 1. Exact Kalodata L1 Category ID match when available
  if (product.kalodataCategoryId) {
    return product.kalodataCategoryId === category.id;
  }

  // 2. Exact localized category label match
  const catEnNorm = normalizeCategoryKey(category.label.en || '');
  const prodEnNorm = normalizeCategoryKey(product.categoryLabel?.en || '');
  const prodMyNorm = (product.categoryLabel?.my || '').trim();
  const catMyNorm = (category.label.my || '').trim();

  if (
    (catEnNorm &&
      prodEnNorm &&
      prodEnNorm !== 'general' &&
      (prodEnNorm === catEnNorm ||
        prodEnNorm.includes(catEnNorm) ||
        catEnNorm.includes(prodEnNorm))) ||
    (catMyNorm && prodMyNorm && prodMyNorm === catMyNorm)
  ) {
    return true;
  }

  // 3. Granular Thai + English keyword match against product title & category hint
  const haystack = [
    product.thaiTitle,
    product.clearTitle?.en,
    product.aiAnalysis?.cleanName?.en,
    product.categoryLabel?.en,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const matchingRule = SPECIFIC_CATEGORY_RULES.find((rule) => rule.nameMatch.test(catEnNorm));
  if (matchingRule) {
    return matchingRule.productMatch.test(haystack);
  }

  return false;
}

export function doesProductMatchSelectedCategories(
  product: {
    id: string;
    thaiTitle: string;
    clearTitle: { my: string; en: string };
    category: KalodataCategoryItem['visualGroup'];
    categoryLabel: { my: string; en: string };
    kalodataCategoryId?: string;
    aiAnalysis?: { cleanName: { my: string; en: string } };
  },
  selectedCateIds: string[],
  allCategories: KalodataCategoryItem[]
): boolean {
  if (selectedCateIds.length === 0) return true;
  const selectedObjects = selectedCateIds
    .map((id) => allCategories.find((c) => c.id === id))
    .filter((c): c is KalodataCategoryItem => Boolean(c));
  if (selectedObjects.length === 0) return true;
  return selectedObjects.some((cat) => doesProductMatchCategory(product, cat));
}

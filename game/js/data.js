'use strict';
/* DARK STARS — بيانات اللعبة: الكواكب، الترقيات، الإنجازات، القطع الأثرية.
   ملف بيانات نقي (لا يعتمد على DOM) — يُختبر عبر node. */

const COLORS = {
  bg: '#07010d',
  surface: '#12041f',
  primary: '#a855f7',
  accent: '#e879f9',
  gold: '#fbbf24',
  text: '#f5efff',
  muted: '#a78fc7',
};

const HOME_PLANET = {
  id: 'home',
  name: 'الوطن',
  zone: 0,
  color: '#38bdf8',
  color2: '#0369a1',
  terrain: 'الكوكب الأم — نقطة الانطلاق',
  resource: '—',
  desc: 'كوكبك الأم. من هنا تبدأ كل رحلة، وإليه تعود.',
};

// 9 كواكب: 3 مناطق. كل كوكب: قطعة أثرية مخفية واحدة + مخلوق نادر واحد.
const PLANETS = [
  {
    id: 'ramman', name: 'رمّال', zone: 1,
    color: '#d97706', color2: '#92400e', terrain: 'صحراء رملية لا نهائية',
    resource: 'بلورات رملية',
    creature: { id: 'sandworm', name: 'دودة الرمل', color: '#f59e0b', speed: 60 },
    rare: { id: 'goldfox', name: 'ثعلب الرمال الذهبي', color: '#fbbf24' },
    hazard: { name: 'عاصفة رملية', desc: 'رياح تحمل الرمل وتخفي الرؤية.' },
    artifact: { id: 'heart_sand', name: 'قلب الرمال', story: 'حجر نابض بالدفء، يقول أهل المجرة إنه نبض أول صحراء عرفها الكون. من يحمله لا يضيع طريقه أبداً.' },
    flightDist: 900,
    desc: 'كوكب صحراوي حار، كثبانه تخفي أسراراً تحت الرمال.',
  },
  {
    id: 'jaledon', name: 'جليدون', zone: 1,
    color: '#7dd3fc', color2: '#0369a1', terrain: 'سهول جليدية متجمدة',
    resource: 'بلورات جليدية',
    creature: { id: 'icewolf', name: 'ذئب الجليد', color: '#bae6fd', speed: 75 },
    rare: { id: 'lightseal', name: 'فقمة النور', color: '#e0f2fe' },
    hazard: { name: 'شقوق جليدية', desc: 'شقوق خفية في الجليد تبتلع من لا ينتبه.' },
    artifact: { id: 'ice_tear', name: 'دمعة الجليد الأبدي', story: 'قطرة تجمدت قبل مليار سنة ولم تذب أبداً. يقال إن بداخلها ذكريات أول شتاء في المجرة.' },
    flightDist: 950,
    desc: 'عالم أبيض صامت، تحت جليده أنهار من البلورات.',
  },
  {
    id: 'ghabon', name: 'غابون', zone: 1,
    color: '#22c55e', color2: '#14532d', terrain: 'غابة كثيفة متشابكة',
    resource: 'بلورات نباتية',
    creature: { id: 'junglespider', name: 'عنكبوت الغابة', color: '#4ade80', speed: 70 },
    rare: { id: 'moonmoth', name: 'فراشة القمر', color: '#f0abfc' },
    hazard: { name: 'نباتات سامة', desc: 'أوراق تلمع بألوان جذابة… ولمسها يكلفك بلورات.' },
    artifact: { id: 'first_seed', name: 'بذرة الغابة الأولى', story: 'بذرة صغيرة تنبض بلون أخضر حي. زرعها أول مستكشف، فصارت غابة كاملة في ليلة واحدة.' },
    flightDist: 1000,
    desc: 'غابة حية تتنفس، وأشجارها تهمس لمن يصغي.',
  },
  {
    id: 'lahib', name: 'لهيب', zone: 2,
    color: '#ef4444', color2: '#7f1d1d', terrain: 'حقول بركانية ملتهبة',
    resource: 'بلورات نارية',
    creature: { id: 'lavalizard', name: 'سحلية الحمم', color: '#f97316', speed: 80 },
    rare: { id: 'phoenix', name: 'طائر الفينيق الصغير', color: '#fb923c' },
    hazard: { name: 'ثوران حمم', desc: 'ينابيع حمم تنفجر فجأة من الأرض.' },
    artifact: { id: 'volcano_ember', name: 'جمرة البركان', story: 'جمرة لم تنطفئ منذ ولادة الكوكب. دفؤها يكفي لتدفئة سفينة كاملة في أبرد ليلة.' },
    flightDist: 1500,
    desc: 'كوكب ناري، أنهار الحمم فيه تضيء السماء ليلاً.',
  },
  {
    id: 'ghayum', name: 'غيوم', zone: 2,
    color: '#a78bfa', color2: '#4c1d95', terrain: 'بحر من السحب البنفسجية',
    resource: 'بلورات عاصفة',
    creature: { id: 'stormbird', name: 'طائر العاصفة', color: '#c4b5fd', speed: 85 },
    rare: { id: 'clouddragon', name: 'تنين السحاب', color: '#ddd6fe' },
    hazard: { name: 'رياح عاصفة', desc: 'هبات رياح تدفعك بعيداً عن طريقك.' },
    artifact: { id: 'storm_feather', name: 'ريشة العاصفة', story: 'ريشة خفيفة كالهواء وثقيلة كالعاصفة. من يمسكها يسمع صوت أول رعد في التاريخ.' },
    flightDist: 1550,
    desc: 'لا أرض صلبة هنا — جزر عائمة فوق بحر من الغيوم.',
  },
  {
    id: 'kahfon', name: 'كهفون', zone: 2,
    color: '#a8a29e', color2: '#44403c', terrain: 'شبكة كهوف مظلمة',
    resource: 'بلورات كهفية',
    creature: { id: 'cavebat', name: 'خفاش الكهف', color: '#d6d3d1', speed: 90 },
    rare: { id: 'diamondspider', name: 'عنكبوت الماس', color: '#e7e5e4' },
    hazard: { name: 'انهيارات صخرية', desc: 'صخور تتساقط من سقف الكهف دون إنذار.' },
    artifact: { id: 'cave_eye', name: 'عين الكهف', story: 'جوهرة ترى في الظلام ما لا تراه العيون. فتحت أبواب كهوف ظلت مغلقة آلاف السنين.' },
    flightDist: 1600,
    desc: 'عالم تحت الأرض، جدرانه مرصعة ببلورات تلمع في العتمة.',
  },
  {
    id: 'ballor', name: 'بلّور', zone: 3,
    color: '#e879f9', color2: '#86198f', terrain: 'سهول بلورية متلألئة',
    resource: 'بلورات نقية',
    creature: { id: 'crystalguard', name: 'حارس البلور', color: '#f0abfc', speed: 95 },
    rare: { id: 'crystalunicorn', name: 'وحيد القرن البلوري', color: '#fae8ff' },
    hazard: { name: 'شظايا حادة', desc: 'شظايا بلورية حادة تتطاير مع الرياح.' },
    artifact: { id: 'star_shard', name: 'شظية النجمة', story: 'قطعة من نجمة سقطت قبل أن يولد الزمن. بريقها يهدي السفن الضائعة إلى طريقها.' },
    flightDist: 2200,
    desc: 'كل شيء هنا يلمع — الأرض والسماء وحتى الهواء.',
  },
  {
    id: 'zilal', name: 'ظلال', zone: 3,
    color: '#6d28d9', color2: '#1e1b4b', terrain: 'أرض الضباب البنفسجي',
    resource: 'بلورات الظل',
    creature: { id: 'shadowghost', name: 'شبح الظل', color: '#8b5cf6', speed: 100 },
    rare: { id: 'shadowcat', name: 'قط الظلال', color: '#a78bfa' },
    hazard: { name: 'ضباب سام', desc: 'ضباب كثيف يسرق منك البلورات ببطء.' },
    artifact: { id: 'shadow_mask', name: 'قناع الظل', story: 'قناع يخفي صاحبه عن أعين المخلوقات. ارتداه لص المجرة الأعظم، ولم يُقبض عليه أبداً.' },
    flightDist: 2300,
    desc: 'كوكب يعيش في شفق دائم، وظلاله تخفي أكثر مما تُظهر.',
  },
  {
    id: 'darkstar', name: 'النجم المظلم', zone: 3, secret: true,
    color: '#000000', color2: '#a855f7', terrain: 'قلب الظلام نفسه',
    resource: 'بلورات الظلام',
    creature: { id: 'darkking', name: 'ملك الظلام', color: '#c084fc', speed: 110 },
    rare: { id: 'babystar', name: 'نجم الظلام الصغير', color: '#e879f9' },
    hazard: { name: 'جاذبية ساحقة', desc: 'جاذبية قوية تسحب كل شيء نحو المركز.' },
    artifact: { id: 'dark_heart', name: 'قلب النجم المظلم', story: 'قلب أسود ينبض بنور بنفسجي. من يجمع القطع الثماني ويصل إلى هنا، يصبح حارس النجوم — حامي المجرة كلها.' },
    flightDist: 2600,
    desc: 'النجم الذي لا يراه إلا من جمع كل الأسرار. هنا تنتهي الرحلة… أو تبدأ.',
  },
];

const ZONES = [
  { id: 1, name: 'المنطقة القريبة', engineReq: 1, desc: 'كواكب سهلة قريبة من الوطن.' },
  { id: 2, name: 'المنطقة الوسطى', engineReq: 2, desc: 'كواكب متوسطة — تحتاج محرك مستوى 2.' },
  { id: 3, name: 'المنطقة البعيدة', engineReq: 3, desc: 'كواكب خطيرة — تحتاج محرك مستوى 3.' },
];

// الترقيات: التكلفة للمستوى التالي (المستوى الحالي + 1).
const UPGRADES = {
  engine: {
    name: 'المحرك', desc: 'يفتح مناطق أبعد. مستوى 2 يفتح المنطقة الوسطى، ومستوى 3 يفتح المنطقة البعيدة.',
    max: 3, costs: { 2: 100, 3: 300 },
  },
  tank: {
    name: 'خزان الوقود', desc: 'يزيد سعة الوقود القصوى.',
    max: 3, costs: { 2: 60, 3: 150 },
    fuelMax: [100, 160, 240],
  },
  storage: {
    name: 'مخزن البلورات', desc: 'يزيد الحد الأقصى للبلورات التي تحملها.',
    max: 3, costs: { 2: 60, 3: 180 },
    cap: [300, 800, 2000],
  },
  scanner: {
    name: 'الماسح', desc: 'مستوى 1: يظهر وجود سر على الكوكب. مستوى 2: يظهر تلميحاً نصياً عن مكانه.',
    max: 2, costs: { 1: 80, 2: 200 },
  },
  shield: {
    name: 'الدرع', desc: 'يحمي سفينتك من الكويكبات: مستوى 1 يقلل الخسارة، ومستوى 2 يلغيها.',
    max: 2, costs: { 1: 70, 2: 180 },
  },
};

const FUEL_PRICE = { crystals: 2, fuel: 10 }; // 2 بلورة = 10 وقود

const ACHIEVEMENTS = [
  { id: 'first_landing', name: 'أول هبوط', desc: 'اهبط على أول كوكب' },
  { id: 'explorer_3', name: 'مستكشف مبتدئ', desc: 'اكتشف 3 كواكب' },
  { id: 'explorer_all', name: 'سيد المجرة', desc: 'اكتشف كل الكواكب التسعة' },
  { id: 'artifacts_5', name: 'جامع الآثار', desc: 'اجمع 5 قطع أثرية' },
  { id: 'artifacts_all', name: 'حارس النجوم', desc: 'اجمع كل القطع الأثرية التسع' },
  { id: 'crystals_1000', name: 'ثري البلورات', desc: 'اجمع 1000 بلورة إجمالاً' },
  { id: 'rich_500', name: 'كنز متحرك', desc: 'امتلك 500 بلورة في نفس الوقت' },
  { id: 'zapper_10', name: 'صاعق المخلوقات', desc: 'اصعق 10 مخلوقات' },
  { id: 'dark_star', name: 'فاتح الظلام', desc: 'صل إلى النجم المظلم' },
  { id: 'traveler_10', name: 'رحّالة الفضاء', desc: 'قم بـ 10 رحلات' },
];

const SAVE_KEY = 'darkstars.save.v1';

var DS_DATA = { COLORS: COLORS, HOME_PLANET: HOME_PLANET, PLANETS: PLANETS, ZONES: ZONES, UPGRADES: UPGRADES, FUEL_PRICE: FUEL_PRICE, ACHIEVEMENTS: ACHIEVEMENTS, SAVE_KEY: SAVE_KEY };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DS_DATA;
}

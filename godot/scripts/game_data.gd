extends RefCounted
class_name GameData

# DARK STARS 3D — بيانات اللعبة: الكواكب، المناطق، الترقيات، الإنجازات.
# نفس محتوى نسخة الـ 2D (SPEC.md) منقولاً إلى Godot.

const COLORS := {
	"bg": Color(0.027, 0.004, 0.051),
	"surface": Color(0.071, 0.016, 0.122),
	"primary": Color(0.659, 0.333, 0.969),
	"accent": Color(0.910, 0.475, 0.976),
	"gold": Color(0.984, 0.749, 0.141),
	"text": Color(0.961, 0.937, 1.0),
	"muted": Color(0.655, 0.561, 0.780),
}

const HOME_PLANET := {
	"id": "home", "name": "الوطن", "zone": 0,
	"color": Color(0.22, 0.74, 0.97), "color2": Color(0.01, 0.41, 0.63),
	"terrain": "الكوكب الأم — نقطة الانطلاق",
	"resource": "—",
	"desc": "كوكبك الأم. من هنا تبدأ كل رحلة، وإليه تعود.",
}

# 9 كواكب: 3 مناطق. كل كوكب: قطعة أثرية مخفية واحدة + مخلوق نادر واحد.
# flight_dist: مسافة الطيران بوحدات العالم (بعد التحويل: dist / 10).
const PLANETS := [
	{
		"id": "ramman", "name": "رمّال", "zone": 1,
		"color": Color(0.85, 0.47, 0.02), "color2": Color(0.57, 0.25, 0.05),
		"terrain": "صحراء رملية لا نهائية", "resource": "بلورات رملية",
		"creature": {"id": "sandworm", "name": "دودة الرمل", "color": Color(0.96, 0.62, 0.04), "speed": 60},
		"rare": {"id": "goldfox", "name": "ثعلب الرمال الذهبي", "color": Color(0.98, 0.75, 0.14)},
		"hazard": {"name": "عاصفة رملية", "desc": "رياح تحمل الرمل وتخفي الرؤية."},
		"artifact": {"id": "heart_sand", "name": "قلب الرمال", "story": "حجر نابض بالدفء، يقول أهل المجرة إنه نبض أول صحراء عرفها الكون. من يحمله لا يضيع طريقه أبداً."},
		"secret_hint": "الكشف في كهف شرقي الكوكب، بين الصخور الكبيرة.",
		"flight_dist": 900,
		"desc": "كوكب صحراوي حار، كثبانه تخفي أسراراً تحت الرمال.",
	},
	{
		"id": "jaledon", "name": "جليدون", "zone": 1,
		"color": Color(0.49, 0.83, 0.99), "color2": Color(0.01, 0.41, 0.63),
		"terrain": "سهول جليدية متجمدة", "resource": "بلورات جليدية",
		"creature": {"id": "icewolf", "name": "ذئب الجليد", "color": Color(0.73, 0.90, 0.99), "speed": 75},
		"rare": {"id": "lightseal", "name": "فقمة النور", "color": Color(0.88, 0.95, 1.0)},
		"hazard": {"name": "شقوق جليدية", "desc": "شقوق خفية في الجليد تبتلع من لا ينتبه."},
		"artifact": {"id": "ice_tear", "name": "دمعة الجليد الأبدي", "story": "قطرة تجمدت قبل مليار سنة ولم تذب أبداً. يقال إن بداخلها ذكريات أول شتاء في المجرة."},
		"secret_hint": "الكشف في كهف تحت أكبر جبل جليدي في الشمال.",
		"flight_dist": 950,
		"desc": "عالم أبيض صامت، تحت جليده أنهار من البلورات.",
	},
	{
		"id": "ghabon", "name": "غابون", "zone": 1,
		"color": Color(0.13, 0.77, 0.37), "color2": Color(0.08, 0.33, 0.18),
		"terrain": "غابة كثيفة متشابكة", "resource": "بلورات نباتية",
		"creature": {"id": "junglespider", "name": "عنكبوت الغابة", "color": Color(0.29, 0.87, 0.50), "speed": 70},
		"rare": {"id": "moonmoth", "name": "فراشة القمر", "color": Color(0.94, 0.67, 0.99)},
		"hazard": {"name": "نباتات سامة", "desc": "أوراق تلمع بألوان جذابة… ولمسها يكلفك بلورات."},
		"artifact": {"id": "first_seed", "name": "بذرة الغابة الأولى", "story": "بذرة صغيرة تنبض بلون أخضر حي. زرعها أول مستكشف، فصارت غابة كاملة في ليلة واحدة."},
		"secret_hint": "الكشف في كهف خلف أطول شجرة في الغابة.",
		"flight_dist": 1000,
		"desc": "غابة حية تتنفس، وأشجارها تهمس لمن يصغي.",
	},
	{
		"id": "lahib", "name": "لهيب", "zone": 2,
		"color": Color(0.94, 0.27, 0.27), "color2": Color(0.50, 0.11, 0.11),
		"terrain": "حقول بركانية ملتهبة", "resource": "بلورات نارية",
		"creature": {"id": "lavalizard", "name": "سحلية الحمم", "color": Color(0.97, 0.45, 0.09), "speed": 80},
		"rare": {"id": "phoenix", "name": "طائر الفينيق الصغير", "color": Color(0.98, 0.57, 0.24)},
		"hazard": {"name": "ثوران حمم", "desc": "ينابيع حمم تنفجر فجأة من الأرض."},
		"artifact": {"id": "volcano_ember", "name": "جمرة البركان", "story": "جمرة لم تنطفئ منذ ولادة الكوكب. دفؤها يكفي لتدفئة سفينة كاملة في أبرد ليلة."},
		"secret_hint": "الكشف في كهف بجانب أكبر بركان في الكوكب.",
		"flight_dist": 1500,
		"desc": "كوكب ناري، أنهار الحمم فيه تضيء السماء ليلاً.",
	},
	{
		"id": "ghayum", "name": "غيوم", "zone": 2,
		"color": Color(0.65, 0.55, 0.98), "color2": Color(0.30, 0.11, 0.58),
		"terrain": "بحر من السحب البنفسجية", "resource": "بلورات عاصفة",
		"creature": {"id": "stormbird", "name": "طائر العاصفة", "color": Color(0.77, 0.71, 0.99), "speed": 85},
		"rare": {"id": "clouddragon", "name": "تنين السحاب", "color": Color(0.87, 0.84, 0.99)},
		"hazard": {"name": "رياح عاصفة", "desc": "هبات رياح تدفعك بعيداً عن طريقك."},
		"artifact": {"id": "storm_feather", "name": "ريشة العاصفة", "story": "ريشة خفيفة كالهواء وثقيلة كالعاصفة. من يمسكها يسمع صوت أول رعد في التاريخ."},
		"secret_hint": "الكشف في كهف عائم فوق أعلى جزيرة سحابية.",
		"flight_dist": 1550,
		"desc": "لا أرض صلبة هنا — جزر عائمة فوق بحر من الغيوم.",
	},
	{
		"id": "kahfon", "name": "كهفون", "zone": 2,
		"color": Color(0.66, 0.64, 0.62), "color2": Color(0.27, 0.25, 0.24),
		"terrain": "شبكة كهوف مظلمة", "resource": "بلورات كهفية",
		"creature": {"id": "cavebat", "name": "خفاش الكهف", "color": Color(0.84, 0.83, 0.82), "speed": 90},
		"rare": {"id": "diamondspider", "name": "عنكبوت الماس", "color": Color(0.91, 0.90, 0.90)},
		"hazard": {"name": "انهيارات صخرية", "desc": "صخور تتساقط من سقف الكهف دون إنذار."},
		"artifact": {"id": "cave_eye", "name": "عين الكهف", "story": "جوهرة ترى في الظلام ما لا تراه العيون. فتحت أبواب كهوف ظلت مغلقة آلاف السنين."},
		"secret_hint": "الكشف في أعمق كهف، خلف الشلال الصخري.",
		"flight_dist": 1600,
		"desc": "عالم تحت الأرض، جدرانه مرصعة ببلورات تلمع في العتمة.",
	},
	{
		"id": "ballor", "name": "بلّور", "zone": 3,
		"color": Color(0.91, 0.47, 0.98), "color2": Color(0.53, 0.10, 0.56),
		"terrain": "سهول بلورية متلألئة", "resource": "بلورات نقية",
		"creature": {"id": "crystalguard", "name": "حارس البلور", "color": Color(0.94, 0.67, 0.99), "speed": 95},
		"rare": {"id": "crystalunicorn", "name": "وحيد القرن البلوري", "color": Color(0.98, 0.91, 1.0)},
		"hazard": {"name": "شظايا حادة", "desc": "شظايا بلورية حادة تتطاير مع الرياح."},
		"artifact": {"id": "star_shard", "name": "شظية النجمة", "story": "قطعة من نجمة سقطت قبل أن يولد الزمن. بريقها يهدي السفن الضائعة إلى طريقها."},
		"secret_hint": "الكشف في كهف وسط أكبر حقل بلوري متلألئ.",
		"flight_dist": 2200,
		"desc": "كل شيء هنا يلمع — الأرض والسماء وحتى الهواء.",
	},
	{
		"id": "zilal", "name": "ظلال", "zone": 3,
		"color": Color(0.43, 0.16, 0.85), "color2": Color(0.12, 0.11, 0.29),
		"terrain": "أرض الضباب البنفسجي", "resource": "بلورات الظل",
		"creature": {"id": "shadowghost", "name": "شبح الظل", "color": Color(0.55, 0.36, 0.96), "speed": 100},
		"rare": {"id": "shadowcat", "name": "قط الظلال", "color": Color(0.65, 0.55, 0.98)},
		"hazard": {"name": "ضباب سام", "desc": "ضباب كثيف يسرق منك البلورات ببطء."},
		"artifact": {"id": "shadow_mask", "name": "قناع الظل", "story": "قناع يخفي صاحبه عن أعين المخلوقات. ارتداه لص المجرة الأعظم، ولم يُقبض عليه أبداً."},
		"secret_hint": "الكشف في كهف مظلم في قلب الضباب الكثيف.",
		"flight_dist": 2300,
		"desc": "كوكب يعيش في شفق دائم، وظلاله تخفي أكثر مما تُظهر.",
	},
	{
		"id": "darkstar", "name": "النجم المظلم", "zone": 3, "secret": true,
		"color": Color(0.02, 0.01, 0.03), "color2": Color(0.66, 0.33, 0.97),
		"terrain": "قلب الظلام نفسه", "resource": "بلورات الظلام",
		"creature": {"id": "darkking", "name": "ملك الظلام", "color": Color(0.75, 0.52, 0.99), "speed": 110},
		"rare": {"id": "babystar", "name": "نجم الظلام الصغير", "color": Color(0.91, 0.47, 0.98)},
		"hazard": {"name": "جاذبية ساحقة", "desc": "جاذبية قوية تسحب كل شيء نحو المركز."},
		"artifact": {"id": "dark_heart", "name": "قلب النجم المظلم", "story": "قلب أسود ينبض بنور بنفسجي. من يجمع القطع الثماني ويصل إلى هنا، يصبح حارس النجوم — حامي المجرة كلها."},
		"secret_hint": "القلب في مركز النجم، خلف بوابة الظلام.",
		"flight_dist": 2600,
		"desc": "النجم الذي لا يراه إلا من جمع كل الأسرار. هنا تنتهي الرحلة… أو تبدأ.",
	},
]

const ZONES := [
	{"id": 1, "name": "المنطقة القريبة", "engine_req": 1, "desc": "كواكب سهلة قريبة من الوطن."},
	{"id": 2, "name": "المنطقة الوسطى", "engine_req": 2, "desc": "كواكب متوسطة — تحتاج محرك مستوى 2."},
	{"id": 3, "name": "المنطقة البعيدة", "engine_req": 3, "desc": "كواكب خطيرة — تحتاج محرك مستوى 3."},
]

# الترقيات: التكلفة للوصول إلى المستوى التالي.
const UPGRADES := {
	"engine": {
		"name": "المحرك", "desc": "يفتح مناطق أبعد. مستوى 2 يفتح المنطقة الوسطى، ومستوى 3 يفتح المنطقة البعيدة.",
		"max": 3, "costs": {2: 100, 3: 300}, "start": 1,
	},
	"tank": {
		"name": "خزان الوقود", "desc": "يزيد سعة الوقود القصوى.",
		"max": 3, "costs": {2: 60, 3: 150}, "start": 1,
		"fuel_max": [100, 160, 240],
	},
	"storage": {
		"name": "مخزن البلورات", "desc": "يزيد الحد الأقصى للبلورات التي تحملها.",
		"max": 3, "costs": {2: 60, 3: 180}, "start": 1,
		"cap": [300, 800, 2000],
	},
	"scanner": {
		"name": "الماسح", "desc": "مستوى 1: يظهر وجود سر على الكوكب. مستوى 2: يظهر تلميحاً نصياً عن مكانه.",
		"max": 2, "costs": {1: 80, 2: 200}, "start": 0,
	},
	"shield": {
		"name": "الدرع", "desc": "يحمي سفينتك من الكويكبات: مستوى 1 يقلل الخسارة، ومستوى 2 يلغيها.",
		"max": 2, "costs": {1: 70, 2: 180}, "start": 0,
	},
}

const FUEL_PRICE := {"crystals": 2, "fuel": 10} # 2 بلورة = 10 وقود
const FUEL_DRAIN_PER_SEC := 5.0
const CRYSTAL_VALUE := 5 # بلورات لكل بلورة تجمعها على السطح
const FUEL_NODE_VALUE := 12
const RARE_BONUS := 25

const ACHIEVEMENTS := [
	{"id": "first_landing", "name": "أول هبوط", "desc": "اهبط على أول كوكب"},
	{"id": "explorer_3", "name": "مستكشف مبتدئ", "desc": "اكتشف 3 كواكب"},
	{"id": "explorer_all", "name": "سيد المجرة", "desc": "اكتشف كل الكواكب التسعة"},
	{"id": "artifacts_5", "name": "جامع الآثار", "desc": "اجمع 5 قطع أثرية"},
	{"id": "artifacts_all", "name": "حارس النجوم", "desc": "اجمع كل القطع الأثرية التسع"},
	{"id": "crystals_1000", "name": "ثري البلورات", "desc": "اجمع 1000 بلورة إجمالاً"},
	{"id": "rich_500", "name": "كنز متحرك", "desc": "امتلك 500 بلورة في نفس الوقت"},
	{"id": "zapper_10", "name": "صاعق المخلوقات", "desc": "اصعق 10 مخلوقات"},
	{"id": "dark_star", "name": "فاتح الظلام", "desc": "صل إلى النجم المظلم"},
	{"id": "traveler_10", "name": "رحّالة الفضاء", "desc": "قم بـ 10 رحلات"},
]

static func planet_by_id(pid: String) -> Dictionary:
	for p in PLANETS:
		if p["id"] == pid:
			return p
	return {}

static func zone_engine_req(zone: int) -> int:
	for z in ZONES:
		if z["id"] == zone:
			return z["engine_req"]
	return 1

static func fuel_max_for_level(level: int) -> int:
	var arr: Array = UPGRADES["tank"]["fuel_max"]
	return arr[clampi(level, 1, 3) - 1]

static func crystal_cap_for_level(level: int) -> int:
	var arr: Array = UPGRADES["storage"]["cap"]
	return arr[clampi(level, 1, 3) - 1]

static func upgrade_cost(key: String, current_level: int) -> int:
	var u: Dictionary = UPGRADES[key]
	if current_level >= int(u["max"]):
		return -1
	var costs: Dictionary = u["costs"]
	return int(costs.get(current_level + 1, -1))

static func flight_world_dist(planet: Dictionary) -> float:
	return float(planet["flight_dist"]) / 10.0

static func flight_fuel_estimate(planet: Dictionary) -> int:
	return int(ceil(flight_world_dist(planet) * 0.18))

static func max_speed_for_engine(engine_level: int) -> float:
	return 26.0 + float(engine_level) * 6.0

static func dark_star_requirements_met(save: Dictionary) -> bool:
	if int(save["upgrades"]["engine"]) < 3:
		return false
	if int(save["upgrades"]["scanner"]) < 2:
		return false
	var count := 0
	for p in PLANETS:
		if String(p["id"]) == "darkstar":
			continue
		if String(p["artifact"]["id"]) in (save["artifacts"] as Array):
			count += 1
	return count >= 8

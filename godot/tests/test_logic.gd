extends SceneTree

# اختبارات منطق نقية (بدون مشهد): بيانات، ترقيات، حفظ، شروط فتح.
# التشغيل من داخل مجلد godot/:
#   godot --headless --path . -s tests/test_logic.gd

var _failures := 0

func _check(cond: bool, label: String) -> void:
	if cond:
		print("[TEST] OK: " + label)
	else:
		_failures += 1
		print("[TEST] FAIL: " + label)

func _init() -> void:
	# 1) الكواكب
	_check(GameData.PLANETS.size() == 9, "عدد الكواكب = 9")
	var ids := {}
	var artifact_ids := {}
	var ok := true
	for p in GameData.PLANETS:
		if String(p["id"]) in ids:
			ok = false
		ids[String(p["id"])] = true
		if String(p["artifact"]["id"]) in artifact_ids:
			ok = false
		artifact_ids[String(p["artifact"]["id"])] = true
	_check(ok, "معرّفات الكواكب والقطع الأثرية فريدة")
	_check(GameData.planet_by_id("ramman")["name"] == "رمّال", "البحث عن كوكب بالمعرّف")
	_check(GameData.planet_by_id("nope").is_empty(), "كوكب غير موجود يعيد قاموساً فارغاً")
	# 2) المناطق
	_check(GameData.zone_engine_req(1) == 1, "المنطقة 1 تحتاج محرك 1")
	_check(GameData.zone_engine_req(2) == 2, "المنطقة 2 تحتاج محرك 2")
	_check(GameData.zone_engine_req(3) == 3, "المنطقة 3 تحتاج محرك 3")
	# 3) سعات الوقود والبلورات
	_check(GameData.fuel_max_for_level(1) == 100, "خزان مستوى 1 = 100")
	_check(GameData.fuel_max_for_level(2) == 160, "خزان مستوى 2 = 160")
	_check(GameData.fuel_max_for_level(3) == 240, "خزان مستوى 3 = 240")
	_check(GameData.crystal_cap_for_level(1) == 300, "مخزن مستوى 1 = 300")
	_check(GameData.crystal_cap_for_level(3) == 2000, "مخزن مستوى 3 = 2000")
	# 4) تكاليف الترقيات
	_check(GameData.upgrade_cost("engine", 1) == 100, "محرك 1→2 يكلف 100")
	_check(GameData.upgrade_cost("engine", 3) == -1, "محرك 3 هو الحد الأقصى")
	_check(GameData.upgrade_cost("scanner", 0) == 80, "ماسح 0→1 يكلف 80")
	_check(GameData.upgrade_cost("scanner", 2) == -1, "ماسح 2 هو الحد الأقصى")
	_check(GameData.upgrade_cost("shield", 1) == 180, "درع 1→2 يكلف 180")
	# 5) الطيران
	var ramman := GameData.planet_by_id("ramman")
	_check(int(GameData.flight_world_dist(ramman)) == 90, "مسافة طيران رمّال = 90 وحدة")
	_check(GameData.flight_fuel_estimate(ramman) == 17, "تقدير وقود رمّال = 17")
	_check(GameData.max_speed_for_engine(1) == 32.0, "سرعة قصوى محرك 1 = 32")
	_check(GameData.max_speed_for_engine(3) == 44.0, "سرعة قصوى محرك 3 = 44")
	# 6) النجم المظلم
	var fresh := SaveData.default_data()
	_check(not GameData.dark_star_requirements_met(fresh), "النجم المظلم مقفل في حفظ جديد")
	var done := SaveData.default_data()
	done["upgrades"]["engine"] = 3
	done["upgrades"]["scanner"] = 2
	done["artifacts"] = ["heart_sand", "ice_tear", "first_seed", "volcano_ember", "storm_feather", "cave_eye", "star_shard", "shadow_mask"]
	_check(GameData.dark_star_requirements_met(done), "النجم المظلم يفتح بعد 8 قطع + محرك 3 + ماسح 2")
	var almost := SaveData.default_data()
	almost["upgrades"]["engine"] = 3
	almost["upgrades"]["scanner"] = 2
	almost["artifacts"] = ["heart_sand", "ice_tear", "first_seed", "volcano_ember", "storm_feather", "cave_eye", "star_shard"]
	_check(not GameData.dark_star_requirements_met(almost), "7 قطع لا تكفي للنجم المظلم")
	# 7) الحفظ (round-trip)
	var s := SaveData.new()
	s.data = SaveData.default_data()
	s.add_crystals(120)
	s.add_artifact("heart_sand")
	s.discover_planet("ramman")
	s.bump_stat("trips", 2)
	s.save_game()
	var s2 := SaveData.load_game()
	_check(int(s2.data["crystals"]) == 120, "حفظ/تحميل البلورات")
	_check(s2.has_artifact("heart_sand"), "حفظ/تحميل القطعة الأثرية")
	_check("ramman" in (s2.data["discovered_planets"] as Array), "حفظ/تحميل الكواكب المكتشفة")
	_check(int(s2.data["stats"]["trips"]) == 2, "حفظ/تحميل الإحصاءات")
	# 8) حدود المخزن والوقود
	var s3 := SaveData.new()
	s3.data = SaveData.default_data()
	var gained := s3.add_crystals(500)
	_check(gained == 300 and int(s3.data["crystals"]) == 300, "البلورات لا تتجاوز سعة المخزن (300)")
	_check(not s3.spend_crystals(400), "لا يمكن صرف أكثر من الرصيد")
	_check(s3.spend_crystals(100) and int(s3.data["crystals"]) == 200, "الصرف يعمل")
	var fg := s3.add_fuel(50)
	_check(fg == 0 and int(s3.data["fuel"]) == 100, "الوقود لا يتجاوز الخزان الممتلئ")
	s3.data["fuel"] = 50
	_check(s3.add_fuel(30) == 30 and int(s3.data["fuel"]) == 80, "إضافة الوقود")
	# 9) إنجازات: منع التكرار
	var s4 := SaveData.new()
	s4.data = SaveData.default_data()
	_check(s4.unlock_achievement("first_landing"), "فتح إنجاز أول مرة")
	_check(not s4.unlock_achievement("first_landing"), "لا يتكرر فتح نفس الإنجاز")
	# تنظيف ملف الحفظ التجريبي
	if FileAccess.file_exists(SaveData.SAVE_PATH):
		DirAccess.remove_absolute(SaveData.SAVE_PATH)
	if _failures == 0:
		print("[TEST] PASS — كل اختبارات المنطق نجحت")
		quit(0)
	else:
		print("[TEST] FAIL — عدد الأخطاء: %d" % _failures)
		quit(1)

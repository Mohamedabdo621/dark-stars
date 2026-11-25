extends Node3D

# DARK STARS 3D — المدير الرئيسي: حالات اللعب، الواجهات، الحفظ، الإنجازات.
# كل الواجهات تُبنى بالكود (لا مشاهد UI خارجية). عربي RTL بالكامل.

enum State { TITLE, MAP, FLIGHT, SURFACE }

var save: SaveData
var audio: AudioManager
var state: int = State.TITLE
var current_planet: Dictionary = {}
var selected_planet: Dictionary = {}

var map_world: StarMap
var flight_world: Flight
var surface_world: Surface

var ui_layer: CanvasLayer
var root_control: Control
var theme: Theme
var font: SystemFont
var screens: Dictionary = {}
var stats_bar: HBoxContainer
var lbl_crystals: Label
var lbl_fuel: Label
var toast_label: Label
var _toast_time: float = 0.0
var _return_screen: String = "title"
var _confirm_action: Callable

# عناصر خريطة النجوم
var map_info_panel: PanelContainer
var map_info_title: Label
var map_info_meta: Label
var map_info_desc: Label
var map_info_extra: Label
var map_info_req: Label
var map_travel_btn: Button

# عناصر الطيران
var flight_joy: DarkJoystick
var flight_fuel_bar: ProgressBar
var flight_fuel_lbl: Label
var flight_dist_lbl: Label
var flight_speed_lbl: Label
var flight_warn_lbl: Label
var _warn_time: float = 0.0
var _thrust_held: bool = false

# عناصر السطح
var surface_joy: DarkJoystick
var surface_artifact_lbl: Label
var surface_zap_btn: Button
var surface_hint_lbl: Label

# عناصر الترقيات
var upgrades_list: VBoxContainer
var upgrades_fuel_lbl: Label

func _ready() -> void:
	_setup_input()
	save = SaveData.load_game()
	audio = AudioManager.new()
	audio.name = "AudioManager"
	add_child(audio)
	audio.set_muted(bool(save.data["muted"]))
	_make_theme()
	_build_ui()
	_build_map_world()
	_show_title()
	if "--smoke" in OS.get_cmdline_user_args():
		_run_smoke_test()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		if save != null:
			save.save_game()
	elif what == NOTIFICATION_WM_GO_BACK_REQUEST:
		_on_back_pressed()

func _on_back_pressed() -> void:
	match state:
		State.MAP:
			if screens.has("map") and (screens["map"] as Control).visible:
				_show_title()
		State.SURFACE:
			_on_return_to_ship()
		_:
			pass

# ---------------- الإدخال ----------------

func _setup_input() -> void:
	_add_key_action("move_forward", [KEY_W, KEY_UP])
	_add_key_action("move_back", [KEY_S, KEY_DOWN])
	_add_key_action("move_left", [KEY_A, KEY_LEFT])
	_add_key_action("move_right", [KEY_D, KEY_RIGHT])
	_add_key_action("thrust", [KEY_SPACE])
	_add_key_action("zap", [KEY_E])

func _add_key_action(action_name: String, keys: Array) -> void:
	if not InputMap.has_action(action_name):
		InputMap.add_action(action_name)
	for k in keys:
		var ev := InputEventKey.new()
		ev.physical_keycode = k
		InputMap.action_add_event(action_name, ev)

func _process(delta: float) -> void:
	# تنبيهات تختفي مع الوقت
	if _toast_time > 0.0:
		_toast_time -= delta
		if _toast_time <= 0.0:
			toast_label.modulate.a = 0.0
	if _warn_time > 0.0:
		_warn_time -= delta
		if _warn_time <= 0.0 and flight_warn_lbl != null:
			flight_warn_lbl.text = ""
	# تحديث HUD حسب الحالة
	if state == State.FLIGHT and flight_world != null and not flight_world.finished:
		var kb := Vector2(Input.get_axis("move_left", "move_right"), Input.get_axis("move_back", "move_forward"))
		var joy := flight_joy.output
		if kb.length() > joy.length():
			joy = kb
		flight_world.set_joystick(joy)
		flight_world.set_thrust(_thrust_held or Input.is_action_pressed("thrust"))
		_update_flight_hud()
	elif state == State.SURFACE and surface_world != null:
		var joy := surface_joy.output
		var kb := Vector2(Input.get_axis("move_left", "move_right"), Input.get_axis("move_back", "move_forward"))
		if kb.length() > joy.length():
			joy = kb
		surface_world.set_joystick(joy)
		if Input.is_action_just_pressed("zap"):
			surface_world.zap()
		_update_surface_hud()

# ---------------- الخط والثيم ----------------

func _make_theme() -> void:
	font = SystemFont.new()
	font.font_names = PackedStringArray(["Noto Naskh Arabic", "Noto Sans Arabic", "Noto Sans", "Arial"])
	theme = Theme.new()
	theme.default_font = font
	theme.default_font_size = 26
	theme.set_color("font_color", "Label", GameData.COLORS["text"])
	theme.set_color("font_color", "Button", GameData.COLORS["text"])
	theme.set_color("font_disabled_color", "Button", Color(0.5, 0.45, 0.6))

func _style_button(b: Button, gold: bool = false) -> Button:
	var normal := StyleBoxFlat.new()
	normal.bg_color = Color(0.16, 0.05, 0.28) if not gold else Color(0.5, 0.35, 0.04)
	normal.border_color = GameData.COLORS["accent"] if not gold else GameData.COLORS["gold"]
	normal.set_border_width_all(2)
	normal.set_corner_radius_all(14)
	normal.content_margin_left = 20
	normal.content_margin_right = 20
	normal.content_margin_top = 10
	normal.content_margin_bottom = 10
	var hover := normal.duplicate() as StyleBoxFlat
	hover.bg_color = normal.bg_color.lightened(0.25)
	var pressed := normal.duplicate() as StyleBoxFlat
	pressed.bg_color = normal.bg_color.darkened(0.3)
	var disabled := normal.duplicate() as StyleBoxFlat
	disabled.bg_color = Color(0.09, 0.04, 0.14)
	disabled.border_color = Color(0.3, 0.25, 0.4)
	b.add_theme_stylebox_override("normal", normal)
	b.add_theme_stylebox_override("hover", hover)
	b.add_theme_stylebox_override("pressed", pressed)
	b.add_theme_stylebox_override("disabled", disabled)
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	b.add_theme_font_size_override("font_size", 28)
	return b

func _panel_style() -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = Color(0.07, 0.02, 0.12, 0.95)
	s.border_color = Color(0.66, 0.33, 0.97, 0.6)
	s.set_border_width_all(2)
	s.set_corner_radius_all(18)
	s.content_margin_left = 20
	s.content_margin_right = 20
	s.content_margin_top = 16
	s.content_margin_bottom = 16
	return s

func _mk_label(text: String, size: int, color: Color, align: HorizontalAlignment = HORIZONTAL_ALIGNMENT_RIGHT) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.horizontal_alignment = align
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return l

func _mk_button(text: String, gold: bool = false) -> Button:
	var b := Button.new()
	b.text = text
	_style_button(b, gold)
	return b

# ---------------- بناء الواجهات ----------------

func _build_ui() -> void:
	ui_layer = CanvasLayer.new()
	ui_layer.name = "UI"
	add_child(ui_layer)
	root_control = Control.new()
	root_control.name = "Root"
	root_control.set_anchors_preset(Control.PRESET_FULL_RECT)
	root_control.layout_direction = Control.LAYOUT_DIRECTION_RTL
	root_control.theme = theme
	# مهم: Root يغطي الشاشة كلها — لو بقي STOP (الافتراضي) سيبتلع كل
	# لمسة/نقرة قبل أن تصل إلى _unhandled_input (اختيار الكواكب).
	root_control.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui_layer.add_child(root_control)
	# شريط الإحصاءات العلوي (يظهر في الخريطة والطيران والسطح)
	stats_bar = HBoxContainer.new()
	stats_bar.set_anchors_preset(Control.PRESET_TOP_WIDE)
	stats_bar.offset_left = 16
	stats_bar.offset_right = -16
	stats_bar.offset_top = 12
	stats_bar.offset_bottom = 64
	stats_bar.add_theme_constant_override("separation", 12)
	stats_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	lbl_crystals = _mk_label("💎 0", 28, GameData.COLORS["gold"], HORIZONTAL_ALIGNMENT_LEFT)
	lbl_fuel = _mk_label("⛽ 0", 28, Color(0.5, 0.85, 1.0), HORIZONTAL_ALIGNMENT_LEFT)
	var fuel_btn := _mk_button("⛽ +10 وقود (2 💎)")
	fuel_btn.add_theme_font_size_override("font_size", 22)
	fuel_btn.pressed.connect(_on_buy_fuel)
	stats_bar.add_child(lbl_crystals)
	stats_bar.add_child(lbl_fuel)
	stats_bar.add_child(fuel_btn)
	stats_bar.visible = false
	root_control.add_child(stats_bar)
	_build_title_screen()
	_build_map_screen()
	_build_flight_hud()
	_build_surface_hud()
	_build_upgrades_screen()
	_build_codex_screen()
	_build_achievements_screen()
	_build_help_screen()
	_build_confirm_screen()
	# تنبيه عائم (فوق كل شيء)
	toast_label = _mk_label("", 30, GameData.COLORS["gold"], HORIZONTAL_ALIGNMENT_CENTER)
	toast_label.set_anchors_preset(Control.PRESET_CENTER_TOP)
	toast_label.offset_top = 90
	toast_label.offset_left = -360
	toast_label.offset_right = 360
	toast_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	toast_label.add_theme_constant_override("outline_size", 8)
	toast_label.modulate.a = 0.0
	toast_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root_control.add_child(toast_label)

func _new_screen(screen_name: String) -> Control:
	var c := Control.new()
	c.name = screen_name
	c.set_anchors_preset(Control.PRESET_FULL_RECT)
	c.visible = false
	root_control.add_child(c)
	screens[screen_name] = c
	return c

func _show_screen(screen_name: String) -> void:
	for key in screens.keys():
		(screens[key] as Control).visible = (key == screen_name)
	stats_bar.visible = screen_name in ["map", "flight", "surface"]

func toast(msg: String, dur: float = 2.5) -> void:
	toast_label.text = msg
	toast_label.modulate.a = 1.0
	_toast_time = dur

func _update_stats_bar() -> void:
	lbl_crystals.text = "💎 %d / %d" % [int(save.data["crystals"]), GameData.crystal_cap_for_level(int(save.data["upgrades"]["storage"]))]
	lbl_fuel.text = "⛽ %d / %d" % [int(save.data["fuel"]), GameData.fuel_max_for_level(int(save.data["upgrades"]["tank"]))]

# ----- شاشة العنوان -----
func _build_title_screen() -> void:
	var s := _new_screen("title")
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	s.add_child(center)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 18)
	vbox.alignment = BoxContainer.ALIGNMENT_CENTER
	center.add_child(vbox)
	var title := _mk_label("DARK STARS", 72, GameData.COLORS["gold"], HORIZONTAL_ALIGNMENT_CENTER)
	vbox.add_child(title)
	var sub := _mk_label("✦ نجوم الظلام ✦", 38, GameData.COLORS["accent"], HORIZONTAL_ALIGNMENT_CENTER)
	vbox.add_child(sub)
	var tagline := _mk_label("مغامرة فضاء — 9 كواكب، قطع أثرية، مخلوقات غريبة", 24, GameData.COLORS["muted"], HORIZONTAL_ALIGNMENT_CENTER)
	vbox.add_child(tagline)
	var start_btn := _mk_button("🚀 ابدأ الرحلة", true)
	start_btn.custom_minimum_size = Vector2(420, 72)
	start_btn.pressed.connect(_on_start_pressed)
	vbox.add_child(start_btn)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 12)
	vbox.add_child(row)
	var upg_btn := _mk_button("🛠 الترقيات")
	upg_btn.pressed.connect(func() -> void: _open_overlay("upgrades"))
	row.add_child(upg_btn)
	var codex_btn := _mk_button("📖 الموسوعة")
	codex_btn.pressed.connect(func() -> void: _open_overlay("codex"))
	row.add_child(codex_btn)
	var ach_btn := _mk_button("🏆 الإنجازات")
	ach_btn.pressed.connect(func() -> void: _open_overlay("achievements"))
	row.add_child(ach_btn)
	var row2 := HBoxContainer.new()
	row2.alignment = BoxContainer.ALIGNMENT_CENTER
	row2.add_theme_constant_override("separation", 12)
	vbox.add_child(row2)
	var help_btn := _mk_button("❓ كيفية اللعب")
	help_btn.pressed.connect(func() -> void: _open_overlay("help"))
	row2.add_child(help_btn)
	var mute_btn := _mk_button("🔊 الصوت: يعمل")
	mute_btn.name = "MuteBtn"
	mute_btn.pressed.connect(func() -> void: _toggle_mute(mute_btn))
	row2.add_child(mute_btn)
	var erase_btn := _mk_button("🗑 مسح التقدم")
	erase_btn.pressed.connect(_on_erase_pressed)
	row2.add_child(erase_btn)
	var ver := _mk_label("إصدار 1.0.0 — Godot 4.4 • أوفلاين 100%", 20, GameData.COLORS["muted"], HORIZONTAL_ALIGNMENT_CENTER)
	vbox.add_child(ver)

func _on_start_pressed() -> void:
	audio.play("click")
	_show_map()

func _toggle_mute(btn: Button) -> void:
	var m := not bool(save.data["muted"])
	save.data["muted"] = m
	audio.set_muted(m)
	btn.text = "🔇 الصوت: مكتوم" if m else "🔊 الصوت: يعمل"
	save.save_game()
	if not m:
		audio.play("click")

func _on_erase_pressed() -> void:
	_confirm("هل أنت متأكد؟ سيتم مسح كل تقدمك (بلورات، قطع أثرية، ترقيات) نهائياً.", func() -> void:
		save.erase()
		save = SaveData.load_game()
		audio.set_muted(bool(save.data["muted"]))
		_build_map_world()
		_update_stats_bar()
		toast("تم مسح التقدم 🗑")
	)

# ----- شاشة الخريطة -----
func _build_map_screen() -> void:
	var s := _new_screen("map")
	s.mouse_filter = Control.MOUSE_FILTER_IGNORE
	# أزرار سفلية
	var bottom := HBoxContainer.new()
	bottom.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	bottom.offset_left = 16
	bottom.offset_right = -16
	bottom.offset_top = -84
	bottom.offset_bottom = -16
	bottom.alignment = BoxContainer.ALIGNMENT_CENTER
	bottom.add_theme_constant_override("separation", 12)
	bottom.mouse_filter = Control.MOUSE_FILTER_IGNORE
	s.add_child(bottom)
	var upg_btn := _mk_button("🛠 الترقيات")
	upg_btn.pressed.connect(func() -> void: _open_overlay("upgrades"))
	bottom.add_child(upg_btn)
	var codex_btn := _mk_button("📖 الموسوعة")
	codex_btn.pressed.connect(func() -> void: _open_overlay("codex"))
	bottom.add_child(codex_btn)
	var ach_btn := _mk_button("🏆 الإنجازات")
	ach_btn.pressed.connect(func() -> void: _open_overlay("achievements"))
	bottom.add_child(ach_btn)
	var back_btn := _mk_button("🏠 القائمة")
	back_btn.pressed.connect(_show_title)
	bottom.add_child(back_btn)
	# تلميح يشرح ماذا يفعل اللاعب هنا (فوق، تحت شريط الإحصاءات)
	var hint := _mk_label("👆 المس أي كوكب لاختياره، ثم اضغط «سافر إلى الكوكب»", 24, GameData.COLORS["muted"], HORIZONTAL_ALIGNMENT_CENTER)
	hint.set_anchors_preset(Control.PRESET_CENTER_TOP)
	hint.offset_top = 76
	hint.offset_left = -420
	hint.offset_right = 420
	hint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	s.add_child(hint)
	# لوحة معلومات الكوكب المختار
	map_info_panel = PanelContainer.new()
	map_info_panel.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	map_info_panel.offset_left = 16
	map_info_panel.offset_right = -16
	map_info_panel.offset_top = -430
	map_info_panel.offset_bottom = -100
	map_info_panel.add_theme_stylebox_override("panel", _panel_style())
	map_info_panel.visible = false
	s.add_child(map_info_panel)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 6)
	map_info_panel.add_child(vbox)
	map_info_title = _mk_label("", 34, GameData.COLORS["gold"])
	vbox.add_child(map_info_title)
	map_info_meta = _mk_label("", 24, GameData.COLORS["muted"])
	vbox.add_child(map_info_meta)
	map_info_desc = _mk_label("", 24, GameData.COLORS["text"])
	vbox.add_child(map_info_desc)
	map_info_extra = _mk_label("", 24, GameData.COLORS["accent"])
	vbox.add_child(map_info_extra)
	map_info_req = _mk_label("", 24, Color(1.0, 0.6, 0.4))
	vbox.add_child(map_info_req)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	vbox.add_child(row)
	map_travel_btn = _mk_button("🚀 سافر إلى الكوكب", true)
	map_travel_btn.pressed.connect(_on_travel_pressed)
	row.add_child(map_travel_btn)
	var close_btn := _mk_button("إغلاق")
	close_btn.pressed.connect(func() -> void: map_info_panel.visible = false)
	row.add_child(close_btn)

func _on_planet_selected(p: Dictionary) -> void:
	selected_planet = p
	audio.play("click")
	map_info_title.text = "🪐 " + String(p["name"])
	var zone_text := "الوطن" if int(p["zone"]) == 0 else "المنطقة " + str(p["zone"])
	map_info_meta.text = "%s • %s" % [zone_text, String(p["terrain"])]
	map_info_desc.text = String(p["desc"])
	var extra := "المورد: " + String(p["resource"]) + "  •  الخطر: " + String(p["hazard"]["name"])
	if String(p["id"]) != "home":
		if save.has_artifact(String(p["artifact"]["id"])):
			extra += "\n🏺 القطعة الأثرية: %s ✓ (تم جمعها)" % String(p["artifact"]["name"])
		elif int(save.data["upgrades"]["scanner"]) >= 2:
			extra += "\n🔍 تلميح الماسح: " + String(p["secret_hint"])
		elif int(save.data["upgrades"]["scanner"]) >= 1:
			extra += "\n🔍 يوجد سر هنا! (الماسح مستوى 2 يكشف مكانه)"
	map_info_extra.text = extra
	var reason := _travel_block_reason(p)
	if reason == "":
		map_info_req.text = "⛽ وقود الرحلة التقريبي: %d" % GameData.flight_fuel_estimate(p)
		map_travel_btn.disabled = false
	else:
		map_info_req.text = "🔒 " + reason
		map_travel_btn.disabled = true
	map_info_panel.visible = true

func _travel_block_reason(p: Dictionary) -> String:
	if String(p["id"]) == "home":
		return "أنت هنا بالفعل — اختر كوكباً آخر"
	var zone: int = int(p["zone"])
	if int(save.data["upgrades"]["engine"]) < GameData.zone_engine_req(zone):
		return "تحتاج محرك مستوى %d لفتح هذه المنطقة" % GameData.zone_engine_req(zone)
	if bool(p.get("secret", false)) and not GameData.dark_star_requirements_met(save.data):
		return "مقفل — اجمع القطع الأثرية الثماني وطوّر المحرك إلى 3 والماسح إلى 2"
	var est := GameData.flight_fuel_estimate(p)
	if int(save.data["fuel"]) < est:
		return "وقود غير كافٍ (تحتاج ~%d وقود)" % est
	return ""

func _on_travel_pressed() -> void:
	if selected_planet.is_empty():
		return
	if _travel_block_reason(selected_planet) != "":
		audio.play("error")
		return
	audio.play("click")
	map_info_panel.visible = false
	_start_flight(selected_planet)

# ----- واجهة الطيران -----
func _build_flight_hud() -> void:
	var s := _new_screen("flight")
	s.mouse_filter = Control.MOUSE_FILTER_IGNORE
	flight_fuel_bar = ProgressBar.new()
	flight_fuel_bar.set_anchors_preset(Control.PRESET_TOP_WIDE)
	flight_fuel_bar.offset_left = 16
	flight_fuel_bar.offset_right = -16
	flight_fuel_bar.offset_top = 76
	flight_fuel_bar.offset_bottom = 104
	flight_fuel_bar.show_percentage = false
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0.05, 0.02, 0.1, 0.9)
	bg.set_corner_radius_all(8)
	var fill := StyleBoxFlat.new()
	fill.bg_color = Color(0.5, 0.85, 1.0)
	fill.set_corner_radius_all(8)
	flight_fuel_bar.add_theme_stylebox_override("background", bg)
	flight_fuel_bar.add_theme_stylebox_override("fill", fill)
	flight_fuel_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	s.add_child(flight_fuel_bar)
	flight_fuel_lbl = _mk_label("", 24, Color(0.5, 0.85, 1.0), HORIZONTAL_ALIGNMENT_CENTER)
	flight_fuel_lbl.set_anchors_preset(Control.PRESET_TOP_WIDE)
	flight_fuel_lbl.offset_top = 108
	flight_fuel_lbl.offset_bottom = 140
	flight_fuel_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	s.add_child(flight_fuel_lbl)
	flight_dist_lbl = _mk_label("", 26, GameData.COLORS["text"], HORIZONTAL_ALIGNMENT_CENTER)
	flight_dist_lbl.set_anchors_preset(Control.PRESET_TOP_WIDE)
	flight_dist_lbl.offset_top = 148
	flight_dist_lbl.offset_bottom = 182
	flight_dist_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	s.add_child(flight_dist_lbl)
	flight_speed_lbl = _mk_label("", 24, GameData.COLORS["muted"], HORIZONTAL_ALIGNMENT_CENTER)
	flight_speed_lbl.set_anchors_preset(Control.PRESET_TOP_WIDE)
	flight_speed_lbl.offset_top = 186
	flight_speed_lbl.offset_bottom = 216
	flight_speed_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	s.add_child(flight_speed_lbl)
	flight_warn_lbl = _mk_label("", 30, Color(1.0, 0.55, 0.3), HORIZONTAL_ALIGNMENT_CENTER)
	flight_warn_lbl.set_anchors_preset(Control.PRESET_CENTER_TOP)
	flight_warn_lbl.offset_top = 240
	flight_warn_lbl.offset_left = -300
	flight_warn_lbl.offset_right = 300
	flight_warn_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	s.add_child(flight_warn_lbl)
	# عصا التوجيه (يسار)
	flight_joy = DarkJoystick.new()
	flight_joy.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	flight_joy.offset_left = 24
	flight_joy.offset_top = -280
	flight_joy.offset_right = 274
	flight_joy.offset_bottom = -30
	s.add_child(flight_joy)
	# زر الدفع (يمين)
	var thrust_btn := _mk_button("🚀\nدفع", true)
	thrust_btn.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	thrust_btn.offset_left = -210
	thrust_btn.offset_top = -240
	thrust_btn.offset_right = -30
	thrust_btn.offset_bottom = -60
	thrust_btn.add_theme_font_size_override("font_size", 34)
	thrust_btn.button_down.connect(func() -> void: _thrust_held = true)
	thrust_btn.button_up.connect(func() -> void: _thrust_held = false)
	s.add_child(thrust_btn)

func _update_flight_hud() -> void:
	var max_fuel := GameData.fuel_max_for_level(int(save.data["upgrades"]["tank"]))
	flight_fuel_bar.max_value = max_fuel
	flight_fuel_bar.value = flight_world.fuel
	flight_fuel_lbl.text = "⛽ الوقود: %d / %d" % [int(flight_world.fuel), max_fuel]
	flight_dist_lbl.text = "🪐 المسافة إلى %s: %d" % [String(current_planet["name"]), int(flight_world.distance_to_target())]
	flight_speed_lbl.text = "السرعة: %d" % int(flight_world.speed())

func _flight_warn(msg: String) -> void:
	flight_warn_lbl.text = msg
	_warn_time = 2.0

# ----- واجهة السطح -----
func _build_surface_hud() -> void:
	var s := _new_screen("surface")
	s.mouse_filter = Control.MOUSE_FILTER_IGNORE
	surface_artifact_lbl = _mk_label("", 24, GameData.COLORS["gold"], HORIZONTAL_ALIGNMENT_CENTER)
	surface_artifact_lbl.set_anchors_preset(Control.PRESET_TOP_WIDE)
	surface_artifact_lbl.offset_top = 76
	surface_artifact_lbl.offset_bottom = 110
	surface_artifact_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	s.add_child(surface_artifact_lbl)
	surface_hint_lbl = _mk_label("اجمع البلورات 💎 والوقود ⛽ — ادخل الكهف للقطعة الأثرية", 22, GameData.COLORS["muted"], HORIZONTAL_ALIGNMENT_CENTER)
	surface_hint_lbl.set_anchors_preset(Control.PRESET_TOP_WIDE)
	surface_hint_lbl.offset_top = 114
	surface_hint_lbl.offset_bottom = 144
	surface_hint_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	s.add_child(surface_hint_lbl)
	var return_btn := _mk_button("🚀 عودة للسفينة")
	return_btn.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	return_btn.offset_left = -250
	return_btn.offset_top = 150
	return_btn.offset_right = -16
	return_btn.offset_bottom = 210
	return_btn.pressed.connect(_on_return_to_ship)
	s.add_child(return_btn)
	surface_joy = DarkJoystick.new()
	surface_joy.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	surface_joy.offset_left = 24
	surface_joy.offset_top = -280
	surface_joy.offset_right = 274
	surface_joy.offset_bottom = -30
	s.add_child(surface_joy)
	surface_zap_btn = _mk_button("⚡ صعق", true)
	surface_zap_btn.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	surface_zap_btn.offset_left = -210
	surface_zap_btn.offset_top = -240
	surface_zap_btn.offset_right = -30
	surface_zap_btn.offset_bottom = -60
	surface_zap_btn.add_theme_font_size_override("font_size", 34)
	surface_zap_btn.pressed.connect(func() -> void:
		if surface_world != null:
			surface_world.zap()
	)
	s.add_child(surface_zap_btn)

func _update_surface_hud() -> void:
	if surface_world == null:
		return
	var art_name := String(current_planet["artifact"]["name"])
	if surface_world.artifact_found or save.has_artifact(String(current_planet["artifact"]["id"])):
		surface_artifact_lbl.text = "🏺 القطعة الأثرية: %s ✓" % art_name
	else:
		surface_artifact_lbl.text = "🏺 القطعة الأثرية: %s (مخفية في الكهف)" % art_name
	var cd := surface_world.zap_cooldown()
	if cd > 0.0:
		surface_zap_btn.text = "⚡ (%d)" % int(ceil(cd))
		surface_zap_btn.disabled = true
	else:
		surface_zap_btn.text = "⚡ صعق"
		surface_zap_btn.disabled = false

# ----- شاشة الترقيات -----
func _build_upgrades_screen() -> void:
	var s := _new_screen("upgrades")
	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	panel.offset_left = 16
	panel.offset_right = -16
	panel.offset_top = 16
	panel.offset_bottom = -16
	panel.add_theme_stylebox_override("panel", _panel_style())
	s.add_child(panel)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 10)
	panel.add_child(vbox)
	var title := _mk_label("🛠 ترقيات السفينة", 36, GameData.COLORS["gold"], HORIZONTAL_ALIGNMENT_CENTER)
	vbox.add_child(title)
	upgrades_fuel_lbl = _mk_label("", 26, GameData.COLORS["text"], HORIZONTAL_ALIGNMENT_CENTER)
	vbox.add_child(upgrades_fuel_lbl)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_child(scroll)
	upgrades_list = VBoxContainer.new()
	upgrades_list.add_theme_constant_override("separation", 10)
	upgrades_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(upgrades_list)
	var back_btn := _mk_button("⬅ رجوع")
	back_btn.pressed.connect(_close_overlay)
	vbox.add_child(back_btn)

func _refresh_upgrades() -> void:
	for c in upgrades_list.get_children():
		c.queue_free()
	upgrades_fuel_lbl.text = "💎 بلوراتك: %d   •   ⛽ وقودك: %d / %d" % [
		int(save.data["crystals"]), int(save.data["fuel"]),
		GameData.fuel_max_for_level(int(save.data["upgrades"]["tank"]))]
	# شراء وقود
	var fuel_row := PanelContainer.new()
	fuel_row.add_theme_stylebox_override("panel", _panel_style())
	upgrades_list.add_child(fuel_row)
	var fr := HBoxContainer.new()
	fr.add_theme_constant_override("separation", 12)
	fuel_row.add_child(fr)
	var fl := _mk_label("⛽ شراء وقود\n10 وقود مقابل 2 بلورة", 24, GameData.COLORS["text"])
	fl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	fr.add_child(fl)
	var fb := _mk_button("شراء ⛽")
	fb.pressed.connect(_on_buy_fuel)
	fr.add_child(fb)
	for key in ["engine", "tank", "storage", "scanner", "shield"]:
		var u: Dictionary = GameData.UPGRADES[key]
		var level: int = int(save.data["upgrades"][key])
		var max_level: int = int(u["max"])
		var row := PanelContainer.new()
		row.add_theme_stylebox_override("panel", _panel_style())
		upgrades_list.add_child(row)
		var hb := HBoxContainer.new()
		hb.add_theme_constant_override("separation", 12)
		row.add_child(hb)
		var info := VBoxContainer.new()
		info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		hb.add_child(info)
		var name_lbl := _mk_label("%s — المستوى %d / %d" % [String(u["name"]), level, max_level], 28, GameData.COLORS["text"])
		info.add_child(name_lbl)
		var desc_lbl := _mk_label(String(u["desc"]), 22, GameData.COLORS["muted"])
		info.add_child(desc_lbl)
		var cost := GameData.upgrade_cost(key, level)
		var buy_btn := _mk_button("شراء (%d 💎)" % cost if cost >= 0 else "الحد الأقصى ✓", true)
		if cost < 0 or int(save.data["crystals"]) < cost:
			buy_btn.disabled = true
		buy_btn.pressed.connect(_on_buy_upgrade.bind(key))
		hb.add_child(buy_btn)

func _on_buy_upgrade(key: String) -> void:
	var level: int = int(save.data["upgrades"][key])
	var cost := GameData.upgrade_cost(key, level)
	if cost < 0:
		return
	if not save.spend_crystals(cost):
		audio.play("error")
		toast("بلورات غير كافية!")
		return
	save.data["upgrades"][key] = level + 1
	save.save_game()
	audio.play("collect")
	toast("تمت الترقية: %s إلى المستوى %d 🎉" % [String(GameData.UPGRADES[key]["name"]), level + 1])
	_refresh_upgrades()
	_update_stats_bar()

func _on_buy_fuel() -> void:
	if int(save.data["fuel"]) >= GameData.fuel_max_for_level(int(save.data["upgrades"]["tank"])):
		audio.play("error")
		toast("خزان الوقود ممتلئ!")
		return
	if not save.spend_crystals(GameData.FUEL_PRICE["crystals"]):
		audio.play("error")
		toast("بلورات غير كافية!")
		return
	var gained := save.add_fuel(GameData.FUEL_PRICE["fuel"])
	save.save_game()
	audio.play("collect")
	toast("اشتريت %d وقود ⛽" % gained)
	_update_stats_bar()
	if screens.has("upgrades") and (screens["upgrades"] as Control).visible:
		_refresh_upgrades()

# ----- الموسوعة -----
func _build_codex_screen() -> void:
	var s := _new_screen("codex")
	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	panel.offset_left = 16
	panel.offset_right = -16
	panel.offset_top = 16
	panel.offset_bottom = -16
	panel.add_theme_stylebox_override("panel", _panel_style())
	s.add_child(panel)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 10)
	panel.add_child(vbox)
	vbox.add_child(_mk_label("📖 موسوعة المجرة", 36, GameData.COLORS["gold"], HORIZONTAL_ALIGNMENT_CENTER))
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_child(scroll)
	var list := VBoxContainer.new()
	list.add_theme_constant_override("separation", 10)
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.name = "CodexList"
	scroll.add_child(list)
	var back_btn := _mk_button("⬅ رجوع")
	back_btn.pressed.connect(_close_overlay)
	vbox.add_child(back_btn)

func _refresh_codex() -> void:
	var list := (screens["codex"] as Control).find_child("CodexList", true, false) as VBoxContainer
	for c in list.get_children():
		c.queue_free()
	list.add_child(_mk_label("🏺 القطع الأثرية", 30, GameData.COLORS["gold"]))
	for p in GameData.PLANETS:
		var aid := String(p["artifact"]["id"])
		var text := ""
		if save.has_artifact(aid):
			text = "🏺 %s — %s\n%s" % [String(p["artifact"]["name"]), String(p["name"]), String(p["artifact"]["story"])]
		else:
			text = "؟؟؟ — قطعة أثرية مخفية على كوكب %s" % String(p["name"])
		list.add_child(_mk_label(text, 24, GameData.COLORS["text"] if save.has_artifact(aid) else GameData.COLORS["muted"]))
	list.add_child(_mk_label("👾 المخلوقات", 30, GameData.COLORS["gold"]))
	for p in GameData.PLANETS:
		var cid := String(p["creature"]["id"])
		var rid := String(p["rare"]["id"])
		var ct := "👾 %s (%s)" % [String(p["creature"]["name"]), String(p["name"])] if cid in (save.data["creatures"] as Array) else "؟؟؟ — مخلوق على كوكب %s" % String(p["name"])
		var rt := "✨ %s (نادر — %s)" % [String(p["rare"]["name"]), String(p["name"])] if rid in (save.data["rare_creatures"] as Array) else "؟؟؟ — مخلوق نادر على كوكب %s" % String(p["name"])
		list.add_child(_mk_label(ct, 24, GameData.COLORS["text"] if cid in (save.data["creatures"] as Array) else GameData.COLORS["muted"]))
		list.add_child(_mk_label(rt, 24, GameData.COLORS["gold"] if rid in (save.data["rare_creatures"] as Array) else GameData.COLORS["muted"]))

# ----- الإنجازات -----
func _build_achievements_screen() -> void:
	var s := _new_screen("achievements")
	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	panel.offset_left = 16
	panel.offset_right = -16
	panel.offset_top = 16
	panel.offset_bottom = -16
	panel.add_theme_stylebox_override("panel", _panel_style())
	s.add_child(panel)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 10)
	panel.add_child(vbox)
	vbox.add_child(_mk_label("🏆 الإنجازات", 36, GameData.COLORS["gold"], HORIZONTAL_ALIGNMENT_CENTER))
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_child(scroll)
	var list := VBoxContainer.new()
	list.add_theme_constant_override("separation", 10)
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.name = "AchList"
	scroll.add_child(list)
	var back_btn := _mk_button("⬅ رجوع")
	back_btn.pressed.connect(_close_overlay)
	vbox.add_child(back_btn)

func _refresh_achievements() -> void:
	var list := (screens["achievements"] as Control).find_child("AchList", true, false) as VBoxContainer
	for c in list.get_children():
		c.queue_free()
	for a in GameData.ACHIEVEMENTS:
		var got := String(a["id"]) in (save.data["achievements"] as Array)
		var icon := "🏆" if got else "🔒"
		var text := "%s %s — %s" % [icon, String(a["name"]), String(a["desc"])]
		list.add_child(_mk_label(text, 26, GameData.COLORS["gold"] if got else GameData.COLORS["muted"]))

# ----- كيفية اللعب -----
func _build_help_screen() -> void:
	var s := _new_screen("help")
	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	panel.offset_left = 16
	panel.offset_right = -16
	panel.offset_top = 16
	panel.offset_bottom = -16
	panel.add_theme_stylebox_override("panel", _panel_style())
	s.add_child(panel)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 10)
	panel.add_child(vbox)
	vbox.add_child(_mk_label("❓ كيفية اللعب", 36, GameData.COLORS["gold"], HORIZONTAL_ALIGNMENT_CENTER))
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_child(scroll)
	var text := """🎯 الهدف: سافر بين الكواكب التسعة، اجمع القطع الأثرية، وافتح النجم المظلم السري.

🗺 الخريطة: انقر على كوكب لترى معلوماته، ثم اضغط «سافر». المناطق الأبعد تحتاج محركاً أقوى.

🚀 الطيران: العصا اليسرى للتوجيه، وزر «دفع» للتسارع. تجنّب الكويكبات! الوقود ينفد أثناء الدفع. للهبوط: اقترب من الكوكب ببطء (السرعة أقل من 14).

🪐 على السطح: تحرك بالعصا، اجمع البلورات 💎 وعقد الوقود ⛽ بالاقتراب منها. ادخل الكهف لتجد القطعة الأثرية. المخلوقات تطاردك — ابتعد عنها أو اصعقها بزر ⚡ (أو حرف E). المخلوق الذهبي النادر يهرب منك — اقترب منه بحذر لتحصل على مكافأة.

🛠 الترقيات: بالبلورات اشترِ محركاً أقوى (يفتح مناطق جديدة)، خزان وقود أكبر، مخزن بلورات أكبر، ماسحاً يكشف الأسرار، ودرعاً ضد الكويكبات.

⌨️ على الكمبيوتر: WASD أو الأسهم للحركة، مسافة للدفع، E للصعق.

💾 الحفظ تلقائي بعد كل هبوط وجمع وشراء."""
	var lbl := _mk_label(text, 26, GameData.COLORS["text"])
	scroll.add_child(lbl)
	var back_btn := _mk_button("⬅ رجوع")
	back_btn.pressed.connect(_close_overlay)
	vbox.add_child(back_btn)

# ----- تأكيد عام -----
func _build_confirm_screen() -> void:
	var s := _new_screen("confirm")
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	s.add_child(center)
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style())
	center.add_child(panel)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 16)
	panel.add_child(vbox)
	var lbl := _mk_label("", 28, GameData.COLORS["text"], HORIZONTAL_ALIGNMENT_CENTER)
	lbl.name = "ConfirmLabel"
	vbox.add_child(lbl)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 16)
	vbox.add_child(row)
	var yes_btn := _mk_button("نعم، متأكد", true)
	yes_btn.pressed.connect(func() -> void:
		_close_overlay()
		if _confirm_action.is_valid():
			_confirm_action.call()
	)
	row.add_child(yes_btn)
	var no_btn := _mk_button("إلغاء")
	no_btn.pressed.connect(_close_overlay)
	row.add_child(no_btn)

func _confirm(msg: String, action: Callable) -> void:
	_confirm_action = action
	var lbl := (screens["confirm"] as Control).find_child("ConfirmLabel", true, false) as Label
	lbl.text = msg
	_open_overlay("confirm")

# ----- النوافذ المنبثقة (ترقيات/موسوعة/إنجازات/مساعدة/تأكيد) -----
func _open_overlay(screen_name: String) -> void:
	_return_screen = "title" if state == State.TITLE else "map"
	if screen_name == "upgrades":
		_refresh_upgrades()
	elif screen_name == "codex":
		_refresh_codex()
	elif screen_name == "achievements":
		_refresh_achievements()
	audio.play("click")
	_show_screen(screen_name)

func _close_overlay() -> void:
	audio.play("click")
	if state == State.TITLE:
		_show_screen("title")
	elif state == State.MAP:
		_show_screen("map")
	else:
		_show_screen("title")

# ---------------- العوالم ----------------

func _build_map_world() -> void:
	if map_world != null:
		map_world.queue_free()
		map_world = null
	map_world = StarMap.new()
	add_child(map_world)
	map_world.build(save)
	map_world.planet_selected.connect(_on_planet_selected)

func _show_title() -> void:
	state = State.TITLE
	_free_flight()
	_free_surface()
	if map_world == null:
		_build_map_world()
	map_world.set_process_unhandled_input(false)
	_show_screen("title")
	_update_stats_bar()
	# زر البدء: «أكمل» إذا كان هناك تقدم
	var title_screen := screens["title"] as Control
	for b in title_screen.find_children("*", "Button", true, false):
		if (b as Button).text.begins_with("🚀"):
			(b as Button).text = "🚀 أكمل الرحلة" if int(save.data["stats"]["trips"]) > 0 else "🚀 ابدأ الرحلة"

func _show_map() -> void:
	state = State.MAP
	_free_flight()
	_free_surface()
	_build_map_world()
	map_world.set_process_unhandled_input(true)
	map_info_panel.visible = false
	selected_planet = {}
	_show_screen("map")
	_update_stats_bar()

func _free_flight() -> void:
	if flight_world != null:
		flight_world.queue_free()
		flight_world = null

func _free_surface() -> void:
	if surface_world != null:
		surface_world.queue_free()
		surface_world = null

func _start_flight(p: Dictionary) -> void:
	current_planet = p
	state = State.FLIGHT
	if map_world != null:
		map_world.queue_free()
		map_world = null
	flight_world = Flight.new()
	add_child(flight_world)
	flight_world.setup(p, save, audio)
	flight_world.landed.connect(_on_landed)
	flight_world.returned_out_of_fuel.connect(_on_returned_out_of_fuel)
	flight_world.asteroid_hit.connect(_on_asteroid_hit)
	flight_world.too_fast.connect(func() -> void: _flight_warn("⚠ خفف السرعة للهبوط!"))
	_thrust_held = false
	flight_joy.reset()
	save.bump_stat("trips")
	save.save_game()
	_show_screen("flight")
	_update_stats_bar()
	_update_flight_hud()

func _on_landed() -> void:
	var remaining_fuel := int(flight_world.fuel)
	save.set_fuel(remaining_fuel)
	var is_new := save.discover_planet(String(current_planet["id"]))
	save.bump_stat("landings")
	save.save_game()
	_free_flight()
	state = State.SURFACE
	surface_world = Surface.new()
	add_child(surface_world)
	surface_world.setup(current_planet, save, audio)
	surface_world.artifact_collected.connect(_on_artifact_collected)
	surface_world.crystal_collected.connect(_on_crystal_collected)
	surface_world.fuel_collected.connect(_on_fuel_collected)
	surface_world.rare_found.connect(_on_rare_found)
	surface_world.player_hit.connect(_on_player_hit)
	surface_world.zapped.connect(_on_zapped)
	surface_joy.reset()
	_show_screen("surface")
	_update_stats_bar()
	_update_surface_hud()
	toast("🪐 هبطت على %s!" % String(current_planet["name"]))
	if String(current_planet["id"]) == "darkstar":
		_check_achievements()
	if int(save.data["upgrades"]["scanner"]) == 1:
		toast("🔍 يوجد سر هنا! طوّر الماسح لتعرف مكانه", 3.5)
	elif int(save.data["upgrades"]["scanner"]) >= 2:
		toast("🔍 تلميح: %s" % String(current_planet["secret_hint"]), 4.0)
	_check_achievements()

func _on_returned_out_of_fuel() -> void:
	save.set_fuel(0)
	var lost := int(int(save.data["crystals"]) * 0.15)
	save.data["crystals"] = int(save.data["crystals"]) - lost
	var emergency := false
	if int(save.data["crystals"]) <= 0:
		save.data["fuel"] = 20
		emergency = true
	save.save_game()
	_free_flight()
	_show_map()
	if emergency:
		toast("⛽ نفد الوقود! عدت للوطن مع وقود طوارئ +20", 3.5)
	elif lost > 0:
		toast("⛽ نفد الوقود! عدت للوطن وخسرت %d بلورة" % lost, 3.5)
	else:
		toast("⛽ نفد الوقود! عدت للوطن", 3.0)

func _on_return_to_ship() -> void:
	save.save_game()
	_free_surface()
	_show_map()
	toast("🚀 عدت إلى السفينة")

func _on_asteroid_hit(lost: int) -> void:
	if lost > 0:
		save.data["crystals"] = maxi(0, int(save.data["crystals"]) - lost)
		save.save_game()
		toast("💥 اصطدمت بكويكب! خسرت %d بلورة" % lost)
		_update_stats_bar()
	else:
		toast("🛡 الدرع امتص الصدمة!")

func _on_artifact_collected(artifact_id: String) -> void:
	save.add_artifact(artifact_id)
	save.save_game()
	var p := GameData.planet_by_id(String(current_planet["id"]))
	toast("🏺 وجدت القطعة الأثرية: %s!" % String(p["artifact"]["name"]), 3.5)
	_check_achievements()
	_update_stats_bar()
	_update_surface_hud()

func _on_crystal_collected(amount: int) -> void:
	_update_stats_bar()
	_check_achievements()

func _on_fuel_collected(amount: int) -> void:
	_update_stats_bar()
	toast("⛽ وقود +%d" % amount, 1.5)

func _on_rare_found(rare_id: String) -> void:
	if save.record_rare(rare_id):
		var gained := save.add_crystals(GameData.RARE_BONUS)
		save.save_game()
		var p := GameData.planet_by_id(String(current_planet["id"]))
		toast("✨ وجدت المخلوق النادر: %s! +%d 💎" % [String(p["rare"]["name"]), gained], 3.5)
		_update_stats_bar()
		_check_achievements()

func _on_player_hit(lost: int) -> void:
	if lost > 0:
		toast("👾 هاجمك مخلوق! خسرت %d بلورة" % lost)
		_update_stats_bar()
	else:
		toast("👾 هاجمك مخلوق!")

func _on_zapped(count: int) -> void:
	if count > 0:
		toast("⚡ صعقت %d مخلوقات!" % count)
		_check_achievements()
	else:
		toast("⚡ لا مخلوقات قريبة")

# ---------------- الإنجازات ----------------

func _check_achievements() -> void:
	var unlocked: Array[String] = []
	var d := save.data
	if int(d["stats"]["landings"]) >= 1:
		unlocked.append("first_landing")
	if (d["discovered_planets"] as Array).size() >= 3:
		unlocked.append("explorer_3")
	if (d["discovered_planets"] as Array).size() >= 9:
		unlocked.append("explorer_all")
	if (d["artifacts"] as Array).size() >= 5:
		unlocked.append("artifacts_5")
	if (d["artifacts"] as Array).size() >= 9:
		unlocked.append("artifacts_all")
	if int(d["crystals_total"]) >= 1000:
		unlocked.append("crystals_1000")
	if int(d["crystals"]) >= 500:
		unlocked.append("rich_500")
	if int(d["stats"]["zaps"]) >= 10:
		unlocked.append("zapper_10")
	if "darkstar" in (d["discovered_planets"] as Array):
		unlocked.append("dark_star")
	if int(d["stats"]["trips"]) >= 10:
		unlocked.append("traveler_10")
	var any_new := false
	for aid in unlocked:
		if save.unlock_achievement(aid):
			any_new = true
			var a := {}
			for item in GameData.ACHIEVEMENTS:
				if String(item["id"]) == aid:
					a = item
			if not a.is_empty():
				toast("🏆 إنجاز جديد: %s!" % String(a["name"]), 3.0)
	if any_new:
		audio.play("achievement")
		save.save_game()

# ---------------- اختبار دخان (headless فقط: --smoke) ----------------

func _run_smoke_test() -> void:
	print("[SMOKE] بدء اختبار الدخان")
	await get_tree().process_frame
	await get_tree().process_frame
	var failures := 0
	# 1) الطيران إلى رمّال والهبوط
	var p := GameData.planet_by_id("ramman")
	_start_flight(p)
	var steps := 0
	while flight_world != null and not flight_world.finished and steps < 3000:
		var dist := flight_world.distance_to_target()
		var spd := flight_world.speed()
		flight_world.set_joystick(Vector2.ZERO)
		flight_world.set_thrust(not (dist < 45.0 and spd > 12.0))
		flight_world.step(1.0 / 60.0)
		steps += 1
		if steps % 120 == 0:
			await get_tree().process_frame
	if surface_world == null:
		print("[SMOKE] FAIL: لم يتم الهبوط على رمّال بعد %d خطوة" % steps)
		failures += 1
	else:
		print("[SMOKE] OK: هبوط بعد %d خطوة، الوقود المتبقي %d" % [steps, int(save.data["fuel"])])
	# 2) جمع بلورة بالانتقال إليها
	if surface_world != null:
		var target_crystal: Dictionary = {}
		for c in surface_world._crystals:
			if not bool(c["taken"]):
				target_crystal = c
				break
		if not target_crystal.is_empty():
			var node: Node3D = target_crystal["node"]
			surface_world._player.position = Vector3(node.position.x, surface_world.ground_height(node.position.x, node.position.z), node.position.z)
			var before := int(save.data["crystals"])
			for i in 5:
				surface_world.step(1.0 / 60.0)
			if int(save.data["crystals"]) > before:
				print("[SMOKE] OK: جمع بلورة (+%d)" % (int(save.data["crystals"]) - before))
			else:
				print("[SMOKE] FAIL: لم تُجمع البلورة")
				failures += 1
		# 3) جمع القطعة الأثرية بالانتقال إلى الكهف
		surface_world._player.position = Vector3(surface_world.cave_pos.x, surface_world.ground_height(surface_world.cave_pos.x, surface_world.cave_pos.z), surface_world.cave_pos.z)
		for i in 5:
			surface_world.step(1.0 / 60.0)
		if save.has_artifact("heart_sand"):
			print("[SMOKE] OK: جمع القطعة الأثرية قلب الرمال")
		else:
			print("[SMOKE] FAIL: لم تُجمع القطعة الأثرية")
			failures += 1
		# 4) صعق
		surface_world.zap()
		print("[SMOKE] OK: الصعق يعمل (cooldown=%.1f)" % surface_world.zap_cooldown())
		# 5) العودة للخريطة
		_on_return_to_ship()
		if state == State.MAP:
			print("[SMOKE] OK: عودة إلى الخريطة")
		else:
			print("[SMOKE] FAIL: لم نعد إلى الخريطة")
			failures += 1
		# 5-ب) محاكاة لمس كوكب على الخريطة (اختبار انحدار: النقر كان
		# يبتلعه Root قبل أن يصل إلى _unhandled_input)
		if state == State.MAP and map_world != null:
			# إطار أو اثنان حتى تتموضع الكاميرا (تدور في _process)
			await get_tree().process_frame
			await get_tree().process_frame
			if root_control.mouse_filter != Control.MOUSE_FILTER_IGNORE:
				print("[SMOKE] FAIL: root_control يبتلع النقرات (mouse_filter ليس IGNORE)")
				failures += 1
			else:
				var tap_pos := map_world.screen_pos_of_planet("ramman")
				var ev := InputEventMouseButton.new()
				ev.position = tap_pos
				ev.button_index = MOUSE_BUTTON_LEFT
				ev.pressed = true
				map_world._unhandled_input(ev)
				if String(selected_planet.get("id", "")) == "ramman" and map_info_panel.visible:
					print("[SMOKE] OK: لمس كوكب رمّال يفتح لوحة معلوماته")
				else:
					print("[SMOKE] FAIL: لمس كوكب رمّال لم يختر الكوكب")
					failures += 1
	# 6) حفظ/تحميل
	var crystals_now := int(save.data["crystals"])
	save.save_game()
	var reloaded := SaveData.load_game()
	if int(reloaded.data["crystals"]) == crystals_now and reloaded.has_artifact("heart_sand"):
		print("[SMOKE] OK: حفظ/تحميل سليم (بلورات=%d)" % crystals_now)
	else:
		print("[SMOKE] FAIL: الحفظ/التحميل غير متطابق")
		failures += 1
	if failures == 0:
		print("[SMOKE] PASS — كل الاختبارات نجحت")
	else:
		print("[SMOKE] FAIL — %d أخطاء" % failures)
	get_tree().quit(0 if failures == 0 else 1)

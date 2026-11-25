extends RefCounted
class_name SaveData

# حفظ اللعبة في user://save.json (JSON نصي). حفظ تلقائي عند الأحداث المهمة.

const SAVE_PATH := "user://save.json"

var data: Dictionary = {}

static func default_data() -> Dictionary:
	return {
		"version": 1,
		"crystals": 0,
		"crystals_total": 0,
		"fuel": 100,
		"upgrades": {"engine": 1, "tank": 1, "storage": 1, "scanner": 0, "shield": 0},
		"discovered_planets": [],
		"artifacts": [],
		"creatures": [],
		"rare_creatures": [],
		"achievements": [],
		"stats": {"trips": 0, "zaps": 0, "landings": 0},
		"muted": false,
	}

static func load_game() -> SaveData:
	var s := SaveData.new()
	s.data = default_data()
	if FileAccess.file_exists(SAVE_PATH):
		var f := FileAccess.open(SAVE_PATH, FileAccess.READ)
		if f != null:
			var parsed = JSON.parse_string(f.get_as_text())
			if parsed is Dictionary:
				_merge_into(s.data, parsed)
	return s

static func _merge_into(dst: Dictionary, src: Dictionary) -> void:
	for k in src.keys():
		if dst.has(k):
			if dst[k] is Dictionary and src[k] is Dictionary:
				_merge_into(dst[k], src[k])
			else:
				dst[k] = src[k]

func save_game() -> void:
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f != null:
		f.store_string(JSON.stringify(data))
		f.close()

func erase() -> void:
	data = default_data()
	if FileAccess.file_exists(SAVE_PATH):
		DirAccess.remove_absolute(SAVE_PATH)

func add_crystals(amount: int) -> int:
	var cap: int = GameData.crystal_cap_for_level(int(data["upgrades"]["storage"]))
	var new_val: int = mini(int(data["crystals"]) + amount, cap)
	var gained: int = new_val - int(data["crystals"])
	data["crystals"] = new_val
	data["crystals_total"] = int(data["crystals_total"]) + gained
	return gained

func spend_crystals(amount: int) -> bool:
	if int(data["crystals"]) < amount:
		return false
	data["crystals"] = int(data["crystals"]) - amount
	return true

func add_fuel(amount: int) -> int:
	var cap: int = GameData.fuel_max_for_level(int(data["upgrades"]["tank"]))
	var new_val: int = mini(int(data["fuel"]) + amount, cap)
	var gained: int = new_val - int(data["fuel"])
	data["fuel"] = new_val
	return gained

func set_fuel(value: int) -> void:
	data["fuel"] = maxi(0, mini(value, GameData.fuel_max_for_level(int(data["upgrades"]["tank"]))))

func has_artifact(artifact_id: String) -> bool:
	return artifact_id in (data["artifacts"] as Array)

func add_artifact(artifact_id: String) -> bool:
	if artifact_id in (data["artifacts"] as Array):
		return false
	(data["artifacts"] as Array).append(artifact_id)
	return true

func discover_planet(planet_id: String) -> bool:
	if planet_id in (data["discovered_planets"] as Array):
		return false
	(data["discovered_planets"] as Array).append(planet_id)
	return true

func record_creature(creature_id: String) -> bool:
	if creature_id in (data["creatures"] as Array):
		return false
	(data["creatures"] as Array).append(creature_id)
	return true

func record_rare(rare_id: String) -> bool:
	if rare_id in (data["rare_creatures"] as Array):
		return false
	(data["rare_creatures"] as Array).append(rare_id)
	return true

func unlock_achievement(achievement_id: String) -> bool:
	if achievement_id in (data["achievements"] as Array):
		return false
	(data["achievements"] as Array).append(achievement_id)
	return true

func bump_stat(key: String, amount: int = 1) -> void:
	data["stats"][key] = int(data["stats"][key]) + amount

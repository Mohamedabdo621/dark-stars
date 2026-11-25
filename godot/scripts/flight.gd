extends Node3D
class_name Flight

# طيران ثلاثي الأبعاد: دفع بقصور ذاتي، توجيه، كويكبات، وقود، هبوط.
# فيزياء مخصصة (بدون محرك فيزياء) لتكون قابلة للاختبار بدون إطار.

signal landed
signal returned_out_of_fuel
signal asteroid_hit(crystals_lost: int)
signal too_fast

var save: SaveData
var audio: AudioManager
var planet: Dictionary = {}
var target_dist: float = 100.0
var planet_radius: float = 8.0
var fuel: float = 100.0
var finished: bool = false

var _ship: Node3D
var _flame: Node3D
var _velocity: Vector3 = Vector3.ZERO
var _yaw: float = 0.0
var _pitch: float = 0.0
var _joy: Vector2 = Vector2.ZERO
var _thrust: bool = false
var _dest: Vector3 = Vector3.ZERO
var _asteroids: Array = [] # {node, radius, drift, spin, active}
var _invuln: float = 0.0
var _shake: float = 0.0
var _cam: Camera3D
var _time: float = 0.0

func setup(planet_dict: Dictionary, save_data: SaveData, audio_mgr: AudioManager) -> void:
	save = save_data
	audio = audio_mgr
	planet = planet_dict
	target_dist = GameData.flight_world_dist(planet)
	fuel = float(save.data["fuel"])
	# بيئة
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.01, 0.0, 0.03)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.4, 0.3, 0.6)
	e.ambient_light_energy = 0.8
	env.environment = e
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.light_energy = 1.2
	sun.rotation_degrees = Vector3(-35, -20, 0)
	add_child(sun)
	# نجوم
	add_child(Builders.starfield(500, 90.0, 220.0, 777))
	# السفينة
	_ship = Builders.ship()
	add_child(_ship)
	_flame = _ship.get_node("Flame")
	_flame.visible = false
	# كوكب الوجهة
	_dest = Vector3(0, 0, -target_dist)
	var dest_node := Builders.planet_mesh(planet_radius, planet["color"], planet["color2"], 42, String(planet["id"]) in ["ghayum", "ballor"])
	dest_node.position = _dest
	add_child(dest_node)
	# كويكبات
	var rng := RandomNumberGenerator.new()
	rng.seed = int(planet["flight_dist"]) + 5
	var count := 12 + int(planet["zone"]) * 2
	for i in count:
		var ast := Builders.asteroid(rng.randi())
		var pos := Vector3(
			rng.randf_range(-30.0, 30.0),
			rng.randf_range(-14.0, 14.0),
			rng.randf_range(-30.0, -(target_dist - 15.0))
		)
		ast.position = pos
		add_child(ast)
		_asteroids.append({
			"node": ast,
			"radius": maxf(ast.scale.x, ast.scale.z) * 1.0,
			"drift": Vector3(rng.randf_range(-1.5, 1.5), rng.randf_range(-0.8, 0.8), rng.randf_range(-1.0, 1.0)),
			"spin": Vector3(rng.randf_range(-0.6, 0.6), rng.randf_range(-0.6, 0.6), rng.randf_range(-0.6, 0.6)),
			"active": true,
		})
	# كاميرا ملاحقة
	_cam = Camera3D.new()
	_cam.fov = 62.0
	add_child(_cam)
	_cam.make_current()
	_update_camera(0.0)

func set_joystick(v: Vector2) -> void:
	_joy = v

func set_thrust(value: bool) -> void:
	_thrust = value

func speed() -> float:
	return _velocity.length()

func distance_to_target() -> float:
	return _ship.position.distance_to(_dest)

func _process(delta: float) -> void:
	if finished:
		return
	_time += delta
	step(delta)
	_update_camera(delta)

func step(delta: float) -> void:
	if finished:
		return
	_invuln = maxf(0.0, _invuln - delta)
	_shake = maxf(0.0, _shake - delta * 1.5)
	# توجيه
	_yaw -= _joy.x * 1.7 * delta
	_pitch = clampf(_pitch + _joy.y * 0.9 * delta, -0.45, 0.45)
	var roll := -_joy.x * 0.35
	_ship.rotation = Vector3(_pitch, _yaw, roll)
	var fwd := -_ship.global_transform.basis.z
	var max_speed := GameData.max_speed_for_engine(int(save.data["upgrades"]["engine"]))
	# دفع
	if _thrust and fuel > 0.0:
		_velocity += fwd * 32.0 * delta
		fuel = maxf(0.0, fuel - GameData.FUEL_DRAIN_PER_SEC * delta)
		_flame.visible = true
		_flame.scale = Vector3.ONE * (0.8 + 0.7 * clampf(_velocity.length() / max_speed, 0.0, 1.0))
		if audio != null:
			audio.start_engine()
			audio.set_engine_level(clampf(_velocity.length() / max_speed, 0.0, 1.0))
	else:
		_flame.visible = false
		if audio != null:
			audio.stop_engine()
	# مقاومة خفيفة (قصور ذاتي)
	_velocity *= (1.0 - 0.10 * delta)
	if _velocity.length() > max_speed:
		_velocity = _velocity.normalized() * max_speed
	_ship.position += _velocity * delta
	# حدود جانبية ناعمة: أعد التوجيه نحو الهدف إذا ابتعدت كثيراً
	if absf(_ship.position.x) > 55.0 or absf(_ship.position.y) > 35.0:
		_ship.position.x = clampf(_ship.position.x, -55.0, 55.0)
		_ship.position.y = clampf(_ship.position.y, -35.0, 35.0)
	# كويكبات: حركة وتصادم
	for a in _asteroids:
		if not bool(a["active"]):
			continue
		var node: Node3D = a["node"]
		node.position += (a["drift"] as Vector3) * delta
		node.rotation += (a["spin"] as Vector3) * delta
		var d := node.position.distance_to(_ship.position)
		if d < float(a["radius"]) + 1.6 and _invuln <= 0.0:
			_hit_asteroid(a)
	# هبوط أو نفاد وقود
	var dist := distance_to_target()
	# مساعدة هبوط: كبح تلقائي قرب الكوكب حتى لا يصطدم اللاعب بسرعة عالية
	if dist < 30.0 and _velocity.length() > 14.0:
		_velocity *= (1.0 - 0.9 * delta)
	if dist < planet_radius + 7.0:
		if _velocity.length() < 14.0:
			finished = true
			if audio != null:
				audio.stop_engine()
				audio.play("land")
			landed.emit()
		else:
			var away := (_ship.position - _dest).normalized()
			_velocity = away * 12.0 + _velocity * 0.2
			_shake = 0.7
			too_fast.emit()
			_invuln = 1.0
	elif fuel <= 0.0:
		finished = true
		if audio != null:
			audio.stop_engine()
		returned_out_of_fuel.emit()

func _hit_asteroid(a: Dictionary) -> void:
	a["active"] = false
	(a["node"] as Node3D).hide()
	_invuln = 1.0
	_shake = 1.0
	var shield: int = int(save.data["upgrades"]["shield"])
	var lost := 0
	if shield >= 2:
		lost = 0
	elif shield == 1:
		lost = 5
	else:
		lost = 15
		_velocity *= 0.4
	if audio != null:
		audio.play("hit")
	asteroid_hit.emit(lost)

func _update_camera(delta: float) -> void:
	if _cam == null or _ship == null:
		return
	var basis := _ship.global_transform.basis
	var target_pos := _ship.position + basis * Vector3(0, 5.5, 11.0)
	if delta <= 0.0:
		_cam.position = target_pos
	else:
		_cam.position = _cam.position.lerp(target_pos, minf(1.0, delta * 6.0))
	var look := _ship.position + (-basis.z) * 8.0
	var shake_offset := Vector3.ZERO
	if _shake > 0.0:
		shake_offset = Vector3(randf_range(-1, 1), randf_range(-1, 1), randf_range(-1, 1)) * _shake * 0.5
	_cam.look_at(look + shake_offset, Vector3.UP)

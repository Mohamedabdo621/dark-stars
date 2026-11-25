extends Node3D
class_name Surface

# سطح الكوكب ثلاثي الأبعاد: مشي، جمع بلورات ووقود، كهف فيه قطعة أثرية،
# مخلوقات تطاردك، صعق، مخلوق نادر هارب. حركة مخصصة بدون محرك فيزياء.

signal artifact_collected(artifact_id: String)
signal crystal_collected(amount: int)
signal fuel_collected(amount: int)
signal rare_found(rare_id: String)
signal player_hit(crystals_lost: int)
signal zapped(count: int)

var save: SaveData
var audio: AudioManager
var planet: Dictionary = {}
var amp: float = 3.5
var cave_pos: Vector3 = Vector3.ZERO
var artifact_found: bool = false

var _noise: FastNoiseLite
var _flats: Array = []
var _player: Node3D
var _cam: Camera3D
var _joy: Vector2 = Vector2.ZERO
var _cam_yaw: float = 0.0
var _player_yaw: float = 0.0
var _crystals: Array = []
var _fuel_nodes: Array = []
var _creatures: Array = []
var _artifact_node: Node3D
var _beacon: MeshInstance3D
var _zap_cooldown: float = 0.0
var _player_stun: float = 0.0
var _time: float = 0.0
var _shake: float = 0.0
var _rng: RandomNumberGenerator

func setup(planet_dict: Dictionary, save_data: SaveData, audio_mgr: AudioManager) -> void:
	save = save_data
	audio = audio_mgr
	planet = planet_dict
	_rng = RandomNumberGenerator.new()
	_rng.seed = absf(int(planet["flight_dist"]) * 7919 + 13)
	_noise = FastNoiseLite.new()
	_noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	_noise.frequency = 1.0
	_noise.fractal_octaves = 3
	# الكهف: اتجاه ثابت من بصمة الكوكب، على بعد 30 وحدة
	var cave_angle := deg_to_rad(float(int(planet["flight_dist"]) % 360))
	cave_pos = Vector3(cos(cave_angle) * 30.0, 0, sin(cave_angle) * 30.0)
	_flats = [Vector3(0, 0, 9.0), Vector3(cave_pos.x, cave_pos.z, 7.0)]
	# سماء وبيئة
	var env := WorldEnvironment.new()
	var e := Environment.new()
	var sky := Sky.new()
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.03, 0.01, 0.09)
	sky_mat.sky_horizon_color = (planet["color"] as Color).darkened(0.55)
	sky_mat.sky_curve = 0.12
	sky_mat.ground_bottom_color = Color(0.01, 0.0, 0.02)
	sky_mat.ground_horizon_color = (planet["color"] as Color).darkened(0.7)
	sky_mat.sun_angle_max = 25.0
	sky.sky_material = sky_mat
	e.background_mode = Environment.BG_SKY
	e.sky = sky
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = (planet["color"] as Color).lightened(0.1)
	e.ambient_light_energy = 0.75
	env.environment = e
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.light_energy = 1.1
	sun.light_color = Color(1.0, 0.95, 0.85)
	sun.rotation_degrees = Vector3(-50, -40, 0)
	add_child(sun)
	# تضاريس
	var terrain := Builders.terrain_mesh(_noise, 140.0, 48, amp, planet["color"], _flats)
	add_child(terrain)
	# نجوم خافتة في السماء (فوق الأفق)
	add_child(Builders.starfield(220, 90.0, 160.0, 55))
	# منصة الهبوط (حلقة مضيئة)
	var pad := TorusMesh.new()
	pad.inner_radius = 2.2
	pad.outer_radius = 2.7
	pad.rings = 32
	pad.ring_segments = 6
	var pad_mi := MeshInstance3D.new()
	pad_mi.mesh = pad
	pad_mi.set_surface_override_material(0, Builders.mat(Color(0.66, 0.33, 0.97), 0.0, 1.0, Color(0.66, 0.33, 0.97), 1.5))
	pad_mi.rotation_degrees.x = 90.0
	pad_mi.position = Vector3(0, ground_height(0, 0) + 0.15, 0)
	add_child(pad_mi)
	# صخور متناثرة
	for i in 14:
		var rock := Builders.rock((planet["color2"] as Color), _rng.randf_range(0.8, 2.2), _rng.randi())
		var rp := _random_ground_pos(12.0, 52.0)
		rock.position = Vector3(rp.x, ground_height(rp.x, rp.y) + 0.3, rp.y)
		add_child(rock)
	# بلورات
	for i in 14:
		var node := Builders.crystal(planet["color"], 0.55)
		var cp := _random_ground_pos(8.0, 48.0)
		node.position = Vector3(cp.x, ground_height(cp.x, cp.y) + 0.7, cp.y)
		add_child(node)
		_crystals.append({"node": node, "base_y": node.position.y, "taken": false, "phase": _rng.randf() * TAU})
	# عقد وقود
	for i in 5:
		var node := Builders.fuel_node()
		var fp := _random_ground_pos(10.0, 45.0)
		node.position = Vector3(fp.x, ground_height(fp.x, fp.y), fp.y)
		add_child(node)
		_fuel_nodes.append({"node": node, "taken": false})
	# الكهف + القطعة الأثرية
	var cave := Builders.cave_arch(planet["color2"])
	add_child(cave)
	cave.position = Vector3(cave_pos.x, ground_height(cave_pos.x, cave_pos.z), cave_pos.z)
	cave.look_at(Vector3.ZERO, Vector3.UP)
	_artifact_node = Builders.crystal(Color(0.98, 0.75, 0.14), 1.1)
	_artifact_node.position = Vector3(cave_pos.x, ground_height(cave_pos.x, cave_pos.z) + 1.4, cave_pos.z)
	add_child(_artifact_node)
	if int(save.data["upgrades"]["scanner"]) >= 2:
		_beacon = Builders.beacon(Color(0.98, 0.75, 0.14))
		_beacon.position = Vector3(cave_pos.x, ground_height(cave_pos.x, cave_pos.z), cave_pos.z)
		add_child(_beacon)
	# مخلوقات عادية
	for i in 3:
		var c := Builders.creature((planet["creature"]["color"] as Color), 1.0, _rng.randi())
		var pos := _random_ground_pos(15.0, 42.0)
		c.position = Vector3(pos.x, ground_height(pos.x, pos.y), pos.y)
		add_child(c)
		var star := Builders.crystal(Color(0.98, 0.75, 0.14), 0.35)
		star.position = Vector3(0, 2.2, 0)
		star.visible = false
		c.add_child(star)
		_creatures.append({
			"node": c, "kind": "normal", "state": "wander",
			"target": _random_ground_pos(10.0, 45.0),
			"stun": 0.0, "speed": float(planet["creature"]["speed"]) / 25.0,
			"retreat": 0.0, "star": star, "phase": _rng.randf() * TAU,
		})
	# مخلوق نادر ذهبي
	var rare := Builders.creature((planet["rare"]["color"] as Color), 0.9, _rng.randi())
	var rpos := _random_ground_pos(20.0, 45.0)
	rare.position = Vector3(rpos.x, ground_height(rpos.x, rpos.y), rpos.y)
	add_child(rare)
	_creatures.append({
		"node": rare, "kind": "rare", "state": "wander",
		"target": _random_ground_pos(10.0, 45.0),
		"stun": 0.0, "speed": 3.0, "retreat": 0.0, "star": null, "phase": 0.0,
	})
	# اللاعب
	_player = Node3D.new()
	_player.name = "Player"
	var suit := Builders.cylinder(0.45, 0.45, 1.5, Builders.mat(Color(0.66, 0.33, 0.97), 0.3, 0.6), 12)
	suit.position = Vector3(0, 0.95, 0)
	_player.add_child(suit)
	var visor := Builders.sphere(0.3, Builders.mat(Color(0.98, 0.75, 0.14), 0.7, 0.2, Color(0.98, 0.75, 0.14), 1.2), 10, 8)
	visor.position = Vector3(0, 1.45, -0.35)
	_player.add_child(visor)
	_player.position = Vector3(0, ground_height(0, 0), 0)
	add_child(_player)
	# كاميرا خلفية
	_cam = Camera3D.new()
	_cam.fov = 60.0
	add_child(_cam)
	_cam.make_current()
	_update_camera(0.0)

func ground_height(x: float, z: float) -> float:
	var h := _noise.get_noise_2d(x * 0.045, z * 0.045) * amp
	for f in _flats:
		var d := Vector2(x, z).distance_to(Vector2(f.x, f.y))
		h = lerpf(0.0, h, clampf(d / f.z, 0.0, 1.0))
	return h

func set_joystick(v: Vector2) -> void:
	_joy = v

func zap_cooldown() -> float:
	return _zap_cooldown

func _random_ground_pos(min_r: float, max_r: float) -> Vector2:
	var a := _rng.randf() * TAU
	var r := _rng.randf_range(min_r, max_r)
	return Vector2(cos(a) * r, sin(a) * r)

func _process(delta: float) -> void:
	_time += delta
	step(delta)
	_update_camera(delta)

func step(delta: float) -> void:
	_zap_cooldown = maxf(0.0, _zap_cooldown - delta)
	_player_stun = maxf(0.0, _player_stun - delta)
	_shake = maxf(0.0, _shake - delta * 1.5)
	# حركة اللاعب (اتفاق: y الموجب = للأمام؛ العصا/لوحة المفاتيح تُدمجان في main)
	var move := _joy
	if _player_stun <= 0.0 and move.length() > 0.05:
		var cam_basis := Basis(Vector3.UP, _cam_yaw)
		# للأمام في الشاشة = بعيداً عن الكاميرا = -Z في أساس الكاميرا
		var dir := (cam_basis * Vector3(move.x, 0, -move.y)).normalized()
		var speed := 7.0
		_player.position += dir * speed * delta
		_player.position.x = clampf(_player.position.x, -55.0, 55.0)
		_player.position.z = clampf(_player.position.z, -55.0, 55.0)
		var target_yaw := atan2(dir.x, dir.z)
		_player_yaw = lerp_angle(_player_yaw, target_yaw, minf(1.0, delta * 10.0))
		_player.rotation.y = _player_yaw
		_cam_yaw = lerp_angle(_cam_yaw, _player_yaw, minf(1.0, delta * 2.0))
	_player.position.y = ground_height(_player.position.x, _player.position.z)
	# بلورات: دوران + جمع
	for c in _crystals:
		if bool(c["taken"]):
			continue
		var node: Node3D = c["node"]
		node.rotation.y += delta * 1.5
		node.position.y = float(c["base_y"]) + sin(_time * 2.0 + float(c["phase"])) * 0.15
		if node.position.distance_to(_player.position + Vector3(0, 0.9, 0)) < 1.9:
			c["taken"] = true
			node.hide()
			var gained: int = save.add_crystals(GameData.CRYSTAL_VALUE)
			if audio != null:
				audio.play("collect")
			crystal_collected.emit(gained)
	# عقد وقود
	for n in _fuel_nodes:
		if bool(n["taken"]):
			continue
		var node: Node3D = n["node"]
		if node.position.distance_to(_player.position + Vector3(0, 0.9, 0)) < 1.9:
			n["taken"] = true
			node.hide()
			var gained: int = save.add_fuel(GameData.FUEL_NODE_VALUE)
			if audio != null:
				audio.play("collect")
			fuel_collected.emit(gained)
	# قطعة أثرية
	if not artifact_found and _artifact_node != null:
		_artifact_node.rotation.y += delta * 1.2
		_artifact_node.position.y = ground_height(cave_pos.x, cave_pos.z) + 1.4 + sin(_time * 1.5) * 0.2
		if _artifact_node.position.distance_to(_player.position + Vector3(0, 0.9, 0)) < 2.4:
			artifact_found = true
			_artifact_node.hide()
			if _beacon != null:
				_beacon.hide()
			if audio != null:
				audio.play("artifact")
			artifact_collected.emit(String(planet["artifact"]["id"]))
	# مخلوقات
	for cr in _creatures:
		_update_creature(cr, delta)

func _update_creature(cr: Dictionary, delta: float) -> void:
	var node: Node3D = cr["node"]
	var state: String = cr["state"]
	var speed: float = cr["speed"]
	if float(cr["stun"]) > 0.0:
		cr["stun"] = float(cr["stun"]) - delta
		if cr["star"] != null:
			(cr["star"] as Node3D).visible = true
			(cr["star"] as Node3D).rotation.y += delta * 4.0
		return
	if cr["star"] != null:
		(cr["star"] as Node3D).visible = false
	var to_player := _player.position - node.position
	to_player.y = 0.0
	var dist := to_player.length()
	if String(cr["kind"]) == "rare":
		if dist < 6.0 and dist > 0.01:
			# يهرب من اللاعب
			var flee := -to_player.normalized()
			node.position += flee * 5.0 * delta
			node.rotation.y = atan2(flee.x, flee.z)
		else:
			_wander(cr, delta, 2.5)
		if dist < 1.7:
			# اكتشاف المخلوق النادر
			cr["state"] = "done"
			node.hide()
			if audio != null:
				audio.play("achievement")
			rare_found.emit(String(planet["rare"]["id"]))
		node.position.y = ground_height(node.position.x, node.position.z)
		return
	# مخلوق عادي
	if state == "retreat":
		cr["retreat"] = float(cr["retreat"]) - delta
		var away := -to_player.normalized() if dist > 0.01 else Vector3.FORWARD
		node.position += away * speed * delta
		node.rotation.y = atan2(away.x, away.z)
		if float(cr["retreat"]) <= 0.0:
			cr["state"] = "wander"
	elif dist < 9.0 and _player_stun <= 0.0:
		# مطاردة
		var chase := to_player.normalized()
		node.position += chase * speed * delta
		node.rotation.y = atan2(chase.x, chase.z)
		if dist < 1.5:
			var lost := mini(10, int(save.data["crystals"]))
			save.data["crystals"] = int(save.data["crystals"]) - lost
			_player_stun = 1.5
			_shake = 0.8
			cr["state"] = "retreat"
			cr["retreat"] = 3.0
			if audio != null:
				audio.play("hit")
			player_hit.emit(lost)
	else:
		_wander(cr, delta, 2.0)
	node.position.y = ground_height(node.position.x, node.position.z)

func _wander(cr: Dictionary, delta: float, speed: float) -> void:
	var node: Node3D = cr["node"]
	var target: Vector2 = cr["target"]
	var to := Vector3(target.x, 0, target.y) - node.position
	to.y = 0.0
	if to.length() < 1.5:
		cr["target"] = _random_ground_pos(10.0, 45.0)
		return
	var dir := to.normalized()
	node.position += dir * speed * delta
	node.rotation.y = atan2(dir.x, dir.z)

func zap() -> void:
	if _zap_cooldown > 0.0:
		return
	_zap_cooldown = 4.0
	var count := 0
	for cr in _creatures:
		if String(cr["state"]) == "done":
			continue
		var node: Node3D = cr["node"]
		if node.position.distance_to(_player.position) < 6.5:
			cr["stun"] = 4.0
			cr["state"] = "wander"
			count += 1
	if count > 0:
		save.bump_stat("zaps", count)
		if audio != null:
			audio.play("zap")
		zapped.emit(count)

func _update_camera(delta: float) -> void:
	if _cam == null or _player == null:
		return
	var offset := Vector3(sin(_cam_yaw), 0, cos(_cam_yaw)) * 9.0 + Vector3(0, 4.6, 0)
	var target_pos := _player.position + offset
	if delta <= 0.0:
		_cam.position = target_pos
	else:
		_cam.position = _cam.position.lerp(target_pos, minf(1.0, delta * 5.0))
	var look := _player.position + Vector3(0, 1.4, 0)
	var shake_offset := Vector3.ZERO
	if _shake > 0.0:
		shake_offset = Vector3(randf_range(-1, 1), randf_range(-1, 1), 0) * _shake * 0.35
	_cam.look_at(look + shake_offset, Vector3.UP)

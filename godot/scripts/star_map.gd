extends Node3D
class_name StarMap

# خريطة النجوم ثلاثية الأبعاد: الوطن في المركز، والكواكب في 3 حلقات (مناطق).
# اختيار كوكب بالنقر/اللمس (حساب شعاع من الكاميرا بدون فيزياء).

signal planet_selected(planet: Dictionary)

var save: SaveData
var planet_nodes: Dictionary = {}
var planet_radius: Dictionary = {}
var _cam: Camera3D
var _orbit_time: float = 0.0
var _group: Node3D
var _ship: Node3D

const ZONE_RADIUS := {1: 16.0, 2: 26.0, 3: 36.0}
const ZONE_ANGLES := {
	1: [20.0, 140.0, 260.0],
	2: [60.0, 180.0, 300.0],
	3: [100.0, 220.0, 340.0],
}

func build(save_data: SaveData) -> void:
	save = save_data
	for c in get_children():
		c.queue_free()
	planet_nodes.clear()
	planet_radius.clear()
	_group = Node3D.new()
	_group.name = "MapGroup"
	add_child(_group)
	# بيئة فضاء
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.027, 0.004, 0.051)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.35, 0.25, 0.55)
	e.ambient_light_energy = 0.9
	env.environment = e
	_group.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.light_energy = 1.1
	sun.rotation_degrees = Vector3(-45, -30, 0)
	_group.add_child(sun)
	# نجوم خلفية
	_group.add_child(Builders.starfield(420, 70.0, 150.0, 1234))
	# حلقات المناطق
	for zone in [1, 2, 3]:
		var torus := TorusMesh.new()
		var r: float = ZONE_RADIUS[zone]
		torus.inner_radius = r - 0.18
		torus.outer_radius = r + 0.18
		torus.rings = 72
		torus.ring_segments = 6
		var ring := MeshInstance3D.new()
		ring.mesh = torus
		ring.set_surface_override_material(0, Builders.mat(Color(0.66, 0.33, 0.97), 0.0, 1.0, Color(0.66, 0.33, 0.97), 0.5, 0.3))
		ring.rotation_degrees.x = 90.0
		_group.add_child(ring)
	# الوطن
	var home := Builders.planet_mesh(3.5, Color(0.22, 0.74, 0.97), Color(0.01, 0.41, 0.63), 7)
	home.position = Vector3.ZERO
	_group.add_child(home)
	planet_nodes["home"] = home
	planet_radius["home"] = 3.5
	# سفينة اللاعب قرب الوطن — حتى تبدو الخريطة حيّة وفيها «شخصية»
	_ship = Builders.ship()
	_ship.position = Vector3(6.5, 1.2, 5.0)
	_ship.scale = Vector3.ONE * 0.7
	_ship.rotation_degrees = Vector3(0, -35, 0)
	_group.add_child(_ship)
	# الكواكب
	var zone_index := {1: 0, 2: 0, 3: 0}
	for p in GameData.PLANETS:
		var pid: String = p["id"]
		var zone: int = p["zone"]
		if bool(p.get("secret", false)):
			if not GameData.dark_star_requirements_met(save.data):
				continue
		var idx: int = zone_index[zone]
		zone_index[zone] = idx + 1
		var angle_deg: float = ZONE_ANGLES[zone][idx]
		var angle := deg_to_rad(angle_deg)
		var r: float = ZONE_RADIUS[zone]
		var pos := Vector3(cos(angle) * r, randf_range(-1.5, 1.5), sin(angle) * r)
		var locked := int(save.data["upgrades"]["engine"]) < GameData.zone_engine_req(zone)
		var radius := 2.0 if zone < 3 else 2.3
		var node: Node3D
		if locked:
			node = Builders.planet_mesh(radius, Color(0.15, 0.13, 0.18), Color(0.1, 0.09, 0.13), 100 + idx, false, true)
		else:
			var with_ring := pid in ["ghayum", "ballor"]
			node = Builders.planet_mesh(radius, p["color"], p["color2"], 100 + idx, with_ring)
		node.position = pos
		_group.add_child(node)
		planet_nodes[pid] = node
		planet_radius[pid] = radius
	# كاميرا تدور ببطء حول المركز
	_cam = Camera3D.new()
	_cam.fov = 55.0
	add_child(_cam)
	_cam.make_current()

func _process(delta: float) -> void:
	_orbit_time += delta
	if _cam != null:
		var a := _orbit_time * 0.045
		_cam.position = Vector3(sin(a) * 30.0, 25.0, cos(a) * 30.0)
		_cam.look_at(Vector3(0, 0, 0), Vector3.UP)
	# السفينة تطفو وتدور ببطء قرب الوطن
	if _ship != null:
		_ship.position.y = 1.2 + sin(_orbit_time * 1.2) * 0.35
		_ship.rotation.y += delta * 0.25
	# دوران بطيء للكواكب حول نفسها
	for pid in planet_nodes.keys():
		var node: Node3D = planet_nodes[pid]
		node.rotation.y += delta * 0.12

func _unhandled_input(event: InputEvent) -> void:
	var pos := Vector2.ZERO
	var clicked := false
	if event is InputEventScreenTouch:
		var t := event as InputEventScreenTouch
		if t.pressed:
			pos = t.position
			clicked = true
	elif event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.pressed and mb.button_index == MOUSE_BUTTON_LEFT:
			pos = mb.position
			clicked = true
	if not clicked or _cam == null:
		return
	var origin := _cam.project_ray_origin(pos)
	var dir := _cam.project_ray_normal(pos)
	var best_id := ""
	var best_t := 1e9
	for pid in planet_nodes.keys():
		var node: Node3D = planet_nodes[pid]
		var center: Vector3 = node.global_position
		var to := center - origin
		var t := to.dot(dir)
		if t < 0.0:
			continue
		var closest := origin + dir * t
		var d := closest.distance_to(center)
		var radius: float = planet_radius[pid]
		if d < radius * 2.0 and t < best_t:
			best_t = t
			best_id = pid
	if best_id != "":
		if best_id == "home":
			planet_selected.emit(GameData.HOME_PLANET)
		else:
			planet_selected.emit(GameData.planet_by_id(best_id))

func planet_position(pid: String) -> Vector3:
	if planet_nodes.has(pid):
		return (planet_nodes[pid] as Node3D).global_position
	return Vector3.ZERO

func screen_pos_of_planet(pid: String) -> Vector2:
	if _cam == null:
		return Vector2.ZERO
	return _cam.unproject_position(planet_position(pid))

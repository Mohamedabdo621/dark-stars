extends RefCounted
class_name Builders

# بناء كل المحتوى ثلاثي الأبعاد إجرائياً من أشكال Godot البدائية.
# لا توجد أي ملفات نماذج أو خامات خارجية — كل شيء بالكود.

static func mat(color: Color, metallic: float = 0.0, roughness: float = 0.85, emission: Color = Color(0, 0, 0), energy: float = 0.0, alpha: float = 1.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(color.r, color.g, color.b, alpha)
	m.metallic = metallic
	m.roughness = roughness
	if alpha < 1.0:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if energy > 0.0:
		m.emission_enabled = true
		m.emission = emission
		m.emission_energy_multiplier = energy
	return m

static func _mesh_instance(mesh: Mesh, material: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	if material != null:
		mi.set_surface_override_material(0, material)
	return mi

static func sphere(radius: float, material: Material, segments: int = 16, rings: int = 8) -> MeshInstance3D:
	var s := SphereMesh.new()
	s.radius = radius
	s.height = radius * 2.0
	s.radial_segments = segments
	s.rings = rings
	return _mesh_instance(s, material)

static func box(size: Vector3, material: Material) -> MeshInstance3D:
	var b := BoxMesh.new()
	b.size = size
	return _mesh_instance(b, material)

static func cylinder(top_r: float, bottom_r: float, height: float, material: Material, segments: int = 12) -> MeshInstance3D:
	var c := CylinderMesh.new()
	c.top_radius = top_r
	c.bottom_radius = bottom_r
	c.height = height
	c.radial_segments = segments
	return _mesh_instance(c, material)

static func starfield(count: int, radius_min: float, radius_max: float, seed_value: int) -> MultiMeshInstance3D:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	var s := SphereMesh.new()
	s.radius = 0.35
	s.height = 0.7
	s.radial_segments = 6
	s.rings = 3
	mm.mesh = s
	mm.instance_count = count
	var palette := [Color(1, 1, 1), Color(0.75, 0.85, 1), Color(0.85, 0.7, 1), Color(1, 0.85, 0.5)]
	for i in count:
		var dir := Vector3(rng.randf_range(-1.0, 1.0), rng.randf_range(-1.0, 1.0), rng.randf_range(-1.0, 1.0)).normalized()
		var dist := rng.randf_range(radius_min, radius_max)
		var pos := dir * dist
		var scale := rng.randf_range(0.5, 1.8)
		var t := Transform3D(Basis().scaled(Vector3.ONE * scale), pos)
		mm.set_instance_transform(i, t)
		mm.set_instance_color(i, palette[rng.randi_range(0, palette.size() - 1)])
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = mat(Color.WHITE, 0.0, 1.0, Color.WHITE, 0.6)
	return mmi

static func planet_mesh(radius: float, c1: Color, c2: Color, seed_value: int, with_ring: bool = false, dark: bool = false) -> Node3D:
	var root := Node3D.new()
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	var body_mat := mat(c1, 0.1, 0.9)
	if dark:
		body_mat = mat(Color(0.02, 0.01, 0.04), 0.3, 0.7, c2, 1.2)
	var body := sphere(radius, body_mat, 32, 16)
	root.add_child(body)
	# حفر (craters) — كرات داكنة صغيرة مدمجة في السطح
	var crater_mat := mat(c2.darkened(0.45), 0.0, 1.0)
	var crater_count := 8 if not dark else 5
	for i in crater_count:
		var dir := Vector3(rng.randf_range(-1.0, 1.0), rng.randf_range(-0.4, 1.0), rng.randf_range(-1.0, 1.0)).normalized()
		var crater := sphere(radius * rng.randf_range(0.08, 0.16), crater_mat, 8, 4)
		crater.position = dir * radius * 0.94
		crater.scale = Vector3(1.0, 0.45, 1.0)
		crater.rotation = Vector3(rng.randf(), rng.randf() * TAU, rng.randf())
		root.add_child(crater)
	# غلاف جوي
	var atmo := sphere(radius * 1.14, mat(c1, 0.0, 1.0, c1, 0.5, 0.16), 24, 12)
	root.add_child(atmo)
	# حلقة (لبعض الكواكب)
	if with_ring:
		var torus := TorusMesh.new()
		torus.inner_radius = radius * 1.45
		torus.outer_radius = radius * 1.95
		torus.rings = 48
		torus.ring_segments = 8
		var ring := _mesh_instance(torus, mat(c2, 0.4, 0.6, c2, 0.4, 0.55))
		ring.rotation = Vector3(deg_to_rad(72.0), 0.0, deg_to_rad(12.0))
		root.add_child(ring)
	return root

static func ship() -> Node3D:
	var root := Node3D.new()
	root.name = "Ship"
	var hull_mat := mat(Color(0.72, 0.65, 0.85), 0.65, 0.35)
	var accent_mat := mat(Color(0.66, 0.33, 0.97), 0.4, 0.4, Color(0.66, 0.33, 0.97), 0.8)
	var glass_mat := mat(Color(0.15, 0.08, 0.35), 0.9, 0.15)
	# جسم السفينة (أسطوانة على محور Z — الأمام هو -Z)
	var body := cylinder(0.35, 0.55, 2.4, hull_mat, 12)
	body.rotation_degrees.x = 90.0
	root.add_child(body)
	# مقدمة مخروطية
	var nose := cylinder(0.0, 0.35, 1.0, accent_mat, 12)
	nose.rotation_degrees.x = 90.0
	nose.position = Vector3(0, 0, -1.7)
	root.add_child(nose)
	# قمرة القيادة
	var cockpit := sphere(0.32, glass_mat, 12, 8)
	cockpit.scale = Vector3(1.0, 0.7, 1.5)
	cockpit.position = Vector3(0, 0.42, -0.55)
	root.add_child(cockpit)
	# جناحان
	var wing := box(Vector3(2.6, 0.08, 0.95), hull_mat)
	wing.position = Vector3(0, -0.08, 0.55)
	root.add_child(wing)
	# زعنفة ذيل عمودية
	var fin := box(Vector3(0.08, 0.95, 0.75), accent_mat)
	fin.position = Vector3(0, 0.5, 0.95)
	root.add_child(fin)
	# محركان
	var engine_mat := mat(Color(0.3, 0.3, 0.35), 0.7, 0.3, Color(1.0, 0.55, 0.1), 1.6)
	for sx in [-0.45, 0.45]:
		var eng := cylinder(0.22, 0.26, 0.5, engine_mat, 10)
		eng.rotation_degrees.x = 90.0
		eng.position = Vector3(sx, 0, 1.25)
		root.add_child(eng)
	# لهب المحرك (يُظهر/يُخفي ويتغير حجمه مع الدفع)
	var flame := cylinder(0.02, 0.3, 1.1, mat(Color(1.0, 0.6, 0.1), 0.0, 1.0, Color(1.0, 0.5, 0.05), 2.5), 10)
	flame.rotation_degrees.x = -90.0
	flame.position = Vector3(0, 0, 2.0)
	flame.name = "Flame"
	root.add_child(flame)
	return root

static func asteroid(seed_value: int) -> MeshInstance3D:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	var s := SphereMesh.new()
	s.radius = 1.0
	s.height = 2.0
	s.radial_segments = 7
	s.rings = 5
	var shade := rng.randf_range(0.25, 0.45)
	var mi := _mesh_instance(s, mat(Color(shade, shade * 0.85, shade * 0.7), 0.0, 1.0))
	mi.scale = Vector3(rng.randf_range(0.8, 2.4), rng.randf_range(0.7, 1.6), rng.randf_range(0.8, 2.2))
	mi.rotation = Vector3(rng.randf() * TAU, rng.randf() * TAU, rng.randf() * TAU)
	return mi

static func crystal(color: Color, size: float) -> Node3D:
	var root := Node3D.new()
	var m := mat(color, 0.1, 0.25, color, 2.0)
	var top := cylinder(0.0, size * 0.5, size, m, 4)
	top.position = Vector3(0, size * 0.5, 0)
	root.add_child(top)
	var bottom := cylinder(size * 0.5, 0.0, size, m, 4)
	bottom.position = Vector3(0, -size * 0.5, 0)
	root.add_child(bottom)
	return root

static func creature(color: Color, size: float, seed_value: int) -> Node3D:
	var root := Node3D.new()
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	var body_mat := mat(color, 0.05, 0.8)
	var dark_mat := mat(color.darkened(0.5), 0.0, 0.9)
	# جسم
	var body := sphere(0.8 * size, body_mat, 14, 10)
	body.scale = Vector3(1.0, 0.85, 1.15)
	body.position = Vector3(0, 0.75 * size, 0)
	root.add_child(body)
	# رأس
	var head := sphere(0.45 * size, body_mat, 12, 8)
	head.position = Vector3(0, 1.15 * size, -0.7 * size)
	root.add_child(head)
	# عينان
	for sx in [-0.18, 0.18]:
		var eye := sphere(0.13 * size, mat(Color.WHITE, 0.0, 0.4), 8, 6)
		eye.position = Vector3(sx * size, 1.25 * size, -1.05 * size)
		root.add_child(eye)
		var pupil := sphere(0.06 * size, mat(Color.BLACK, 0.0, 0.4), 8, 6)
		pupil.position = Vector3(sx * size, 1.25 * size, -1.16 * size)
		root.add_child(pupil)
	# قرنان
	for sx in [-0.3, 0.3]:
		var horn := cylinder(0.0, 0.12 * size, 0.5 * size, dark_mat, 6)
		horn.position = Vector3(sx * size, 1.55 * size, -0.55 * size)
		horn.rotation_degrees = Vector3(-20.0, 0.0, -sx * 60.0)
		root.add_child(horn)
	# أشواك ظهر
	for i in 3:
		var spike := cylinder(0.0, 0.09 * size, 0.35 * size, dark_mat, 6)
		spike.position = Vector3(0, 1.45 * size, 0.25 * size + float(i) * 0.3 * size)
		spike.rotation_degrees.x = 35.0
		root.add_child(spike)
	# أرجل
	for sx in [-0.4, 0.4]:
		for sz in [-0.45, 0.45]:
			var leg := cylinder(0.1 * size, 0.12 * size, 0.5 * size, dark_mat, 6)
			leg.position = Vector3(sx * size, 0.25 * size, sz * size)
			root.add_child(leg)
	# ظل
	var shadow := cylinder(0.9 * size, 0.9 * size, 0.03, mat(Color(0, 0, 0), 0.0, 1.0, Color(0, 0, 0), 0.0, 0.45), 16)
	shadow.position = Vector3(0, 0.02, 0)
	root.add_child(shadow)
	return root

static func rock(color: Color, size: float, seed_value: int) -> MeshInstance3D:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	var mi := box(Vector3(size, size * rng.randf_range(0.5, 0.9), size), mat(color.darkened(0.2), 0.0, 1.0))
	mi.rotation = Vector3(rng.randf() * 0.6, rng.randf() * TAU, rng.randf() * 0.6)
	return mi

static func cave_arch(color: Color) -> Node3D:
	var root := Node3D.new()
	var m := mat(color.darkened(0.35), 0.0, 1.0)
	var left := box(Vector3(1.4, 4.2, 1.6), m)
	left.position = Vector3(-2.4, 2.1, 0)
	root.add_child(left)
	var right := box(Vector3(1.4, 4.2, 1.6), m)
	right.position = Vector3(2.4, 2.1, 0)
	root.add_child(right)
	var top := box(Vector3(6.2, 1.4, 1.8), m)
	top.position = Vector3(0, 4.7, 0)
	root.add_child(top)
	# فم الكهف مظلم
	var mouth := box(Vector3(3.4, 4.0, 0.3), mat(Color(0.01, 0.0, 0.03), 0.0, 1.0))
	mouth.position = Vector3(0, 2.0, 0.9)
	root.add_child(mouth)
	return root

static func fuel_node() -> Node3D:
	var root := Node3D.new()
	var m := mat(Color(0.2, 0.9, 0.3), 0.0, 0.3, Color(0.2, 0.9, 0.3), 2.2)
	for i in 3:
		var s := sphere(0.3, m, 10, 8)
		s.position = Vector3(float(i - 1) * 0.45, 0.35 + float(i % 2) * 0.25, 0.0)
		root.add_child(s)
	var base := cylinder(0.5, 0.65, 0.25, mat(Color(0.25, 0.25, 0.3), 0.0, 1.0), 10)
	base.position = Vector3(0, 0.12, 0)
	root.add_child(base)
	return root

static func beacon(color: Color) -> MeshInstance3D:
	var b := cylinder(0.25, 0.25, 30.0, mat(color, 0.0, 1.0, color, 1.8, 0.35), 10)
	b.position = Vector3(0, 15.0, 0)
	return b

static func terrain_mesh(noise: FastNoiseLite, size: float, subdiv: int, amp: float, base_color: Color, flats: Array = []) -> MeshInstance3D:
	var plane := PlaneMesh.new()
	plane.size = Vector2(size, size)
	plane.subdivide_width = subdiv
	plane.subdivide_depth = subdiv
	var arrays: Array = plane.surface_get_arrays(0)
	var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	var new_verts := PackedVector3Array()
	var colors := PackedColorArray()
	var normals := PackedVector3Array()
	var eps := 0.6
	for v in verts:
		var h := _ground_h_flat(noise, v.x, v.z, amp, flats)
		new_verts.append(Vector3(v.x, h, v.z))
		var hx := _ground_h_flat(noise, v.x + eps, v.z, amp, flats) - _ground_h_flat(noise, v.x - eps, v.z, amp, flats)
		var hz := _ground_h_flat(noise, v.x, v.z + eps, amp, flats) - _ground_h_flat(noise, v.x, v.z - eps, amp, flats)
		var n := Vector3(-hx / (2.0 * eps), 1.0, -hz / (2.0 * eps)).normalized()
		normals.append(n)
		var shade := clampf(0.75 + h / (amp * 2.5), 0.6, 1.15)
		var c := base_color * shade
		colors.append(Color(c.r, c.g, c.b, 1.0))
	arrays[Mesh.ARRAY_VERTEX] = new_verts
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_COLOR] = colors
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var mi := MeshInstance3D.new()
	mi.mesh = am
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.roughness = 1.0
	mi.set_surface_override_material(0, m)
	return mi

static func _ground_h(noise: FastNoiseLite, x: float, z: float, amp: float) -> float:
	return noise.get_noise_2d(x * 0.045, z * 0.045) * amp

# نفس المعادلة المستخدمة في Surface.ground_height — تسطيح حول نقاط محددة.
# كل عنصر في flats هو Vector3(x, z, radius).
static func _ground_h_flat(noise: FastNoiseLite, x: float, z: float, amp: float, flats: Array) -> float:
	var h := _ground_h(noise, x, z, amp)
	for f in flats:
		var d := Vector2(x, z).distance_to(Vector2(f.x, f.y))
		h = lerpf(0.0, h, clampf(d / f.z, 0.0, 1.0))
	return h

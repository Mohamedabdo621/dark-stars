extends Control
class_name VirtualJoystick

# عصا افتراضية للمس (وتعمل بالفأرة للاختبار على الكمبيوتر).
# output: Vector2 في نطاق [-1, 1] (x يمين/يسار، y لأعلى/لأسفل).

signal changed(value: Vector2)

var output: Vector2 = Vector2.ZERO
var radius: float = 110.0
var _knob_radius: float = 48.0
var _active: bool = false
var _pointer_id: int = -1
var _center: Vector2 = Vector2.ZERO
var _knob_pos: Vector2 = Vector2.ZERO

func _ready() -> void:
	custom_minimum_size = Vector2(radius * 2.0 + 20.0, radius * 2.0 + 20.0)
	_center = size * 0.5
	_knob_pos = _center
	mouse_filter = MOUSE_FILTER_STOP

func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED:
		_center = size * 0.5
		if not _active:
			_knob_pos = _center

func _draw() -> void:
	var base_color := Color(0.66, 0.33, 0.97, 0.25)
	var ring_color := Color(0.91, 0.47, 0.98, 0.7)
	var knob_color := Color(0.66, 0.33, 0.97, 0.75)
	draw_circle(_center, radius, base_color)
	draw_arc(_center, radius, 0.0, TAU, 48, ring_color, 3.0)
	draw_circle(_knob_pos, _knob_radius, knob_color)
	draw_arc(_knob_pos, _knob_radius, 0.0, TAU, 32, Color(1, 1, 1, 0.5), 2.0)

func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		if touch.pressed:
			_active = true
			_pointer_id = touch.index
			_update_knob(touch.position)
		elif touch.index == _pointer_id:
			_release()
	elif event is InputEventScreenDrag:
		var drag := event as InputEventScreenDrag
		if _active and drag.index == _pointer_id:
			_update_knob(drag.position)
	elif event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.pressed:
				_active = true
				_pointer_id = -2
				_update_knob(mb.position)
			elif _pointer_id == -2:
				_release()
	elif event is InputEventMouseMotion:
		var mm := event as InputEventMouseMotion
		if _active and _pointer_id == -2:
			_update_knob(mm.position)

func _update_knob(local_pos: Vector2) -> void:
	var offset := local_pos - _center
	if offset.length() > radius:
		offset = offset.normalized() * radius
	_knob_pos = _center + offset
	output = offset / radius
	output.y = -output.y # لأعلى = موجب
	queue_redraw()
	changed.emit(output)

func _release() -> void:
	_active = false
	_pointer_id = -1
	_knob_pos = _center
	output = Vector2.ZERO
	queue_redraw()
	changed.emit(output)

func reset() -> void:
	_release()

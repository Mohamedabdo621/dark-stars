extends Node
class_name AudioManager

# أصوات مولّدة بالكود فقط (لا ملفات صوت). موجات PCM تُبنى في الذاكرة.
# محرك مستمر عبر AudioStreamWAV بحلقة (loop).

const MIX_RATE := 22050

var muted: bool = false
var _players: Array[AudioStreamPlayer] = []
var _streams: Dictionary = {}
var _engine_player: AudioStreamPlayer
var _engine_on: bool = false

func _ready() -> void:
	for i in 6:
		var p := AudioStreamPlayer.new()
		p.bus = "Master"
		add_child(p)
		_players.append(p)
	_engine_player = AudioStreamPlayer.new()
	_engine_player.bus = "Master"
	add_child(_engine_player)
	_streams["click"] = _make_tone([880.0], 0.07, 0.35, 0)
	_streams["collect"] = _make_tone([880.0, 1318.0], 0.22, 0.4, 0)
	_streams["zap"] = _make_tone([1400.0, 300.0], 0.18, 0.4, 1)
	_streams["artifact"] = _make_tone([523.0, 659.0, 784.0, 1046.0], 0.55, 0.4, 0)
	_streams["land"] = _make_tone([130.0, 90.0], 0.3, 0.5, 0)
	_streams["error"] = _make_tone([220.0, 180.0], 0.2, 0.35, 1)
	_streams["achievement"] = _make_tone([784.0, 1046.0, 1318.0], 0.5, 0.4, 0)
	_streams["hit"] = _make_tone([160.0, 110.0], 0.25, 0.5, 1)
	_engine_player.stream = _make_engine_loop()

func set_muted(value: bool) -> void:
	muted = value
	if muted:
		stop_engine()

func play(sound_name: String) -> void:
	if muted:
		return
	if not _streams.has(sound_name):
		return
	for p in _players:
		if not p.playing:
			p.stream = _streams[sound_name]
			p.play()
			return
	_players[0].stream = _streams[sound_name]
	_players[0].play()

func start_engine() -> void:
	if muted or _engine_on:
		return
	_engine_on = true
	_engine_player.volume_db = -14.0
	_engine_player.play()

func set_engine_level(level: float) -> void:
	if not _engine_on:
		return
	_engine_player.volume_db = lerpf(-20.0, -8.0, clampf(level, 0.0, 1.0))
	_engine_player.pitch_scale = lerpf(0.85, 1.25, clampf(level, 0.0, 1.0))

func stop_engine() -> void:
	_engine_on = false
	_engine_player.stop()

func _make_tone(freqs: Array, duration: float, volume: float, wave: int) -> AudioStreamWAV:
	var frames := int(MIX_RATE * duration)
	var data := PackedByteArray()
	data.resize(frames * 2)
	var step := duration / float(freqs.size())
	for i in frames:
		var t := float(i) / MIX_RATE
		var seg := int(t / step)
		seg = mini(seg, freqs.size() - 1)
		var f := float(freqs[seg])
		var env := exp(-3.0 * (t - float(seg) * step) / step)
		var s := 0.0
		if wave == 1:
			s = 1.0 if sin(TAU * f * t) >= 0.0 else -1.0
		elif wave == 2:
			s = randf() * 2.0 - 1.0
		else:
			s = sin(TAU * f * t)
		var v := int(clampf(s * env * volume, -1.0, 1.0) * 32767.0)
		data.encode_s16(i * 2, v)
	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = MIX_RATE
	wav.stereo = false
	wav.data = data
	return wav

func _make_engine_loop() -> AudioStreamWAV:
	var frames := MIX_RATE # حلقة ثانية واحدة
	var data := PackedByteArray()
	data.resize(frames * 2)
	for i in frames:
		var t := float(i) / MIX_RATE
		var s := sin(TAU * 90.0 * t) * 0.5 + sin(TAU * 135.0 * t) * 0.25 + (randf() * 2.0 - 1.0) * 0.08
		var v := int(clampf(s * 0.5, -1.0, 1.0) * 32767.0)
		data.encode_s16(i * 2, v)
	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = MIX_RATE
	wav.stereo = false
	wav.loop_mode = AudioStreamWAV.LOOP_FORWARD
	wav.loop_begin = 0
	wav.loop_end = frames
	wav.data = data
	return wav

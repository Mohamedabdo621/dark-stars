# DARK STARS — نجوم الظلام

لعبة مغامرة فضاء أوفلاين (HTML5 + WebView). طيّر سفينتك بين الكواكب، اجمع موارد، اكتشف قطع أثرية ومخلوقات نادرة، وطوّر سفينتك عشان توصل لأبعد الكواكب — كل ده من غير نت.

## البنية
- `game/` — اللعبة نفسها (HTML + CSS + JavaScript، من غير أي ملفات صور أو صوت — كل حاجة مرسومة بالكود).
- `android/` — غلاف أندرويد (WebView) بيشغّل اللعبة من `assets/game`.
- `.github/workflows/build-apk.yml` — بيبني APK من كل push على main.

## البناء
كل push على `main` بيشغّل GitHub Actions وبيطلع APK جاهز (artifact اسمه `dark-stars-apk`).
النسخة: `com.alex.darkstars` — الإصدار 1.0.0.

## الاختبار محلياً
افتح `game/index.html` في المتصفح، أو شغّل اختبارات المنطق من `game/tests/`.

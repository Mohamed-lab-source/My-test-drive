/// Very small translation layer: English text is the key, Arabic comes from
/// [arabic] (lib/app/strings_ar.dart). Anything not translated yet shows in
/// English rather than breaking.
library;

import 'package:intl/intl.dart';

import 'strings_ar.dart';

/// 'en' or 'ar'. Set once at start-up and when the person switches language
/// (the whole app is rebuilt then).
String _lang = 'en';
String get appLang => _lang;
set appLang(String lang) {
  _lang = lang == 'ar' ? 'ar' : 'en';
  // Dates ("Mon 5 Oct") follow the language too. Flutter's localizations
  // load the Arabic date names before any screen is drawn.
  Intl.defaultLocale = _lang;
}

bool get isArabic => appLang == 'ar';

/// Translates fixed text.
String tr(String en) => isArabic ? (arabic[en] ?? en) : en;

/// Translates text with blanks, e.g. trf('{n} places', {'n': 12}).
String trf(String en, Map<String, Object?> args) {
  var out = tr(en);
  args.forEach((k, v) => out = out.replaceAll('{$k}', '$v'));
  return out;
}

/// Arabic digits are not used: Egyptian apps commonly show 0-9, and it keeps
/// times and phone numbers consistent with maps and ride apps.

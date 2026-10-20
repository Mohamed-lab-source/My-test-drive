/// Well-known districts (same list as tool/districts.mjs, which gives every
/// place its area at build time): Arabic name and extra search words, so
/// "التجمع", "fifth settlement" or "masr el gedida" all find the right area.
/// Kept in sync by test/districts_test.dart.
library;

import 'i18n.dart';

/// Canonical English area → (Arabic name, extra search words).
const districts = <String, (String, String)>{
  'New Cairo (5th Settlement)': (
    'التجمع الخامس',
    'new cairo fifth settlement 5th settlement tagamo tagamoa el tagamo3 التجمع الخامس القاهرة الجديدة',
  ),
  'Rehab': ('الرحاب', ''),
  'Madinaty': ('مدينتي', ''),
  'Shorouk': ('الشروق', ''),
  'Nasr City': ('مدينة نصر', 'nasr city madinet nasr مدينة نصر مدينه نصر'),
  'Heliopolis': ('مصر الجديدة', 'heliopolis masr el gedida masr el gdida misr el gedida مصر الجديدة korba الكوربة'),
  'Maadi': ('المعادي', 'maadi maady el maadi المعادي المعادى degla دجلة'),
  'Zamalek': ('الزمالك', 'zamalek الزمالك'),
  'Garden City': ('جاردن سيتي', ''),
  'Downtown': ('وسط البلد', 'downtown wust el balad west el balad وسط البلد'),
  'Mokattam': ('المقطم', ''),
  'Manial': ('المنيل', ''),
  'Old Cairo': ('مصر القديمة', ''),
  'Shubra': ('شبرا', ''),
  'Abbassia': ('العباسية', ''),
  'Dokki': ('الدقي', 'dokki doki doqqi الدقي الدقى'),
  'Mohandessin': ('المهندسين', 'mohandessin mohandiseen el mohandseen المهندسين'),
  'Agouza': ('العجوزة', ''),
  'Haram': ('الهرم', ''),
  'Faisal': ('فيصل', ''),
  'Sheikh Zayed': ('الشيخ زايد', 'sheikh zayed zayed el sheikh zayed الشيخ زايد زايد'),
  '6th of October': ('6 أكتوبر', '6th of october 6 october october city ٦ أكتوبر 6 اكتوبر'),
  'Smouha': ('سموحة', ''),
  'Sidi Gaber': ('سيدي جابر', ''),
  'Stanley': ('ستانلي', ''),
  'Gleem': ('جليم', ''),
  'Sporting': ('سبورتنج', ''),
  'Roushdy': ('رشدي', ''),
  'Miami': ('ميامي', ''),
  'Montaza': ('المنتزه', ''),
  'Agami': ('العجمي', ''),
  'Raml Station': ('محطة الرمل', ''),
};

/// The area as shown: its Arabic name in Arabic mode, when it's a known district.
String areaName(String area, {bool? arabic}) => (arabic ?? isArabic) ? (districts[area]?.$1 ?? area) : area;

final _byArabic = {for (final e in districts.entries) e.value.$1: e.key};

/// Every way of writing an area (English, Arabic, common spellings), for search.
String areaSearchText(String area) {
  final en = districts.containsKey(area) ? area : _byArabic[area];
  if (en == null) return area;
  final (ar, words) = districts[en]!;
  return '$en $ar $words';
}

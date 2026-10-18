/// Free, real, live data from open sources (no keys), fetched on request:
/// - Open-Meteo: hourly weather for a plan's day, UV and air quality.
/// - Wikipedia (via Wikidata): a short summary of famous places.
/// Parsers are pure and tested in test/live_data_test.dart. Failures return
/// null/empty: the app just doesn't show that extra.
library;

import 'dart:convert';

import 'package:http/http.dart' as http;

import '../app/i18n.dart';

const _ua = {'User-Agent': 'Khroga/1.0 (Android outing planner; https://play.google.com)'};

String _ymd(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

Future<Map<String, dynamic>?> _getJson(Uri uri, {http.Client? client}) async {
  try {
    final res = await (client ?? http.Client()).get(uri, headers: _ua).timeout(const Duration(seconds: 8));
    if (res.statusCode != 200) return null;
    final body = jsonDecode(utf8.decode(res.bodyBytes));
    return body is Map<String, dynamic> ? body : null;
  } catch (_) {
    return null;
  }
}

// ---------------------------------------------------------------- weather

typedef HourWeather = ({double temp, int rain});

/// Open-Meteo hourly answer → hour of day (0–23) → temperature and rain %.
Map<int, HourWeather> parseHourly(Map<String, dynamic> json) {
  final h = json['hourly'] as Map?;
  final times = (h?['time'] as List?) ?? const [];
  final temps = (h?['temperature_2m'] as List?) ?? const [];
  final rain = (h?['precipitation_probability'] as List?) ?? const [];
  final out = <int, HourWeather>{};
  for (var i = 0; i < times.length && i < temps.length; i++) {
    final t = DateTime.tryParse('${times[i]}');
    if (t == null || temps[i] is! num) continue;
    out[t.hour] = (
      temp: (temps[i] as num).toDouble(),
      rain: i < rain.length && rain[i] is num ? (rain[i] as num).round() : 0,
    );
  }
  return out;
}

/// The day's weather hour by hour at a real spot (forecasts go 16 days ahead).
Future<Map<int, HourWeather>> fetchHourly(double lat, double lng, DateTime day, {http.Client? client}) async {
  final json = await _getJson(
      Uri.https('api.open-meteo.com', '/v1/forecast', {
        'latitude': '$lat',
        'longitude': '$lng',
        'hourly': 'temperature_2m,precipitation_probability',
        'timezone': 'Africa/Cairo',
        'start_date': _ymd(day),
        'end_date': _ymd(day),
      }),
      client: client);
  return json == null ? const {} : parseHourly(json);
}

/// The weather at "18:30" (rounded to the hour), or null.
HourWeather? weatherAt(Map<int, HourWeather> hours, String? hhmm) {
  final p = hhmm?.split(':');
  if (p == null || p.length != 2) return null;
  final h = int.tryParse(p[0]), m = int.tryParse(p[1]);
  if (h == null || m == null) return null;
  return hours[(m >= 30 ? h + 1 : h) % 24];
}

typedef AirNow = ({int? aqi, double? uv});

/// Open-Meteo air-quality answer → European AQI and UV index right now.
AirNow parseAir(Map<String, dynamic> json) {
  final c = json['current'] as Map?;
  final aqi = c?['european_aqi'];
  final uv = c?['uv_index'];
  return (aqi: aqi is num ? aqi.round() : null, uv: uv is num ? uv.toDouble() : null);
}

Future<AirNow?> fetchAir(double lat, double lng, {http.Client? client}) async {
  final json = await _getJson(
      Uri.https('air-quality-api.open-meteo.com', '/v1/air-quality', {
        'latitude': '$lat',
        'longitude': '$lng',
        'current': 'european_aqi,uv_index',
        'timezone': 'Africa/Cairo',
      }),
      client: client);
  return json == null ? null : parseAir(json);
}

/// European AQI bands (as Open-Meteo documents them).
String aqiLabel(int aqi) => tr(aqi <= 20
    ? 'Good'
    : aqi <= 40
        ? 'Fair'
        : aqi <= 60
            ? 'Moderate'
            : aqi <= 80
                ? 'Poor'
                : aqi <= 100
                    ? 'Very poor'
                    : 'Extremely poor');

/// WHO UV index bands.
String uvLabel(double uv) => tr(uv < 3
    ? 'Low'
    : uv < 6
        ? 'Moderate'
        : uv < 8
            ? 'High'
            : uv < 11
                ? 'Very high'
                : 'Extreme');

// --------------------------------------------------------------- wikipedia

/// Wikidata sitelinks → Wikipedia title for a language ('ar' / 'en'), or null.
String? parseWikiTitle(Map<String, dynamic> json, String id, String lang) {
  final entity = (json['entities'] as Map?)?[id] as Map?;
  final link = (entity?['sitelinks'] as Map?)?['${lang}wiki'] as Map?;
  final t = link?['title'];
  return t is String && t.isNotEmpty ? t : null;
}

typedef WikiSummary = ({String title, String extract, String url, String lang});

/// Wikipedia REST summary → title, first paragraph and page link.
WikiSummary? parseWikiSummary(Map<String, dynamic> json, String lang) {
  final extract = json['extract'];
  final title = json['title'];
  final url = ((json['content_urls'] as Map?)?['mobile'] as Map?)?['page'] ??
      ((json['content_urls'] as Map?)?['desktop'] as Map?)?['page'];
  if (extract is! String || extract.trim().isEmpty || title is! String || url is! String) return null;
  if (json['type'] == 'disambiguation') return null;
  return (title: title, extract: extract.trim(), url: url, lang: lang);
}

/// The Wikipedia summary for a place's Wikidata id, in [lang] when the
/// article exists, else English.
Future<WikiSummary?> fetchWikiSummary(String wikidataId, String lang, {http.Client? client}) async {
  if (!RegExp(r'^Q\d+$').hasMatch(wikidataId)) return null;
  final links = await _getJson(
      Uri.https('www.wikidata.org', '/w/api.php', {
        'action': 'wbgetentities',
        'ids': wikidataId,
        'props': 'sitelinks',
        'sitefilter': 'arwiki|enwiki',
        'format': 'json',
      }),
      client: client);
  if (links == null) return null;
  for (final l in {lang, 'en'}) {
    final title = parseWikiTitle(links, wikidataId, l);
    if (title == null) continue;
    final json = await _getJson(
        Uri.https('$l.wikipedia.org', '/api/rest_v1/page/summary/${Uri.encodeComponent(title.replaceAll(' ', '_'))}'),
        client: client);
    final s = json == null ? null : parseWikiSummary(json, l);
    if (s != null) return s;
  }
  return null;
}

// ----------------------------------------------------------- around here

typedef WikiNearby = ({String title, int pageId, int meters});

/// Wikipedia geosearch answer → articles about things near a spot.
List<WikiNearby> parseGeoSearch(Map<String, dynamic> json) => [
      for (final g in ((json['query'] as Map?)?['geosearch'] as List?) ?? const [])
        if (g is Map && g['title'] is String && g['pageid'] is num)
          (title: g['title'] as String, pageId: (g['pageid'] as num).toInt(), meters: ((g['dist'] as num?) ?? 0).round()),
    ];

/// Wikipedia articles within 1 km of a real spot ([lang] = 'ar' or 'en').
Future<List<WikiNearby>> fetchWikiNearby(double lat, double lng, String lang, {http.Client? client}) async {
  final json = await _getJson(
      Uri.https('$lang.wikipedia.org', '/w/api.php', {
        'action': 'query',
        'list': 'geosearch',
        'gscoord': '$lat|$lng',
        'gsradius': '1000',
        'gslimit': '12',
        'format': 'json',
      }),
      client: client);
  return json == null ? const [] : parseGeoSearch(json);
}

typedef CommonsPhoto = ({String thumb, String page, String author, String license});

String _plain(String? html) => (html ?? '').replaceAll(RegExp(r'<[^>]*>'), '').replaceAll('&amp;', '&').trim();

/// Wikimedia Commons answer → photos taken near a spot, with credits.
List<CommonsPhoto> parseCommonsPhotos(Map<String, dynamic> json) {
  final pages = ((json['query'] as Map?)?['pages'] as Map?)?.values ?? const [];
  final out = <CommonsPhoto>[];
  for (final p in pages) {
    final info = ((p as Map?)?['imageinfo'] as List?)?.firstOrNull as Map?;
    final thumb = info?['thumburl'];
    final page = info?['descriptionurl'];
    if (thumb is! String || page is! String) continue;
    if (!RegExp(r'\.(jpe?g|png|webp)$', caseSensitive: false).hasMatch(thumb)) continue;
    final meta = info?['extmetadata'] as Map?;
    out.add((
      thumb: thumb,
      page: page,
      author: _plain((meta?['Artist'] as Map?)?['value'] as String?),
      license: _plain((meta?['LicenseShortName'] as Map?)?['value'] as String?),
    ));
  }
  return out;
}

/// Photos people took within 300 m of a real spot (Wikimedia Commons).
Future<List<CommonsPhoto>> fetchCommonsNearby(double lat, double lng, {http.Client? client}) async {
  final json = await _getJson(
      Uri.https('commons.wikimedia.org', '/w/api.php', {
        'action': 'query',
        'generator': 'geosearch',
        'ggsnamespace': '6',
        'ggscoord': '$lat|$lng',
        'ggsradius': '300',
        'ggslimit': '12',
        'prop': 'imageinfo',
        'iiprop': 'url|extmetadata',
        'iiurlwidth': '320',
        'format': 'json',
      }),
      client: client);
  return json == null ? const [] : parseCommonsPhotos(json);
}

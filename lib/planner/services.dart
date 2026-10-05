import 'dart:convert';

import 'package:http/http.dart' as http;

import 'planner.dart';

/// Gemini key, added at build time by the GitHub workflow (free tier, no
/// billing on the project, so it can never cost money). Empty = no AI: the
/// app still builds plans from real places by itself.
const geminiApiKey = String.fromEnvironment('GEMINI_API_KEY');
const geminiModel =
    String.fromEnvironment('GEMINI_MODEL', defaultValue: 'gemini-flash-lite-latest');

/// The lighter "Flash-Lite" model: plenty for short sentences, with a
/// bigger free daily allowance than the full model.

/// The key only works from this app: Google checks these two headers.
const _androidPackage = 'com.khroga.khroga';
const _androidCertSha1 = String.fromEnvironment(
  'ANDROID_CERT_SHA1',
  defaultValue: 'FD0FA7738B35DF676ADC616265FDF86F06276CC3',
);

const _cityCoords = {
  'cairo': (30.0444, 31.2357),
  'giza': (30.0131, 31.2089),
  'alexandria': (31.2001, 29.9187),
};

/// Today's real forecast from Open-Meteo (free, no key). Null if unavailable.
Future<Weather?> fetchWeather(String city, {DateTime? day, http.Client? client}) async {
  final coords = _cityCoords[city];
  if (coords == null) return null;
  final today = DateTime.now();
  final target = day ?? DateTime(today.year, today.month, today.day);
  final daysAhead = target.difference(DateTime(today.year, today.month, today.day)).inDays;
  if (daysAhead < 0 || daysAhead > 15) return null; // forecasts only go 16 days ahead
  final ymd = '${target.year.toString().padLeft(4, '0')}-'
      '${target.month.toString().padLeft(2, '0')}-${target.day.toString().padLeft(2, '0')}';
  final uri = Uri.https('api.open-meteo.com', '/v1/forecast', {
    'latitude': '${coords.$1}',
    'longitude': '${coords.$2}',
    'daily': 'temperature_2m_max,precipitation_probability_max',
    'timezone': 'Africa/Cairo',
    'start_date': ymd,
    'end_date': ymd,
  });
  try {
    final res = await (client ?? http.Client())
        .get(uri)
        .timeout(const Duration(seconds: 6));
    if (res.statusCode != 200) return null;
    final daily = (jsonDecode(res.body) as Map)['daily'] as Map?;
    final temp = (daily?['temperature_2m_max'] as List?)?.firstOrNull;
    final rain = (daily?['precipitation_probability_max'] as List?)?.firstOrNull;
    if (temp is! num) return null;
    return Weather(maxTempC: temp.toDouble(), rainChancePct: rain is num ? rain.round() : 0);
  } catch (_) {
    return null;
  }
}

class AiUnavailable implements Exception {
  AiUnavailable(this.reason, {this.resting = false});
  final String reason;

  /// True when the free daily AI allowance is used up (try again later).
  final bool resting;
  @override
  String toString() => 'AI unavailable: $reason';
}

/// After the free allowance runs out, don't ask again for a while: it would
/// only fail and waste time. Kept in memory, so restarting the app retries.
DateTime? _restingUntil;
bool get aiResting => _restingUntil != null && DateTime.now().isBefore(_restingUntil!);

/// Asks Gemini for a plan as structured JSON.
Future<Map<String, dynamic>> askGemini(String prompt, {http.Client? client}) async {
  if (geminiApiKey.isEmpty) throw AiUnavailable('no key in this build');
  if (aiResting) throw AiUnavailable('resting', resting: true);
  final uri = Uri.https('generativelanguage.googleapis.com',
      '/v1beta/models/$geminiModel:generateContent');
  final res = await (client ?? http.Client())
      .post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey,
          'X-Android-Package': _androidPackage,
          'X-Android-Cert': _androidCertSha1,
        },
        body: jsonEncode({
          'contents': [
            {
              'role': 'user',
              'parts': [
                {'text': prompt},
              ],
            },
          ],
          'generationConfig': {
            'responseMimeType': 'application/json',
            'responseSchema': planSchema,
            'temperature': 0.8,
          },
        }),
      )
      .timeout(const Duration(seconds: 40));
  if (res.statusCode == 429) {
    _restingUntil = DateTime.now().add(const Duration(hours: 1));
    throw AiUnavailable('free allowance used up', resting: true);
  }
  if (res.statusCode != 200) {
    final body = res.body;
    throw AiUnavailable('HTTP ${res.statusCode}: '
        '${body.length > 300 ? body.substring(0, 300) : body}');
  }
  final data = jsonDecode(res.body) as Map<String, dynamic>;
  final parts = ((data['candidates'] as List?)?.firstOrNull as Map?)?['content']?['parts'] as List?;
  final text = parts?.map((p) => (p as Map)['text'] ?? '').join() ?? '';
  try {
    return jsonDecode(text) as Map<String, dynamic>;
  } catch (_) {
    throw AiUnavailable('answer was not valid JSON');
  }
}

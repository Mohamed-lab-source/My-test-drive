import 'package:flutter_test/flutter_test.dart';
import 'package:khroga/data/live_data.dart';

void main() {
  test('hourly weather and the weather at a stop time', () {
    final h = parseHourly({
      'hourly': {
        'time': ['2026-10-13T17:00', '2026-10-13T18:00', '2026-10-13T19:00', 'bad'],
        'temperature_2m': [29.5, 27.0, 25.4, 20],
        'precipitation_probability': [0, 10, null, 0],
      }
    });
    expect(h.length, 3);
    expect(h[18]!.temp, 27.0);
    expect(h[19]!.rain, 0);
    expect(weatherAt(h, '18:10')!.temp, 27.0);
    expect(weatherAt(h, '18:40')!.temp, 25.4); // rounds to 19:00
    expect(weatherAt(h, null), isNull);
    expect(weatherAt(h, 'x'), isNull);
    expect(parseHourly(const {}), isEmpty);
  });

  test('air quality and UV bands', () {
    final a = parseAir({'current': {'european_aqi': 47.6, 'uv_index': 6.2}});
    expect(a.aqi, 48);
    expect(a.uv, 6.2);
    expect(aqiLabel(10), 'Good');
    expect(aqiLabel(55), 'Moderate');
    expect(aqiLabel(120), 'Extremely poor');
    expect(uvLabel(1), 'Low');
    expect(uvLabel(7), 'High');
    expect(uvLabel(11), 'Extreme');
    expect(parseAir(const {}).aqi, isNull);
  });

  test('Wikipedia: title from Wikidata, then the summary', () {
    final links = {
      'entities': {
        'Q123': {
          'sitelinks': {
            'enwiki': {'title': 'Test Museum'},
          }
        }
      }
    };
    expect(parseWikiTitle(links, 'Q123', 'en'), 'Test Museum');
    expect(parseWikiTitle(links, 'Q123', 'ar'), isNull);
    final s = parseWikiSummary({
      'title': 'Test Museum',
      'extract': ' A test museum. ',
      'content_urls': {'mobile': {'page': 'https://en.m.wikipedia.org/wiki/Test_Museum'}},
    }, 'en')!;
    expect(s.extract, 'A test museum.');
    expect(s.url, contains('wikipedia.org'));
    expect(parseWikiSummary({'title': 'X', 'extract': 'y', 'type': 'disambiguation', 'content_urls': {'mobile': {'page': 'u'}}}, 'en'), isNull);
    expect(parseWikiSummary({'title': 'X'}, 'en'), isNull);
  });
}

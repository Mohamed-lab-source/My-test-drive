/// Share links that open the app (Android App Links on our free Firebase
/// Hosting site), with a web page for people who don't have Khroga yet.
/// Pure functions, tested in test/links_test.dart.
///
/// Only ids, times and a title travel in a link. Place facts are always
/// looked up again in our own bundled data, so a link can't add fake facts.
library;

/// The Android package, for the Play Store link.
const androidPackage = 'com.khroga.khroga';

/// Khroga on Google Play (works once the app is published).
final playStoreUrl =
    Uri.https('play.google.com', '/store/apps/details', {'id': androidPackage});

Uri placeLink(String host, String placeId) =>
    Uri(scheme: 'https', host: host, pathSegments: ['p', placeId]);

Uri groupLink(String host, String code) =>
    Uri(scheme: 'https', host: host, pathSegments: ['j', code.toUpperCase()]);

Uri friendLink(String host, String uid) =>
    Uri(scheme: 'https', host: host, pathSegments: ['u', uid]);

/// The app's own invite link (opens the app, or the web page with the
/// download button).
Uri appLink(String host) => Uri(scheme: 'https', host: host, path: '/get');

/// One stop in a shared plan: a place id, and optionally a start time and
/// how many minutes.
typedef SharedStop = ({String placeId, String? time, int? minutes});

typedef SharedPlan = ({String city, String title, String? date, List<SharedStop> stops});

final _time = RegExp(r'^([01]?\d|2[0-3]):[0-5]\d$');
final _date = RegExp(r'^\d{4}-\d{2}-\d{2}$');

/// A link that recreates a plan on a friend's phone. A [mystery] link
/// hides the stops until the friend reveals them one by one.
Uri planLink(String host, SharedPlan plan, {bool mystery = false}) => Uri(
      scheme: 'https',
      host: host,
      path: '/s',
      queryParameters: {
        'c': plan.city,
        't': plan.title.length > 80 ? plan.title.substring(0, 80) : plan.title,
        'd': ?plan.date,
        's': plan.stops
            .take(5)
            .map((s) => [s.placeId, s.time ?? '', s.minutes?.toString() ?? ''].join('~'))
            .join('|'),
        if (mystery) 'm': '1',
      },
    );

/// Whether a shared plan link is a mystery (stops hidden until revealed).
bool isMysteryLink(Uri uri) => uri.queryParameters['m'] == '1';

/// Reads a shared plan link. Anything odd is dropped, never trusted:
/// at most 5 stops, times must look like HH:mm, minutes 10–600.
SharedPlan? parsePlanLink(Uri uri) {
  if (uri.path != '/s') return null;
  final q = uri.queryParameters;
  final city = q['c'];
  if (city == null || !const ['cairo', 'giza', 'alexandria'].contains(city)) return null;
  final stops = <SharedStop>[];
  for (final part in (q['s'] ?? '').split('|')) {
    final f = part.split('~');
    final id = f.first.trim();
    if (id.isEmpty || id.length > 120) continue;
    final time = f.length > 1 && _time.hasMatch(f[1]) ? f[1] : null;
    final m = f.length > 2 ? int.tryParse(f[2]) : null;
    stops.add((placeId: id, time: time, minutes: m != null && m >= 10 && m <= 600 ? m : null));
    if (stops.length == 5) break;
  }
  if (stops.isEmpty) return null;
  var title = (q['t'] ?? '').trim();
  if (title.length > 80) title = title.substring(0, 80);
  final d = q['d'];
  return (city: city, title: title, date: d != null && _date.hasMatch(d) ? d : null, stops: stops);
}

/// Where in the app a link should go: `/place/{id}`, `/join/{code}`,
/// `/add-friend/{uid}`, `/shared?…`, or null when it isn't one of ours.
String? appRouteFor(Uri uri) {
  final seg = uri.pathSegments;
  if (seg.length == 2 && seg[0] == 'p' && seg[1].isNotEmpty) {
    return '/place/${Uri.encodeComponent(seg[1])}';
  }
  if (seg.length == 2 && seg[0] == 'j' && RegExp(r'^[A-Za-z0-9]{4,12}$').hasMatch(seg[1])) {
    return '/join/${seg[1].toUpperCase()}';
  }
  if (seg.length == 2 && seg[0] == 'u' && RegExp(r'^[A-Za-z0-9_-]{6,64}$').hasMatch(seg[1])) {
    return '/add-friend/${seg[1]}';
  }
  if (uri.path == '/s' && parsePlanLink(uri) != null) return '/shared?${uri.query}';
  if (uri.path == '/get') return '/plan';
  return null;
}

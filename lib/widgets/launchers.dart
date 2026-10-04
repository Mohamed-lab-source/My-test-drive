import 'package:url_launcher/url_launcher.dart';

/// Opens Google Maps at a real location. Returns false if nothing is on file.
Future<bool> openInMaps({
  required String name,
  double? lat,
  double? lng,
  String? googlePlaceId,
}) async {
  final Uri uri;
  if (lat != null && lng != null) {
    uri = Uri.https('www.google.com', '/maps/search/', {
      'api': '1',
      'query': '$lat,$lng',
      'query_place_id': ?googlePlaceId,
    });
  } else if (googlePlaceId != null) {
    uri = Uri.https('www.google.com', '/maps/search/', {
      'api': '1',
      'query': name,
      'query_place_id': googlePlaceId,
    });
  } else {
    return false;
  }
  return launchUrl(uri, mode: LaunchMode.externalApplication);
}

/// Uber's documented universal link, with the destination pre-filled.
Future<bool> openUber({
  required String name,
  required double lat,
  required double lng,
}) {
  final uri = Uri.https('m.uber.com', '/ul/', {
    'action': 'setPickup',
    'pickup': 'my_location',
    'dropoff[latitude]': '$lat',
    'dropoff[longitude]': '$lng',
    'dropoff[nickname]': name,
  });
  return launchUrl(uri, mode: LaunchMode.externalApplication);
}

/// DiDi and inDrive have no documented way to pre-fill a destination, so we
/// only open the app (or its Play Store page if it isn't installed).
Future<bool> openRideApp(String app) async {
  final (scheme, storeId) = switch (app) {
    'didi' => ('didiglobal://', 'com.didiglobal.passenger'),
    _ => ('indriver://', 'sinet.startup.inDriver'),
  };
  final appUri = Uri.parse(scheme);
  try {
    if (await launchUrl(appUri, mode: LaunchMode.externalApplication)) {
      return true;
    }
  } catch (_) {
    // App not installed: fall through to the store.
  }
  return launchUrl(
    Uri.https('play.google.com', '/store/apps/details', {'id': storeId}),
    mode: LaunchMode.externalApplication,
  );
}

Future<bool> openWebsite(String url) {
  final uri = Uri.tryParse(url.startsWith('http') ? url : 'https://$url');
  if (uri == null) return Future.value(false);
  return launchUrl(uri, mode: LaunchMode.externalApplication);
}

Future<bool> callPhone(String phone) =>
    launchUrl(Uri(scheme: 'tel', path: phone.replaceAll(' ', '')));

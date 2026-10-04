import 'package:geolocator/geolocator.dart';

/// Gets the phone's location once, for "Near me" sorting.
/// The location is only used on the phone; it's never saved or sent anywhere.
class LocationService {
  Future<(double, double)> current() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw Exception('Turn on Location in your phone settings to sort by distance.');
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw Exception('Allow location for Khroga to sort places by distance.');
    }
    final last = await Geolocator.getLastKnownPosition();
    if (last != null &&
        DateTime.now().difference(last.timestamp) < const Duration(minutes: 10)) {
      return (last.latitude, last.longitude);
    }
    final pos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.medium,
        timeLimit: Duration(seconds: 15),
      ),
    );
    return (pos.latitude, pos.longitude);
  }
}

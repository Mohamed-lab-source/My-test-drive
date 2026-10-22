import 'package:geolocator/geolocator.dart';

/// The phone's location, only while Khroga is open. It's used on the phone
/// ("Near me", Track my outing), and only leaves it when you choose to share
/// it live with a group, for the time you pick.
class LocationService {
  Future<(double, double)> current() async {
    await ensureAllowed();
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

  /// Asks for location permission if needed (while the app is open only;
  /// Khroga never asks for background location).
  Future<void> ensureAllowed() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw Exception('Turn on Location in your phone settings, then try again.');
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw Exception('Allow location for Khroga in your phone settings, then try again.');
    }
  }

  /// Your position as you move (only while Khroga is open).
  Stream<(double, double)> moving({int everyMeters = 15}) => Geolocator.getPositionStream(
        locationSettings: LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: everyMeters),
      ).map((p) => (p.latitude, p.longitude));
}

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../app/theme.dart';
import 'launchers.dart';

/// One pin on the map, always at a real coordinate from our data.
class MapPin {
  const MapPin({
    required this.lat,
    required this.lng,
    required this.label,
    this.emoji,
    this.number,
    this.onTap,
    this.dim = false,
  });

  /// Greyed out (e.g. known to be closed right now).
  final bool dim;

  final double lat;
  final double lng;
  final String label;
  final String? emoji;

  /// Shown instead of the emoji (plan stop numbers).
  final int? number;
  final VoidCallback? onTap;
}

/// A free OpenStreetMap map with pins, and an optional line joining them
/// in order (a plan's route). Credits OpenStreetMap as its licence asks.
class KhrogaMap extends StatelessWidget {
  const KhrogaMap({
    super.key,
    required this.pins,
    this.route = false,
    this.me,
    this.interactive = true,
    this.zoom = 14,
  });

  final List<MapPin> pins;
  final bool route;

  /// Your position, when known.
  final (double, double)? me;
  final bool interactive;
  final double zoom;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final points = [for (final p in pins) LatLng(p.lat, p.lng)];
    final all = [...points, if (me != null) LatLng(me!.$1, me!.$2)];
    if (all.isEmpty) return const SizedBox.shrink();
    return FlutterMap(
      options: MapOptions(
        initialCenter: all.first,
        initialZoom: zoom,
        initialCameraFit: all.length > 1
            ? CameraFit.coordinates(
                coordinates: all, padding: const EdgeInsets.all(40), maxZoom: 16)
            : null,
        interactionOptions: InteractionOptions(
          flags: interactive ? InteractiveFlag.all & ~InteractiveFlag.rotate : InteractiveFlag.none,
        ),
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.khroga.khroga',
          maxZoom: 19,
        ),
        if (route && points.length > 1)
          PolylineLayer(polylines: [
            Polyline(points: points, strokeWidth: 4, color: k.accent),
          ]),
        MarkerLayer(markers: [
          if (me != null)
            Marker(
              point: LatLng(me!.$1, me!.$2),
              width: 22,
              height: 22,
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF1E88E5),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 3),
                ),
              ),
            ),
          for (final p in pins)
            Marker(
              point: LatLng(p.lat, p.lng),
              width: 40,
              height: 40,
              child: Tooltip(
                message: p.label,
                child: GestureDetector(
                  onTap: p.onTap,
                  child: Container(
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: p.dim ? k.inkMuted : k.accent,
                      shape: BoxShape.circle,
                      border: Border.all(color: k.onAccent, width: 2),
                      boxShadow: const [BoxShadow(blurRadius: 4, color: Color(0x55000000))],
                    ),
                    child: p.number != null
                        ? Text('${p.number}',
                            style: TextStyle(color: k.onAccent, fontWeight: FontWeight.w800))
                        : Text(p.emoji ?? '📍', style: const TextStyle(fontSize: 18)),
                  ),
                ),
              ),
            ),
        ]),
        RichAttributionWidget(
          alignment: AttributionAlignment.bottomLeft,
          attributions: [
            TextSourceAttribution(
              'OpenStreetMap contributors',
              onTap: () => openWebsite('https://www.openstreetmap.org/copyright'),
            ),
          ],
        ),
      ],
    );
  }
}

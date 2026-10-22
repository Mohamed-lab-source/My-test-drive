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
    this.initials,
  });

  /// A person (live location): shown as a round badge with their initials.
  final String? initials;

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

/// Free key for Stadia Maps (non-commercial free tier, no card), added by the
/// GitHub build from the MAP_TILES_KEY secret. See store/PUBLISHING.md.
const mapTilesKey = String.fromEnvironment('MAP_TILES_KEY');

/// A free map (OpenStreetMap data) with pins, and an optional line joining
/// them in order (a plan's route).
///
/// Tiles: with a Stadia Maps key, Stadia's tiles (made for apps, light and
/// dark styles). Without one, OpenStreetMap's own tiles (fine for a few
/// testers, with a dark filter in dark mode; their policy doesn't allow
/// heavy app use, so add the key before going public). Tiles are cached on
/// the phone (flutter_map's built-in cache), so places you've looked at don't
/// download again.
class KhrogaMap extends StatelessWidget {
  const KhrogaMap({
    super.key,
    required this.pins,
    this.route = false,
    this.me,
    this.interactive = true,
    this.zoom = 14,
    this.trail = const [],
  });

  /// A recorded route (Track my outing), drawn as a line.
  final List<(double, double)> trail;

  final List<MapPin> pins;
  final bool route;

  /// Your position, when known.
  final (double, double)? me;
  final bool interactive;
  final double zoom;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final points = [for (final p in pins) LatLng(p.lat, p.lng)];
    final line = [for (final t in trail) LatLng(t.$1, t.$2)];
    final all = [...points, ...line, if (me != null) LatLng(me!.$1, me!.$2)];
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
        if (mapTilesKey.isNotEmpty)
          TileLayer(
            urlTemplate: dark
                ? 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key={key}'
                : 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key={key}',
            additionalOptions: const {'key': mapTilesKey},
            retinaMode: RetinaMode.isHighDensity(context),
            userAgentPackageName: 'com.khroga.khroga',
            maxZoom: 20,
          )
        else
          TileLayer(
            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            userAgentPackageName: 'com.khroga.khroga',
            tileBuilder: dark ? darkModeTileBuilder : null,
            maxZoom: 19,
          ),
        if (route && points.length > 1)
          PolylineLayer(polylines: [
            Polyline(points: points, strokeWidth: 4, color: k.accent),
          ]),
        if (line.length > 1)
          PolylineLayer(polylines: [
            Polyline(
              points: line,
              strokeWidth: 5,
              gradientColors: [k.accent, k.accent2],
              borderStrokeWidth: 2,
              borderColor: k.surface.withValues(alpha: 0.8),
            ),
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
          for (final p in pins.where((p) => p.initials != null))
            Marker(
              point: LatLng(p.lat, p.lng),
              width: 46,
              height: 46,
              child: Tooltip(
                message: p.label,
                child: GestureDetector(
                  onTap: p.onTap,
                  child: Container(
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      gradient: p.dim ? null : k.accentGradient,
                      color: p.dim ? k.inkMuted : null,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 3),
                      boxShadow: const [BoxShadow(blurRadius: 8, color: Color(0x66000000))],
                    ),
                    child: Text(p.initials!,
                        style: TextStyle(color: k.onAccent, fontWeight: FontWeight.w800, fontSize: 15)),
                  ),
                ),
              ),
            ),
          for (final p in pins.where((p) => p.initials == null))
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
            if (mapTilesKey.isNotEmpty) ...[
              TextSourceAttribution(
                'Stadia Maps',
                onTap: () => openWebsite('https://stadiamaps.com/'),
              ),
              TextSourceAttribution(
                'OpenMapTiles',
                onTap: () => openWebsite('https://openmaptiles.org/'),
              ),
            ],
          ],
        ),
      ],
    );
  }
}

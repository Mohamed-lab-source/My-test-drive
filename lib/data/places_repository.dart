import 'dart:convert';

import 'package:flutter/services.dart';

import '../models/place.dart';

/// Real places from OpenStreetMap, bundled inside the app at build time
/// (assets/data/places.json). No server, no cost, and works offline.
class PlacesRepository {
  PlacesRepository({AssetBundle? bundle}) : _bundle = bundle ?? rootBundle;

  final AssetBundle _bundle;
  List<Place>? _all;

  Future<List<Place>> all() async {
    if (_all != null) return _all!;
    final raw = jsonDecode(await _bundle.loadString('assets/data/places.json'));
    final list = raw is Map ? (raw['places'] as List? ?? const []) : raw as List;
    _all = list
        .whereType<Map>()
        .map((m) => Place.fromMap(Map<String, dynamic>.from(m)))
        .where((p) => p.id.isNotEmpty)
        .toList();
    return _all!;
  }

  Future<List<Place>> placesInCity(String city) async {
    final list = (await all()).where((p) => p.city == city).toList()
      ..sort((a, b) {
        final q = b.quality.compareTo(a.quality);
        return q != 0 ? q : a.name.compareTo(b.name);
      });
    return list;
  }

  Future<Place?> place(String id) async {
    for (final p in await all()) {
      if (p.id == id) return p;
    }
    return null;
  }

  /// Malls with at least one venue linked inside them.
  Future<List<Place>> malls(String city) async {
    final places = await all();
    final withVenues = {for (final p in places) ?p.parentMallId};
    return places
        .where((p) => p.city == city && p.category == 'mall' && withVenues.contains(p.id))
        .toList()
      ..sort((a, b) => a.name.compareTo(b.name));
  }
}

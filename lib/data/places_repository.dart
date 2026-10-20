import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../app/districts.dart';
import '../models/place.dart';

/// Real places from OpenStreetMap and Overture Maps, bundled inside the app
/// at build time (assets/data/places.json). No server, no cost, works offline.
class PlacesRepository {
  PlacesRepository({AssetBundle? bundle, this.arabic = false}) : _bundle = bundle ?? rootBundle;

  final AssetBundle _bundle;

  /// Show well-known area names in Arabic (the app makes a new repository
  /// when the language changes).
  final bool arabic;
  List<Place>? _all;

  Future<List<Place>>? _loading;

  Future<List<Place>> all() {
    if (_all != null) return Future.value(_all!);
    return _loading ??= () async {
      final text = await _bundle.loadString('assets/data/places.json');
      // Tens of thousands of places: read them off the main thread so the
      // screen never freezes.
      _all = await compute(_parsePlaces, (text, arabic));
      return _all!;
    }();
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
    return places.where((p) => p.city == city && p.category == 'mall' && withVenues.contains(p.id)).toList()
      ..sort((a, b) => a.name.compareTo(b.name));
  }
}

List<Place> _parsePlaces((String, bool) input) {
  final (text, arabic) = input;
  final raw = jsonDecode(text);
  final list = raw is Map ? (raw['places'] as List? ?? const []) : raw as List;
  return list
      .whereType<Map>()
      .map((m) {
        final map = Map<String, dynamic>.from(m);
        if (arabic && map['area'] is String) map['area'] = areaName(map['area'] as String, arabic: true);
        return Place.fromMap(map);
      })
      .where((p) => p.id.isNotEmpty)
      .toList();
}

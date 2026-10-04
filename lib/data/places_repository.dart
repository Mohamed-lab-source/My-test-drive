import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';

import '../models/place.dart';

class PlacesRepository {
  PlacesRepository(this._db, this._functions);

  final FirebaseFirestore _db;
  final FirebaseFunctions _functions;

  /// Cache of photo links already resolved this session.
  final Map<String, List<PlacePhoto>> _photoCache = {};

  Future<List<Place>> placesInCity(String city) async {
    final snap =
        await _db.collection('places').where('city', isEqualTo: city).get();
    final places = snap.docs.map((d) => Place.fromMap(d.id, d.data())).toList()
      ..sort((a, b) => (b.rating ?? 0).compareTo(a.rating ?? 0));
    return places;
  }

  Future<Place?> place(String id) async {
    final doc = await _db.collection('places').doc(id).get();
    if (!doc.exists) return null;
    return Place.fromMap(doc.id, doc.data()!);
  }

  /// Malls that have venues linked to them (for "Plan my day here").
  Future<List<Place>> malls(String city) async {
    final snap = await _db
        .collection('places')
        .where('city', isEqualTo: city)
        .where('category', isEqualTo: 'mall')
        .get();
    return snap.docs.map((d) => Place.fromMap(d.id, d.data())).toList()
      ..sort((a, b) => a.name.compareTo(b.name));
  }

  /// Returns viewable photos. Stored URLs are used as-is; Google photo
  /// references are turned into links by the server (the API key stays there).
  Future<List<PlacePhoto>> photosFor(Place place) async {
    final direct = place.photos.where((p) => p.url != null).toList();
    if (direct.isNotEmpty || place.photos.isEmpty) return direct;
    final cached = _photoCache[place.id];
    if (cached != null) return cached;

    final result = await _functions
        .httpsCallable('placePhotos')
        .call<Map<String, dynamic>>({'placeId': place.id});
    final photos = ((result.data['photos'] as List?) ?? const [])
        .whereType<Map>()
        .map((p) => PlacePhoto.fromMap(Map<String, dynamic>.from(p)))
        .where((p) => p.url != null)
        .toList();
    _photoCache[place.id] = photos;
    return photos;
  }
}

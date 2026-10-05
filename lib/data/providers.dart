import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app/theme_settings.dart' show sharedPrefsProvider;
import '../models/place.dart';
import '../planner/planner.dart' show areaCenters;
import '../models/plan.dart';
import '../models/social.dart';
import 'auth_repository.dart';
import 'checkins_repository.dart';
import 'favorites_repository.dart';
import 'location_service.dart';
import 'personal_repository.dart';
import 'groups_repository.dart';
import 'places_repository.dart';
import 'plans_repository.dart';
import 'social_repository.dart';

// ---- Firebase singletons ----
final firestoreProvider = Provider((_) => FirebaseFirestore.instance);

// ---- Repositories ----
final authRepositoryProvider = Provider(
    (ref) => AuthRepository(FirebaseAuth.instance, ref.watch(firestoreProvider)));
final placesRepositoryProvider = Provider((_) => PlacesRepository());
final plansRepositoryProvider = Provider((ref) =>
    PlansRepository(ref.watch(firestoreProvider), ref.watch(placesRepositoryProvider)));
final groupsRepositoryProvider =
    Provider((ref) => GroupsRepository(ref.watch(firestoreProvider)));
final socialRepositoryProvider =
    Provider((ref) => SocialRepository(ref.watch(firestoreProvider)));

// ---- Auth ----
final authStateProvider = StreamProvider<User?>(
    (ref) => ref.watch(authRepositoryProvider).authChanges());

/// The signed-in user's id. Screens behind sign-in can rely on it.
final uidProvider = Provider<String?>((ref) => ref.watch(authStateProvider).value?.uid);

final myProfileProvider = StreamProvider<PublicProfile?>((ref) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return Stream.value(null);
  return ref.watch(socialRepositoryProvider).watchProfile(uid);
});

// ---- Places ----
/// The city the person is browsing/planning in. Remembered on the phone.
class CityNotifier extends Notifier<String> {
  static const _key = 'city';

  @override
  String build() {
    final saved = ref.watch(sharedPrefsProvider)?.getString(_key);
    return Cities.all.containsKey(saved) ? saved! : 'cairo';
  }

  void set(String city) {
    state = city;
    ref.read(sharedPrefsProvider)?.setString(_key, city);
  }
}

final cityProvider = NotifierProvider<CityNotifier, String>(CityNotifier.new);

final placesInCityProvider = FutureProvider.family<List<Place>, String>(
    (ref, city) => ref.watch(placesRepositoryProvider).placesInCity(city));

final placeProvider = FutureProvider.family<Place?, String>(
    (ref, id) => ref.watch(placesRepositoryProvider).place(id));

/// Areas of a city with their real centre point, for "Where in the city?".
final areaCentersProvider =
    FutureProvider.family<List<({String name, double lat, double lng, int count})>, String>(
        (ref, city) async => areaCenters(await ref.watch(placesRepositoryProvider).all(), city));

final mallsProvider = FutureProvider.family<List<Place>, String>(
    (ref, city) => ref.watch(placesRepositoryProvider).malls(city));

// ---- Plans ----
final planProvider = StreamProvider.family<OutingPlan?, String>((ref, planId) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return Stream.value(null);
  return ref.watch(plansRepositoryProvider).watch(uid, planId);
});

final savedPlansProvider = StreamProvider<List<OutingPlan>>((ref) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return Stream.value(const []);
  return ref.watch(plansRepositoryProvider).watchSaved(uid);
});

// ---- Groups ----
final myGroupsProvider = StreamProvider<List<Group>>((ref) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return Stream.value(const []);
  return ref.watch(groupsRepositoryProvider).watchMyGroups(uid);
});

final groupProvider = StreamProvider.family<Group?, String>(
    (ref, id) => ref.watch(groupsRepositoryProvider).watch(id));

final groupPollsProvider = StreamProvider.family<List<Poll>, String>(
    (ref, id) => ref.watch(groupsRepositoryProvider).watchPolls(id));

final groupMessagesProvider = StreamProvider.family<List<GroupMessage>, String>(
    (ref, id) => ref.watch(groupsRepositoryProvider).watchMessages(id));

/// Profiles for a set of uids, keyed by a sorted, comma-joined string so the
/// family key stays stable across rebuilds.
final profilesProvider =
    FutureProvider.family<Map<String, PublicProfile>, String>((ref, key) async {
  if (key.isEmpty) return const {};
  final list =
      await ref.watch(socialRepositoryProvider).profiles(key.split(','));
  return {for (final p in list) p.uid: p};
});

String profilesKey(Iterable<String> uids) => (uids.toSet().toList()..sort()).join(',');

// ---- Friends ----
final friendshipsProvider = StreamProvider<List<Friendship>>((ref) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return Stream.value(const []);
  return ref.watch(socialRepositoryProvider).watchFriendships(uid);
});

// ---- Favorites ----
final favoritesRepositoryProvider =
    Provider((ref) => FavoritesRepository(ref.watch(firestoreProvider)));

final favoriteIdsProvider = StreamProvider<List<String>>((ref) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return Stream.value(const []);
  return ref.watch(favoritesRepositoryProvider).watch(uid);
});

final favoritePlacesProvider = FutureProvider<List<Place>>((ref) async {
  final ids = await ref.watch(favoriteIdsProvider.future);
  final all = await ref.watch(placesRepositoryProvider).all();
  final byId = {for (final p in all) p.id: p};
  return [for (final id in ids) ?byId[id]];
});

// ---- Places inside a mall (mall directory) ----
final mallVenuesProvider = FutureProvider.family<List<Place>, String>((ref, mallId) async {
  final all = await ref.watch(placesRepositoryProvider).all();
  return all.where((p) => p.parentMallId == mallId).toList();
});

// ---- Location ("Near me") ----
final locationServiceProvider = Provider((_) => LocationService());

/// Your last known position (set when you use "Near me" or "How far?").
/// Kept in memory only, never saved.
class MyLocationNotifier extends Notifier<(double, double)?> {
  @override
  (double, double)? build() => null;
  void set((double, double)? here) => state = here;
}

final myLocationProvider =
    NotifierProvider<MyLocationNotifier, (double, double)?>(MyLocationNotifier.new);

// ---- Personal history (been there, notes) ----
final personalRepositoryProvider =
    Provider((ref) => PersonalRepository(ref.watch(firestoreProvider)));

final visitedIdsProvider = StreamProvider<List<String>>((ref) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return Stream.value(const []);
  return ref.watch(personalRepositoryProvider).watchVisited(uid);
});

final visitedPlacesProvider = FutureProvider<List<Place>>((ref) async {
  final ids = await ref.watch(visitedIdsProvider.future);
  final all = await ref.watch(placesRepositoryProvider).all();
  final byId = {for (final p in all) p.id: p};
  return [for (final id in ids) ?byId[id]];
});

final placeNoteProvider = StreamProvider.family<String?, String>((ref, placeId) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return Stream.value(null);
  return ref.watch(personalRepositoryProvider).watchNote(uid, placeId);
});

final allPlansProvider = StreamProvider<List<OutingPlan>>((ref) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return Stream.value(const []);
  return ref.watch(plansRepositoryProvider).watchAll(uid);
});

final allPlacesProvider =
    FutureProvider<List<Place>>((ref) => ref.watch(placesRepositoryProvider).all());

/// The next group outing you're part of (soonest first), if any.
final nextOutingProvider = Provider<Group?>((ref) {
  final groups = ref.watch(myGroupsProvider).value ?? const <Group>[];
  final now = DateTime.now().subtract(const Duration(hours: 6));
  final upcoming = groups.where((g) => g.scheduledAt != null && g.scheduledAt!.isAfter(now)).toList()
    ..sort((a, b) => a.scheduledAt!.compareTo(b.scheduledAt!));
  return upcoming.firstOrNull;
});

// ---- Check-ins ("I'm here") ----
final checkInsRepositoryProvider =
    Provider((ref) => CheckInsRepository(ref.watch(firestoreProvider)));

final myCheckInProvider = StreamProvider<CheckIn?>((ref) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return Stream.value(null);
  return ref.watch(checkInsRepositoryProvider).watchMine(uid);
});

/// Accepted friends' check-ins from the last 24 hours, newest first.
final friendsCheckInsProvider = StreamProvider<List<CheckIn>>((ref) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return Stream.value(const []);
  final friends = {
    for (final f in ref.watch(friendshipsProvider).value ?? const <Friendship>[])
      if (f.status == FriendshipStatus.accepted) f.otherUid(uid),
  };
  return ref.watch(checkInsRepositoryProvider).watchShared(uid).map((list) {
    final now = DateTime.now();
    return list.where((c) => friends.contains(c.uid) && c.isFresh(now)).toList()
      ..sort((a, b) => b.createdAt!.compareTo(a.createdAt!));
  });
});

/// Your accepted friends' uids (for sharing a check-in with them).
final friendUidsProvider = Provider<List<String>>((ref) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return const [];
  return [
    for (final f in ref.watch(friendshipsProvider).value ?? const <Friendship>[])
      if (f.status == FriendshipStatus.accepted) f.otherUid(uid),
  ];
});

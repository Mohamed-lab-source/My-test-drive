import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/place.dart';
import '../models/plan.dart';
import '../models/social.dart';
import 'auth_repository.dart';
import 'groups_repository.dart';
import 'places_repository.dart';
import 'plans_repository.dart';
import 'social_repository.dart';

// ---- Firebase singletons ----
final firestoreProvider = Provider((_) => FirebaseFirestore.instance);
final functionsProvider = Provider((_) => FirebaseFunctions.instance);

// ---- Repositories ----
final authRepositoryProvider = Provider(
    (ref) => AuthRepository(FirebaseAuth.instance, ref.watch(firestoreProvider)));
final placesRepositoryProvider = Provider((ref) =>
    PlacesRepository(ref.watch(firestoreProvider), ref.watch(functionsProvider)));
final plansRepositoryProvider = Provider((ref) =>
    PlansRepository(ref.watch(firestoreProvider), ref.watch(functionsProvider)));
final groupsRepositoryProvider = Provider((ref) =>
    GroupsRepository(ref.watch(firestoreProvider), ref.watch(functionsProvider)));
final socialRepositoryProvider = Provider((ref) =>
    SocialRepository(ref.watch(firestoreProvider), ref.watch(functionsProvider)));

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
/// The city the person is browsing/planning in.
class CityNotifier extends Notifier<String> {
  @override
  String build() => 'cairo';
  void set(String city) => state = city;
}

final cityProvider = NotifierProvider<CityNotifier, String>(CityNotifier.new);

final placesInCityProvider = FutureProvider.family<List<Place>, String>(
    (ref, city) => ref.watch(placesRepositoryProvider).placesInCity(city));

final placeProvider = FutureProvider.family<Place?, String>(
    (ref, id) => ref.watch(placesRepositoryProvider).place(id));

final mallsProvider = FutureProvider.family<List<Place>, String>(
    (ref, city) => ref.watch(placesRepositoryProvider).malls(city));

final placePhotosProvider = FutureProvider.family<List<PlacePhoto>, String>(
    (ref, placeId) async {
  final place = await ref.watch(placeProvider(placeId).future);
  if (place == null) return const [];
  return ref.watch(placesRepositoryProvider).photosFor(place);
});

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

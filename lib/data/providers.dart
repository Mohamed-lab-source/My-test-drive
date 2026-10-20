import '../models/crowd.dart';
import 'crowd_repository.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app/local_prefs.dart' show appSettingsProvider;
import '../app/theme_settings.dart' show sharedPrefsProvider;
import '../models/place.dart';
import '../app/extras.dart' show DayForecast, cityCenters;
import 'live_data.dart';
import '../planner/planner.dart' show areaCenters;
import '../planner/services.dart' show fetchWeek;
import '../models/plan.dart';
import '../models/review.dart';
import '../models/social.dart';
import 'auth_repository.dart';
import 'checkins_repository.dart';
import 'favorites_repository.dart';
import 'location_service.dart';
import 'personal_repository.dart';
import 'groups_repository.dart';
import 'places_repository.dart';
import 'plans_repository.dart';
import 'reviews_repository.dart';
import 'safety_repository.dart';
import 'social_repository.dart';

// ---- Firebase singletons ----
final firestoreProvider = Provider((_) => FirebaseFirestore.instance);

// ---- Repositories ----
final authRepositoryProvider = Provider(
    (ref) => AuthRepository(FirebaseAuth.instance, ref.watch(firestoreProvider)));
final placesRepositoryProvider = Provider(
    (ref) => PlacesRepository(arabic: ref.watch(appSettingsProvider.select((s) => s.lang)) == 'ar'));
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

/// (group id, how many newest messages).
final groupMessagesProvider = StreamProvider.family<List<GroupMessage>, (String, int)>(
    (ref, key) => ref.watch(groupsRepositoryProvider).watchMessages(key.$1, limit: key.$2));

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

/// Places you've been with the day you marked them (one listener).
final visitedEntriesProvider = StreamProvider<List<(String, DateTime?)>>((ref) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return Stream.value(const []);
  return ref.watch(personalRepositoryProvider).watchVisited(uid);
});

final visitedIdsProvider = FutureProvider<List<String>>(
    (ref) async => [for (final e in await ref.watch(visitedEntriesProvider.future)) e.$1]);

/// Places you've been (real places only) with when you marked them.
final visitedDatedProvider = FutureProvider<List<(Place, DateTime?)>>((ref) async {
  final entries = await ref.watch(visitedEntriesProvider.future);
  final all = await ref.watch(placesRepositoryProvider).all();
  final byId = {for (final p in all) p.id: p};
  return [for (final (id, t) in entries) if (byId[id] case final p?) (p, t)];
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

/// Your 15 newest plans (Plan tab, "Add to a plan"). Small on purpose:
/// every document read counts against the free daily allowance.
final recentPlansProvider = StreamProvider<List<OutingPlan>>((ref) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return Stream.value(const []);
  return ref.watch(plansRepositoryProvider).watchRecent(uid, limit: 15);
});

/// Plan history, [limit] newest (grows by 20 with "Show more").
final historyPlansProvider = StreamProvider.family<List<OutingPlan>, int>((ref, limit) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return Stream.value(const []);
  return ref.watch(plansRepositoryProvider).watchRecent(uid, limit: limit);
});

/// How many plans you've made (a cheap count for stats and badges).
final plansCountProvider = FutureProvider<int>((ref) async {
  final uid = ref.watch(uidProvider);
  if (uid == null) return 0;
  return ref.watch(plansRepositoryProvider).count(uid);
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

// ---- Safety: reports, feedback, account deletion ----
final safetyRepositoryProvider = Provider((ref) => SafetyRepository(ref.watch(firestoreProvider),
    ref.watch(groupsRepositoryProvider), ref.watch(reviewsRepositoryProvider)));

// ---- Reviews, place stars and guide levels (read on request, no listeners) ----
final reviewsRepositoryProvider = Provider((ref) => ReviewsRepository(ref.watch(firestoreProvider)));

final placeStatsProvider = FutureProvider.autoDispose.family<PlaceStats, String>(
    (ref, placeId) => ref.watch(reviewsRepositoryProvider).placeStats(placeId));

final myReviewerStatsProvider = FutureProvider<ReviewerStats>((ref) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return Future.value(const ReviewerStats());
  return ref.watch(reviewsRepositoryProvider).reviewerStats(uid);
});

// ---- Live extras (Open-Meteo, Wikipedia; free, fetched on request) ----
/// Hour-by-hour weather for (lat, lng, "yyyy-MM-dd"), kept for the session.
final hourlyWeatherProvider = FutureProvider.family<Map<int, HourWeather>, (double, double, String)>(
    (ref, k) => fetchHourly(k.$1, k.$2, DateTime.parse(k.$3)));

/// UV and air quality now, per city.
final airProvider = FutureProvider.family<AirNow?, String>((ref, city) {
  final c = cityCenters[city] ?? cityCenters['cairo']!;
  return fetchAir(c.$1, c.$2);
});

/// A Wikipedia summary for (wikidata id, language).
final wikiProvider = FutureProvider.autoDispose.family<WikiSummary?, (String, String)>(
    (ref, k) => fetchWikiSummary(k.$1, k.$2));

// ---- Weather this week (Open-Meteo, free) ----
/// Kept while the app runs, so it's fetched once per city per session.
final weekForecastProvider =
    FutureProvider.family<List<DayForecast>, String>((ref, city) => fetchWeek(city));

// ---- How busy is it now (live reports from people there) ----
final crowdRepositoryProvider = Provider((ref) => CrowdRepository(ref.watch(firestoreProvider)));

/// One read when a place page opens.
final crowdNowProvider = FutureProvider.autoDispose.family<CrowdNow, String>(
    (ref, placeId) => ref.watch(crowdRepositoryProvider).now(placeId));

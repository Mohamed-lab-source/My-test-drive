// Taps through menus, sheets, pop-ups and settings like a person would, and
// fails on any error (e.g. a text box disposed while its pop-up closes).
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:khroga/app/theme.dart';
import 'package:khroga/app/theme_settings.dart';
import 'package:khroga/data/providers.dart';
import 'package:khroga/features/explore/explore_screen.dart';
import 'package:khroga/features/groups/groups_screen.dart';
import 'package:khroga/features/plan/plan_form_screen.dart';
import 'package:khroga/features/plan/plan_result_screen.dart';
import 'package:khroga/features/plan/plans_hub_screen.dart';
import 'package:khroga/features/profile/settings_screen.dart';
import 'package:khroga/features/tools/tools_screen.dart';
import 'package:khroga/models/place.dart';
import 'package:khroga/models/plan.dart';
import 'package:khroga/models/social.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeFs implements FirebaseFirestore {
  @override
  dynamic noSuchMethod(Invocation i) => null;
}

OutingPlan _plan(String id, String title, String? date) => OutingPlan(
      id: id,
      title: title,
      summary: 'Test',
      source: 'local',
      stops: const [
        PlanStop(placeId: 'a', name: 'Test Cafe', category: 'cafe', startTime: '18:00', durationMinutes: 60, lat: 30.06, lng: 31.22),
        PlanStop(placeId: 'b', name: 'Test Park', category: 'park', startTime: '19:15', durationMinutes: 45, kmFromPrevious: 0.8, lat: 30.063, lng: 31.219),
      ],
      request: PlanRequest(city: 'cairo', groupSize: 2, vibes: const ['chill'], timeOfDay: 'evening', stops: 2, date: date),
      tips: const [],
    );

late SharedPreferences _prefs;
final _errors = <String>[];

Widget _app(Widget child) {
  final now = DateTime.now();
  final d = '${now.year}-${now.month.toString().padLeft(2, '0')}-${(now.day).toString().padLeft(2, '0')}';
  final places = [
    Place.fromMap({'id': 'a', 'name': 'Test Cafe', 'category': 'cafe', 'city': 'cairo', 'lat': 30.06, 'lng': 31.22, 'quality': 3}),
    Place.fromMap({'id': 'b', 'name': 'Test Park', 'category': 'park', 'city': 'cairo', 'lat': 30.063, 'lng': 31.219, 'quality': 3}),
  ];
  final group = Group.fromMap('g1', const {'name': 'Test group', 'ownerUid': 'me', 'memberUids': ['me', 'f1'], 'joinCode': 'ABC123', 'lastMessage': 'hi'});
  return ProviderScope(
    overrides: [
      sharedPrefsProvider.overrideWithValue(_prefs),
      uidProvider.overrideWith((_) => 'me'),
      firestoreProvider.overrideWithValue(_FakeFs()),
      myProfileProvider.overrideWith((_) => Stream.value(const PublicProfile(uid: 'me', displayName: 'Tester'))),
      myGroupsProvider.overrideWith((_) => Stream.value([group])),
      recentPlansProvider.overrideWith((_) => Stream.value([_plan('p', 'Night out', d)])),
      historyPlansProvider.overrideWith((_, _) => Stream.value([_plan('p', 'Night out', d), _plan('q', 'Old one', '2025-01-01')])),
      savedPlansProvider.overrideWith((_) => Stream.value(const [])),
      planProvider('p').overrideWith((_) => Stream.value(_plan('p', 'Night out', d))),
      weekForecastProvider.overrideWith((_, _) async => const []),
      airProvider.overrideWith((_, _) async => null),
      allPlacesProvider.overrideWith((_) async => places),
      placesInCityProvider.overrideWith((_, _) async => places),
      mallsProvider.overrideWith((_, _) async => const []),
      favoriteIdsProvider.overrideWith((_) => Stream.value(const [])),
      visitedIdsProvider.overrideWith((_) async => const []),
    ],
    child: MaterialApp.router(
      theme: buildTheme(accent: accentThemes.first, brightness: Brightness.dark),
      routerConfig: GoRouter(routes: [GoRoute(path: '/', builder: (_, _) => child)]),
    ),
  );
}

Future<void> _go(WidgetTester t, Finder f, {bool long = false}) async {
  final label = f.describeMatch(Plurality.one);
  expect(f, findsWidgets, reason: label);
  long ? await t.longPress(f.first) : await t.tap(f.first);
  await t.pump();
  await t.pump(const Duration(milliseconds: 600));
  final e = t.takeException();
  if (e != null) _errors.add('$label → $e');
}

Future<void> _close(WidgetTester t) async {
  await t.tapAt(const Offset(20, 20));
  await t.pump(const Duration(milliseconds: 600));
}

void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    _prefs = await SharedPreferences.getInstance();
    final view = TestWidgetsFlutterBinding.instance.platformDispatcher.views.first;
    view.physicalSize = const Size(390 * 3, 844 * 3);
    view.devicePixelRatio = 3;
  });
  tearDown(() {
    if (_errors.isNotEmpty) debugPrint('SMOKE ERRORS:\n${_errors.join('\n')}');
    _errors.clear();
  });

  testWidgets('my plans: search, sort, past, actions, label, pin', (t) async {
    await t.pumpWidget(_app(const PlansHubScreen()));
    await t.pump(const Duration(milliseconds: 600));
    await _go(t, find.byIcon(Icons.search));
    await t.enterText(find.byType(TextField).first, 'night');
    await t.pump();
    await _go(t, find.text('Past'));
    await _go(t, find.text('All'));
    await _go(t, find.byIcon(Icons.more_horiz));
    await _go(t, find.text('Label'));
    await _go(t, find.textContaining('Birthday'));
    await _go(t, find.byIcon(Icons.more_horiz));
    await _go(t, find.text('Pin to the top'));
    await t.pump(const Duration(seconds: 5));
    expect(_errors, isEmpty);
  });

  testWidgets('plan page: glance, more sheet, note', (t) async {
    await t.pumpWidget(_app(const PlanResultScreen(planId: 'p')));
    await t.pump(const Duration(milliseconds: 800));
    await _go(t, find.text('Add a label'));
    await _close(t);
    await t.ensureVisible(find.textContaining('Add a private note'));
    await t.pump(const Duration(milliseconds: 600));
    await _go(t, find.textContaining('Add a private note'));
    await t.enterText(find.byType(TextField).last, 'Bring cash');
    await _go(t, find.text('Save').last);
    await _go(t, find.byIcon(Icons.more_horiz).last);
    await t.pump(const Duration(seconds: 5));
    expect(_errors, isEmpty);
  });

  testWidgets('settings: every switch and the start tab', (t) async {
    await t.pumpWidget(_app(const SettingsScreen()));
    await t.pump(const Duration(milliseconds: 600));
    for (var i = 0; i < 6; i++) {
      final sw = find.byType(Switch);
      if (sw.evaluate().length > i) await _go(t, sw.at(i));
    }
    await _go(t, find.text('Home').first);
    await _go(t, find.text('My plans').last);
    await t.pump(const Duration(seconds: 2));
    expect(_errors, isEmpty);
  });

  testWidgets('groups: long-press menu, pin, mute, emoji', (t) async {
    await t.pumpWidget(_app(const GroupsScreen()));
    await t.pump(const Duration(milliseconds: 600));
    await _go(t, find.text('Test group'), long: true);
    await _go(t, find.text('Pin to the top'));
    await _go(t, find.text('Test group'), long: true);
    await _go(t, find.text('🎉'));
    await t.pump(const Duration(seconds: 2));
    expect(_errors, isEmpty);
  });

  testWidgets('tools: star, open a new one, timer', (t) async {
    await t.pumpWidget(_app(const ToolsScreen()));
    await t.pump(const Duration(milliseconds: 600));
    await _go(t, find.text('Flip a coin'), long: true);
    await _go(t, find.text('Flip a coin'));
    await _go(t, find.text('Flip'));
    await _close(t);
    await t.enterText(find.byType(TextField).first, 'timer');
    await t.pump(const Duration(milliseconds: 600));
    await _go(t, find.descendant(of: find.byType(Card), matching: find.text('Game timer')));
    await _go(t, find.text('Start'));
    await t.pump(const Duration(seconds: 3));
    await _go(t, find.text('Pause'));
    await _close(t);
    await t.pump(const Duration(seconds: 2));
    expect(_errors, isEmpty);
  });

  testWidgets('home: customise, get started, quick start', (t) async {
    await t.pumpWidget(_app(const PlanFormScreen()));
    await t.pump(const Duration(milliseconds: 800));
    for (var i = 0; i < 6 && find.byTooltip('Choose what shows here').evaluate().isEmpty; i++) {
      await t.drag(find.byType(Scrollable).first, const Offset(0, -600));
      await t.pump(const Duration(milliseconds: 300));
    }
    await t.drag(find.byType(Scrollable).first, const Offset(0, -300));
    await t.pump(const Duration(milliseconds: 300));
    await _go(t, find.byTooltip('Choose what shows here'));
    expect(find.text('Choose what shows on Home.'), findsOneWidget);
    await _go(t, find.byType(Switch).first);
    await _close(t);
    await _close(t);
    await t.pump(const Duration(seconds: 2));
    expect(_errors, isEmpty);
  });

  testWidgets('explore: discover sheet', (t) async {
    await t.pumpWidget(_app(const ExploreScreen()));
    await t.pump(const Duration(milliseconds: 800));
    await _go(t, find.text('Discover'));
    await _go(t, find.text('Surprise me'));
    await t.pump(const Duration(seconds: 2));
    expect(_errors, isEmpty);
  });
}

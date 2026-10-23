// Renders a few screens on a small phone size to catch layout overflows.
// Test-only fake place (never shipped in the app).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:khroga/app/theme.dart';
import 'package:khroga/data/providers.dart';
import 'package:khroga/features/explore/explore_screen.dart';
import 'package:khroga/features/fun/badges_screen.dart';
import 'package:khroga/features/fun/bingo_screen.dart';
import 'package:khroga/features/fun/recap_screen.dart';
import 'package:khroga/features/fun/timeline_screen.dart';
import 'package:khroga/features/profile/about_screen.dart';
import 'package:khroga/features/profile/help_screen.dart';
import 'package:khroga/features/profile/welcome_screen.dart';
import 'package:khroga/features/profile/whats_new_screen.dart';
import 'package:khroga/features/tools/ideas_screen.dart';
import 'package:khroga/features/tools/tools_screen.dart';
import 'package:khroga/features/tools/track_screen.dart';
import 'package:khroga/features/groups/live_map_screen.dart';
import 'package:khroga/features/groups/money_screen.dart';
import 'package:khroga/features/groups/start_points_screen.dart';
import 'package:khroga/data/money_providers.dart';
import 'package:khroga/data/money_repository.dart';
import 'package:khroga/app/money.dart';
import 'package:khroga/data/live_share.dart';
import 'package:khroga/models/social.dart';
import 'package:khroga/models/place.dart';
import 'package:khroga/widgets/share_card.dart';

Widget _app(Widget child) => ProviderScope(child: _router(child));

Widget _router(Widget child) => MaterialApp.router(
      theme: buildTheme(accent: accentThemes.first, brightness: Brightness.dark),
      routerConfig: GoRouter(routes: [GoRoute(path: '/', builder: (_, _) => child)]),
    );

void main() {
  setUp(() {
    final view = TestWidgetsFlutterBinding.instance.platformDispatcher.views.first;
    view.physicalSize = const Size(360 * 3, 720 * 3);
    view.devicePixelRatio = 3;
  });

  testWidgets('About screen fits a small phone', (tester) async {
    await tester.pumpWidget(_app(const AboutScreen()));
    await tester.pump();
    expect(find.text('Only real places'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('place grid tile and list tile fit', (tester) async {
    const p = Place(
        id: 'x', name: 'Test Place With A Rather Long Name', category: 'cafe', city: 'cairo',
        area: 'Test Area', openingHours: 'Mo-Su 00:00-24:00');
    await tester.pumpWidget(_app(Scaffold(
      body: Column(children: const [
        SizedBox(width: 170, height: 210, child: PlaceGridTile(place: p)),
        PlaceTile(place: p),
      ]),
    )));
    await tester.pump();
    expect(find.text('Open all day'), findsNWidgets(2));
    expect(tester.takeException(), isNull);
  });

  testWidgets('welcome and what\'s new fit a small phone', (tester) async {
    await tester.pumpWidget(_app(const WelcomeScreen()));
    await tester.pump();
    expect(find.text('Tell us the vibe'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(_app(const WhatsNewScreen()));
    await tester.pump();
    expect(find.text('Money & InstaPay'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('outing ideas and tools fit a small phone', (tester) async {
    await tester.pumpWidget(_app(const IdeasScreen()));
    await tester.pump();
    expect(find.text('Date night'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(_app(const ToolsScreen()));
    await tester.pump();
    expect(find.text('Decide for us'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Flip'), 300, scrollable: find.byType(Scrollable).first);
    await tester.ensureVisible(find.text('Flip'));
    await tester.pump();
    await tester.tap(find.text('Flip'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.textContaining(RegExp('Heads|Tails')), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Coming public holidays'), 400,
        scrollable: find.byType(Scrollable).first);
    expect(find.text('Coming public holidays'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('story picture card fits with long text', (tester) async {
    await tester.pumpWidget(_app(Scaffold(
      body: Center(
        child: SizedBox(
          width: 300,
          child: StoryCard(
            emoji: '🗺️',
            title: 'A rather long test plan title that goes on and on and on',
            subtitle: 'Friday 9 Oct · Cairo',
            lines: [
              for (var i = 0; i < 8; i++) ('☕', 'Test Place $i with a long name indeed', '18:00 · Test Area'),
            ],
          ),
        ),
      ),
    )));
    await tester.pump();
    expect(find.text('Made with Khroga'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('badges, bingo, recap and mystery screens fit when empty', (tester) async {
    Widget signedOut(Widget child) => ProviderScope(
          overrides: [
            uidProvider.overrideWith((_) => null),
            visitedDatedProvider.overrideWith((_) async => const []),
          ],
          child: _router(child),
        );
    for (final (screen, expected) in [
      (const BadgesScreen(), 'Closest next'),
      (const BingoScreen(), 'My goal this month'),
      (const RecapScreen(), 'Your outing personality'),
      (const TimelineScreen(), 'Your timeline is empty'),
    ]) {
      await tester.pumpWidget(signedOut(screen));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text(expected), findsOneWidget, reason: expected);
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets('new party tools work', (tester) async {
    await tester.pumpWidget(_app(const ToolsScreen()));
    await tester.pump();
    await tester.scrollUntilVisible(find.text('Give us a question'), 300, scrollable: find.byType(Scrollable).first);
    await tester.ensureVisible(find.text('Give us a question'));
    await tester.pump();
    await tester.tap(find.text('Give us a question'));
    await tester.pump();
    expect(find.text('Another one'), findsWidgets);
    expect(tester.takeException(), isNull);
  });

  testWidgets('help screen fits and searches', (tester) async {
    await tester.pumpWidget(_app(const HelpScreen()));
    await tester.pump();
    expect(find.text('Are the places real?'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'reminder');
    await tester.pump();
    expect(find.text('How do reminders work?'), findsOneWidget);
    expect(find.text('Are the places real?'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('live map and track my outing fit a small phone', (tester) async {
    final group = Group.fromMap('g1', const {
      'name': 'Test group', 'ownerUid': 'me', 'memberUids': ['me', 'friend'], 'joinCode': 'ABC123',
    });
    await tester.pumpWidget(ProviderScope(
      overrides: [
        uidProvider.overrideWith((_) => 'me'),
        groupProvider('g1').overrideWith((_) => Stream.value(group)),
        groupLiveProvider('g1').overrideWith((_) => Stream.value(const [])),
        allPlacesProvider.overrideWith((_) async => const []),
      ],
      child: _router(const LiveMapScreen(groupId: 'g1')),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Share my live location'), findsOneWidget);
    expect(find.text('1 h'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(ProviderScope(key: UniqueKey(), child: _router(const TrackScreen())));
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Start tracking'), findsOneWidget);
    expect(find.text('Routes you record show up here.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('money and where-we-start screens fit a small phone', (tester) async {
    final group = Group.fromMap('g1', const {
      'name': 'Test group', 'ownerUid': 'me', 'memberUids': ['me', 'friend'], 'joinCode': 'ABC123',
    });
    final base = [
      uidProvider.overrideWith((_) => 'me'),
      groupProvider('g1').overrideWith((_) => Stream.value(group)),
      profilesProvider(profilesKey(group.memberUids)).overrideWith((_) async => const {}),
    ];
    await tester.pumpWidget(ProviderScope(
      key: UniqueKey(),
      overrides: [
        ...base,
        moneySettingsProvider('g1').overrideWith((_) => Stream.value(const MoneySettings(
            collectorUid: 'friend', collectorName: 'Test Friend', payTo: 'test@instapay', extraPct: 12))),
        groupOrdersProvider('g1').overrideWith((_) => Stream.value(const [
              OrderItem(id: 'o1', uid: 'me', name: 'Me', item: 'Test drink', price: 50, qty: 2),
              OrderItem(id: 'o2', uid: 'friend', name: 'Test Friend', item: 'Test plate', price: 80, shared: true),
            ])),
        groupPaidProvider('g1').overrideWith((_) => Stream.value(const <String, double>{})),
      ],
      child: _router(const MoneyScreen(groupId: 'g1')),
    ));
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));
    expect(find.text('Pay with InstaPay'), findsOneWidget);
    expect(find.text('157'), findsOneWidget, reason: '(100 + 40) x 1.12 = 156.8, rounded up');
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(ProviderScope(
      key: UniqueKey(),
      overrides: [...base, groupOriginsProvider('g1').overrideWith((_) => Stream.value(const <Origin>[]))],
      child: _router(const StartPointsScreen(groupId: 'g1')),
    ));
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Plan close to everyone'), findsOneWidget);
    expect(find.text('Where I am now'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

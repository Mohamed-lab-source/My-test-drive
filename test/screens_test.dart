// Renders a few screens on a small phone size to catch layout overflows.
// Test-only fake place (never shipped in the app).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:khroga/app/theme.dart';
import 'package:khroga/features/explore/explore_screen.dart';
import 'package:khroga/features/profile/about_screen.dart';
import 'package:khroga/features/profile/welcome_screen.dart';
import 'package:khroga/features/profile/whats_new_screen.dart';
import 'package:khroga/models/place.dart';

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
    expect(find.text('Safety'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

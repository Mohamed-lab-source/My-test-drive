import 'i18n.dart';
import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/providers.dart';
import '../models/social.dart';
import 'links.dart';
import 'local_prefs.dart';
import '../features/links/link_screens.dart';
import '../features/reviews/community_screen.dart';
import '../features/reviews/review_screens.dart';
import '../features/auth/sign_in_screen.dart';
import '../features/explore/explore_screen.dart';
import '../features/explore/compare_screen.dart';
import '../features/fun/badges_screen.dart';
import '../features/fun/bingo_screen.dart';
import '../features/fun/collections_screen.dart';
import '../features/fun/leaderboard_screen.dart';
import '../features/fun/mystery_screen.dart';
import '../features/fun/recap_screen.dart';
import '../features/explore/lists_screen.dart';
import '../features/explore/malls_screen.dart';
import '../features/explore/place_details_screen.dart';
import '../features/friends/friends_screen.dart';
import '../features/friends/qr_scan_screen.dart';
import '../features/groups/group_detail_screen.dart';
import '../features/groups/groups_screen.dart';
import '../features/plan/plan_form_screen.dart';
import '../features/plan/plan_result_screen.dart';
import '../features/plan/saved_plans_screen.dart';
import '../features/profile/about_screen.dart';
import '../features/tools/areas_screen.dart';
import '../features/tools/ideas_screen.dart';
import '../features/tools/my_stats_screen.dart';
import '../features/tools/notes_screen.dart';
import '../features/tools/tools_screen.dart';
import '../features/profile/safety_screens.dart';
import '../features/profile/welcome_screen.dart';
import '../features/profile/whats_new_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/profile/help_screen.dart';

/// A link opened before signing in, opened right after.
String? _pendingLink;

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authRepositoryProvider);
  final refresh = _StreamListenable(auth.authChanges());
  ref.onDispose(refresh.dispose);

  final start = ref.read(appSettingsProvider).startOnExplore ? '/explore' : '/plan';
  return GoRouter(
    initialLocation: start,
    refreshListenable: refresh,
    redirect: (context, state) {
      // A Khroga link (place, plan, invite, friend) opened from outside.
      final link = appRouteFor(state.uri);
      final signedIn = FirebaseAuth.instance.currentUser != null;
      final atSignIn = state.matchedLocation == '/sign-in';
      if (!signedIn) {
        if (link != null) _pendingLink = link; // open it after signing in
        return atSignIn ? null : '/sign-in';
      }
      // First time after signing in: a short welcome.
      final atWelcome = state.matchedLocation == '/welcome';
      if (!ref.read(appSettingsProvider).onboarded) {
        if (link != null) _pendingLink = link;
        return atWelcome ? null : '/welcome';
      }
      if (link != null) return link;
      if (_pendingLink != null) {
        final next = _pendingLink;
        _pendingLink = null;
        return next;
      }
      if (atSignIn) return start;
      return null;
    },
    routes: [
      GoRoute(path: '/sign-in', builder: (_, _) => const SignInScreen()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => _Shell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/plan', builder: (_, _) => const PlanFormScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/explore', builder: (_, _) => const ExploreScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/groups', builder: (_, _) => const GroupsScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/friends', builder: (_, _) => const FriendsScreen()),
          ]),
        ],
      ),
      GoRoute(
        path: '/new-plan',
        builder: (_, s) {
          final q = s.uri.queryParameters;
          final lat = double.tryParse(q['lat'] ?? '');
          final lng = double.tryParse(q['lng'] ?? '');
          return PlanFormScreen(
            initialMallId: q['mall'],
            idea: int.tryParse(q['idea'] ?? ''),
            anchor: lat == null || lng == null ? null : (lat, lng, q['label'] ?? 'this place'),
          );
        },
      ),
      GoRoute(
        path: '/plan/:id',
        builder: (_, s) => PlanResultScreen(planId: s.pathParameters['id']!),
      ),
      GoRoute(path: '/saved', builder: (_, _) => const SavedPlansScreen()),
      GoRoute(
        path: '/place/:id',
        builder: (_, s) => PlaceDetailsScreen(placeId: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/group/:id',
        builder: (_, s) => GroupDetailScreen(groupId: s.pathParameters['id']!),
      ),
      GoRoute(path: '/scan', builder: (_, _) => const QrScanScreen()),
      GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen()),
      GoRoute(path: '/malls', builder: (_, _) => const MallsScreen()),
      GoRoute(path: '/about', builder: (_, _) => const AboutScreen()),
      GoRoute(path: '/welcome', builder: (_, _) => const WelcomeScreen()),
      GoRoute(path: '/privacy', builder: (_, _) => const PrivacyScreen()),
      GoRoute(path: '/terms', builder: (_, _) => const TermsScreen()),
      GoRoute(path: '/feedback', builder: (_, _) => const FeedbackScreen()),
      GoRoute(path: '/blocked', builder: (_, _) => const BlockedScreen()),
      GoRoute(path: '/whats-new', builder: (_, _) => const WhatsNewScreen()),
      GoRoute(path: '/lists', builder: (_, _) => const ListsScreen()),
      GoRoute(path: '/ideas', builder: (_, _) => const IdeasScreen()),
      // Web links (`https://{project}.web.app/...`) are mapped by the redirect
      // above; these keep the router from treating them as unknown.
      for (final p in const ['/p/:id', '/j/:code', '/u/:uid', '/s', '/get'])
        GoRoute(path: p, redirect: (_, s) => appRouteFor(s.uri) ?? '/plan'),
      GoRoute(
          path: '/join/:code',
          builder: (_, s) => JoinLinkScreen(code: s.pathParameters['code']!)),
      GoRoute(
          path: '/add-friend/:uid',
          builder: (_, s) => AddFriendLinkScreen(uid: s.pathParameters['uid']!)),
      GoRoute(path: '/shared', builder: (_, s) => SharedPlanScreen(uri: s.uri)),
      GoRoute(path: '/areas', builder: (_, _) => const AreasScreen()),
      GoRoute(
        path: '/area/:city/:name',
        builder: (_, s) =>
            AreaScreen(city: s.pathParameters['city']!, name: s.pathParameters['name']!),
      ),
      GoRoute(path: '/tools', builder: (_, _) => const ToolsScreen()),
      GoRoute(path: '/badges', builder: (_, _) => const BadgesScreen()),
      GoRoute(path: '/help', builder: (_, _) => const HelpScreen()),
      GoRoute(path: '/recap', builder: (_, _) => const RecapScreen()),
      GoRoute(path: '/bingo', builder: (_, _) => const BingoScreen()),
      GoRoute(path: '/leaderboard', builder: (_, _) => const LeaderboardScreen()),
      GoRoute(path: '/collections', builder: (_, _) => const CollectionsScreen()),
      GoRoute(
        path: '/collection/:key',
        builder: (_, s) => CollectionScreen(collectionKey: s.pathParameters['key']!),
      ),
      GoRoute(
        path: '/mystery/:id',
        builder: (_, s) => MysteryPlanScreen(planId: s.pathParameters['id']!),
      ),
      GoRoute(path: '/guide', builder: (_, _) => const GuideScreen()),
      GoRoute(path: '/community', builder: (_, _) => const CommunityScreen()),
      GoRoute(
          path: '/review/:placeId',
          builder: (_, s) => ReviewFormScreen(placeId: s.pathParameters['placeId']!)),
      GoRoute(path: '/stats', builder: (_, _) => const MyStatsScreen()),
      GoRoute(path: '/my-map', builder: (_, _) => const MyMapScreen()),
      GoRoute(path: '/notes', builder: (_, _) => const NotesScreen()),
      GoRoute(
        path: '/compare',
        builder: (_, s) => CompareScreen(
            a: s.uri.queryParameters['a'] ?? '', b: s.uri.queryParameters['b'] ?? ''),
      ),
    ],
  );
});

class _Shell extends ConsumerWidget {
  const _Shell({required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final uid = ref.watch(uidProvider);
    final requests = (ref.watch(friendshipsProvider).value ?? const [])
        .where((f) => f.status == FriendshipStatus.pending && f.requestedBy != uid)
        .length;
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        onDestinationSelected: (i) =>
            shell.goBranch(i, initialLocation: i == shell.currentIndex),
        destinations: [
          NavigationDestination(
              icon: Icon(Icons.auto_awesome_outlined),
              selectedIcon: Icon(Icons.auto_awesome),
              label: tr('Plan')),
          NavigationDestination(
              icon: Icon(Icons.explore_outlined),
              selectedIcon: Icon(Icons.explore),
              label: tr('Explore')),
          NavigationDestination(
              icon: Icon(Icons.forum_outlined),
              selectedIcon: Icon(Icons.forum),
              label: tr('Groups')),
          NavigationDestination(
              icon: Badge(
                  isLabelVisible: requests > 0,
                  label: Text('$requests'),
                  child: const Icon(Icons.people_outline)),
              selectedIcon: Badge(
                  isLabelVisible: requests > 0,
                  label: Text('$requests'),
                  child: const Icon(Icons.people)),
              label: tr('Friends')),
        ],
      ),
    );
  }
}

/// Lets the router re-check sign-in whenever auth state changes.
class _StreamListenable extends ChangeNotifier {
  _StreamListenable(Stream<dynamic> stream) {
    _sub = stream.listen((_) => notifyListeners());
  }

  late final StreamSubscription<dynamic> _sub;

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}

import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/providers.dart';
import '../features/auth/sign_in_screen.dart';
import '../features/explore/explore_screen.dart';
import '../features/explore/place_details_screen.dart';
import '../features/friends/friends_screen.dart';
import '../features/friends/qr_scan_screen.dart';
import '../features/groups/group_detail_screen.dart';
import '../features/groups/groups_screen.dart';
import '../features/plan/plan_form_screen.dart';
import '../features/plan/plan_result_screen.dart';
import '../features/plan/saved_plans_screen.dart';
import '../features/profile/profile_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authRepositoryProvider);
  final refresh = _StreamListenable(auth.authChanges());
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/plan',
    refreshListenable: refresh,
    redirect: (context, state) {
      final signedIn = FirebaseAuth.instance.currentUser != null;
      final atSignIn = state.matchedLocation == '/sign-in';
      if (!signedIn) return atSignIn ? null : '/sign-in';
      if (atSignIn) return '/plan';
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
        builder: (_, s) =>
            PlanFormScreen(initialMallId: s.uri.queryParameters['mall']),
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
    ],
  );
});

class _Shell extends StatelessWidget {
  const _Shell({required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        onDestinationSelected: (i) =>
            shell.goBranch(i, initialLocation: i == shell.currentIndex),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.auto_awesome_outlined),
              selectedIcon: Icon(Icons.auto_awesome),
              label: 'Plan'),
          NavigationDestination(
              icon: Icon(Icons.explore_outlined),
              selectedIcon: Icon(Icons.explore),
              label: 'Explore'),
          NavigationDestination(
              icon: Icon(Icons.forum_outlined),
              selectedIcon: Icon(Icons.forum),
              label: 'Groups'),
          NavigationDestination(
              icon: Icon(Icons.people_outline),
              selectedIcon: Icon(Icons.people),
              label: 'Friends'),
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

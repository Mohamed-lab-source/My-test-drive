import 'i18n.dart';
import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/providers.dart';
import '../models/social.dart';
import 'links.dart';
import 'helpers.dart' show tapFeedback;
import 'live.dart' show trailKm;
import '../data/live_share.dart';
import 'local_prefs.dart';
import 'theme.dart';
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
import '../features/fun/timeline_screen.dart';
import '../features/fun/for_you_screen.dart';
import '../features/reviews/friends_reviews_screen.dart';
import '../features/friends/person_screen.dart';
import '../features/explore/lists_screen.dart';
import '../features/explore/malls_screen.dart';
import '../features/explore/place_details_screen.dart';
import '../features/friends/friends_screen.dart';
import '../features/friends/qr_scan_screen.dart';
import '../features/groups/group_detail_screen.dart';
import '../features/groups/groups_screen.dart';
import '../features/groups/live_map_screen.dart';
import '../features/groups/money_screen.dart';
import '../features/groups/start_points_screen.dart';
import '../features/tools/track_screen.dart';
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
      GoRoute(
        path: '/group/:id/money',
        builder: (_, s) => MoneyScreen(groupId: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/group/:id/start',
        builder: (_, s) => StartPointsScreen(groupId: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/group/:id/live',
        builder: (_, s) => LiveMapScreen(groupId: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/track',
        builder: (_, s) => TrackScreen(title: s.uri.queryParameters['title']),
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
      GoRoute(path: '/timeline', builder: (_, _) => const TimelineScreen()),
      GoRoute(path: '/for-you', builder: (_, _) => const ForYouScreen()),
      GoRoute(path: '/friends-reviews', builder: (_, _) => const FriendsReviewsScreen()),
      GoRoute(path: '/person/:uid', builder: (_, s) => PersonScreen(uid: s.pathParameters['uid']!)),
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
    final share = ref.watch(liveShareProvider);
    final track = ref.watch(trackProvider);
    return Scaffold(
      body: shell,
      bottomNavigationBar: Column(mainAxisSize: MainAxisSize.min, children: [
        // Something running in the background of the app: one tap back to it.
        if (track.running)
          _ActiveStrip(
            emoji: '🔴',
            text: trf('Recording your route · {km} km', {'km': trailKm(track.points).toStringAsFixed(2)}),
            onTap: () => context.push('/track'),
          ),
        if (share.on)
          _ActiveStrip(
            emoji: '🟢',
            text: tr("You're sharing your live location"),
            onTap: () => context.push('/group/${share.groupId}/live'),
          ),
        _NavBar(
        index: shell.currentIndex,
        onTap: (i) {
          tapFeedback(ref.read(phoneSettingsProvider).haptics);
          shell.goBranch(i, initialLocation: i == shell.currentIndex);
        },
        items: [
          (Icons.auto_awesome_outlined, Icons.auto_awesome, tr('Plan'), 0),
          (Icons.explore_outlined, Icons.explore, tr('Explore'), 0),
          (Icons.forum_outlined, Icons.forum, tr('Groups'), 0),
          (Icons.people_outline, Icons.people, tr('Friends'), requests),
        ],
      ),
      ]),
    );
  }
}

/// A slim strip above the tabs while tracking or sharing is on.
class _ActiveStrip extends StatelessWidget {
  const _ActiveStrip({required this.emoji, required this.text, required this.onTap});

  final String emoji;
  final String text;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return ColoredBox(
      color: k.background,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(KSpace.md, KSpace.xs, KSpace.md, 0),
        child: Material(
          color: k.accentSoft,
          shape: const StadiumBorder(),
          child: InkWell(
            customBorder: const StadiumBorder(),
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: KSpace.md, vertical: 9),
              child: Row(children: [
                Text(emoji),
                const SizedBox(width: KSpace.sm),
                Expanded(
                  child: Text(text,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: k.ink, fontWeight: FontWeight.w600, fontSize: 13.5)),
                ),
                Icon(Icons.chevron_right, size: 18, color: k.inkMuted),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

/// The floating tab bar: a rounded card with a glowing pill behind the
/// selected tab that slides between tabs.
class _NavBar extends StatelessWidget {
  const _NavBar({required this.index, required this.onTap, required this.items});

  final int index;
  final ValueChanged<int> onTap;

  /// (icon, selected icon, label, badge count).
  final List<(IconData, IconData, String, int)> items;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return ColoredBox(
      color: k.background,
      child: SafeArea(
        top: false,
        minimum: const EdgeInsets.only(bottom: KSpace.sm),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(KSpace.md, KSpace.xs, KSpace.md, KSpace.xs),
          child: Container(
            height: 74,
            decoration: BoxDecoration(
              color: k.surfaceHigh,
              borderRadius: BorderRadius.circular(26),
              border: Border.all(color: k.line.withValues(alpha: k.isDark ? 1 : 0.7)),
              boxShadow: k.softShadow,
            ),
            child: Row(children: [
              for (final (i, (icon, selected, label, badge)) in items.indexed)
                Expanded(
                  child: _NavItem(
                    icon: i == index ? selected : icon,
                    label: label,
                    badge: badge,
                    selected: i == index,
                    onTap: () => onTap(i),
                  ),
                ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.label,
    required this.badge,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final int badge;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      child: InkResponse(
        onTap: onTap,
        radius: 40,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedContainer(
              duration: KMotion.medium,
              curve: KMotion.curve,
              width: selected ? 58 : 40,
              height: 32,
              decoration: ShapeDecoration(
                shape: const StadiumBorder(),
                gradient: selected ? k.accentGradient : null,
                shadows: selected && !k.flat
                    ? [BoxShadow(color: k.accent.withValues(alpha: 0.35), blurRadius: 12, offset: const Offset(0, 4))]
                    : const [],
              ),
              child: Badge(
                isLabelVisible: badge > 0,
                label: Text('$badge'),
                child: AnimatedScale(
                  scale: selected ? 1.08 : 1,
                  duration: KMotion.medium,
                  curve: Curves.easeOutBack,
                  child: Icon(icon, size: 22, color: selected ? k.onAccent : k.inkMuted),
                ),
              ),
            ),
            const SizedBox(height: 4),
            AnimatedDefaultTextStyle(
              duration: KMotion.fast,
              style: TextStyle(
                fontFamily: KFont.body,
                fontSize: 12,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected ? k.ink : k.inkMuted,
              ),
              child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
            const SizedBox(height: 3),
            AnimatedScale(
              scale: selected ? 1 : 0,
              duration: KMotion.medium,
              curve: Curves.easeOutBack,
              child: Container(
                width: 4,
                height: 4,
                decoration: BoxDecoration(color: k.signal, shape: BoxShape.circle),
              ),
            ),
          ],
        ),
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

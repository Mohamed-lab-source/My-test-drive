import 'package:flutter/material.dart';

import '../app_state.dart';
import 'guide_tab.dart';
import 'home_tab.dart';
import 'planner_tab.dart';
import 'practice_tab.dart';
import 'track_tab.dart';

class RootScreen extends StatefulWidget {
  const RootScreen({super.key, required this.state});

  final AppState state;

  @override
  State<RootScreen> createState() => _RootScreenState();
}

class _RootScreenState extends State<RootScreen> {
  int _tab = 0;

  void _goTo(int index) => setState(() => _tab = index);

  @override
  Widget build(BuildContext context) {
    final t = widget.state.tr;
    return Scaffold(
      body: IndexedStack(
        index: _tab,
        children: <Widget>[
          HomeTab(state: widget.state, onOpenPlan: () => _goTo(1), onOpenTrack: () => _goTo(4)),
          PlannerTab(state: widget.state),
          PracticeTab(state: widget.state),
          GuideTab(state: widget.state),
          TrackTab(state: widget.state, onSaved: () => _goTo(1)),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: _goTo,
        destinations: <NavigationDestination>[
          NavigationDestination(icon: const Icon(Icons.home_outlined), selectedIcon: const Icon(Icons.home), label: t('الرئيسية', 'Home')),
          NavigationDestination(icon: const Icon(Icons.bar_chart_outlined), selectedIcon: const Icon(Icons.bar_chart), label: t('الخطة', 'Plan')),
          NavigationDestination(icon: const Icon(Icons.menu_book_outlined), selectedIcon: const Icon(Icons.menu_book), label: t('تدريب', 'Practice')),
          NavigationDestination(icon: const Icon(Icons.auto_stories_outlined), selectedIcon: const Icon(Icons.auto_stories), label: t('الدليل', 'Guide')),
          NavigationDestination(icon: const Icon(Icons.explore_outlined), selectedIcon: const Icon(Icons.explore), label: t('المسار', 'Track')),
        ],
      ),
    );
  }
}

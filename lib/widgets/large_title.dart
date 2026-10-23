import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../app/theme.dart';

/// A screen with a big title that shrinks into a frosted, see-through bar
/// as you scroll (the way phone settings screens feel), and a soft bounce at
/// the ends. Give it the same ListView you'd put in a Scaffold body.
class KScaffold extends StatelessWidget {
  const KScaffold({
    super.key,
    required this.title,
    required this.body,
    this.actions = const [],
    this.floatingActionButton,
    this.floatingActionButtonLocation,
  });

  final Widget title;
  final ListView body;
  final List<Widget> actions;
  final Widget? floatingActionButton;
  final FloatingActionButtonLocation? floatingActionButtonLocation;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final theme = Theme.of(context);
    final canPop = ModalRoute.of(context)?.canPop ?? false;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return Scaffold(
      floatingActionButton: floatingActionButton,
      floatingActionButtonLocation: floatingActionButtonLocation,
      body: CupertinoTheme(
        data: CupertinoThemeData(
          brightness: theme.brightness,
          primaryColor: k.ink,
          scaffoldBackgroundColor: k.background,
          textTheme: CupertinoTextThemeData(
            primaryColor: k.ink,
            textStyle: TextStyle(fontFamily: KFont.body, fontSize: 16, color: k.ink),
            navTitleTextStyle:
                TextStyle(fontFamily: KFont.body, fontSize: 17, fontWeight: FontWeight.w600, color: k.ink),
            navLargeTitleTextStyle:
                TextStyle(fontFamily: KFont.display, fontSize: 31, fontWeight: FontWeight.w800, color: k.ink),
          ),
        ),
        child: CustomScrollView(
          controller: body.controller,
          physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
          slivers: [
            CupertinoSliverNavigationBar(
              largeTitle: DefaultTextStyle.merge(maxLines: 1, overflow: TextOverflow.ellipsis, child: title),
              transitionBetweenRoutes: false,
              automaticallyImplyLeading: false,
              automaticallyImplyTitle: false,
              // See-through: the page shows blurred behind the bar.
              backgroundColor: k.background.withValues(alpha: 0.78),
              border: null,
              leading: canPop
                  ? Material(
                      type: MaterialType.transparency,
                      child: IconButton(
                        tooltip: MaterialLocalizations.of(context).backButtonTooltip,
                        icon: Icon(rtl ? Icons.arrow_forward_ios_rounded : Icons.arrow_back_ios_new_rounded, size: 20),
                        onPressed: () => Navigator.maybePop(context),
                      ),
                    )
                  : null,
              trailing: actions.isEmpty
                  ? null
                  : Material(
                      type: MaterialType.transparency,
                      child: Row(mainAxisSize: MainAxisSize.min, children: actions),
                    ),
            ),
            SliverPadding(
              padding: (body.padding ?? EdgeInsets.zero).resolve(Directionality.of(context)).copyWith(top: KSpace.sm) +
                  EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom),
              sliver: SliverList(delegate: body.childrenDelegate),
            ),
          ],
        ),
      ),
    );
  }
}

import '../app/i18n.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../app/local_prefs.dart';
import '../app/theme.dart';
import '../models/social.dart';
import 'motion.dart';

/// Turns any error into one short, kind sentence that says what to do next.
/// Never shows raw technical text (which would also be English-only).
String friendlyError(Object error) {
  if (error is GoogleSignInException) {
    return error.code == GoogleSignInExceptionCode.canceled
        ? tr('Sign-in was cancelled. You can try again any time.')
        : tr("Google sign-in didn't work. Check your internet and try again.");
  }
  if (error is FirebaseAuthException) {
    return switch (error.code) {
      'network-request-failed' => tr('No internet right now. Connect and try again.'),
      'too-many-requests' => tr('Too many tries. Wait a minute, then try again.'),
      'credential-already-in-use' || 'account-exists-with-different-credential' =>
        tr('That Google account is already used in Khroga. Sign out, then sign in with it.'),
      'requires-recent-login' => tr('For your safety, please sign in again first.'),
      'user-disabled' => tr('This account is turned off. Contact us from the Play Store page.'),
      _ => tr("Sign-in didn't work. Please try again."),
    };
  }
  if (error is FirebaseException) {
    return switch (error.code) {
      'permission-denied' => tr("That isn't allowed. If it should be, tell us in Profile → Report a problem."),
      'unavailable' || 'deadline-exceeded' =>
        tr("You're offline or the connection is slow. Your saved things still work; try again soon."),
      'resource-exhausted' => tr('Khroga is very busy today. Please try again in a little while.'),
      'not-found' => tr('That no longer exists. It may have been deleted.'),
      'unauthenticated' => tr('Please sign in again.'),
      _ => tr("That didn't work. Please try again."),
    };
  }
  final raw = error.toString();
  if (RegExp('SocketException|TimeoutException|ClientException|Failed host lookup|Connection')
      .hasMatch(raw)) {
    return tr('No internet right now. Connect and try again.');
  }
  final text = raw.replaceFirst('Exception: ', '');
  return text.length > 160 || text.contains('Error') ? tr("That didn't work. Please try again.") : tr(text);
}

/// True for "no internet / too slow" problems (shown with a 📡).
bool isOfflineError(Object e) =>
    (e is FirebaseException && (e.code == 'unavailable' || e.code == 'deadline-exceeded')) ||
    (e is FirebaseAuthException && e.code == 'network-request-failed') ||
    RegExp('SocketException|TimeoutException|ClientException|Failed host lookup').hasMatch('$e');

/// A short message with an Undo button (deleting is never a dead end).
void showUndo(BuildContext context, String text, VoidCallback onUndo) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(text),
      duration: const Duration(seconds: 5),
      action: SnackBarAction(label: tr('Undo'), onPressed: onUndo),
    ));
}

void showError(BuildContext context, Object error) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(friendlyError(error))));
}

void showMessage(BuildContext context, String text, {String? actionLabel, VoidCallback? onAction}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(text),
      action: actionLabel == null || onAction == null
          ? null
          : SnackBarAction(label: actionLabel, onPressed: onAction),
    ));
}

/// Renders loading / error / data states the same way everywhere.
class AsyncView<T> extends StatelessWidget {
  const AsyncView({
    super.key,
    required this.value,
    required this.builder,
    this.onRetry,
  });

  final AsyncValue<T> value;
  final Widget Function(T data) builder;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return value.when(
      skipLoadingOnReload: true,
      data: builder,
      loading: () => const SkeletonList(),
      error: (e, _) => EmptyState(
        emoji: isOfflineError(e) ? '📡' : '🙈',
        title: tr("We couldn't load this"),
        message: friendlyError(e),
        actionLabel: onRetry == null ? null : tr('Try again'),
        onAction: onRetry,
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.emoji,
    required this.title,
    this.message,
    this.actionLabel,
    this.onAction,
  });

  final String emoji;
  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(KSpace.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            PopIn(
              child: Container(
                width: 104,
                height: 104,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [context.k.accentSoft, context.k.background]),
                ),
                child: Text(emoji, style: const TextStyle(fontSize: 48)),
              ),
            ),
            const SizedBox(height: KSpace.md),
            Text(tr(title), style: text.titleLarge, textAlign: TextAlign.center),
            if (message != null) ...[
              const SizedBox(height: KSpace.sm),
              Text(
                tr(message!),
                style: text.bodyMedium?.copyWith(color: context.k.inkMuted),
                textAlign: TextAlign.center,
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: KSpace.lg),
              FilledButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.trailing});

  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: KSpace.sm, top: KSpace.lg - 4),
      child: Row(
        children: [
          // Mono: a small red dot, like a recording light. Others: a color bar.
          context.k.flat
              ? Container(
                  width: 7,
                  height: 7,
                  margin: const EdgeInsetsDirectional.only(end: KSpace.sm + 2),
                  decoration: BoxDecoration(color: context.k.signal, shape: BoxShape.circle),
                )
              : Container(
                  width: 4,
                  height: 18,
                  margin: const EdgeInsetsDirectional.only(end: KSpace.sm),
                  decoration: ShapeDecoration(shape: const StadiumBorder(), gradient: context.k.accentGradient),
                ),
          Expanded(
            child: Text(text,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontFamily: KFont.display,
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                    )),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

/// Network image with a calm placeholder, never a crash. With "Data saver"
/// on, photos aren't downloaded at all.
class PlaceImage extends ConsumerWidget {
  const PlaceImage({
    super.key,
    required this.url,
    required this.emoji,
    this.width,
    this.height,
    this.radius = 14,
  });

  final String? url;
  final String emoji;
  final double? width;
  final double? height;
  final double radius;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final saver = ref.watch(appSettingsProvider.select((s) => s.dataSaver));
    final k = context.k;
    final placeholder = Container(
      width: width,
      height: height,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
          colors: [k.accentSoft, k.surfaceHigh],
        ),
      ),
      child: Text(emoji, style: TextStyle(fontSize: height != null && height! >= 120 ? 44 : 26)),
    );
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: url == null || saver
          ? placeholder
          : Image.network(
              url!,
              width: width,
              height: height,
              fit: BoxFit.cover,
              // Decode small thumbnails small: less memory and smoother lists.
              cacheWidth: width != null && width!.isFinite
                  ? (width! * MediaQuery.devicePixelRatioOf(context)).round()
                  : null,
              errorBuilder: (_, _, _) => placeholder,
              // Photos fade in over the placeholder instead of popping in.
              frameBuilder: (_, child, frame, sync) => sync
                  ? child
                  : Stack(fit: StackFit.passthrough, children: [
                      placeholder,
                      AnimatedOpacity(
                        opacity: frame == null ? 0 : 1,
                        duration: KMotion.medium,
                        curve: Curves.easeOut,
                        child: child,
                      ),
                    ]),
            ),
    );
  }
}

class Avatar extends StatelessWidget {
  const Avatar({super.key, required this.profile, this.size = 40});

  final PublicProfile? profile;
  final double size;

  @override
  Widget build(BuildContext context) {
    final url = profile?.photoUrl;
    return CircleAvatar(
      radius: size / 2,
      backgroundColor: context.k.accentSoft,
      foregroundImage: url == null ? null : NetworkImage(url),
      child: Text(
        profile?.initials ?? '?',
        style: TextStyle(
          color: context.k.accent,
          fontWeight: FontWeight.w700,
          fontSize: size * 0.38,
        ),
      ),
    );
  }
}

/// A small rounded label, e.g. "★ 4.5" or "Mall".
class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, this.color, this.textColor});

  final String text;
  final Color? color;
  final Color? textColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: ShapeDecoration(
        shape: const StadiumBorder(),
        color: color ?? context.k.surfaceHigh,
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: textColor ?? context.k.inkMuted,
        ),
      ),
    );
  }
}

/// Runs an async action with a spinner on the button and error handling.
class BusyButton extends StatefulWidget {
  const BusyButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.outlined = false,
  });

  final String label;
  final Future<void> Function() onPressed;
  final IconData? icon;
  final bool outlined;

  @override
  State<BusyButton> createState() => _BusyButtonState();
}

class _BusyButtonState extends State<BusyButton> {
  bool _busy = false;

  Future<void> _run() async {
    setState(() => _busy = true);
    try {
      await widget.onPressed();
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final child = _busy
        ? const SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(strokeWidth: 2.4),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (widget.icon != null) ...[
                Icon(widget.icon, size: 20),
                const SizedBox(width: KSpace.sm),
              ],
              Flexible(child: Text(widget.label, overflow: TextOverflow.ellipsis)),
            ],
          );
    final onPressed = _busy ? null : _run;
    return widget.outlined
        ? OutlinedButton(onPressed: onPressed, child: child)
        : FilledButton(onPressed: onPressed, child: child);
  }
}

/// Soft shimmering placeholder cards while something loads (calmer than a
/// spinner). Stays still when "Reduce motion" is on.
class SkeletonList extends StatefulWidget {
  const SkeletonList({super.key, this.rows = 4});

  final int rows;

  @override
  State<SkeletonList> createState() => _SkeletonListState();
}

class _SkeletonListState extends State<SkeletonList> with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final still = MediaQuery.of(context).disableAnimations;
    Widget bar(double w, double h, [double r = 8]) => Container(
          width: w,
          height: h,
          decoration: BoxDecoration(color: k.surfaceHigh, borderRadius: BorderRadius.circular(r)),
        );
    final body = ListView.builder(
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      padding: const EdgeInsets.all(KSpace.md),
      itemCount: widget.rows,
      itemBuilder: (_, _) => Container(
        margin: const EdgeInsets.only(bottom: KSpace.md),
        padding: const EdgeInsets.all(KSpace.sm + 4),
        decoration: BoxDecoration(
          color: k.surface,
          borderRadius: BorderRadius.circular(KRadius.card),
          border: Border.all(color: k.line.withValues(alpha: 0.6)),
        ),
        child: Row(children: [
          bar(64, 64, 14),
          const SizedBox(width: KSpace.md),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              bar(double.infinity, 14),
              const SizedBox(height: 8),
              bar(140, 12),
              const SizedBox(height: 8),
              bar(80, 12),
            ]),
          ),
        ]),
      ),
    );
    if (still) return body;
    // A soft band of light sweeps across the cards.
    return AnimatedBuilder(
      animation: _c,
      child: body,
      builder: (_, child) => ShaderMask(
        blendMode: BlendMode.srcATop,
        shaderCallback: (rect) => LinearGradient(
          begin: Alignment(-1.6 + 3.2 * _c.value, -0.3),
          end: Alignment(-0.6 + 3.2 * _c.value, 0.3),
          colors: [
            Colors.transparent,
            k.ink.withValues(alpha: k.isDark ? 0.06 : 0.05),
            Colors.transparent,
          ],
        ).createShader(rect),
        child: child,
      ),
    );
  }
}

/// The big colorful card at the top of a screen: a gradient with soft
/// circles of light. Text inside should use [KPalette.onHero].
class HeroCard extends StatelessWidget {
  const HeroCard({super.key, required this.child, this.padding = const EdgeInsets.all(KSpace.lg)});

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    Widget glow(double size, double alpha) => IgnorePointer(
          child: Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(colors: [
                Colors.white.withValues(alpha: alpha),
                Colors.white.withValues(alpha: 0),
              ]),
            ),
          ),
        );
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(KRadius.sheet),
        gradient: k.heroGradient,
        border: k.isDark ? Border.all(color: k.flat ? k.line : k.accent.withValues(alpha: 0.25)) : null,
        boxShadow: [
          BoxShadow(
            color: k.flat ? k.shadow : k.accent.withValues(alpha: k.isDark ? 0.18 : 0.28),
            blurRadius: 28,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Stack(children: [
        if (k.flat)
          Positioned.fill(child: DotGrid(color: k.onHero.withValues(alpha: k.isDark ? 0.07 : 0.10)))
        else ...[
          PositionedDirectional(top: -60, end: -40, child: glow(200, k.isDark ? 0.10 : 0.22)),
          PositionedDirectional(bottom: -80, start: -50, child: glow(180, k.isDark ? 0.06 : 0.14)),
        ],
        Padding(
          padding: padding,
          child: DefaultTextStyle.merge(
            style: TextStyle(color: k.onHero),
            child: IconTheme.merge(data: IconThemeData(color: k.onHero), child: child),
          ),
        ),
      ]),
    );
  }
}

/// "KHROGA" in dot-matrix letters with a red signal dot (the app's name
/// as a logo). In Arabic it uses the display font.
class KhrogaWordmark extends StatelessWidget {
  const KhrogaWordmark({super.key, this.size = 28, this.color});

  final double size;

  /// Defaults to the theme (ink in Mono, the accent gradient otherwise).
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final name = tr('Khroga');
    final latin = !RegExp(r'[\u0600-\u06FF]').hasMatch(name);
    // Latin: a dot-matrix wordmark with a red signal dot. Arabic keeps the
    // display font (the dot face has no Arabic letters).
    final text = Text(
      latin ? name.toUpperCase() : name,
      style: latin
          ? TextStyle(
              fontFamily: KFont.dots, fontFamilyFallback: KFont.dotsFallback, fontSize: size, fontWeight: FontWeight.w900)
          : TextStyle(fontFamily: KFont.display, fontSize: size * 0.9, fontWeight: FontWeight.w800),
    );
    return Row(mainAxisSize: MainAxisSize.min, children: [
      k.flat || color != null
          ? DefaultTextStyle.merge(style: TextStyle(color: color ?? k.ink), child: text)
          : ShaderMask(
              blendMode: BlendMode.srcIn,
              shaderCallback: (r) => k.accentGradient.createShader(r),
              child: text,
            ),
      Container(
        width: size / 4,
        height: size / 4,
        margin: EdgeInsetsDirectional.only(start: size / 7, top: size / 2.8),
        decoration: BoxDecoration(color: k.signal, shape: BoxShape.circle),
      ),
    ]);
  }
}

/// A full-screen version of the [HeroCard] gradient (sign-in, welcome).
class GradientBackdrop extends StatelessWidget {
  const GradientBackdrop({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final start = k.isDark ? Color.alphaBlend(k.heroStart, k.background) : k.heroStart;
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
          colors: [start, k.heroEnd],
        ),
      ),
      child: Stack(children: [
        if (k.flat) Positioned.fill(child: DotGrid(color: k.onHero.withValues(alpha: k.isDark ? 0.06 : 0.09))),
        PositionedDirectional(
          top: -120,
          end: -100,
          child: IgnorePointer(
            child: Container(
              width: 340,
              height: 340,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(colors: [
                  Colors.white.withValues(alpha: k.isDark ? 0.10 : 0.22),
                  Colors.white.withValues(alpha: 0),
                ]),
              ),
            ),
          ),
        ),
        Positioned.fill(child: child),
      ]),
    );
  }
}

/// A grid of shortcuts (three to a row): an icon tile and a short name.
/// [items] are (icon, name, longer description shown on long press, onTap).
class TileGrid extends StatelessWidget {
  const TileGrid({super.key, required this.items, this.title});

  final List<(IconData, String, String, VoidCallback)> items;
  final String? title;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
      if (title != null)
        Padding(
          padding: const EdgeInsetsDirectional.only(start: KSpace.sm, bottom: KSpace.sm, top: KSpace.sm),
          child: Text(title!.toUpperCase(),
              style: Theme.of(context).textTheme.labelSmall?.copyWith(letterSpacing: isArabic ? null : 0.6)),
        ),
      LayoutBuilder(builder: (context, c) {
        final perRow = c.maxWidth > 520 ? 4 : 3;
        final w = (c.maxWidth - (perRow - 1) * KSpace.sm) / perRow;
        return Wrap(spacing: KSpace.sm, runSpacing: KSpace.sm, children: [
          for (final (icon, name, about, onTap) in items)
            SizedBox(
              width: w,
              height: 104,
              child: Tooltip(
                message: about,
                triggerMode: TooltipTriggerMode.longPress,
                child: Pressable(
                  child: Card(
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: onTap,
                      child: Padding(
                        padding: const EdgeInsets.all(KSpace.sm),
                        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                          IconTile(icon, size: 42),
                          const SizedBox(height: 6),
                          Text(name,
                              textAlign: TextAlign.center,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.labelMedium?.copyWith(height: 1.2)),
                        ]),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ]);
      }),
    ]);
  }
}

/// A numbered step title ("1  When?"), for forms that go step by step.
class StepTitle extends StatelessWidget {
  const StepTitle(this.step, this.text, {super.key});

  final int step;
  final String text;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Padding(
      padding: const EdgeInsets.only(top: KSpace.lg, bottom: KSpace.sm),
      child: Row(children: [
        Container(
          width: 26,
          height: 26,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: k.accent, shape: BoxShape.circle),
          child: Text('$step', style: TextStyle(color: k.onAccent, fontWeight: FontWeight.w800, fontSize: 13)),
        ),
        const SizedBox(width: KSpace.sm + 2),
        Expanded(
          child: Text(text,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontFamily: KFont.display,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  )),
        ),
      ]),
    );
  }
}

/// A quiet grid of dots (a dot-matrix texture) behind header cards.
class DotGrid extends StatelessWidget {
  const DotGrid({super.key, required this.color, this.gap = 14, this.radius = 1.1});

  final Color color;
  final double gap;
  final double radius;

  @override
  Widget build(BuildContext context) =>
      IgnorePointer(child: CustomPaint(painter: _DotGridPainter(color, gap, radius)));
}

class _DotGridPainter extends CustomPainter {
  _DotGridPainter(this.color, this.gap, this.radius);

  final Color color;
  final double gap;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color;
    for (var y = gap / 2; y < size.height; y += gap) {
      for (var x = gap / 2; x < size.width; x += gap) {
        canvas.drawCircle(Offset(x, y), radius, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotGridPainter old) => old.color != color || old.gap != gap || old.radius != radius;
}

/// A big number in the dot-matrix face (counts up once), e.g. stats.
class DotNumber extends StatelessWidget {
  const DotNumber(this.value, {super.key, this.size = 30, this.color, this.suffix = ''});

  final int value;
  final double size;
  final Color? color;
  final String suffix;

  @override
  Widget build(BuildContext context) => CountUp(
        value,
        suffix: suffix,
        style: TextStyle(
          fontFamily: KFont.dots,
          fontFamilyFallback: KFont.dotsFallback,
          fontWeight: FontWeight.w900,
          fontSize: size,
          height: 1.05,
          color: color ?? context.k.ink,
        ),
      );
}

/// A small rounded, colored square behind a menu icon. Each icon gets its own
/// color (picked from the icon, so it's always the same one).
class IconTile extends StatelessWidget {
  const IconTile(this.icon, {super.key, this.size = 38, this.hue});

  final IconData icon;
  final double size;

  /// 0–360; default: from the icon.
  final double? hue;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final h = hue ?? (icon.codePoint * 47) % 360.0;
    // The Mono theme keeps icons monochrome too.
    final bg = k.flat
        ? k.surfaceHigh
        : (k.isDark ? HSLColor.fromAHSL(1, h, 0.45, 0.22) : HSLColor.fromAHSL(1, h, 0.75, 0.93)).toColor();
    final fg = k.flat
        ? k.ink
        : (k.isDark ? HSLColor.fromAHSL(1, h, 0.85, 0.78) : HSLColor.fromAHSL(1, h, 0.7, 0.32)).toColor();
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(size * 0.32)),
      child: Icon(icon, size: size * 0.55, color: fg),
    );
  }
}

/// A rounded group of menu rows, with thin lines between them.
class MenuGroup extends StatelessWidget {
  const MenuGroup({super.key, required this.children, this.title});

  final List<Widget> children;
  final String? title;

  @override
  Widget build(BuildContext context) {
    final rows = children.where((c) => c is! Divider).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (title != null)
          Padding(
            padding: const EdgeInsetsDirectional.only(start: KSpace.sm, bottom: KSpace.sm, top: KSpace.sm),
            child: Text(title!.toUpperCase(),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(letterSpacing: isArabic ? null : 0.6)),
          ),
        Card(
          clipBehavior: Clip.antiAlias,
          child: Column(children: [
            for (var i = 0; i < rows.length; i++) ...[
              if (i > 0) const Divider(indent: 68),
              rows[i],
            ],
          ]),
        ),
      ],
    );
  }
}

/// The main call-to-action: a pill with the theme's gradient and a glow.
class GradientButton extends StatelessWidget {
  const GradientButton({super.key, required this.label, required this.onPressed, this.icon});

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final enabled = onPressed != null;
    return Pressable(
      child: AnimatedContainer(
        duration: KMotion.medium,
        decoration: ShapeDecoration(
          shape: const StadiumBorder(),
          gradient: enabled ? k.accentGradient : null,
          color: enabled ? null : k.line,
          shadows: enabled
              ? [
                  BoxShadow(
                    color: k.flat ? k.shadow : k.accent.withValues(alpha: 0.35),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ]
              : const [],
        ),
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            customBorder: const StadiumBorder(),
            onTap: onPressed == null
                ? null
                : () {
                    // A light tap feel for the main buttons (Profile → Vibrate on taps).
                    try {
                      if (ProviderScope.containerOf(context, listen: false).read(phoneSettingsProvider).haptics) {
                        HapticFeedback.lightImpact();
                      }
                    } catch (_) {}
                    onPressed!();
                  },
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 58),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: KSpace.lg),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (icon != null) ...[
                      Icon(icon, color: enabled ? k.onAccent : k.inkMuted, size: 22),
                      const SizedBox(width: KSpace.sm),
                    ],
                    Flexible(
                      child: Text(
                        label,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontFamily: KFont.display,
                          fontSize: 16.5,
                          fontWeight: FontWeight.w700,
                          color: enabled ? k.onAccent : k.inkMuted,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

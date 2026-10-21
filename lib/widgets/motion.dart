import 'package:flutter/material.dart';

import '../app/theme.dart';

/// Small, one-shot animations that make the app feel alive. Every one of
/// them stays still when "Reduce motion" is on (or the phone asks for it),
/// and none of them repeats forever.

bool _still(BuildContext context) => MediaQuery.of(context).disableAnimations;

/// Fades and slides its child in once, a little after the ones above it
/// ([index] staggers lists: each item starts 45 ms after the previous one).
class FadeSlideIn extends StatefulWidget {
  const FadeSlideIn({super.key, required this.child, this.index = 0, this.offset = 18});

  final Widget child;
  final int index;

  /// How far (logical pixels) it travels upwards.
  final double offset;

  @override
  State<FadeSlideIn> createState() => _FadeSlideInState();
}

class _FadeSlideInState extends State<FadeSlideIn> with SingleTickerProviderStateMixin {
  static const _step = 45;
  static const _base = 420;
  late final int _delay = widget.index.clamp(0, 8) * _step;
  late final AnimationController _c =
      AnimationController(vsync: this, duration: Duration(milliseconds: _base + _delay));
  late final Animation<double> _t = CurvedAnimation(
    parent: _c,
    curve: Interval(_delay / (_base + _delay), 1, curve: KMotion.curve),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_c.isDismissed) {
      _still(context) ? _c.value = 1 : _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _t,
      child: widget.child,
      builder: (_, child) => Opacity(
        opacity: _t.value,
        child: Transform.translate(offset: Offset(0, (1 - _t.value) * widget.offset), child: child),
      ),
    );
  }
}

/// Shrinks a touch while pressed, like a real button. It only listens, so
/// the child's own taps work as before.
class Pressable extends StatefulWidget {
  const Pressable({super.key, required this.child, this.scale = 0.97});

  final Widget child;
  final double scale;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  void _set(bool v) {
    if (_down != v) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    if (_still(context)) return widget.child;
    return Listener(
      onPointerDown: (_) => _set(true),
      onPointerUp: (_) => _set(false),
      onPointerCancel: (_) => _set(false),
      child: AnimatedScale(
        scale: _down ? widget.scale : 1,
        duration: KMotion.fast,
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}

/// Pops its child in once (a gentle overshoot), e.g. a big emoji.
class PopIn extends StatelessWidget {
  const PopIn({super.key, required this.child, this.delay = Duration.zero});

  final Widget child;
  final Duration delay;

  @override
  Widget build(BuildContext context) {
    if (_still(context)) return child;
    final total = KMotion.slow + delay;
    final start = delay.inMilliseconds / total.inMilliseconds;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: total,
      curve: Interval(start, 1, curve: Curves.easeOutBack),
      child: child,
      builder: (_, t, child) => Opacity(
        opacity: t.clamp(0, 1),
        child: Transform.scale(scale: 0.6 + 0.4 * t, child: child),
      ),
    );
  }
}

/// A number that counts up to [value] once (stats, points).
class CountUp extends StatelessWidget {
  const CountUp(this.value, {super.key, this.style, this.suffix = ''});

  final int value;
  final TextStyle? style;
  final String suffix;

  @override
  Widget build(BuildContext context) {
    if (_still(context) || value == 0) return Text('$value$suffix', style: style);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value.toDouble()),
      duration: const Duration(milliseconds: 900),
      curve: Curves.easeOutCubic,
      builder: (_, v, _) => Text('${v.round()}$suffix', style: style),
    );
  }
}

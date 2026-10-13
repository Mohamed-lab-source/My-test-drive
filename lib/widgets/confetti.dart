import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../app/theme.dart';

/// A short burst of falling confetti (drawn, no package). Shows nothing when
/// the phone asks for less motion.
class Confetti extends StatefulWidget {
  const Confetti({super.key, this.height = 160});

  final double height;

  @override
  State<Confetti> createState() => _ConfettiState();
}

class _ConfettiState extends State<Confetti> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 2200));
  final _bits = List.generate(42, (i) {
    final r = math.Random(i * 7919);
    return (
      x: r.nextDouble(),
      speed: 0.6 + r.nextDouble() * 0.8,
      spin: r.nextDouble() * 6,
      size: 4 + r.nextDouble() * 5,
      hue: r.nextInt(5),
    );
  });

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!MediaQuery.of(context).disableAnimations && !_c.isAnimating && _c.value == 0) _c.forward();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.of(context).disableAnimations) return SizedBox(height: widget.height * 0.2);
    final k = context.k;
    final base = HSLColor.fromColor(k.accent);
    final colors = [
      for (final shift in [0.0, 60.0, 140.0, 200.0, 290.0]) base.withHue((base.hue + shift) % 360).toColor(),
    ];
    return IgnorePointer(
      child: SizedBox(
        height: widget.height,
        width: double.infinity,
        child: AnimatedBuilder(
          animation: _c,
          builder: (_, _) => CustomPaint(painter: _ConfettiPainter(_c.value, _bits, colors)),
        ),
      ),
    );
  }
}

class _ConfettiPainter extends CustomPainter {
  _ConfettiPainter(this.t, this.bits, this.colors);

  final double t;
  final List<({double x, double speed, double spin, double size, int hue})> bits;
  final List<Color> colors;

  @override
  void paint(Canvas canvas, Size size) {
    if (t == 0 || t == 1) return;
    final fade = t > 0.75 ? (1 - t) / 0.25 : 1.0;
    for (final b in bits) {
      final y = (t * b.speed * 1.3) * size.height - 10;
      if (y > size.height) continue;
      final x = b.x * size.width + math.sin((t + b.x) * 8) * 12;
      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(t * b.spin * math.pi);
      canvas.drawRect(
        Rect.fromCenter(center: Offset.zero, width: b.size, height: b.size * 0.5),
        Paint()..color = colors[b.hue % colors.length].withValues(alpha: fade),
      );
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_ConfettiPainter old) => old.t != t;
}

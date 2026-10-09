import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:share_plus/share_plus.dart';

import '../app/i18n.dart';
import '../app/theme.dart';
import '../app/web_host.dart';
import 'common.dart';

/// A tall picture card (story size) for WhatsApp status, Instagram stories
/// or a chat. Everything on it comes from your own plan or our map data.
class StoryCard extends StatelessWidget {
  const StoryCard({
    super.key,
    required this.emoji,
    required this.title,
    this.subtitle,
    required this.lines,
  });

  final String emoji;
  final String title;
  final String? subtitle;

  /// (emoji, main text, small text)
  final List<(String, String, String?)> lines;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final host = webHost();
    return AspectRatio(
      aspectRatio: 9 / 16,
      child: Container(
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [k.accent, Color.lerp(k.accent, k.background, 0.55)!],
          ),
        ),
        child: DefaultTextStyle(
          style: TextStyle(color: k.onAccent),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(emoji, style: const TextStyle(fontSize: 44)),
              const SizedBox(height: 8),
              Text(
                title,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: k.onAccent,
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  height: 1.15,
                ),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 4),
                Text(
                  subtitle!,
                  style: TextStyle(
                    color: k.onAccent.withValues(alpha: 0.85),
                    fontSize: 15,
                  ),
                ),
              ],
              const SizedBox(height: 18),
              // Long plans are cut off neatly rather than overflowing.
              Expanded(
                child: SingleChildScrollView(
                  physics: const NeverScrollableScrollPhysics(),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final (e, main, small) in lines.take(6))
                        Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: k.onAccent.withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Row(
                            children: [
                              Text(e, style: const TextStyle(fontSize: 22)),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      main,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        color: k.onAccent,
                                        fontWeight: FontWeight.w700,
                                        fontSize: 15,
                                      ),
                                    ),
                                    if (small != null && small.isNotEmpty)
                                      Text(
                                        small,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          color: k.onAccent.withValues(
                                            alpha: 0.8,
                                          ),
                                          fontSize: 12,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.asset(
                      'assets/icon/khroga.png',
                      width: 30,
                      height: 30,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      host == null
                          ? tr('Made with Khroga')
                          : '${tr('Made with Khroga')} · $host',
                      style: TextStyle(
                        color: k.onAccent,
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Shows a preview of [card] and shares it as a picture (with [text] and its
/// link alongside, for apps that keep text).
Future<void> sharePictureCard(BuildContext context, Widget card, String text) {
  final key = GlobalKey();
  return showDialog<void>(
    context: context,
    builder: (dialogContext) => Dialog(
      insetPadding: const EdgeInsets.all(KSpace.lg),
      child: Padding(
        padding: const EdgeInsets.all(KSpace.md),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              child: FittedBox(
                child: SizedBox(
                  width: 300,
                  child: RepaintBoundary(key: key, child: card),
                ),
              ),
            ),
            const SizedBox(height: KSpace.md),
            BusyButton(
              label: tr('Share picture'),
              icon: Icons.image_outlined,
              onPressed: () async {
                try {
                  final boundary =
                      key.currentContext!.findRenderObject()!
                          as RenderRepaintBoundary;
                  final image = await boundary.toImage(pixelRatio: 3.6);
                  final data = await image.toByteData(
                    format: ui.ImageByteFormat.png,
                  );
                  if (data == null) return;
                  await SharePlus.instance.share(
                    ShareParams(
                      files: [
                        XFile.fromData(
                          data.buffer.asUint8List(),
                          mimeType: 'image/png',
                          name: 'khroga.png',
                        ),
                      ],
                      text: text,
                    ),
                  );
                  if (dialogContext.mounted) Navigator.pop(dialogContext);
                } catch (e) {
                  if (dialogContext.mounted) showError(dialogContext, e);
                }
              },
            ),
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: Text(tr('Cancel')),
            ),
          ],
        ),
      ),
    ),
  );
}

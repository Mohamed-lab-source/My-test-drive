import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../app/theme.dart';
import '../models/social.dart';

/// Turns any error into one short sentence a person can act on.
String friendlyError(Object error) {
  if (error is GoogleSignInException) {
    return error.code == GoogleSignInExceptionCode.canceled
        ? 'Sign-in was cancelled.'
        : 'Google sign-in failed. Please try again.';
  }
  if (error is FirebaseAuthException) {
    return error.message ?? 'Sign-in failed. Please try again.';
  }
  if (error is FirebaseException) {
    return switch (error.code) {
      'permission-denied' => "You don't have access to that.",
      'unavailable' => "You're offline. Check your internet connection.",
      _ => error.message ?? 'Something went wrong. Please try again.',
    };
  }
  final text = error.toString().replaceFirst('Exception: ', '');
  return text.length > 160 ? 'Something went wrong. Please try again.' : text;
}

void showError(BuildContext context, Object error) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(friendlyError(error))));
}

void showMessage(BuildContext context, String text) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(text)));
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
      loading: () => const Center(
        child: Padding(
          padding: EdgeInsets.all(KSpace.xl),
          child: CircularProgressIndicator(),
        ),
      ),
      error: (e, _) => EmptyState(
        emoji: '⚠️',
        title: 'Could not load this',
        message: friendlyError(e),
        actionLabel: onRetry == null ? null : 'Try again',
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
            Text(emoji, style: const TextStyle(fontSize: 44)),
            const SizedBox(height: KSpace.md),
            Text(title, style: text.titleLarge, textAlign: TextAlign.center),
            if (message != null) ...[
              const SizedBox(height: KSpace.sm),
              Text(
                message!,
                style: text.bodyMedium?.copyWith(color: KColors.inkMuted),
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
      padding: const EdgeInsets.only(bottom: KSpace.sm, top: KSpace.md),
      child: Row(
        children: [
          Expanded(
            child: Text(text, style: Theme.of(context).textTheme.titleMedium),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

/// Network image with a calm placeholder, never a crash.
class PlaceImage extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final placeholder = Container(
      width: width,
      height: height,
      color: KColors.accentSoft,
      alignment: Alignment.center,
      child: Text(emoji, style: const TextStyle(fontSize: 26)),
    );
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: url == null
          ? placeholder
          : Image.network(
              url!,
              width: width,
              height: height,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => placeholder,
              loadingBuilder: (_, child, progress) =>
                  progress == null ? child : placeholder,
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
      backgroundColor: KColors.accentSoft,
      foregroundImage: url == null ? null : NetworkImage(url),
      child: Text(
        profile?.initials ?? '?',
        style: TextStyle(
          color: KColors.accent,
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
        color: color ?? KColors.background,
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: textColor ?? KColors.inkMuted,
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

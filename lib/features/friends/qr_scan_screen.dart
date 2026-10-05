import '../../app/i18n.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../data/providers.dart';
import '../../widgets/common.dart';
import 'friends_screen.dart';

class QrScanScreen extends ConsumerStatefulWidget {
  const QrScanScreen({super.key});

  @override
  ConsumerState<QrScanScreen> createState() => _QrScanScreenState();
}

class _QrScanScreenState extends ConsumerState<QrScanScreen> {
  bool _handled = false;

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_handled) return;
    final value = capture.barcodes
        .map((b) => b.rawValue)
        .whereType<String>()
        .where((v) => v.startsWith(qrPrefix) || v.startsWith(groupQrPrefix))
        .firstOrNull;
    if (value == null) return;
    _handled = true;

    // A group invite QR: join the group.
    if (value.startsWith(groupQrPrefix)) {
      final router = GoRouter.of(context);
      try {
        final uid = ref.read(uidProvider);
        if (uid == null) throw Exception(tr('Please sign in again.'));
        final groupId = await ref
            .read(groupsRepositoryProvider)
            .join(uid, value.substring(groupQrPrefix.length));
        router.pushReplacement('/group/$groupId');
      } catch (e) {
        if (mounted) {
          showError(context, e);
          Navigator.of(context).pop();
        }
      }
      return;
    }

    final other = value.substring(qrPrefix.length);
    final me = ref.read(uidProvider);
    final navigator = Navigator.of(context);
    try {
      if (me == null || other == me) throw Exception(tr("That's your own code 🙂"));
      final profile = await ref.read(socialRepositoryProvider).profile(other);
      if (profile == null) throw Exception(tr('That Khroga account no longer exists.'));
      await ref.read(socialRepositoryProvider).sendRequest(me, other);
      if (mounted) showMessage(context, trf('Friend request sent to {name}', {'name': profile.displayName}));
    } catch (e) {
      if (mounted) showError(context, e);
    }
    navigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr("Scan a friend or group code"))),
      body: MobileScanner(
        onDetect: _onDetect,
        errorBuilder: (context, error) => EmptyState(
          emoji: '📷',
          title: tr('Camera not available'),
          message: error.errorCode == MobileScannerErrorCode.permissionDenied
              ? tr('Allow camera access for Khroga in your phone settings.')
              : tr('Could not start the camera.'),
        ),
      ),
    );
  }
}

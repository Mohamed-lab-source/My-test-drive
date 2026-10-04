import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
        .where((v) => v.startsWith(qrPrefix))
        .firstOrNull;
    if (value == null) return;
    _handled = true;

    final other = value.substring(qrPrefix.length);
    final me = ref.read(uidProvider);
    final navigator = Navigator.of(context);
    try {
      if (me == null || other == me) throw Exception("That's your own code 🙂");
      final profile = await ref.read(socialRepositoryProvider).profile(other);
      if (profile == null) throw Exception('That Khroga account no longer exists.');
      await ref.read(socialRepositoryProvider).sendRequest(me, other);
      if (mounted) showMessage(context, 'Friend request sent to ${profile.displayName}');
    } catch (e) {
      if (mounted) showError(context, e);
    }
    navigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Scan a friend's code")),
      body: MobileScanner(
        onDetect: _onDetect,
        errorBuilder: (context, error) => EmptyState(
          emoji: '📷',
          title: 'Camera not available',
          message: error.errorCode == MobileScannerErrorCode.permissionDenied
              ? 'Allow camera access for Khroga in your phone settings.'
              : 'Could not start the camera.',
        ),
      ),
    );
  }
}

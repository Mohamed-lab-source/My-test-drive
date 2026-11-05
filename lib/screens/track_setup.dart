import 'package:flutter/material.dart';

import '../app_state.dart';
import '../content.dart';
import '../theme.dart';

/// Lets the student pick the Year 2 elective of [trackIndex], then sets up
/// their subjects. Returns true if the track was applied.
Future<bool> showTrackSetup(BuildContext context, AppState state, int trackIndex) async {
  final t = state.tr;
  final ar = state.isArabic;
  final info = tracks[trackIndex];
  final picked = await showModalBottomSheet<int>(
    context: context,
    isScrollControlled: true,
    builder: (sheetContext) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(ar ? info.nameAr : info.nameEn, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Text(
                t('اختار المادة الاختيارية بتاعتك في تانية ثانوي:', 'Pick your Year 2 elective subject:'),
                style: const TextStyle(fontSize: 14, color: AppColors.muted),
              ),
              const SizedBox(height: 14),
              for (var i = 0; i < info.electives.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: SizedBox(
                    height: 56,
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(sheetContext).pop(i),
                      style: OutlinedButton.styleFrom(
                        backgroundColor: state.track == trackIndex && state.elective == i ? AppColors.blueSoft : AppColors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      child: Text(
                        ar ? (subjectInfo(info.electives[i])?.nameAr ?? '') : (subjectInfo(info.electives[i])?.nameEn ?? ''),
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ),
              const SizedBox(height: 4),
              Text(
                t('هنظبط موادك على المسار ده. الدرجات اللي سجلتها لنفس المواد هتفضل محفوظة.',
                    'Your subjects will be set to this track. Scores you saved for the same subjects are kept.'),
                style: const TextStyle(fontSize: 12, height: 1.6, color: AppColors.muted),
              ),
            ],
          ),
        ),
      );
    },
  );
  if (picked == null) return false;
  state.applyTrack(trackIndex, picked);
  if (context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(t('تمام! موادك اتظبطت على مسارك.', 'Done! Your subjects now match your track.'))),
    );
  }
  return true;
}

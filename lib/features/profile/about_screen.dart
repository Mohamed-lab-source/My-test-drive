import '../../app/i18n.dart';
import 'package:flutter/material.dart';
import '../../widgets/large_title.dart';

import '../../app/theme.dart';
import '../../widgets/launchers.dart';

const appVersion = '1.9.2';

/// What Khroga is, where its facts come from, and that it's free.
class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    Widget section(String emoji, String title, String body) => Padding(
          padding: const EdgeInsets.only(bottom: KSpace.md),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(emoji, style: const TextStyle(fontSize: 22)),
              const SizedBox(width: KSpace.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(tr(title), style: text.titleMedium),
                    const SizedBox(height: 2),
                    Text(tr(body), style: text.bodyMedium?.copyWith(color: context.k.inkMuted)),
                  ],
                ),
              ),
            ],
          ),
        );

    return KScaffold(
      title: Text(tr('About Khroga')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(KSpace.lg, 0, KSpace.lg, KSpace.xl),
        children: [
          Center(child: Image.asset('assets/icon/khroga.png', width: 96, height: 96)),
          const SizedBox(height: KSpace.sm),
          Center(child: Text(tr('Khroga'), style: text.headlineMedium)),
          Center(child: Text(trf('Version {v}', {'v': appVersion}), style: text.bodySmall)),
          const SizedBox(height: KSpace.lg),
          section('📍', 'Only real places',
              'Every place comes from OpenStreetMap and Overture Maps. If a fact is unknown, '
                  'we say so instead of guessing.'),
          section('🤖', 'AI that can’t make things up',
              'The AI only picks from real places we give it. It never writes prices, '
                  'and if it’s busy we build the plan ourselves.'),
          section('🌦️', 'Weather', 'Forecasts from Open-Meteo (free and open).'),
          section('📷', 'Photos', 'Real photos from Wikimedia Commons, with credit.'),
          section('🔒', 'Your data',
              'Plans, favorites and notes are private to your account. Recently viewed, '
                  'searches, your star ratings and ticked stops stay on this phone only.'),
          section('💚', 'Free', 'Khroga has no ads and costs nothing.'),
          const SizedBox(height: KSpace.sm),
          OutlinedButton(
            onPressed: () => openWebsite('https://www.openstreetmap.org/copyright'),
            child: Text(tr('© OpenStreetMap contributors')),
          ),
          const SizedBox(height: KSpace.sm),
          OutlinedButton(
            onPressed: () => openWebsite('https://overturemaps.org'),
            child: Text(tr('Overture Maps Foundation')),
          ),
          const SizedBox(height: KSpace.sm),
          OutlinedButton(
            onPressed: () => showLicensePage(
                context: context, applicationName: 'Khroga', applicationVersion: appVersion),
            child: Text(tr('Open-source licences')),
          ),
        ],
      ),
    );
  }
}

/// Share messages with links that open Khroga (or its web page with the
/// download button for people who don't have it yet).
library;

import '../models/plan.dart';
import 'i18n.dart';
import 'links.dart';
import 'web_host.dart';

/// "Open in Khroga: https://…" lines, or nothing for unconnected test builds.
String _line(String label, Uri Function(String host) link) {
  final host = webHost();
  return host == null ? '' : '\n$label: ${link(host)}';
}

String placeLinkLine(String placeId) =>
    _line(tr('Open in Khroga'), (h) => placeLink(h, placeId));

String planLinkLine(OutingPlan plan) => _line(
    tr('Open this plan in Khroga'),
    (h) => planLink(h, (
          city: plan.request.city,
          title: plan.title,
          date: plan.request.date,
          stops: [
            for (final s in plan.stops)
              (placeId: s.placeId, time: s.startTime, minutes: s.durationMinutes),
          ],
        )));

String groupInviteText(String name, String code) =>
    trf('Join "{name}" on Khroga with code {code}', {'name': name, 'code': code}) +
    _line(tr('Tap to join'), (h) => groupLink(h, code));

String friendInviteText(String uid, String? username) =>
    (username == null
        ? tr('Add me on Khroga')
        : trf('Add me on Khroga: @{name}', {'name': username})) +
    _line(tr('Tap to add me'), (h) => friendLink(h, uid));

String appInviteText() =>
    tr("I plan outings in Cairo, Giza and Alexandria with Khroga. It only suggests real "
        "places and it's free.") +
    _line(tr('Get it here'), appLink);

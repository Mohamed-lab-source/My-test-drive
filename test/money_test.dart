import 'package:flutter_test/flutter_test.dart';
import 'package:khroga/app/money.dart';
import 'package:khroga/planner/planner.dart' show haversineKm;

OrderItem _o(String uid, double price, {int qty = 1, bool shared = false}) =>
    OrderItem(id: '$uid$price', uid: uid, name: uid, item: 'Test item', price: price, qty: qty, shared: shared);

void main() {
  test('everyone pays their own items, shared ones are split, extras on top', () {
    final items = [_o('a', 100), _o('b', 50, qty: 2), _o('a', 90, shared: true)];
    final s = sharesFor(items, ['a', 'b', 'c'], 0);
    expect(s['a'], 130);
    expect(s['b'], 130);
    expect(s['c'], 30);
    final withExtras = sharesFor(items, ['a', 'b', 'c'], 10);
    expect(withExtras['a'], closeTo(143, 1e-9));
    expect(billTotal(items, 10), closeTo(319, 1e-9));
    expect(sharesFor(const [], ['a'], 12), {'a': 0.0});
  });

  test('amounts round up to whole pounds', () {
    expect(amountToSend(130), 130);
    expect(amountToSend(130.01), 131);
    expect(amountToSend(0), 0);
  });

  test('only real InstaPay links and addresses are accepted', () {
    expect(isInstapayLink('https://ipn.eg/S/testname/instapay/AbC123'), isTrue);
    expect(isInstapayLink('http://ipn.eg/S/testname'), isFalse);
    expect(isInstapayLink('https://ipn.eg.evil.com/S/x'), isFalse);
    expect(isInstapayLink('https://example.com/ipn.eg/S/x'), isFalse);
    expect(isInstapayAddress('testname@instapay'), isTrue);
    expect(isInstapayAddress('01012345678'), isTrue);
    expect(isInstapayAddress('0101234567'), isFalse);
    expect(isInstapayAddress('test@gmail.com'), isFalse);
  });

  test('starting points are rounded to about 1 km', () {
    expect(roundForPrivacy(30.04449, 31.23571), (30.04, 31.24));
  });

  test('the fair middle stays near most people, not the one far away', () {
    const points = [(30.00, 31.00), (30.01, 31.00), (30.00, 31.01), (30.30, 31.30)];
    final c = fairCenter(points)!;
    const mean = (30.0775, 31.0775);
    expect(haversineKm(c.$1, c.$2, 30.0, 31.0), lessThan(haversineKm(mean.$1, mean.$2, 30.0, 31.0)));
    expect(haversineKm(c.$1, c.$2, 30.0, 31.0), lessThan(2.5));
    expect(fairCenter(const []), isNull);
    expect(fairCenter(const [(30.0, 31.0)]), (30.0, 31.0));
    expect(farthestKm(c, points), greaterThan(40));
  });
}

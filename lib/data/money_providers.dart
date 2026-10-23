import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app/money.dart';
import 'money_repository.dart';
import 'providers.dart';

final moneyRepositoryProvider = Provider((ref) => MoneyRepository(ref.watch(firestoreProvider)));

final moneySettingsProvider = StreamProvider.autoDispose.family<MoneySettings, String>(
    (ref, groupId) => ref.watch(moneyRepositoryProvider).watchSettings(groupId));

final groupOrdersProvider = StreamProvider.autoDispose.family<List<OrderItem>, String>(
    (ref, groupId) => ref.watch(moneyRepositoryProvider).watchOrders(groupId));

final groupPaidProvider = StreamProvider.autoDispose.family<Map<String, double>, String>(
    (ref, groupId) => ref.watch(moneyRepositoryProvider).watchPaid(groupId));

final groupOriginsProvider = StreamProvider.autoDispose.family<List<Origin>, String>(
    (ref, groupId) => ref.watch(moneyRepositoryProvider).watchOrigins(groupId));

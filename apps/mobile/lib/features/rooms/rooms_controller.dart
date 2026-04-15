import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import 'models/room.dart';
import 'rooms_repository.dart';

final roomsRepositoryProvider = Provider<RoomsRepository>((ref) {
  return RoomsRepository(api: ref.watch(apiClientProvider));
});

class RoomsListFilter {
  const RoomsListFilter({this.category, this.country});
  final RoomCategory? category;
  final String? country;

  RoomsListFilter copyWith({RoomCategory? category, String? country}) =>
      RoomsListFilter(
        category: category ?? this.category,
        country: country ?? this.country,
      );
}

final roomsFilterProvider = StateProvider<RoomsListFilter>(
  (_) => const RoomsListFilter(),
);

/// Paginated first page of the Discover list. Refreshes when the filter
/// changes. Pagination beyond page 1 arrives in a follow-up phase.
final roomsListProvider = FutureProvider<PaginatedRooms>((ref) async {
  final filter = ref.watch(roomsFilterProvider);
  final repo = ref.watch(roomsRepositoryProvider);
  return repo.list(category: filter.category, country: filter.country);
});

final roomDetailProvider =
    FutureProvider.family<RoomDetail, String>((ref, id) async {
      final repo = ref.watch(roomsRepositoryProvider);
      return repo.getById(id);
    });

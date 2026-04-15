import '../../core/api/api_client.dart';
import 'models/room.dart';

class RoomsRepository {
  RoomsRepository({required this.api});
  final ApiClient api;

  Future<PaginatedRooms> list({
    RoomCategory? category,
    String? country,
    int page = 1,
    int pageSize = 20,
  }) async {
    final query = <String, String>{
      'page': '$page',
      'pageSize': '$pageSize',
      if (category != null) 'category': category.name,
      if (country != null) 'country': country,
    };
    final qs = query.entries.map((e) => '${e.key}=${e.value}').join('&');
    final data = await api.get('/rooms?$qs');
    return PaginatedRooms.fromJson(data);
  }

  Future<RoomSummary> create({
    required String name,
    String? description,
    required RoomCategory category,
    String? country,
    int? maxSeats,
  }) async {
    final body = <String, dynamic>{
      'name': name,
      'category': category.name,
      if (description != null && description.isNotEmpty) 'description': description,
      if (country != null) 'country': country,
      if (maxSeats != null) 'maxSeats': maxSeats,
    };
    final data = await api.post('/rooms', body);
    return RoomSummary.fromJson(data);
  }

  Future<RoomDetail> getById(String id) async {
    final data = await api.get('/rooms/$id');
    return RoomDetail.fromJson(data);
  }

  Future<void> close(String id) async {
    await api.post('/rooms/$id/close', <String, dynamic>{}).catchError((_) {
      // Non-fatal: server may have already closed it.
    });
  }
}

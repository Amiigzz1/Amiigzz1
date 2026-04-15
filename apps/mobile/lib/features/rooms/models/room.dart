/// Categories as defined by the backend.
enum RoomCategory { gaming, music, chat, story }

RoomCategory _categoryFromString(String s) {
  return RoomCategory.values.firstWhere(
    (c) => c.name == s,
    orElse: () => RoomCategory.chat,
  );
}

/// Slim owner projection attached to rooms.
class RoomOwner {
  const RoomOwner({required this.id, this.displayName, this.avatarUrl});

  final String id;
  final String? displayName;
  final String? avatarUrl;

  factory RoomOwner.fromJson(Map<String, dynamic> json) => RoomOwner(
    id: json['id'] as String,
    displayName: json['displayName'] as String?,
    avatarUrl: json['avatarUrl'] as String?,
  );
}

class RoomSummary {
  const RoomSummary({
    required this.id,
    required this.name,
    this.description,
    required this.category,
    this.country,
    required this.maxSeats,
    required this.locked,
    required this.listenersLive,
    required this.speakersLive,
    required this.owner,
    required this.createdAt,
  });

  final String id;
  final String name;
  final String? description;
  final RoomCategory category;
  final String? country;
  final int maxSeats;
  final bool locked;
  final int listenersLive;
  final int speakersLive;
  final RoomOwner owner;
  final String createdAt;

  factory RoomSummary.fromJson(Map<String, dynamic> json) => RoomSummary(
    id: json['id'] as String,
    name: json['name'] as String,
    description: json['description'] as String?,
    category: _categoryFromString(json['category'] as String),
    country: json['country'] as String?,
    maxSeats: json['maxSeats'] as int,
    locked: json['locked'] as bool,
    listenersLive: json['listenersLive'] as int? ?? 0,
    speakersLive: json['speakersLive'] as int? ?? 0,
    owner: RoomOwner.fromJson(
      (json['owner'] as Map).cast<String, dynamic>(),
    ),
    createdAt: json['createdAt'] as String,
  );
}

class AgoraJoinToken {
  const AgoraJoinToken({
    required this.channel,
    required this.appId,
    required this.token,
    required this.uid,
    required this.expiresAt,
    required this.role,
  });

  final String channel;
  final String appId;
  final String token;
  final int uid;
  final int expiresAt;
  final String role; // 'publisher' | 'audience'

  factory AgoraJoinToken.fromJson(Map<String, dynamic> json) =>
      AgoraJoinToken(
        channel: json['channel'] as String,
        appId: json['appId'] as String,
        token: json['token'] as String,
        uid: json['uid'] as int,
        expiresAt: json['expiresAt'] as int,
        role: json['role'] as String,
      );
}

class RoomDetail extends RoomSummary {
  const RoomDetail({
    required super.id,
    required super.name,
    super.description,
    required super.category,
    super.country,
    required super.maxSeats,
    required super.locked,
    required super.listenersLive,
    required super.speakersLive,
    required super.owner,
    required super.createdAt,
    required this.agoraChannel,
    required this.realtimeWsUrl,
    required this.join,
  });

  final String agoraChannel;
  final String realtimeWsUrl;
  final AgoraJoinToken join;

  factory RoomDetail.fromJson(Map<String, dynamic> json) {
    final summary = RoomSummary.fromJson(json);
    return RoomDetail(
      id: summary.id,
      name: summary.name,
      description: summary.description,
      category: summary.category,
      country: summary.country,
      maxSeats: summary.maxSeats,
      locked: summary.locked,
      listenersLive: summary.listenersLive,
      speakersLive: summary.speakersLive,
      owner: summary.owner,
      createdAt: summary.createdAt,
      agoraChannel: json['agoraChannel'] as String,
      realtimeWsUrl: json['realtimeWsUrl'] as String,
      join: AgoraJoinToken.fromJson(
        (json['join'] as Map).cast<String, dynamic>(),
      ),
    );
  }
}

class PaginatedRooms {
  const PaginatedRooms({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.total,
  });

  final List<RoomSummary> items;
  final int page;
  final int pageSize;
  final int total;

  factory PaginatedRooms.fromJson(Map<String, dynamic> json) =>
      PaginatedRooms(
        items: ((json['items'] as List?) ?? const [])
            .map((e) => RoomSummary.fromJson((e as Map).cast<String, dynamic>()))
            .toList(),
        page: json['page'] as int? ?? 1,
        pageSize: json['pageSize'] as int? ?? 20,
        total: json['total'] as int? ?? 0,
      );
}

/// Live room snapshot broadcast by the realtime service.
class LiveRoomState {
  const LiveRoomState({
    required this.version,
    required this.maxSeats,
    required this.seats,
    required this.muted,
    required this.listenerIds,
    required this.locked,
  });

  final int version;
  final int maxSeats;

  /// seatIndex → userId
  final Map<int, String> seats;

  /// userIds that the host has muted
  final Set<String> muted;
  final Set<String> listenerIds;
  final bool locked;

  factory LiveRoomState.fromJson(Map<String, dynamic> json) {
    final rawSeats = (json['seats'] as Map?)?.cast<String, dynamic>() ?? {};
    final seats = <int, String>{};
    rawSeats.forEach((k, v) {
      final i = int.tryParse(k);
      if (i != null) seats[i] = v as String;
    });
    final rawMuted = (json['muted'] as Map?)?.cast<String, dynamic>() ?? {};
    final rawListeners =
        (json['listeners'] as Map?)?.cast<String, dynamic>() ?? {};
    return LiveRoomState(
      version: (json['version'] as num?)?.toInt() ?? 0,
      maxSeats: (json['maxSeats'] as num?)?.toInt() ?? 8,
      seats: seats,
      muted: rawMuted.entries
          .where((e) => e.value == true)
          .map((e) => e.key)
          .toSet(),
      listenerIds: rawListeners.keys.toSet(),
      locked: json['locked'] as bool? ?? false,
    );
  }
}

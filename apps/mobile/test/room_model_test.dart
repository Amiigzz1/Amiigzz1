import 'package:flutter_test/flutter_test.dart';

import 'package:majlis/features/rooms/models/room.dart';

void main() {
  group('RoomSummary.fromJson', () {
    test('parses the wire shape', () {
      final json = {
        'id': 'room-1',
        'name': 'بيت اللودو',
        'description': null,
        'category': 'gaming',
        'country': 'SA',
        'maxSeats': 8,
        'locked': false,
        'listenersLive': 3,
        'speakersLive': 2,
        'owner': {
          'id': 'user-1',
          'displayName': 'ماجد',
          'avatarUrl': null,
        },
        'createdAt': '2026-01-01T00:00:00.000Z',
      };
      final r = RoomSummary.fromJson(json);
      expect(r.id, 'room-1');
      expect(r.name, 'بيت اللودو');
      expect(r.category, RoomCategory.gaming);
      expect(r.country, 'SA');
      expect(r.listenersLive, 3);
      expect(r.speakersLive, 2);
      expect(r.owner.displayName, 'ماجد');
    });

    test('falls back to chat for unknown categories', () {
      final r = RoomSummary.fromJson({
        'id': 'x',
        'name': 'x',
        'category': 'unknown-category',
        'maxSeats': 8,
        'locked': false,
        'listenersLive': 0,
        'speakersLive': 0,
        'owner': {'id': 'o'},
        'createdAt': '2026-01-01T00:00:00Z',
      });
      expect(r.category, RoomCategory.chat);
    });
  });

  group('LiveRoomState.fromJson', () {
    test('parses seats, muted set, and listeners', () {
      final s = LiveRoomState.fromJson({
        'version': 7,
        'maxSeats': 8,
        'seats': {'0': 'user-a', '3': 'user-b'},
        'muted': {'user-a': true, 'user-c': false},
        'listeners': {'user-d': true, 'user-e': true},
        'locked': true,
      });
      expect(s.version, 7);
      expect(s.seats, {0: 'user-a', 3: 'user-b'});
      expect(s.muted, {'user-a'});
      expect(s.listenerIds, {'user-d', 'user-e'});
      expect(s.locked, true);
    });

    test('handles missing fields gracefully', () {
      final s = LiveRoomState.fromJson({'version': 1});
      expect(s.seats, isEmpty);
      expect(s.muted, isEmpty);
      expect(s.listenerIds, isEmpty);
      expect(s.locked, false);
    });
  });

  test('RoomDetail embeds Agora join token', () {
    final d = RoomDetail.fromJson({
      'id': 'room-1',
      'name': 'n',
      'category': 'chat',
      'maxSeats': 8,
      'locked': false,
      'listenersLive': 0,
      'speakersLive': 0,
      'owner': {'id': 'o'},
      'createdAt': '2026-01-01T00:00:00Z',
      'agoraChannel': 'majlis-abc',
      'realtimeWsUrl': 'ws://localhost:8080',
      'join': {
        'channel': 'majlis-abc',
        'appId': 'mock-app-id',
        'token': 'mock.token.sig',
        'uid': 42,
        'expiresAt': 1900000000,
        'role': 'audience',
      },
    });
    expect(d.agoraChannel, 'majlis-abc');
    expect(d.realtimeWsUrl, 'ws://localhost:8080');
    expect(d.join.token, 'mock.token.sig');
    expect(d.join.role, 'audience');
  });
}

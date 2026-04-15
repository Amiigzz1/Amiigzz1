import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

import 'models/room.dart';

/// Client-side mirror of the realtime service WebSocket protocol.
///
/// Listens for `room.state` events, maintains the latest `LiveRoomState`,
/// and drops any event whose version is older than the last one we saw
/// (protecting against reordered deltas from the server).
class LiveRoomClient {
  LiveRoomClient({required this.wsUrl, required this.accessToken});

  final String wsUrl;
  final String accessToken;

  WebSocketChannel? _channel;
  final _stateCtrl = StreamController<LiveRoomState>.broadcast();
  int _lastVersion = -1;
  bool _closed = false;

  Stream<LiveRoomState> get states => _stateCtrl.stream;

  Future<void> connect(String roomId) async {
    final uri = Uri.parse('$wsUrl/ws').replace(
      queryParameters: {'room': roomId, 'token': accessToken},
    );
    _channel = WebSocketChannel.connect(uri);
    _channel!.stream.listen(
      _onMessage,
      onError: (_) => dispose(),
      onDone: () {
        if (!_closed) dispose();
      },
      cancelOnError: true,
    );
  }

  void _onMessage(dynamic raw) {
    try {
      final map = jsonDecode(raw as String) as Map<String, dynamic>;
      if (map['type'] != 'room.state') return;
      final version = (map['version'] as num?)?.toInt() ?? 0;
      if (version < _lastVersion) return; // stale
      _lastVersion = version;
      final payload = (map['payload'] as Map?)?.cast<String, dynamic>() ?? {};
      // The server wraps the payload with { version } — re-use top-level
      // version if the payload didn't carry one.
      payload.putIfAbsent('version', () => version);
      _stateCtrl.add(LiveRoomState.fromJson(payload));
    } catch (_) {
      // Bad frame — ignore; the server will re-broadcast on next mutation.
    }
  }

  Future<void> dispose() async {
    if (_closed) return;
    _closed = true;
    await _channel?.sink.close();
    await _stateCtrl.close();
  }
}

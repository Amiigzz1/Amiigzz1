import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/storage/token_storage.dart';
import '../../auth/auth_controller.dart';
import '../live_room_client.dart';
import '../models/room.dart';
import '../rooms_controller.dart';

/// The main voice-room screen — the heart of Phase 2c.
///
/// Layout
///   - Top: room name, category badge, close button.
///   - Middle: 8 seats arranged in a circle. Empty seats show a "+" when
///     the viewer is not on stage; taken seats show the user avatar with a
///     muted indicator if the host has muted them.
///   - Bottom: chat preview (Phase 2c+) and action row (request mic / leave
///     seat / share gift).
///
/// Voice transport (Agora) is out of scope for this commit — the join
/// token is printed in debug output so we can sanity-check the round-trip
/// until Phase 2 polish wires up the SDK.
class RoomScreen extends ConsumerStatefulWidget {
  const RoomScreen({super.key, required this.roomId});

  final String roomId;

  @override
  ConsumerState<RoomScreen> createState() => _RoomScreenState();
}

class _RoomScreenState extends ConsumerState<RoomScreen> {
  LiveRoomClient? _live;
  LiveRoomState? _state;

  @override
  void dispose() {
    _live?.dispose();
    super.dispose();
  }

  Future<void> _ensureLive(RoomDetail detail) async {
    if (_live != null) return;
    final tokens = ref.read(tokenStorageProvider);
    final access = await tokens.readAccess();
    if (access == null) return;

    final client = LiveRoomClient(
      wsUrl: detail.realtimeWsUrl,
      accessToken: access,
    );
    client.states.listen((s) {
      if (!mounted) return;
      setState(() => _state = s);
    });
    await client.connect(detail.id);
    _live = client;
  }

  @override
  Widget build(BuildContext context) {
    final detailAsync = ref.watch(roomDetailProvider(widget.roomId));

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        body: SafeArea(
          child: detailAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text(e.toString())),
            data: (detail) {
              // Kick off WS connect on first successful detail load.
              // ignore: discarded_futures
              _ensureLive(detail);
              return _RoomBody(
                detail: detail,
                state: _state,
                onLeave: () {
                  _live?.dispose();
                  if (context.canPop()) {
                    context.pop();
                  } else {
                    context.go('/home');
                  }
                },
              );
            },
          ),
        ),
      ),
    );
  }
}

class _RoomBody extends ConsumerWidget {
  const _RoomBody({
    required this.detail,
    required this.state,
    required this.onLeave,
  });

  final RoomDetail detail;
  final LiveRoomState? state;
  final VoidCallback onLeave;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final auth = ref.watch(authControllerProvider);
    final myUserId = auth.userId ?? '';
    final isOwner = detail.owner.id == myUserId;
    final seats = state?.seats ?? {};
    final maxSeats = detail.maxSeats;

    final onStage = seats.values.contains(myUserId);

    return Column(
      children: [
        _Header(room: detail, onLeave: onLeave),
        const SizedBox(height: 16),
        Expanded(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final size =
                  math.min(constraints.maxWidth, constraints.maxHeight) - 40;
              return Center(
                child: SizedBox(
                  width: size,
                  height: size,
                  child: Stack(
                    children: [
                      for (var i = 0; i < maxSeats; i++)
                        _positionSeat(
                          index: i,
                          count: maxSeats,
                          size: size,
                          child: _SeatTile(
                            index: i,
                            occupantId: seats[i],
                            isMine: seats[i] == myUserId,
                            muted: state?.muted.contains(seats[i]) ?? false,
                            isOwnerSeat: seats[i] == detail.owner.id,
                          ),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        _ActionBar(
          onStage: onStage,
          isOwner: isOwner,
          onLeave: onLeave,
        ),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0),
          child: Text(
            'أعضاء: ${state?.listenerIds.length ?? detail.listenersLive} · '
            'على المنصة: ${seats.length}',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  /// Places a child on the circumference of a circle inscribed in the
  /// parent square. Seat 0 is at the top; others go clockwise.
  Widget _positionSeat({
    required int index,
    required int count,
    required double size,
    required Widget child,
  }) {
    const tile = 64.0;
    final radius = (size - tile) / 2;
    final centerX = size / 2;
    final centerY = size / 2;
    final angle = -math.pi / 2 + (2 * math.pi * index) / count;
    final x = centerX + radius * math.cos(angle) - tile / 2;
    final y = centerY + radius * math.sin(angle) - tile / 2;
    return Positioned(left: x, top: y, child: child);
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.room, required this.onLeave});

  final RoomDetail room;
  final VoidCallback onLeave;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.close),
            onPressed: onLeave,
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Text(
                  room.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  _categoryLabel(room.category),
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 48),
        ],
      ),
    );
  }

  String _categoryLabel(RoomCategory c) {
    switch (c) {
      case RoomCategory.gaming:
        return 'ألعاب';
      case RoomCategory.music:
        return 'موسيقى';
      case RoomCategory.chat:
        return 'دردشة';
      case RoomCategory.story:
        return 'حكايات';
    }
  }
}

class _SeatTile extends StatelessWidget {
  const _SeatTile({
    required this.index,
    required this.occupantId,
    required this.isMine,
    required this.muted,
    required this.isOwnerSeat,
  });

  final int index;
  final String? occupantId;
  final bool isMine;
  final bool muted;
  final bool isOwnerSeat;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final occupied = occupantId != null;

    return SizedBox(
      width: 64,
      height: 84,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Stack(
            alignment: Alignment.bottomRight,
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: occupied
                      ? theme.colorScheme.primaryContainer
                      : theme.colorScheme.surfaceContainerHighest,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isMine
                        ? theme.colorScheme.primary
                        : Colors.transparent,
                    width: 2.5,
                  ),
                ),
                alignment: Alignment.center,
                child: occupied
                    ? Icon(
                        isOwnerSeat ? Icons.star : Icons.person,
                        color: theme.colorScheme.onPrimaryContainer,
                      )
                    : Icon(
                        Icons.add,
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
              ),
              if (muted)
                Container(
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(
                    color: theme.colorScheme.error,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.mic_off,
                    size: 12,
                    color: Colors.white,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            '${index + 1}',
            style: theme.textTheme.labelSmall,
          ),
        ],
      ),
    );
  }
}

class _ActionBar extends StatelessWidget {
  const _ActionBar({
    required this.onStage,
    required this.isOwner,
    required this.onLeave,
  });

  final bool onStage;
  final bool isOwner;
  final VoidCallback onLeave;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _ActionButton(
            icon: onStage ? Icons.mic_off_outlined : Icons.mic_none_outlined,
            label: onStage ? 'ترك المايك' : 'اطلب المايك',
            onTap: () {
              // TODO(phase-2c+): POST /rooms/:id/seats (take/leave) via API.
            },
          ),
          _ActionButton(
            icon: Icons.card_giftcard,
            label: 'هدية',
            onTap: () {
              // TODO(phase-4): open gift picker sheet.
            },
          ),
          if (isOwner)
            _ActionButton(
              icon: Icons.lock_outline,
              label: 'قفل',
              onTap: () {
                // TODO(phase-2c+): POST /rooms/:id/lock.
              },
            ),
          _ActionButton(
            icon: Icons.logout,
            label: 'خروج',
            onTap: onLeave,
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 26),
            const SizedBox(height: 4),
            Text(label, style: theme.textTheme.labelSmall),
          ],
        ),
      ),
    );
  }
}

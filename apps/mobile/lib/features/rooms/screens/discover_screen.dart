import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../l10n/app_strings.dart';
import '../models/room.dart';
import '../rooms_controller.dart';

class DiscoverScreen extends ConsumerWidget {
  const DiscoverScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = AppStrings.of(context);
    final theme = Theme.of(context);
    final filter = ref.watch(roomsFilterProvider);
    final listAsync = ref.watch(roomsListProvider);

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: Text(strings.homeExploreRooms),
          actions: [
            IconButton(
              icon: const Icon(Icons.add),
              tooltip: strings.continueAction,
              onPressed: () => context.push('/rooms/new'),
            ),
          ],
        ),
        body: SafeArea(
          child: Column(
            children: [
              _FilterBar(
                active: filter.category,
                onChanged: (cat) {
                  ref.read(roomsFilterProvider.notifier).state = filter
                      .copyWith(category: cat);
                },
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () async => ref.refresh(roomsListProvider.future),
                  child: listAsync.when(
                    loading: () =>
                        const Center(child: CircularProgressIndicator()),
                    error: (_, __) => _EmptyState(
                      icon: Icons.wifi_off,
                      label: strings.errorNetwork,
                    ),
                    data: (page) {
                      if (page.items.isEmpty) {
                        return _EmptyState(
                          icon: Icons.forum_outlined,
                          label: strings.homeSubtitle,
                          action: FilledButton(
                            onPressed: () => context.push('/rooms/new'),
                            child: Text(strings.continueAction),
                          ),
                        );
                      }
                      return ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: page.items.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (_, i) {
                          final room = page.items[i];
                          return _RoomCard(
                            room: room,
                            onTap: () => context.push('/rooms/${room.id}'),
                          );
                        },
                      );
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FilterBar extends StatelessWidget {
  const _FilterBar({required this.active, required this.onChanged});

  final RoomCategory? active;
  final ValueChanged<RoomCategory?> onChanged;

  static const _labels = {
    RoomCategory.gaming: 'ألعاب',
    RoomCategory.music: 'موسيقى',
    RoomCategory.chat: 'دردشة',
    RoomCategory.story: 'حكايات',
  };

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      child: ListView(
        scrollDirection: Axis.horizontal,
        reverse: true,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
            child: ChoiceChip(
              label: const Text('الكل'),
              selected: active == null,
              onSelected: (_) => onChanged(null),
            ),
          ),
          for (final c in RoomCategory.values)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
              child: ChoiceChip(
                label: Text(_labels[c] ?? c.name),
                selected: active == c,
                onSelected: (_) => onChanged(c),
              ),
            ),
        ],
      ),
    );
  }
}

class _RoomCard extends StatelessWidget {
  const _RoomCard({required this.room, required this.onTap});

  final RoomSummary room;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final strings = AppStrings.of(context);
    return Material(
      color: theme.colorScheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: theme.colorScheme.primaryContainer,
                child: Icon(
                  _iconFor(room.category),
                  color: theme.colorScheme.onPrimaryContainer,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      room.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      room.owner.displayName ?? '—',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              _LiveBadge(
                speakers: room.speakersLive,
                listeners: room.listenersLive,
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _iconFor(RoomCategory c) {
    switch (c) {
      case RoomCategory.gaming:
        return Icons.casino_outlined;
      case RoomCategory.music:
        return Icons.music_note_outlined;
      case RoomCategory.chat:
        return Icons.forum_outlined;
      case RoomCategory.story:
        return Icons.menu_book_outlined;
    }
  }
}

class _LiveBadge extends StatelessWidget {
  const _LiveBadge({required this.speakers, required this.listeners});

  final int speakers;
  final int listeners;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.mic, size: 14, color: Colors.redAccent),
            const SizedBox(width: 4),
            Text(
              '$speakers',
              style: theme.textTheme.labelMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.people_outline,
              size: 14,
              color: theme.colorScheme.onSurfaceVariant,
            ),
            const SizedBox(width: 4),
            Text(
              '$listeners',
              style: theme.textTheme.labelMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.icon, required this.label, this.action});
  final IconData icon;
  final String label;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 64, color: Theme.of(context).colorScheme.outline),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
          if (action != null) ...[const SizedBox(height: 24), action!],
        ],
      ),
    );
  }
}

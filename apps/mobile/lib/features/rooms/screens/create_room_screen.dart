import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../l10n/app_strings.dart';
import '../models/room.dart';
import '../rooms_controller.dart';

class CreateRoomScreen extends ConsumerStatefulWidget {
  const CreateRoomScreen({super.key});

  @override
  ConsumerState<CreateRoomScreen> createState() => _CreateRoomScreenState();
}

class _CreateRoomScreenState extends ConsumerState<CreateRoomScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  RoomCategory _category = RoomCategory.chat;
  bool _saving = false;
  String? _errorMessage;

  static const _categoryLabels = {
    RoomCategory.gaming: 'ألعاب',
    RoomCategory.music: 'موسيقى',
    RoomCategory.chat: 'دردشة',
    RoomCategory.story: 'حكايات',
  };

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _errorMessage = null;
    });
    final strings = AppStrings.of(context);
    try {
      final repo = ref.read(roomsRepositoryProvider);
      final created = await repo.create(
        name: _nameController.text.trim(),
        category: _category,
      );
      ref.invalidate(roomsListProvider);
      if (mounted) context.go('/rooms/${created.id}');
    } on NetworkException {
      setState(() => _errorMessage = strings.errorNetwork);
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final theme = Theme.of(context);
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(title: const Text('غرفة جديدة')),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextFormField(
                    controller: _nameController,
                    decoration: const InputDecoration(
                      labelText: 'اسم الغرفة',
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) {
                      final t = (v ?? '').trim();
                      if (t.length < 2 || t.length > 64) {
                        return strings.errorGeneric;
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'التصنيف',
                    style: theme.textTheme.labelLarge,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    children: [
                      for (final c in RoomCategory.values)
                        ChoiceChip(
                          label: Text(_categoryLabels[c] ?? c.name),
                          selected: _category == c,
                          onSelected: (_) => setState(() => _category = c),
                        ),
                    ],
                  ),
                  if (_errorMessage != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      _errorMessage!,
                      style: TextStyle(color: theme.colorScheme.error),
                    ),
                  ],
                  const Spacer(),
                  FilledButton(
                    onPressed: _saving ? null : _create,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(52),
                    ),
                    child: _saving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              color: Colors.white,
                            ),
                          )
                        : Text(strings.continueAction),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

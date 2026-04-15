import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../l10n/app_strings.dart';
import '../../auth/auth_controller.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = AppStrings.of(context);

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(title: Text(strings.settingsTitle)),
        body: SafeArea(
          child: ListView(
            children: [
              ListTile(
                leading: const Icon(Icons.language_outlined),
                title: Text(strings.settingsLanguage),
                subtitle: Text(
                  Localizations.localeOf(context).languageCode == 'en'
                      ? 'English'
                      : 'العربية',
                ),
                // TODO(phase-1d): persist user-selected language.
              ),
              const Divider(height: 0),
              ListTile(
                leading: Icon(
                  Icons.logout,
                  color: Theme.of(context).colorScheme.error,
                ),
                title: Text(
                  strings.settingsLogout,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
                onTap: () async {
                  await ref.read(authControllerProvider.notifier).logout();
                  // Router redirect handles navigation once status flips.
                },
              ),
              const Divider(height: 0),
              const SizedBox(height: 16),
              Center(
                child: Text(
                  strings.settingsVersion('0.0.1'),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

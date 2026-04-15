import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../l10n/app_strings.dart';
import '../auth_controller.dart';
import '../countries.dart';

class PhoneEntryScreen extends ConsumerStatefulWidget {
  const PhoneEntryScreen({super.key});

  @override
  ConsumerState<PhoneEntryScreen> createState() => _PhoneEntryScreenState();
}

class _PhoneEntryScreenState extends ConsumerState<PhoneEntryScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();
  CountryInfo _country = kSupportedCountries.first; // default SA
  bool _submitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _errorMessage = null;
    });

    final e164 = _country.toE164(_phoneController.text.trim());
    final strings = AppStrings.of(context);

    try {
      final devCode = await ref
          .read(authControllerProvider.notifier)
          .requestOtp(phoneE164: e164, countryHint: _country.code);

      if (!mounted) return;
      context.push('/otp', extra: {
        'phone': e164,
        'country': _country.code,
        if (devCode != null) 'devCode': devCode,
      });
    } on NetworkException {
      setState(() => _errorMessage = strings.errorNetwork);
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final theme = Theme.of(context);

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(title: Text(strings.appName)),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 24),
                  Text(
                    strings.phoneEntryTitle,
                    style: theme.textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    strings.phoneEntrySubtitle,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 32),
                  _CountryDropdown(
                    value: _country,
                    label: strings.countryLabel,
                    onChanged: (c) => setState(() => _country = c),
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    textDirection: TextDirection.ltr,
                    textAlign: TextAlign.left,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(12),
                    ],
                    decoration: InputDecoration(
                      labelText: strings.phoneFieldLabel,
                      hintText: _country.nationalLength == 10
                          ? '10XXXXXXXX'
                          : strings.phoneFieldHint,
                      prefixText: '${_country.dialCode}  ',
                      border: const OutlineInputBorder(),
                    ),
                    validator: (value) {
                      final digits =
                          (value ?? '').replaceAll(RegExp(r'\D'), '');
                      if (digits.isEmpty) return strings.errorGeneric;
                      final normalized =
                          digits.replaceFirst(RegExp(r'^0+'), '');
                      if (normalized.length < _country.nationalLength - 1 ||
                          normalized.length > _country.nationalLength + 1) {
                        return strings.errorGeneric;
                      }
                      return null;
                    },
                  ),
                  if (_errorMessage != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      _errorMessage!,
                      style: TextStyle(color: theme.colorScheme.error),
                    ),
                  ],
                  const SizedBox(height: 32),
                  FilledButton(
                    onPressed: _submitting ? null : _submit,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(52),
                    ),
                    child: _submitting
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

class _CountryDropdown extends StatelessWidget {
  const _CountryDropdown({
    required this.value,
    required this.label,
    required this.onChanged,
  });

  final CountryInfo value;
  final String label;
  final ValueChanged<CountryInfo> onChanged;

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    return DropdownButtonFormField<CountryInfo>(
      value: value,
      isExpanded: true,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
      ),
      items: [
        for (final c in kSupportedCountries)
          DropdownMenuItem<CountryInfo>(
            value: c,
            child: Row(
              children: [
                Text(c.flag, style: const TextStyle(fontSize: 20)),
                const SizedBox(width: 8),
                Expanded(child: Text(strings.country(c.code))),
                Text(
                  c.dialCode,
                  textDirection: TextDirection.ltr,
                  style: const TextStyle(color: Colors.black54),
                ),
              ],
            ),
          ),
      ],
      onChanged: (c) {
        if (c != null) onChanged(c);
      },
    );
  }
}

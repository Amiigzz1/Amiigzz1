import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../auth/auth_controller.dart';

/// Bottom sheet for filing a user / room report.
///
/// Invoke via `showReportSheet(context, targetType: 'user', targetId: …)`.
class ReportSheet extends ConsumerStatefulWidget {
  const ReportSheet({
    super.key,
    required this.targetType,
    required this.targetId,
    this.roomId,
  });

  final String targetType; // 'user' | 'room' | 'message' | 'voice_clip'
  final String targetId;
  final String? roomId;

  @override
  ConsumerState<ReportSheet> createState() => _ReportSheetState();
}

Future<void> showReportSheet(
  BuildContext context, {
  required String targetType,
  required String targetId,
  String? roomId,
}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => ReportSheet(
      targetType: targetType,
      targetId: targetId,
      roomId: roomId,
    ),
  );
}

class _ReportSheetState extends ConsumerState<ReportSheet> {
  String? _category;
  final _detailsController = TextEditingController();
  bool _submitting = false;

  static const _categories = [
    {'id': 'insult', 'label': 'إهانة أو شتيمة'},
    {'id': 'sexual', 'label': 'محتوى جنسي / تحرش'},
    {'id': 'threat', 'label': 'تهديد بالعنف'},
    {'id': 'hate', 'label': 'خطاب كراهية'},
    {'id': 'spam', 'label': 'سبام / دعاية'},
    {'id': 'impersonation', 'label': 'انتحال شخصية'},
    {'id': 'other', 'label': 'آخر'},
  ];

  @override
  void dispose() {
    _detailsController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final cat = _category;
    if (cat == null) return;
    setState(() => _submitting = true);

    final api = ref.read(apiClientProvider);
    final body = <String, dynamic>{
      'targetType': widget.targetType,
      'targetId': widget.targetId,
      'category': cat,
      if (widget.roomId != null) 'roomId': widget.roomId,
      if (_detailsController.text.trim().isNotEmpty)
        'details': _detailsController.text.trim(),
    };

    try {
      await api.post('/reports', body);
      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('استلمنا بلاغك. شكرًا لك 🤝')),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: EdgeInsets.only(
          top: 16,
          left: 24,
          right: 24,
          bottom: MediaQuery.of(context).viewInsets.bottom + 24,
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: theme.colorScheme.outline,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'البلاغ عن مخالفة',
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'اختار السبب. الموديريتور هيراجع خلال 24 ساعة.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 16),
              for (final c in _categories)
                RadioListTile<String>(
                  title: Text(c['label']!),
                  value: c['id']!,
                  groupValue: _category,
                  onChanged: (v) => setState(() => _category = v),
                  dense: true,
                ),
              const SizedBox(height: 8),
              TextField(
                controller: _detailsController,
                maxLines: 3,
                maxLength: 500,
                decoration: const InputDecoration(
                  labelText: 'تفاصيل (اختياري)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _category == null || _submitting ? null : _submit,
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                ),
                child: _submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('إرسال البلاغ'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

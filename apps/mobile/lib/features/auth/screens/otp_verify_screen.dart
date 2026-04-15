import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../l10n/app_strings.dart';
import '../auth_controller.dart';

class OtpVerifyScreen extends ConsumerStatefulWidget {
  const OtpVerifyScreen({
    super.key,
    required this.phoneE164,
    required this.countryCode,
    this.devCode,
  });

  final String phoneE164;
  final String countryCode;
  final String? devCode;

  @override
  ConsumerState<OtpVerifyScreen> createState() => _OtpVerifyScreenState();
}

class _OtpVerifyScreenState extends ConsumerState<OtpVerifyScreen> {
  static const _digits = 6;
  late final List<TextEditingController> _controllers;
  late final List<FocusNode> _focusNodes;
  Timer? _resendTimer;
  int _resendSeconds = 30;
  bool _submitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(_digits, (_) => TextEditingController());
    _focusNodes = List.generate(_digits, (_) => FocusNode());

    // Dev convenience: pre-fill the OTP when the server is in LOCAL_OTP_MODE.
    final dev = widget.devCode;
    if (dev != null && dev.length == _digits) {
      for (var i = 0; i < _digits; i++) {
        _controllers[i].text = dev[i];
      }
      WidgetsBinding.instance.addPostFrameCallback((_) => _submit());
    }
    _startResendTimer();
  }

  @override
  void dispose() {
    _resendTimer?.cancel();
    for (final c in _controllers) c.dispose();
    for (final n in _focusNodes) n.dispose();
    super.dispose();
  }

  void _startResendTimer() {
    _resendTimer?.cancel();
    setState(() => _resendSeconds = 30);
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      if (_resendSeconds <= 0) {
        t.cancel();
      } else {
        setState(() => _resendSeconds--);
      }
    });
  }

  String get _code => _controllers.map((c) => c.text).join();

  Future<void> _submit() async {
    if (_code.length != _digits) return;
    setState(() {
      _submitting = true;
      _errorMessage = null;
    });

    final strings = AppStrings.of(context);
    try {
      await ref
          .read(authControllerProvider.notifier)
          .verifyOtp(
            phoneE164: widget.phoneE164,
            code: _code,
            countryHint: widget.countryCode,
          );
      // Router redirect handles navigation once auth flips to signedIn.
    } on UnauthorizedException {
      setState(() => _errorMessage = strings.otpInvalid);
    } on NetworkException {
      setState(() => _errorMessage = strings.errorNetwork);
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _resend() async {
    setState(() {
      _errorMessage = null;
      for (final c in _controllers) c.clear();
    });
    try {
      final devCode = await ref
          .read(authControllerProvider.notifier)
          .requestOtp(
            phoneE164: widget.phoneE164,
            countryHint: widget.countryCode,
          );
      _startResendTimer();
      if (devCode != null && devCode.length == _digits) {
        for (var i = 0; i < _digits; i++) {
          _controllers[i].text = devCode[i];
        }
        await _submit();
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final theme = Theme.of(context);

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(title: Text(strings.otpTitle)),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 24),
                Text(
                  strings.otpSubtitle(widget.phoneE164),
                  style: theme.textTheme.bodyMedium,
                ),
                const SizedBox(height: 32),
                Directionality(
                  textDirection: TextDirection.ltr,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      for (var i = 0; i < _digits; i++) ...[
                        _OtpBox(
                          controller: _controllers[i],
                          focusNode: _focusNodes[i],
                          onChanged: (value) {
                            if (value.length == 1 && i < _digits - 1) {
                              _focusNodes[i + 1].requestFocus();
                            }
                            if (value.isEmpty && i > 0) {
                              _focusNodes[i - 1].requestFocus();
                            }
                            if (_code.length == _digits) _submit();
                          },
                        ),
                        if (i < _digits - 1) const SizedBox(width: 8),
                      ],
                    ],
                  ),
                ),
                if (_errorMessage != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    _errorMessage!,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: theme.colorScheme.error),
                  ),
                ],
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _submitting || _code.length != _digits
                      ? null
                      : _submit,
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
                      : Text(strings.verifyAction),
                ),
                const SizedBox(height: 8),
                Center(
                  child: TextButton(
                    onPressed: _resendSeconds > 0 ? null : _resend,
                    child: Text(
                      _resendSeconds > 0
                          ? strings.otpResendIn(_resendSeconds)
                          : strings.otpResend,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OtpBox extends StatelessWidget {
  const _OtpBox({
    required this.controller,
    required this.focusNode,
    required this.onChanged,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 44,
      height: 56,
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        keyboardType: TextInputType.number,
        textAlign: TextAlign.center,
        maxLength: 1,
        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        decoration: const InputDecoration(
          counterText: '',
          border: OutlineInputBorder(),
        ),
        onChanged: onChanged,
      ),
    );
  }
}

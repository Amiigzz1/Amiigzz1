/// Top-level auth status. Drives which navigation stack the router shows.
enum AuthStatus {
  /// Initial state before storage has been read.
  unknown,

  /// No valid session. Router shows the phone-entry flow.
  signedOut,

  /// Logged in. Router shows the home stack.
  signedIn,
}

class AuthState {
  const AuthState({
    required this.status,
    this.userId,
    this.isNewUser = false,
  });

  final AuthStatus status;
  final String? userId;

  /// True when the user just completed verify-otp for the first time.
  /// Used to route to ProfileSetupScreen once after signup.
  final bool isNewUser;

  const AuthState.unknown() : this(status: AuthStatus.unknown);
  const AuthState.signedOut() : this(status: AuthStatus.signedOut);
  const AuthState.signedIn({
    required String userId,
    bool isNewUser = false,
  }) : this(
         status: AuthStatus.signedIn,
         userId: userId,
         isNewUser: isNewUser,
       );

  AuthState copyWith({
    AuthStatus? status,
    String? userId,
    bool? isNewUser,
  }) => AuthState(
    status: status ?? this.status,
    userId: userId ?? this.userId,
    isNewUser: isNewUser ?? this.isNewUser,
  );
}

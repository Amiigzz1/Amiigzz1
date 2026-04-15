/// Public user shape — mirrors `UserResponse` in the API.
class UserModel {
  const UserModel({
    required this.id,
    this.displayName,
    this.avatarUrl,
    this.country,
    this.language = 'ar',
    this.birthdate,
    required this.createdAt,
    this.bio,
    this.favoriteGames = const [],
    this.badges = const [],
  });

  final String id;
  final String? displayName;
  final String? avatarUrl;
  final String? country; // ISO 3166-1 alpha-2
  final String language; // 'ar' | 'en'
  final String? birthdate; // ISO date (yyyy-MM-dd)
  final String createdAt;

  final String? bio;
  final List<String> favoriteGames;
  final List<String> badges;

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final profile = (json['profile'] as Map?)?.cast<String, dynamic>() ?? {};
    return UserModel(
      id: json['id'] as String,
      displayName: json['displayName'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      country: json['country'] as String?,
      language: (json['language'] as String?) ?? 'ar',
      birthdate: json['birthdate'] as String?,
      createdAt: json['createdAt'] as String,
      bio: profile['bio'] as String?,
      favoriteGames: ((profile['favoriteGames'] as List?) ?? const [])
          .map((e) => e as String)
          .toList(),
      badges: ((profile['badges'] as List?) ?? const [])
          .map((e) => e as String)
          .toList(),
    );
  }

  UserModel copyWith({
    String? displayName,
    String? avatarUrl,
    String? country,
    String? language,
    String? birthdate,
    String? bio,
    List<String>? favoriteGames,
  }) => UserModel(
    id: id,
    displayName: displayName ?? this.displayName,
    avatarUrl: avatarUrl ?? this.avatarUrl,
    country: country ?? this.country,
    language: language ?? this.language,
    birthdate: birthdate ?? this.birthdate,
    createdAt: createdAt,
    bio: bio ?? this.bio,
    favoriteGames: favoriteGames ?? this.favoriteGames,
    badges: badges,
  );
}

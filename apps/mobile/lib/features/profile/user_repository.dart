import 'package:dio/dio.dart';

import '../../core/api/api_client.dart';
import 'models/user.dart';

class UserRepository {
  UserRepository({required this.api});
  final ApiClient api;

  Future<UserModel> getMe() async {
    final data = await api.get('/users/me');
    return UserModel.fromJson(data);
  }

  Future<UserModel> updateMe({
    String? displayName,
    String? bio,
    String? country,
    String? language,
    String? birthdate,
    List<String>? favoriteGames,
  }) async {
    final body = <String, dynamic>{};
    if (displayName != null) body['displayName'] = displayName;
    if (bio != null) body['bio'] = bio;
    if (country != null) body['country'] = country;
    if (language != null) body['language'] = language;
    if (birthdate != null) body['birthdate'] = birthdate;
    if (favoriteGames != null) body['favoriteGames'] = favoriteGames;

    final data = await api.patch('/users/me', body);
    return UserModel.fromJson(data);
  }

  Future<UserModel> uploadAvatar({
    required List<int> bytes,
    required String filename,
    required String contentType,
  }) async {
    final form = FormData.fromMap({
      'file': MultipartFile.fromBytes(
        bytes,
        filename: filename,
        contentType: DioMediaType.parse(contentType),
      ),
    });
    final data = await api.postMultipart('/users/me/avatar', data: form);
    return UserModel.fromJson(data);
  }
}

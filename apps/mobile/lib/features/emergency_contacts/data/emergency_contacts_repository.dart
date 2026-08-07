import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../domain/emergency_contact.dart';

class EmergencyContactsRepository {
  EmergencyContactsRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<List<EmergencyContact>> listContacts() async {
    try {
      final response = await _apiClient.dio.get('/emergency-contacts');
      final data = response.data['data'] as List<dynamic>;
      return data
          .map((c) => EmergencyContact.fromJson(c as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<EmergencyContact> addContact(String username, {String? phone}) async {
    try {
      final response = await _apiClient.dio.post(
        '/emergency-contacts',
        data: {'username': username, if (phone != null) 'phone': phone},
      );
      return EmergencyContact.fromJson(response.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<void> removeContact(String id) async {
    try {
      await _apiClient.dio.delete('/emergency-contacts/$id');
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}

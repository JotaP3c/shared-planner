import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  CreateUserRequest,
  UpdateUserRequest,
  UserResponse,
} from '../models/shared-planner.models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/users';

  create(request: CreateUserRequest) {
    return this.http.post<UserResponse>(this.apiUrl, request);
  }

  update(userId: string, request: UpdateUserRequest) {
    return this.http.put<UserResponse>(`${this.apiUrl}/${userId}`, request);
  }
}

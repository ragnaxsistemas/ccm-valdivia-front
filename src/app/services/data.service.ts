import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DataService {
  private http = inject(HttpClient);
  private readonly API_URL = environment.apiUrl;

  // Genérico para GET
  get<T>(endpoint: string): Observable<T> {
    return this.http.get<T>(`${this.API_URL}/${endpoint}`);
  }

  // Genérico para POST
  post<T>(endpoint: string, body: any): Observable<T> {
    console.log(`POST Request to: ${this.API_URL}/${endpoint} with body:`, body);
    return this.http.post<T>(`${this.API_URL}/${endpoint}`, body);
  }

  // Genérico para PUT/PATCH
  put<T>(endpoint: string, body: any): Observable<T> {
    return this.http.put<T>(`${this.API_URL}/${endpoint}`, body);
  }
}
import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { UserToken , Menu} from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);
  private userState = signal<UserToken | null>(null);
  user = computed(() => this.userState());

  saveToken(token: string): UserToken {
    localStorage.setItem('token', token);

    console.group('--- Token Guardado ---', token);
    const decoded = jwtDecode<UserToken>(token);
    
    // Guardamos el objeto completo
    localStorage.setItem('usuario', JSON.stringify(decoded));
    
    // IMPORTANTE: También guarda estas llaves individuales si tu MainLayout las busca así
    localStorage.setItem('nombre', decoded.nombre);
    localStorage.setItem('apellidoPaterno', decoded.apellidoPaterno);
    localStorage.setItem('role', JSON.stringify(decoded.role));
    localStorage.setItem('unidadNegocio', JSON.stringify(decoded.unidadNegocio));
    localStorage.setItem('menus', JSON.stringify(decoded.menus || [])); // <--- ESTO faltaba
    
    this.userState.set(decoded);
    return decoded;
}

  // Verifica si el token ha expirado
  isTokenExpired(): boolean {
    const token = localStorage.getItem('token');
    if (!token) return true;

    const decoded = jwtDecode<UserToken>(token);
    const currentTime = Math.floor(Date.now() / 1000); // Tiempo en segundos
    
    return decoded.exp < currentTime;
  }

  checkSession() {
    if (this.isTokenExpired()) {
      this.logout();
      return false;
    }

    const token = localStorage.getItem('token');
    if (token) {
      const decoded = jwtDecode<UserToken>(token);
      this.userState.set(decoded);
    }
    return true;
  }

  getUsuarioActual() {
  // Si tienes un BehaviorSubject o variable 'user', úsala. 
  // Si no, búscalo en el storage pero centralizado aquí.
  const user = localStorage.getItem('usuario');
  return user ? JSON.parse(user) : null;
}

  isLoggedIn(): boolean {
  // Un usuario está logueado si el token existe y NO ha expirado
    return !this.isTokenExpired();
}

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario'); // Limpiar también el objeto usuario
    this.userState.set(null);
    this.router.navigate(['/login']);
  }
}
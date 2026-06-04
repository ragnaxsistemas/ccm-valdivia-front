import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataService } from '../../services/data.service';
import { AuthService } from '../../services/auth.service';
import { AuthStateService } from '../../services/auth-state.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, MatSnackBarModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private dataService = inject(DataService);
  private authService = inject(AuthService);
  private authState = inject(AuthStateService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  loginData = { username: '', password: '', codEmpresa: 'vld_ccm' };
  errorMessage = signal<string | null>(null);
  loading = signal(false);

  onLogin() {
    if (!this.loginData.username || !this.loginData.password) {
      this.mostrarError('Por favor, complete todos los campos');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.dataService.post<any>('api/v1/login', this.loginData).subscribe({
      next: (res) => {
        // 1. El servicio procesa, decodifica y persiste TODO de forma centralizada
        const user = this.authService.saveToken(res.accessToken);
        
        if (user) {
          // 📊 PANEL DE AUDITORÍA AVANZADA EN CONSOLA (Lectura limpia)
          console.group('🔐 [AUDITORÍA DE LOGIN CCM]');
          console.log('📦 Objeto decodificado desde el Servicio:', user);
          console.groupEnd();

          console.group('💾 [VERIFICACIÓN POST-LOGIN LOCALSTORAGE]');
          console.log('sub:', localStorage.getItem('sub'));
          console.log('nombre:', localStorage.getItem('nombre'));
          console.log('role:', JSON.parse(localStorage.getItem('role') || '{}'));
          console.log('unidadNegocio:', JSON.parse(localStorage.getItem('unidadNegocio') || '{}'));
          console.groupEnd();

          // 2. Notificación de estado y navegación
          this.authState.notifyLogin();
          this.router.navigate(['/ccm/registros']);
        } else {
          console.error('❌ Error Crítico: El authService.saveToken devolvió un objeto "user" nulo.');
          this.loading.set(false);
        }
      },
      error: (err) => {
        console.error('❌ Error en el llamado HTTP de login:', err);
        this.loading.set(false);
        this.mostrarError('Usuario o contraseña incorrectos');
      }
    });
  }

  private mostrarError(mensaje: string) {
    this.errorMessage.set(mensaje);
    this.snackBar.open(mensaje, 'Cerrar', {
      duration: 4000,
      panelClass: ['error-snackbar']
    });
  }
}
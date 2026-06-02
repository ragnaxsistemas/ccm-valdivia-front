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
      // 1. Extraemos los datos decodificados (UserToken)
      const user = this.authService.saveToken(res.accessToken);
       // Aquí puedes ver toda la información decodificada del token 
      if (user) {
        console.group('--- Auditoría de Login CCM---');
        console.log('Datos extraídos:', user);
        console.groupEnd();

        // 2. Persistencia en LocalStorage
        // Strings simples
        localStorage.setItem('sub', user.sub || '');
        localStorage.setItem('nombre', user.nombre || '');
        localStorage.setItem('apellidoPaterno', user.apellidoPaterno || '');
        
        // Objetos complejos (DEBEN ser serializados con JSON.stringify)
        localStorage.setItem('role', JSON.stringify(user.role));
        localStorage.setItem('empresa', JSON.stringify(user.empresa));
        localStorage.setItem('unidadNegocio', JSON.stringify(user.unidadNegocio));
        localStorage.setItem('menus', JSON.stringify(user.menus || []));
        console.log('Datos guardados en localStorage:', {
          menus: JSON.parse(localStorage.getItem('menus') || '[]')
        });
      

        // 3. Notificación de estado y navegación
        this.authState.notifyLogin();
        this.router.navigate(['/ccm/registros']);
      }else{
        console.error('Error: No se pudo decodificar el token correctamente.');
      }
    },
    error: (err) => {
        console.error('Error en login:', err);
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
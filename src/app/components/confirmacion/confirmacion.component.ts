import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http'; // 🌟 Añadido HttpParams
import { FormsModule } from '@angular/forms'; // 🌟 Asegura que esté importado para el [(ngModel)]
import Swal from 'sweetalert2';
import { AuthService } from '../../services/auth.service';
import { environment } from "../../../environments/environment";

@Component({
  selector: 'app-confirmacion',
  standalone: true,
  imports:  [CommonModule, FormsModule],
  templateUrl: './confirmacion.component.html',
  styleUrls: ['./confirmacion.component.scss']
})
export class ConfirmacionComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  
  private readonly API_BASE = environment.apiUrl;
  private readonly API_OC = `${this.API_BASE}/api/v1/oc/ordenes-compra`;
  private readonly API_BUSQUEDA_AVANZADA = `${this.API_BASE}/api/v1/oc/ordenes-compra/busqueda-avanzada`;
  private readonly API_UNIDADES = `${this.API_BASE}/api/v1/unidad-compradora/vld_ccm`;

  listaAutorizadas: any[] = [];
  unidades: any[] = []; // 🌟 Lista de unidades para el combo
  unidadSeleccionada: string = ''; // 🌟 Almacena el código string seleccionado ('', 'prochelle', etc.)
  ocSeleccionada: any = null;
  loading: boolean = false;

  public esSupervisorGlobal: boolean = false;
  private usuarioInfo: any = null;

  ngOnInit(): void {
    this.verificarPermisos();
    this.cargarUnidades();
    this.cargarOrdenesAutorizadas();
  }

  verificarPermisos() {
    const user = this.authService.user();
    if (user) {
      this.usuarioInfo = user;
    } else {
      const savedUser = localStorage.getItem('usuario');
      this.usuarioInfo = savedUser ? JSON.parse(savedUser) : null;
    }

    if (this.usuarioInfo) {
      const rol = (this.usuarioInfo.role.nombre || '').toUpperCase();
      // Supervisor o Admin pueden confirmar
      this.esSupervisorGlobal = rol === 'SUPERVISOR' || rol === 'ADMIN';
    }
  }

  esSupervisor(): boolean {
    return this.esSupervisorGlobal;
  }

  // 🌟 Nuevo método para poblar el combo de unidades
  cargarUnidades() {
    this.http.get<any[]>(this.API_UNIDADES).subscribe({
      next: (res) => this.unidades = res || [],
      error: (err) => console.error('❌ Error al cargar unidades en confirmación:', err)
    });
  }

  cargarOrdenesAutorizadas() {
    this.loading = true;

    // Estado 3: Corresponde al ID de estado 'AUTORIZADA' en tu consulta avanzada del Backend
    let params = new HttpParams()
      .set('codEstadoOc', 'autorizado') // Requerido por tu lógica de negocio
      .set('page', '0')                             // Spring Data es base 0
      .set('size', '10')
      .set('sort', 'idOrdenCompra,desc');

    // Si hay una unidad específica seleccionada, filtramos por su código/ID
    if (this.unidadSeleccionada) {
      params = params.set('unidad', this.unidadSeleccionada);
    }

    console.log('🔍 [Confirmación] Buscando Autorizadas con parámetros:', params.toString());

    this.http.get<any>(this.API_BUSQUEDA_AVANZADA, { params }).subscribe({
      next: (res) => {
        // Adaptado por si el backend responde con Page (Spring Data) o lista directa
        this.listaAutorizadas = res.content || res || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('❌ Error al obtener órdenes autorizadas:', err);
        this.listaAutorizadas = [];
        this.loading = false;
      }
    });
  }

  verDetalle(oc: any) {
    this.ocSeleccionada = { ...oc };
  }

  abrirConfirmar(oc: any, tipo?: string) {
    if (!this.esSupervisor()) {
      Swal.fire('No autorizado', 'Acceso restringido a Supervisores', 'warning');
      return;
    }

    Swal.fire({
      title: '¿Confirmar Recepción de OC?',
      text: 'Al confirmar, la orden pasará al estado final de gestión.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#26c2d1', // Color cyan institucional
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'SÍ, CONFIRMAR',
      cancelButtonText: 'CANCELAR'
    }).then((result) => {
      if (result.isConfirmed) {
        this.ejecutarConfirmacion(oc);
      }
    });
  }

  ejecutarConfirmacion(oc: any) {
    const body = {
      codOc: oc.codOrdenCompra,
      plantillaDTO: { codOrdenCompra: oc.codOrdenCompra,
        usernameUsuario: oc.usernameUsuario
       },
      usuarioSup: this.usuarioInfo.sub
    };

    this.http.post(`${this.API_OC}/confirmar`, body).subscribe({
      next: () => {
        Swal.fire('Confirmada', 'La orden ha sido confirmada con éxito.', 'success');
        this.ocSeleccionada = null;
        this.cargarOrdenesAutorizadas();
      },
      error: (err) => {
        Swal.fire('Error', 'No se pudo procesar la confirmación.', 'error');
      }
    });
  }

  parsearProductos(jsonString: any): any[] {
    if (!jsonString) return [];
    if (Array.isArray(jsonString)) return jsonString;
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      return [];
    }
  }
}
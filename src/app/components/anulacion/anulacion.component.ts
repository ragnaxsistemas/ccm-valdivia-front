import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http'; 
import { FormsModule } from '@angular/forms'; 
import Swal from 'sweetalert2';
import { AuthService } from '../../services/auth.service';
import { environment } from "../../../environments/environment";
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-anulacion',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule], 
  templateUrl: './anulacion.component.html',
  styleUrls: ['./anulacion.component.scss']
})
export class AnulacionComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  
  private readonly API_BASE = environment.apiUrl;
  private readonly API_OC = `${this.API_BASE}/api/v1/oc/ordenes-compra`;
  private readonly API_BUSQUEDA_AVANZADA = `${this.API_BASE}/api/v1/oc/ordenes-compra/busqueda-avanzada`;
  private readonly API_UNIDADES = `${this.API_BASE}/api/v1/unidad-compradora/vld_ccm`;

  listaAutorizadas: any[] = [];
  ocSeleccionada: any = null;
  loading: boolean = false;

  unidades: any[] = [];
  unidadSeleccionada: string = '';
  usuarioInfo: any = null;
  
  // Variable unificada para match de rol con el Layout
  userRole: string = '';

  ngOnInit(): void {
    this.usuarioInfo = this.authService.user();
    this.obtenerRolDesdeStorage(); // <-- Captura infalible del Rol de Sesión
    this.cargarUnidades();
    this.cargarOrdenesAutorizadas();
  }

  /**
   * Obtiene el rol del usuario desde el localStorage tal como lo hace MainLayout
   */
  obtenerRolDesdeStorage(): void {
    const userJson = localStorage.getItem('usuario');
    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        this.userRole = user.role?.nombre?.toUpperCase() || 'SIN ROL';
        console.log("Rol unificado detectado en Anulación:", this.userRole);
      } catch (e) {
        console.error("Error al parsear el usuario en localStorage desde Anulación", e);
        this.userRole = 'SIN ROL';
      }
    } else {
      this.userRole = 'SIN ROL';
    }
  }

  /**
   * Evalúa si el usuario logueado tiene los permisos requeridos
   */
  esSupervisor(): boolean {
    return this.userRole.includes('SUPERVISOR') || 
           this.userRole.includes('ADMINISTRACION') || 
           this.userRole.includes('ADMIN');
  }

  cargarUnidades() {
    this.http.get<any[]>(this.API_UNIDADES).subscribe({
      next: (res) => this.unidades = res,
      error: (err) => console.error('Error unidades:', err)
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

    console.log('🔍 [anulacion] Buscando Autorizadas con parámetros:', params.toString());

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

  parseProductos(listProductosStr: any): any[] {
    if (!listProductosStr) return [];
    if (typeof listProductosStr === 'object') return listProductosStr;
    try {
      return JSON.parse(listProductosStr);
    } catch (e) {
      console.error("Error parseando productos:", e);
      return [];
    }
  }

  abrirConfirmar(oc: any, accion: string) {
    if (!this.esSupervisor()) {
      Swal.fire('No autorizado', 'Acceso restringido a Supervisores o Administración', 'warning');
      return;
    }

    Swal.fire({
      title: '¿Anular Orden de Compra?',
      text: 'Esta acción es irreversible y la orden quedará anulada permanentemente.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'SÍ, ANULAR',
      cancelButtonText: 'CANCELAR'
    }).then((result) => {
      if (result.isConfirmed) {
        this.ejecutarAnulacion(oc);
      }
    });
  }

  descargarAdjunto(arch: any) {
        if (!arch || !arch.idAdjunto) {
          Swal.fire('Error', 'Información de archivo adjunto no válida.', 'error');
          return;
        }
  
        console.log("Iniciando descarga del adjunto ID:", arch.idAdjunto);
        
        // Ajusta esta URL si tu endpoint de descarga de archivos adjuntos es diferente
        const urlDescarga = `${this.API_OC}/adjunto/${arch.idAdjunto}`;
  
        this.http.get(urlDescarga, { responseType: 'blob' }).subscribe({
          next: (blob: Blob) => {
            // Crear un link temporal en el DOM para forzar la descarga nativa
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = arch.nombreArchivo || 'archivo_adjunto';
            document.body.appendChild(a);
            a.click();
            
            // Limpieza del DOM
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          },
          error: (err) => {
            console.error('❌ Error al descargar el archivo:', err);
            Swal.fire('Error', 'No se pudo descargar el archivo adjunto desde el servidor.', 'error');
          }
        });
      }
      
  ejecutarAnulacion(oc: any) {
    const body = {
      codOc: oc.codOrdenCompra,
      plantillaDTO: { codOrdenCompra: oc.codOrdenCompra,
        usernameUsuario: oc.usernameUsuario
       },
      usuarioSup: this.usuarioInfo.sub
    };

    this.http.post(`${this.API_OC}/anular`, body).subscribe({
      next: () => {
        Swal.fire('Anulada', 'La orden ha sido anulada con éxito.', 'success');
        this.ocSeleccionada = null;
        this.cargarOrdenesAutorizadas();
      },
      error: (err) => {
        console.error('Error al anular', err);
        Swal.fire('Error', 'No se pudo procesar la anulación en el servidor.', 'error');
      }
    });
  }

  parsearProductos(listProductosStr: any): any[] {
  if (!listProductosStr) return [];
  if (typeof listProductosStr === 'object') return listProductosStr;
  try {
    return JSON.parse(listProductosStr);
  } catch (e) {
    console.error("Error parseando productos:", e);
    return [];
  }
}
  
}
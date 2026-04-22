import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from "../../../environments/environment";
import { HttpClient, HttpParams } from '@angular/common/http';

@Component({
  selector: 'app-gestion-oc',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registros.component.html',
  styleUrls: ['./registros.component.scss']
})
export class GestionOcComponent implements OnInit { // <-- Revisa este nombre para las rutas
  private http = inject(HttpClient);

  private readonly API_BASE = environment.apiUrl;
  private readonly API_BUSQUEDA_AVANZADA = `${this.API_BASE}/api/v1/oc/ordenes-compra/busqueda-avanzada`;
  private readonly API_UNIDADES = `${this.API_BASE}/api/v1/unidad`;
  private readonly API_ESTADOS = `${this.API_BASE}/api/v1/oc/status-oc/all`;
  /***unidades = [
    { id: 1, codigo: 'prochelle', nombre: 'Casa Prochelle' },
    { id: 2, codigo: 'biblioteca', nombre: 'Biblioteca Municipal' },
    { id: 3, codigo: 'escuela_danza', nombre: 'Escuela de Danza' },
    { id: 4, codigo: 'submarino', nombre: 'Submarino' }
  ];***/
  // Variables de datos
  unidades: any[] = [];
  estados: any[] = [];
  ordenes: any[] = [];
  loading: boolean = false;

  filtros = {
    rutProveedor: '',
    unidad: '', 
    folioDesde: '',
    folioHasta: '',
    estado: ''
  };

  ngOnInit() {
    this.cargarUnidades();
    this.cargarEstados(); // <-- Faltaba llamar a los estados
    this.buscar();
  }

  // Método para obtener el código de empresa de forma segura
  private getCodigoEmpresa(): string {
    const empresaData = localStorage.getItem('empresa');
    if (empresaData) {
      try {
        const empresa = JSON.parse(empresaData);
        return empresa.codigoEmpresaCliente || '';
      } catch (e) {
        console.error('Error al parsear empresa del localStorage', e);
      }
    }
    return '';
  }

  cargarUnidades() {
    const codigoEmpresa = this.getCodigoEmpresa();
    
    if (!codigoEmpresa) {
      console.warn('No se encontró código de empresa para cargar unidades');
      return;
    }

    this.http.get<any[]>(`${this.API_UNIDADES}/${codigoEmpresa}`).subscribe({
      next: (res) => {
        this.unidades = res || [];
      },
      error: (err) => console.error('Error al cargar unidades:', err)
    });
  }

  cargarEstados() {
    this.http.get<any[]>(this.API_ESTADOS).subscribe({
      next: (res) => {
        this.estados = res || [];
      },
      error: (err) => console.error('Error al cargar estados:', err)
    });
  }
  buscar() {
    this.loading = true;
    let params = new HttpParams();
    if (this.filtros.rutProveedor) params = params.set('rut', this.filtros.rutProveedor);
    if (this.filtros.unidad) params = params.set('unidad', this.filtros.unidad);
    if (this.filtros.folioDesde) params = params.set('desde', this.filtros.folioDesde);
    if (this.filtros.folioHasta) params = params.set('hasta', this.filtros.folioHasta);
    if (this.filtros.estado) params = params.set('codEstadoOc', this.filtros.estado);

    console.log('url:', `${this.API_BUSQUEDA_AVANZADA}` ,params.toString());
  
    console.log('Filtros enviados:', {
      rut: this.filtros.rutProveedor,
      unidad: this.filtros.unidad,
      desde: this.filtros.folioDesde,
      hasta: this.filtros.folioHasta,
      codEstadoOc: this.filtros.estado
    });

    console.log('Endpoint completo:', `${this.API_BUSQUEDA_AVANZADA}?${params.toString()}`);
    this.http.get<any>(`${this.API_BUSQUEDA_AVANZADA}`,{params})
      .subscribe({
        next: (res) => {
          this.ordenes = res.content || res || [];
          this.loading = false;
        },
        error: () => this.loading = false
      });
  }

  getEstadoClass(estado: string): string {
  // Usamos el código técnico que viene en oc.codEstadoActualOc
  switch (estado?.toLowerCase()) {
    case 'borrador':
      return 'bg-warning text-dark'; // Amarillo
    case 'pendiente_autorizacion':
      return 'bg-info text-white';   // Celeste/Azul claro
    case 'autorizado':
      return 'bg-success text-white'; // Verde
    case 'anulado':
      return 'bg-danger text-white';  // Rojo
    case 'confirmada':
      return 'bg-primary text-white'; // Azul oscuro
    case 'pendiente_anulacion':
      return 'bg-secondary text-white'; // Gris
    default:
      return 'bg-light text-dark border'; // Por defecto
  }
}

  verDetalle(oc: any) {
    console.log('Detalle:', oc);
  }

  formatFecha(fechaStr: string): string {
    if (!fechaStr) return '';
    const date = new Date(fechaStr);
    return date.toLocaleDateString('es-CL');
  }

  limpiarFiltros() {
    this.filtros = { rutProveedor: '', unidad: '', folioDesde: '', folioHasta: '', estado: '' };
    this.buscar();
  }
  
}
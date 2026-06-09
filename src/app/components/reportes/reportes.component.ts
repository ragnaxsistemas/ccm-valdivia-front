import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

// --- INTERFACES DE MODELOS PARA CADA REPORTE ---
export interface ReporteGastoUnidadDto {
  codigoUnidad: number;
  tipoDocumento: string;
  totalOrdenesEmitidas: number;
  inversionTotalNeta: number;
  inversionTotalConImpuesto: number;
}

export interface ReporteEficienciaDto {
  id_orden_compra: number;
  codigo_orden_compra: string;
  id_unidad: number;
  fecha_creacion: string;
  fecha_autorizacion: string;
  horas_en_autorizar: number;
}

export interface ReporteProveedoresDto {
  rut_proveedor: string;
  nombre_proveedor: string;
  ordenes_exitosas: number;
  ordenes_anuladas: number;
  monto_total_adjudicado: number;
}

export interface ReporteSinRespaldoDto {
  codigo_orden_compra: string;
  id_unidad: number;
  fecha_creacion: string;
  estado_actual: string;
  total: number;
}

@Component({
  selector: 'app-reporte-oc',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.scss']
})
export class ReportesComponent implements OnInit {
  private http = inject(HttpClient);
  private readonly API_BASE = `${environment.apiUrl}/api/v1/oc/ordenes-compra/reportes`;

  // Identificador del reporte seleccionado en el Combo Principal
  public reporteSeleccionado: string = '';
  public loading: boolean = false;

  // --- ARRAYS PARA ALMACENAR LOS RESULTADOS DE CADA CONSULTA ---
  public datosGastoUnidad: ReporteGastoUnidadDto[] = [];
  public datosEficiencia: ReporteEficienciaDto[] = [];
  public datosProveedores: ReporteProveedoresDto[] = [];
  public datosSinRespaldo: ReporteSinRespaldoDto[] = [];

  // --- MODELOS DE FILTROS PARA LOS FORMULARIOS ---
  filtrosGasto = { mesesAtras: 0 as number | null };
  filtrosEficiencia = { unidad: '' };
  filtrosProveedores = { limite: 10 };

  ngOnInit(): void {
    // No se ejecuta ninguna carga automática al inicio para esperar la selección del combo
  }

  /**
   * Limpia todas las tablas de datos y gatilla búsquedas automáticas si aplica
   */
  onReporteChange(): void {
    this.datosGastoUnidad = [];
    this.datosEficiencia = [];
    this.datosProveedores = [];
    this.datosSinRespaldo = [];
    
    // Si eligen el reporte de Auditoría Excepcional, se gatilla de inmediato al no requerir formulario
    if (this.reporteSeleccionado === 'SIN_RESPALDO') {
      this.cargarReporteSinRespaldo();
    }
  }

  // --- MÉTODOS DE LLAMADA HACIA SPRING BOOT ---

  cargarReporteGasto(): void {
    this.loading = true;
    let params = new HttpParams();
    if (this.filtrosGasto.mesesAtras !== null) {
      params = params.set('mesesAtras', this.filtrosGasto.mesesAtras.toString());
    }

    this.http.get<ReporteGastoUnidadDto[]>(`${this.API_BASE}/gastos-unidad`, { params })
      .subscribe({
        next: (data) => {
          this.datosGastoUnidad = data ? data : [];
          this.loading = false;
        },
        error: (err) => {
          console.error("Error al cargar reporte de gastos:", err);
          this.loading = false;
        }
      });
  }

  cargarReporteEficiencia(): void {
    this.loading = true;
    let params = new HttpParams();
    if (this.filtrosEficiencia.unidad) {
      params = params.set('unidad', this.filtrosEficiencia.unidad);
    }

    this.http.get<ReporteEficienciaDto[]>(`${this.API_BASE}/eficiencia-tiempos`, { params })
      .subscribe({
        next: (data) => {
          this.datosEficiencia = data ? data : [];
          this.loading = false;
        },
        error: (err) => {
          console.error("Error al cargar reporte de eficiencia:", err);
          this.loading = false;
        }
      });
  }

  cargarReporteProveedores(): void {
    this.loading = true;
    let params = new HttpParams().set('limite', this.filtrosProveedores.limite.toString());

    this.http.get<ReporteProveedoresDto[]>(`${this.API_BASE}/proveedores-criticos`, { params })
      .subscribe({
        next: (data) => {
          this.datosProveedores = data ? data : [];
          this.loading = false;
        },
        error: (err) => {
          console.error("Error al cargar ranking de proveedores:", err);
          this.loading = false;
        }
      });
  }

  cargarReporteSinRespaldo(): void {
    this.loading = true;
    this.http.get<ReporteSinRespaldoDto[]>(`${this.API_BASE}/sin-respaldo`)
      .subscribe({
        next: (data) => {
          this.datosSinRespaldo = data ? data : [];
          this.loading = false;
        },
        error: (err) => {
          console.error("Error al ejecutar auditoría de archivos:", err);
          this.loading = false;
        }
      });
  }
}
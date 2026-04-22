import { Injectable, signal, computed } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class OrdenSharedService {

  // Guardamos la orden completa (PlantillaStatusDTO)
  private ordenActiva = signal<any | null>(null);

  // Exponemos la orden como un computed (solo lectura) para los componentes
  public orden = computed(() => this.ordenActiva());

  constructor() { }

  /**
   * Guarda la orden seleccionada desde la tabla de búsqueda
   * @param orden Objeto PlantillaStatusDTO completo
   */
  setOrden(orden: any) {
    console.log('📦 Guardando orden en el estado compartido:', orden.codigoOrdenCompra);
    this.ordenActiva.set(orden);
  }

  /**
   * Obtiene la orden actual (útil para lógica no reactiva)
   */
  getOrden() {
    return this.ordenActiva();
  }

  /**
   * Limpia el estado (útil al cerrar sesión o terminar un proceso)
   */
  limpiar() {
    this.ordenActiva.set(null);
  }

  /**
   * Verifica si existe una orden cargada
   */
  tieneOrdenCargada(): boolean {
    return this.ordenActiva() !== null;
  }
}
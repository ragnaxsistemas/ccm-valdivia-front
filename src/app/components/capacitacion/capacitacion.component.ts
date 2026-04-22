import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-capacitacion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './capacitacion.component.html',
  styleUrls: ['./capacitacion.component.scss']
})
export class CapacitacionComponent {
  loading = false;
  descargarDoc() {
    console.log("Descargando...");
  }
}
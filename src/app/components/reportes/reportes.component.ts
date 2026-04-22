import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.scss']
})
export class ReportesComponent {
  loading = false;
  generarReporte() {
    this.loading = true;
    setTimeout(() => this.loading = false, 2000); // Simulación
  }
}
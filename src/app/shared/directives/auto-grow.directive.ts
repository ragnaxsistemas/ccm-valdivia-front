import { Directive, ElementRef, HostListener, AfterViewChecked, inject } from '@angular/core';

@Directive({
  selector: '[appAutoGrow]',
  standalone: true
})
export class AutoGrowDirective implements AfterViewChecked {
  private el = inject(ElementRef);

  // Escucha cuando el usuario escribe de forma interactiva
  @HostListener('input')
  onInput(): void {
    this.adjustHeight();
  }

  // Escucha cambios cuando el valor se asigna programáticamente (ej: al cargar un borrador)
  ngAfterViewChecked(): void {
    this.adjustHeight();
  }

  private adjustHeight(): void {
    const textarea = this.el.nativeElement as HTMLTextAreaElement;

    // Validamos que sea un elemento textarea para evitar errores
    if (textarea && textarea.tagName === 'TEXTAREA') {
      // 1. Forzar temporalmente que reduzca su tamaño para poder medir el scrollHeight real actual
      textarea.style.height = 'auto';

      // 2. Asignar la nueva altura basada en el contenido total del scroll interno en px
      if (textarea.scrollHeight > 0) {
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    }
  }
}
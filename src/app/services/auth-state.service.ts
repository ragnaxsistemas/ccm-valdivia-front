import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthStateService {
  // Usamos BehaviorSubject para que cualquier componente que se suscriba
  // reciba el último valor emitido inmediatamente.
  private userSessionSource = new BehaviorSubject<boolean>(false);
  userSession$ = this.userSessionSource.asObservable();

  // Método para avisar que el login fue exitoso
  notifyLogin() {
    this.userSessionSource.next(true);
  }
}
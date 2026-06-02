import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { errorInterceptor } from './interceptors/error.interceptor';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    // Registro del cliente HTTP con ambos interceptores funcionales
    provideHttpClient(
      withInterceptors([
        authInterceptor, 
        errorInterceptor
      ])
    ), provideAnimationsAsync(), provideAnimationsAsync()
  ]
};
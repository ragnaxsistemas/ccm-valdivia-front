import { TestBed } from '@angular/core/testing';

import { OrdenSharedService } from './orden-shared.service';

describe('OrdenSharedService', () => {
  let service: OrdenSharedService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OrdenSharedService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

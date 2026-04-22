import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AutorizacionComponent } from './autorizacion.component';

describe('AutorizacionComponent', () => {
  let component: AutorizacionComponent;
  let fixture: ComponentFixture<AutorizacionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AutorizacionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AutorizacionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

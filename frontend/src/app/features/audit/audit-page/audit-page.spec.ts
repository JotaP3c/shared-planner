import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuditPage } from './audit-page';

describe('AuditPage', () => {
  let component: AuditPage;
  let fixture: ComponentFixture<AuditPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditPage],
    }).compileComponents();

    fixture = TestBed.createComponent(AuditPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

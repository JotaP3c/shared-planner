import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FinancePage } from './finance-page';

describe('FinancePage', () => {
  let component: FinancePage;
  let fixture: ComponentFixture<FinancePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinancePage],
    }).compileComponents();

    fixture = TestBed.createComponent(FinancePage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

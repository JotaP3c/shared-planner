import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PendingPage } from './pending-page';

describe('PendingPage', () => {
  let component: PendingPage;
  let fixture: ComponentFixture<PendingPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PendingPage],
    }).compileComponents();

    fixture = TestBed.createComponent(PendingPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

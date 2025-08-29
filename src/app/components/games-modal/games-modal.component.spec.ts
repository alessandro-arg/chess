import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GamesModalComponent } from './games-modal.component';

describe('GamesModalComponent', () => {
  let component: GamesModalComponent;
  let fixture: ComponentFixture<GamesModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GamesModalComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(GamesModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

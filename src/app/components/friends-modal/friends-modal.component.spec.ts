import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FriendsModalComponent } from './friends-modal.component';

describe('FriendsModalComponent', () => {
  let component: FriendsModalComponent;
  let fixture: ComponentFixture<FriendsModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FriendsModalComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(FriendsModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

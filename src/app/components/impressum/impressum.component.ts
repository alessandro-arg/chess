import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-impressum',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './impressum.component.html',
  styleUrl: './impressum.component.css',
})
export class ImpressumComponent implements OnInit {
  inSettings = false;
  uid: string | null = null;

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.uid =
      this.route.snapshot.paramMap.get('uid') ??
      this.route.parent?.snapshot.paramMap.get('uid') ??
      null;
    this.inSettings = !!this.uid;
  }

  back(): void {
    if (this.uid) this.router.navigate(['/', this.uid, 'settings']);
    else window.history.back();
  }
}

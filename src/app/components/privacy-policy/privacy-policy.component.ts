import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.css',
})
export class PrivacyPolicyComponent implements OnInit {
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

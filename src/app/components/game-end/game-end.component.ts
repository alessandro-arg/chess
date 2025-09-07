import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';

export interface GameEndData {
  gameId: string;
  result: '1-0' | '0-1' | '1/2-1/2';
  status: 'mate' | 'draw' | 'flag' | 'resign' | 'finished';
  myColor: 'white' | 'black';
  myProfile: {
    name: string;
    photoURL: string;
    elo: number | null;
  };
  oppProfile: {
    name: string;
    photoURL: string;
    elo: number | null;
  };
  myUid: string;
}

@Component({
  selector: 'app-game-end',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-end.component.html',
  styleUrl: './game-end.component.css',
})
export class GameEndComponent implements OnInit, OnChanges {
  @Input() gameData!: GameEndData;
  @Input() isVisible = false;
  @Output() onClose = new EventEmitter<void>();
  @Output() onBackToDashboard = new EventEmitter<void>();
  @Output() onRematch = new EventEmitter<void>();
  @Output() onNewGame = new EventEmitter<void>();
  @Output() onAnalyze = new EventEmitter<void>();

  outcome: 'win' | 'loss' | 'draw' = 'draw';
  eloChange: number = 0;
  winReason: string = '';

  ngOnInit(): void {
    if (this.gameData) this.recompute();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['gameData'] || changes['isVisible']) {
      if (this.gameData && this.isVisible) this.recompute();
    }
  }

  private recompute(): void {
    this.calculateOutcome();
    this.setWinReason();
    this.calculateEloChange();
  }

  get leftPlayerName(): string {
    return this.leftPlayerColor === 'white'
      ? this.gameData.myColor === 'white'
        ? this.gameData.myProfile.name
        : this.gameData.oppProfile.name
      : this.gameData.myColor === 'black'
      ? this.gameData.myProfile.name
      : this.gameData.oppProfile.name;
  }

  get rightPlayerName(): string {
    return this.rightPlayerColor === 'black'
      ? this.gameData.myColor === 'black'
        ? this.gameData.myProfile.name
        : this.gameData.oppProfile.name
      : this.gameData.myColor === 'white'
      ? this.gameData.myProfile.name
      : this.gameData.oppProfile.name;
  }

  get leftPlayerPhoto(): string {
    return this.leftPlayerColor === this.gameData.myColor
      ? this.gameData.myProfile.photoURL
      : this.gameData.oppProfile.photoURL;
  }

  get rightPlayerPhoto(): string {
    return this.rightPlayerColor === this.gameData.myColor
      ? this.gameData.myProfile.photoURL
      : this.gameData.oppProfile.photoURL;
  }

  get leftPlayerColor(): 'white' | 'black' {
    return 'white';
  }
  get rightPlayerColor(): 'white' | 'black' {
    return 'black';
  }

  get gameScore(): string {
    return this.gameData.result;
  }

  get currentPlayerElo(): number {
    return this.gameData.myProfile.elo ?? 1200;
  }

  get winnerText(): string {
    if (this.gameData.result === '1-0') return 'Weiß gewinnt';
    if (this.gameData.result === '0-1') return 'Schwarz gewinnt';
    return 'Remis';
  }

  get outcomeText(): string {
    if (this.outcome === 'win')
      return `Du hast durch ${this.winReason} gewonnen`;
    if (this.outcome === 'loss')
      return `Gegner hat durch ${this.winReason} gewonnen`;
    return 'Unentschieden';
  }

  close(): void {
    this.onClose.emit();
  }

  backToDashboard(): void {
    this.onBackToDashboard.emit();
  }

  analyze(): void {
    this.onAnalyze.emit();
  }

  private calculateOutcome(): void {
    const myIsWhite = this.gameData.myColor === 'white';
    if (this.gameData.result === '1-0') {
      this.outcome = myIsWhite ? 'win' : 'loss';
    } else if (this.gameData.result === '0-1') {
      this.outcome = myIsWhite ? 'loss' : 'win';
    } else {
      this.outcome = 'draw';
    }
  }

  private setWinReason(): void {
    switch (this.gameData.status) {
      case 'mate':
        this.winReason = 'Schachmatt';
        break;
      case 'flag':
        this.winReason = 'Zeitüberschreitung';
        break;
      case 'resign':
        this.winReason = 'Aufgabe';
        break;
      case 'draw':
        this.winReason = 'Remis vereinbart';
        break;
      default:
        this.winReason = 'Spielende';
        break;
    }
  }

  private calculateEloChange(): number {
    // Placeholder ELO calculation - implement your actual system
    if (this.outcome === 'win') {
      this.eloChange = Math.floor(Math.random() * 20) + 5; // +5 to +25
    } else if (this.outcome === 'loss') {
      this.eloChange = -(Math.floor(Math.random() * 20) + 5); // -5 to -25
    } else {
      this.eloChange = Math.floor(Math.random() * 11) - 5; // -5 to +5
    }
    return this.eloChange;
  }
}

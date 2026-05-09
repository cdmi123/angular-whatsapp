import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { WhatsappService } from './services/whatsapp.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterModule, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  title = 'WhatsApp Bulk Sender PRO';
  
  connectionStatus = 'Initializing...';
  isConnected = false;
  
  private subs: Subscription = new Subscription();

  constructor(private whatsappService: WhatsappService, private cdRef: ChangeDetectorRef) {}

  ngOnInit() {
    this.subs.add(
      this.whatsappService.connectionStatus$.subscribe(status => {
        this.connectionStatus = status;
        if (status.includes('Connected') || status.includes('Authenticated')) {
          this.isConnected = true;
        } else {
          this.isConnected = false;
        }
        this.cdRef.detectChanges();
      })
    );

    // Initial check
    this.whatsappService.checkStatus().subscribe(
      (res: any) => {
        if (res.ready) {
          this.isConnected = true;
          this.connectionStatus = 'Connected to WhatsApp';
          this.cdRef.detectChanges();
        }
      },
      (err) => {
        this.connectionStatus = 'Backend offline.';
        this.cdRef.detectChanges();
      }
    );
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }
}

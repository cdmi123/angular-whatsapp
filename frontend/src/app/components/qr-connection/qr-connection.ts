import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { WhatsappService } from '../../services/whatsapp.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-qr-connection',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './qr-connection.html'
})
export class QrConnectionComponent implements OnInit, OnDestroy {
  qrCode = '';
  connectionStatus = 'Initializing...';
  isConnected = false;
  
  private subs: Subscription = new Subscription();

  constructor(private whatsappService: WhatsappService, private cdRef: ChangeDetectorRef) {}

  ngOnInit() {
    this.subs.add(
      this.whatsappService.qrCode$.subscribe(qr => {
        this.qrCode = qr;
        if (qr) this.isConnected = false;
        this.cdRef.detectChanges();
      })
    );

    this.subs.add(
      this.whatsappService.connectionStatus$.subscribe(status => {
        this.connectionStatus = status;
        if (status.includes('Connected') || status.includes('Authenticated')) {
          this.isConnected = true;
          this.qrCode = '';
        } else {
          this.isConnected = false;
        }
        this.cdRef.detectChanges();
      })
    );

    this.whatsappService.checkStatus().subscribe(
      (res: any) => {
        if (res.ready) {
          this.isConnected = true;
          this.connectionStatus = 'Connected to WhatsApp';
          this.cdRef.detectChanges();
        }
      }
    );
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }
}

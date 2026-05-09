import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { WhatsappService } from '../../services/whatsapp.service';
import { Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  stats = { sentCount: 0, receivedCount: 0, readCount: 0 };
  activeCampaign: any = null;
  recentCampaigns: any[] = [];
  loading = true;

  private subs: Subscription = new Subscription();

  constructor(private whatsappService: WhatsappService, private cdRef: ChangeDetectorRef, private http: HttpClient) {}

  ngOnInit() {
    this.loading = true;
    this.fetchRecentCampaigns();
    
    // Initial fetch
    this.whatsappService.getStats().subscribe(
      (data: any) => {
        this.stats = data.stats || this.stats;
        this.activeCampaign = data.activeCampaign;
        this.loading = false;
        this.cdRef.detectChanges();
      },
      (err: any) => {
        console.error('Error fetching stats', err);
        this.loading = false;
        this.cdRef.detectChanges();
      }
    );

    // Socket updates
    this.subs.add(
      this.whatsappService.stats$.subscribe((data: any) => {
        if (data) {
          this.stats = data;
          this.cdRef.detectChanges();
        }
      })
    );

    this.subs.add(
      this.whatsappService.activeCampaign$.subscribe((data: any) => {
        if (data) {
          this.activeCampaign = data;
          if (data.status === 'completed') {
            this.fetchRecentCampaigns();
          }
          this.cdRef.detectChanges();
        }
      })
    );
  }

  fetchRecentCampaigns() {
    this.loading = true;
    this.http.get<any[]>('http://localhost:3000/api/campaigns').subscribe(
        (data: any[]) => {
            console.log('Fetched campaigns:', data);
            this.recentCampaigns = data;
            this.loading = false;
            this.cdRef.detectChanges();
        },
        (err: any) => {
            console.error('Fetch campaigns error:', err);
            this.loading = false;
            this.cdRef.detectChanges();
        }
    );
  }

  deleteCampaign(id: string) {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    this.http.delete(`http://localhost:3000/api/campaigns/${id}`).subscribe(
        () => this.fetchRecentCampaigns(),
        (err: any) => alert('Delete failed')
    );
  }

  checkDatabase() {
    this.http.get<any>('http://localhost:3000/api/debug/db').subscribe(
        data => {
            alert(`Database Check:\nTotal Campaigns in DB: ${data.count}\nLatest: ${data.campaigns.length > 0 ? data.campaigns[0].name : 'None'}`);
            if (data.count > 0 && this.recentCampaigns.length === 0) {
                this.fetchRecentCampaigns();
            }
        },
        err => alert('Database Connection Error: ' + err.message)
    );
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  getProgressBarWidth() {
    if (!this.activeCampaign || this.activeCampaign.total === 0) return 0;
    return ((this.activeCampaign.sentCount + this.activeCampaign.failedCount) / this.activeCampaign.total) * 100;
  }
}

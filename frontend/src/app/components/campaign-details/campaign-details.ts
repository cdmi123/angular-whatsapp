import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { WhatsappService } from '../../services/whatsapp.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-campaign-details',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="header-action">
      <div class="flex items-center">
        <a routerLink="/dashboard" class="icon-btn mr-3"><i class="fas fa-arrow-left"></i></a>
        <div>
          <h2>{{ campaign?.name }}</h2>
          <p class="text-muted">Sent on {{ campaign?.createdAt | date:'medium' }}</p>
        </div>
      </div>
      <div class="badge" [ngClass]="campaign?.status">{{ campaign?.status | titlecase }}</div>
      <div class="actions ml-3">
        <button class="btn btn-secondary btn-sm mr-2" (click)="exportCampaign()" [disabled]="!campaign">
          <i class="fas fa-file-export mr-1"></i> Export
        </button>
        <button class="btn btn-primary btn-sm mr-2" (click)="retryFailed()" [disabled]="!campaign || campaign.failedCount === 0">
          <i class="fas fa-redo mr-1"></i> Retry Failed
        </button>
        <button class="btn btn-danger btn-sm" (click)="deleteCampaign()" [disabled]="!campaign">
          <i class="fas fa-trash mr-1"></i> Delete
        </button>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="card campaign-info">
        <h3>Message Sent</h3>
        <div class="message-preview mt-3">
          {{ campaign?.message }}
        </div>
        
        <div class="progress-stats mt-4">
          <div class="stat-box total">
            <span class="label">Total</span>
            <span class="value">{{ campaign?.totalContacts }}</span>
          </div>
          <div class="stat-box success">
            <span class="label">Sent</span>
            <span class="value">{{ campaign?.sentCount }}</span>
          </div>
          <div class="stat-box read">
            <span class="label">Read</span>
            <span class="value">{{ campaign?.readCount }}</span>
          </div>
          <div class="stat-box received">
            <span class="label">Replies</span>
            <span class="value">{{ campaign?.receivedCount }}</span>
          </div>
        </div>
      </div>

      <div class="card campaign-meta">
        <h3>Campaign Info</h3>
        <ul class="meta-list mt-3">
          <li><strong>Category:</strong> {{ campaign?.categoryName }}</li>
          <li><strong>Created:</strong> {{ campaign?.createdAt | date:'short' }}</li>
          <li><strong>Success Rate:</strong> {{ getSuccessRate() }}%</li>
        </ul>
      </div>
    </div>

    <div class="card mt-4">
      <h3>Recipients Details</h3>
      <div class="table-container mt-3">
        <table class="data-table">
          <thead>
            <tr>
              <th>Phone Number</th>
              <th>Status</th>
              <th>Last Interaction</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let contact of campaign?.contacts">
              <td class="font-mono">{{ contact.phone }}</td>
              <td>
                <span class="status-pill" [ngClass]="contact.status">
                  {{ contact.status | titlecase }}
                </span>
              </td>
              <td>{{ contact.lastInteraction ? (contact.lastInteraction | date:'shortTime') : '-' }}</td>
              <td class="text-danger">{{ contact.error || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .message-preview {
      background: #f8fbff;
      padding: 1.5rem;
      border-radius: 12px;
      border-left: 4px solid var(--primary-color);
      white-space: pre-wrap;
    }
    .meta-list {
      list-style: none;
      padding: 0;
    }
    .meta-list li {
      padding: 8px 0;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
    }
    .status-pill {
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .status-pill.sent { background: #dcfce7; color: #166534; }
    .status-pill.read { background: #dbeafe; color: #1e40af; }
    .status-pill.received { background: #fef9c3; color: #854d0e; }
    .status-pill.failed { background: #fee2e2; color: #991b1b; }
    .status-pill.pending { background: #f1f5f9; color: #475569; }
    
    .stat-box.read .value { color: var(--primary-color); }
    .stat-box.received .value { color: #d97706; }
  `]
})
export class CampaignDetailsComponent implements OnInit {
  campaign: any;
  private sub = new Subscription();

  constructor(private route: ActivatedRoute, private http: HttpClient, private whatsappService: WhatsappService, private router: Router) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.fetchDetails(id);

    this.sub.add(
      this.whatsappService.campaignStatsUpdate$.subscribe((data: any) => {
        if (data && data.campaignId === id) {
          this.fetchDetails(id);
        }
      })
    );
  }

  fetchDetails(id: string | null) {
    if (!id) return;
    this.http.get(`http://localhost:3000/api/campaigns/${id}`).subscribe(
      (res: any) => this.campaign = res,
      (err: any) => console.error(err)
    );
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  exportCampaign() {
    const id = this.campaign._id;
    window.open(`http://localhost:3000/api/campaigns/${id}/export`, '_blank');
  }

  retryFailed() {
    if (!confirm(`Are you sure you want to retry sending to ${this.campaign.failedCount} contacts?`)) return;
    
    this.http.post(`http://localhost:3000/api/campaigns/${this.campaign._id}/retry`, {}).subscribe(
      (res: any) => alert(res.message),
      (err: any) => alert('Error: ' + err.error?.error || 'Failed to retry')
    );
  }

  deleteCampaign() {
    if (!confirm('Are you sure you want to delete this campaign history? This action cannot be undone.')) return;
    
    this.http.delete(`http://localhost:3000/api/campaigns/${this.campaign._id}`).subscribe(
      () => {
        alert('Campaign deleted');
        this.router.navigate(['/dashboard']);
      },
      (err: any) => alert('Error: ' + err.error?.error || 'Failed to delete')
    );
  }

  getSuccessRate() {
    if (!this.campaign || this.campaign.totalContacts === 0) return 0;
    return Math.round((this.campaign.sentCount / this.campaign.totalContacts) * 100);
  }
}

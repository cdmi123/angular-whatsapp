import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { Observable, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WhatsappService {
  private socket: Socket;
  private backendUrl = 'http://localhost:3000';

  public qrCode$ = new BehaviorSubject<string>('');
  public connectionStatus$ = new BehaviorSubject<string>('Initializing...');
  public sendProgress$ = new BehaviorSubject<any>(null);
  public sendCompleted$ = new BehaviorSubject<any>(null);
  public stats$ = new BehaviorSubject<any>({ sentCount: 0, receivedCount: 0, readCount: 0 });
  public activeCampaign$ = new BehaviorSubject<any>(null);
  public campaignStatsUpdate$ = new BehaviorSubject<any>(null);

  constructor(private http: HttpClient, private ngZone: NgZone) {
    this.socket = io(this.backendUrl);

    this.socket.on('qr', (qr: string) => {
      this.ngZone.run(() => {
        this.qrCode$.next(qr);
        this.connectionStatus$.next('Scan QR Code to Authenticate');
      });
    });

    this.socket.on('ready', (data: any) => {
      this.ngZone.run(() => {
        this.qrCode$.next('');
        this.connectionStatus$.next('Connected to WhatsApp');
      });
    });

    this.socket.on('authenticated', (data: any) => {
      this.ngZone.run(() => {
        this.connectionStatus$.next('Authenticated, loading...');
      });
    });

    this.socket.on('disconnected', (data: any) => {
      this.ngZone.run(() => {
        this.connectionStatus$.next('Disconnected');
        this.qrCode$.next('');
      });
    });

    this.socket.on('send_progress', (data: any) => {
      this.ngZone.run(() => {
        this.sendProgress$.next(data);
      });
    });

    this.socket.on('send_completed', (data: any) => {
      this.ngZone.run(() => {
        this.sendCompleted$.next(data);
      });
    });

    this.socket.on('stats_update', (data: any) => {
      this.ngZone.run(() => {
        this.stats$.next(data);
      });
    });

    this.socket.on('campaign_update', (data: any) => {
      this.ngZone.run(() => {
        this.activeCampaign$.next(data);
      });
    });

    this.socket.on('campaign_stats_update', (data: any) => {
      this.ngZone.run(() => {
        this.campaignStatsUpdate$.next(data);
      });
    });
  }

  checkStatus() {
    return this.http.get<{ ready: boolean }>(`${this.backendUrl}/api/status`);
  }

  // Categories
  getCategories(): Observable<any> {
    return this.http.get(`${this.backendUrl}/api/categories`);
  }
  
  createCategory(data: any): Observable<any> {
    return this.http.post(`${this.backendUrl}/api/categories`, data);
  }

  deleteCategory(id: string): Observable<any> {
    return this.http.delete(`${this.backendUrl}/api/categories/${id}`);
  }

  // Contacts
  getContactsByCategory(categoryId: string): Observable<any> {
    return this.http.get(`${this.backendUrl}/api/contacts/category/${categoryId}`);
  }

  addContact(data: any): Observable<any> {
    return this.http.post(`${this.backendUrl}/api/contacts`, data);
  }

  updateContact(id: string, data: any): Observable<any> {
    return this.http.put(`${this.backendUrl}/api/contacts/${id}`, data);
  }

  deleteContact(id: string): Observable<any> {
    return this.http.delete(`${this.backendUrl}/api/contacts/${id}`);
  }

  sendBulkMessages(formData: FormData): Observable<any> {
    return this.http.post(`${this.backendUrl}/api/send-bulk`, formData);
  }

  getStats(): Observable<any> {
    return this.http.get(`${this.backendUrl}/api/stats`);
  }
}

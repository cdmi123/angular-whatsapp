import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { WhatsappService } from '../../services/whatsapp.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-bulk-sender',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bulk-sender.html',
  styleUrls: []
})
export class BulkSenderComponent implements OnInit, OnDestroy {
  categories: any[] = [];
  selectedCategoryId = '';
  
  messageText = '';
  phoneNumbersText = '';
  selectedFile: File | null = null;
  
  gujaratiMode = false;
  
  isSending = false;
  sendProgress: any = null;
  sendCompleted: any = null;

  private subs: Subscription = new Subscription();

  constructor(
    private whatsappService: WhatsappService,
    private http: HttpClient,
    private route: ActivatedRoute,
    private cdRef: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      if (params['categoryId']) {
        this.selectedCategoryId = params['categoryId'];
      }
    });

    this.whatsappService.getCategories().subscribe(
      data => this.categories = data,
      err => console.error(err)
    );

    this.subs.add(
      this.whatsappService.sendProgress$.subscribe(progress => {
        if (progress) {
          this.sendProgress = progress;
          this.cdRef.detectChanges();
        }
      })
    );

    this.subs.add(
      this.whatsappService.sendCompleted$.subscribe(completed => {
        if (completed) {
          this.sendCompleted = completed;
          this.isSending = false;
          this.cdRef.detectChanges();
        }
      })
    );
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) this.selectedFile = file;
  }

  // Basic Google Transliteration Implementation
  onMessageKeyUp(event: KeyboardEvent) {
    if (!this.gujaratiMode) return;
    
    // Trigger on Space or Enter
    if (event.code === 'Space' || event.code === 'Enter') {
      const cursorPosition = (event.target as HTMLTextAreaElement).selectionStart;
      const textUpToCursor = this.messageText.substring(0, cursorPosition);
      
      // Find the last word typed
      const words = textUpToCursor.trimEnd().split(/[\s\n]+/);
      const lastWord = words[words.length - 1];
      
      // If it contains English characters
      if (lastWord && /[a-zA-Z]/.test(lastWord)) {
        this.transliterate(lastWord).subscribe(
          (res: any) => {
            if (res && res[0] === 'SUCCESS' && res[1][0][1][0]) {
              const translated = res[1][0][1][0];
              // Replace the last word
              const regex = new RegExp(lastWord + '(?=\\s*$)', 'i');
              this.messageText = textUpToCursor.replace(regex, translated) + this.messageText.substring(cursorPosition);
            }
          }
        );
      }
    }
  }

  transliterate(word: string) {
    const url = `https://inputtools.google.com/request?text=${encodeURIComponent(word)}&itc=gu-t-i0-und&num=1`;
    return this.http.get(url);
  }

  sendBulk() {
    this.isSending = true;
    this.sendProgress = null;
    this.sendCompleted = null;

    const formData = new FormData();
    formData.append('message', this.messageText);
    
    if (this.selectedCategoryId) {
      formData.append('categoryId', this.selectedCategoryId);
      const catName = this.categories.find(c => c._id === this.selectedCategoryId)?.name;
      formData.append('category', catName || 'Database Category');
    }
    
    if (this.phoneNumbersText) {
      formData.append('numbers', this.phoneNumbersText);
    }
    if (this.selectedFile) {
      formData.append('csvFile', this.selectedFile);
    }

    this.whatsappService.sendBulkMessages(formData).subscribe(
      res => console.log('Started', res),
      err => {
        alert('Failed to start bulk sending. Client might not be ready.');
        this.isSending = false;
        this.cdRef.detectChanges();
      }
    );
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WhatsappService } from '../../services/whatsapp.service';

@Component({
  selector: 'app-contacts',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './contacts.html',
  styleUrls: []
})
export class ContactsComponent implements OnInit {
  categoryId: string = '';
  contacts: any[] = [];
  
  showAddForm = false;
  editMode = false;
  currentContact: any = { name: '', phone: '' };

  constructor(
    private whatsappService: WhatsappService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.categoryId = params['categoryId'];
      this.loadContacts();
    });
  }

  loadContacts() {
    if (!this.categoryId) return;
    this.whatsappService.getContactsByCategory(this.categoryId).subscribe(
      data => this.contacts = data,
      err => console.error(err)
    );
  }

  toggleAddForm() {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) {
      this.currentContact = { name: '', phone: '' };
      this.editMode = false;
    }
  }

  editContact(contact: any) {
    this.currentContact = { ...contact };
    this.editMode = true;
    this.showAddForm = true;
  }

  saveContact() {
    if (!this.currentContact.phone) return;
    
    if (this.editMode) {
      this.whatsappService.updateContact(this.currentContact._id, this.currentContact).subscribe(
        res => {
          this.toggleAddForm();
          this.loadContacts();
        },
        err => console.error(err)
      );
    } else {
      this.currentContact.categoryId = this.categoryId;
      this.whatsappService.addContact(this.currentContact).subscribe(
        res => {
          this.toggleAddForm();
          this.loadContacts();
        },
        err => console.error(err)
      );
    }
  }

  deleteContact(id: string) {
    if (confirm('Delete this contact?')) {
      this.whatsappService.deleteContact(id).subscribe(
        () => this.loadContacts(),
        err => console.error(err)
      );
    }
  }
}

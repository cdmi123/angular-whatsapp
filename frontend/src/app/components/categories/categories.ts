import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WhatsappService } from '../../services/whatsapp.service';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './categories.html',
  styleUrls: []
})
export class CategoriesComponent implements OnInit {
  categories: any[] = [];
  loading = true;
  showAddForm = false;
  
  newCategory = { name: '', description: '' };

  constructor(private whatsappService: WhatsappService) {}

  ngOnInit() {
    this.loadCategories();
  }

  loadCategories() {
    this.loading = true;
    this.whatsappService.getCategories().subscribe(
      (data) => {
        this.categories = data;
        this.loading = false;
      },
      (err) => {
        console.error('Error fetching categories', err);
        this.loading = false;
      }
    );
  }

  toggleAddForm() {
    this.showAddForm = !this.showAddForm;
    this.newCategory = { name: '', description: '' };
  }

  addCategory() {
    if (!this.newCategory.name) return;
    this.whatsappService.createCategory(this.newCategory).subscribe(
      (res) => {
        this.toggleAddForm();
        this.loadCategories();
      },
      (err) => {
        console.error('Error creating category', err);
        alert('Failed to create category.');
      }
    );
  }

  deleteCategory(id: string) {
    if (confirm('Are you sure you want to delete this category AND all its contacts?')) {
      this.whatsappService.deleteCategory(id).subscribe(
        () => {
          this.loadCategories();
        },
        (err) => {
          console.error('Error deleting category', err);
        }
      );
    }
  }
}

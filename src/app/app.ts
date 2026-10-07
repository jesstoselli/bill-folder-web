import { DOCUMENT } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly document = inject(DOCUMENT);

  protected skipToMainContent(event: Event): void {
    const mainContent = this.document.getElementById('main-content');
    if (!mainContent) {
      return;
    }

    event.preventDefault();
    mainContent.focus();
  }
}

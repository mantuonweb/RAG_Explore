import { Component, ElementRef, OnInit, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { RagApiService } from '../services/rag-api.service';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
})
export class ChatComponent implements OnInit {
  @ViewChild('messagesEl') messagesEl!: ElementRef<HTMLDivElement>;

  question = '';
  messages = signal<Message[]>([]);
  loading = signal(false);

  docId = '';
  docName = '';

  constructor(private api: RagApiService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.docId = this.route.snapshot.queryParamMap.get('docId') ?? '';

    if (this.docId) {
      this.api.getSources().subscribe({
        next: (docs) => {
          const found = docs.find((d) => d.doc_id === this.docId);
          this.docName = found?.doc_name ?? this.docId;
        },
      });
    }
  }

  ask(): void {
    const q = this.question.trim();
    if (!q || this.loading()) return;

    this.messages.update(msgs => [...msgs, { role: 'user', text: q }]);
    this.question = '';
    this.loading.set(true);
    this.scrollToBottom();

    this.api.query(q, this.docId || undefined).subscribe({
      next: (res) => {
        const text = res?.answer ?? 'No answer returned from server.';
        this.messages.update(msgs => [...msgs, { role: 'assistant', text }]);
        this.loading.set(false);
        this.scrollToBottom();
      },
      error: (err) => {
        const detail = err?.error?.detail ?? err?.message ?? 'Unknown error';
        this.messages.update(msgs => [...msgs, { role: 'assistant', text: `Error: ${detail}` }]);
        this.loading.set(false);
        this.scrollToBottom();
      },
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.ask();
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.messagesEl?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }
}

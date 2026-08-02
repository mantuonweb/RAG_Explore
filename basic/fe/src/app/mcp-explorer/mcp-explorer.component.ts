import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

const MCP_BASE = 'http://localhost:8080';

interface McpTool {
  name: string;
  description: string;
  params: string[];
  required: string[];
  schema: Record<string, any>;
}

interface McpResource {
  uri: string;
  description: string;
}

interface McpPrompt {
  name: string;
  description: string;
  args: { name: string; required: boolean }[];
}

@Component({
  selector: 'app-mcp-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mcp-explorer.component.html',
  styleUrl: './mcp-explorer.component.scss',
})
export class McpExplorerComponent implements OnInit {
  connected = signal(false);
  activeTab = signal<'tools' | 'resources' | 'prompts'>('tools');

  tools = signal<McpTool[]>([]);
  resources = signal<McpResource[]>([]);
  prompts = signal<McpPrompt[]>([]);

  selectedTool = signal<McpTool | null>(null);
  selectedResource = signal<McpResource | null>(null);
  selectedPrompt = signal<McpPrompt | null>(null);

  toolArgs: Record<string, string> = {};
  promptArgs: Record<string, string> = {};

  toolResult = signal<string>('');
  resourceResult = signal<string>('');
  promptResult = signal<string>('');

  toolLoading = signal(false);
  resourceLoading = signal(false);
  promptLoading = signal(false);

  constructor(private http: HttpClient) {}

  ngOnInit() {
    Promise.all([
      this.http.get<McpTool[]>(`${MCP_BASE}/api/tools`).toPromise(),
      this.http.get<McpResource[]>(`${MCP_BASE}/api/resources`).toPromise(),
      this.http.get<McpPrompt[]>(`${MCP_BASE}/api/prompts`).toPromise(),
    ])
      .then(([tools, resources, prompts]) => {
        this.tools.set(tools ?? []);
        this.resources.set(resources ?? []);
        this.prompts.set(prompts ?? []);
        this.connected.set(true);
        if (tools?.length) this.selectTool(tools[0]);
      })
      .catch(() => this.connected.set(false));
  }

  selectTool(tool: McpTool) {
    this.selectedTool.set(tool);
    this.toolArgs = {};
    this.toolResult.set('');
  }

  selectResource(r: McpResource) {
    this.selectedResource.set(r);
    this.resourceResult.set('');
  }

  selectPrompt(p: McpPrompt) {
    this.selectedPrompt.set(p);
    this.promptArgs = {};
    this.promptResult.set('');
  }

  runTool() {
    const tool = this.selectedTool();
    if (!tool) return;
    this.toolLoading.set(true);
    this.toolResult.set('');
    const args: Record<string, string> = {};
    tool.params.forEach(p => { if (this.toolArgs[p]?.trim()) args[p] = this.toolArgs[p].trim(); });

    this.http
      .post<any>(`${MCP_BASE}/api/call-tool`, { name: tool.name, arguments: args })
      .subscribe({
        next: r => { this.toolResult.set(JSON.stringify(r, null, 2)); this.toolLoading.set(false); },
        error: e => { this.toolResult.set('Error: ' + (e.error?.detail ?? e.message)); this.toolLoading.set(false); },
      });
  }

  readResource() {
    const r = this.selectedResource();
    if (!r) return;
    this.resourceLoading.set(true);
    this.resourceResult.set('');

    this.http
      .get<any>(`${MCP_BASE}/api/read-resource`, { params: { uri: r.uri } })
      .subscribe({
        next: d => { this.resourceResult.set(JSON.stringify(d, null, 2)); this.resourceLoading.set(false); },
        error: e => { this.resourceResult.set('Error: ' + (e.error?.detail ?? e.message)); this.resourceLoading.set(false); },
      });
  }

  getPrompt() {
    const p = this.selectedPrompt();
    if (!p) return;
    this.promptLoading.set(true);
    this.promptResult.set('');
    const args: Record<string, string> = {};
    p.args.forEach(a => { if (this.promptArgs[a.name]?.trim()) args[a.name] = this.promptArgs[a.name].trim(); });

    this.http
      .get<any>(`${MCP_BASE}/api/get-prompt`, {
        params: { name: p.name, args: JSON.stringify(args) },
      })
      .subscribe({
        next: d => { this.promptResult.set(JSON.stringify(d, null, 2)); this.promptLoading.set(false); },
        error: e => {
          const detail = e.error?.detail ?? e.message ?? 'Unknown error';
          this.promptResult.set('Error: ' + detail);
          this.promptLoading.set(false);
        },
      });
  }
}

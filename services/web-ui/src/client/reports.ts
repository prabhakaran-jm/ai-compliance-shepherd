/**
 * Reports page functionality
 * Handles compliance reports listing, generation, and viewing
 */

import { apiClient, NotificationManager, LoadingManager, ErrorHandler, DateUtils } from './main';

interface Report {
  reportId: string;
  title: string;
  reportType: string;
  status: 'ready' | 'generating' | 'failed';
  format: string;
  createdAt: string;
  updatedAt: string;
  size?: number;
  downloadUrl?: string;
}

interface ReportTemplate {
  type: string;
  name: string;
  description: string;
  formats: string[];
  estimatedTime: string;
}

class ReportsManager {
  private reports: Report[] = [];
  private templates: ReportTemplate[] = [];
  private currentFilters = {
    reportType: '',
    status: '',
    dateRange: ''
  };
  private currentPage = 1;
  private pageSize = 12;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.setupEventListeners();
    await this.loadReports();
    await this.loadTemplates();
    this.updateMetrics();
  }

  private setupEventListeners(): void {
    // Generate report button
    const generateBtn = document.getElementById('generateReportBtn');
    if (generateBtn) {
      generateBtn.addEventListener('click', () => this.showGenerateModal());
    }

    // Filters
    const filters = ['reportTypeFilter', 'statusFilter', 'dateRangeFilter'];
    filters.forEach(filterId => {
      const filter = document.getElementById(filterId) as HTMLSelectElement;
      if (filter) {
        filter.addEventListener('change', () => this.applyFilters());
      }
    });

    // Clear filters
    const clearFiltersBtn = document.getElementById('clearFilters');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => this.clearFilters());
    }

    // Refresh reports
    const refreshBtn = document.getElementById('refreshReports');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshReports());
    }

    // View mode toggle
    const viewModeInputs = document.querySelectorAll('input[name="viewMode"]');
    viewModeInputs.forEach(input => {
      input.addEventListener('change', () => this.updateViewMode());
    });

    // Generate report form
    this.setupGenerateReportForm();

    // Report actions (delegated events)
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      if (target.closest('.download-report')) {
        const reportId = target.closest('.report-card')?.getAttribute('data-report-id');
        if (reportId) this.downloadReport(reportId);
      }
      
      if (target.closest('.preview-report')) {
        const reportId = target.closest('.report-card')?.getAttribute('data-report-id');
        if (reportId) this.previewReport(reportId);
      }
      
      if (target.closest('.share-report')) {
        const reportId = target.closest('.report-card')?.getAttribute('data-report-id');
        if (reportId) this.shareReport(reportId);
      }
      
      if (target.closest('.delete-report')) {
        const reportId = target.closest('.report-card')?.getAttribute('data-report-id');
        if (reportId) this.deleteReport(reportId);
      }
    });
  }

  private setupGenerateReportForm(): void {
    // Report type selection
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const typeCard = target.closest('.report-type-card');
      
      if (typeCard) {
        document.querySelectorAll('.report-type-card').forEach(card => {
          card.classList.remove('selected');
        });
        typeCard.classList.add('selected');
      }
    });

    // Format selection
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const formatOption = target.closest('.format-option');
      
      if (formatOption) {
        document.querySelectorAll('.format-option').forEach(option => {
          option.classList.remove('selected');
        });
        formatOption.classList.add('selected');
      }
    });

    // Submit generate report
    const submitBtn = document.getElementById('submitGenerateReport');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.submitGenerateReport());
    }
  }

  private async loadReports(): Promise<void> {
    try {
      const response = await apiClient.get('/reports', {
        ...this.currentFilters,
        limit: this.pageSize,
        offset: (this.currentPage - 1) * this.pageSize
      });
      
      this.reports = response.items || [];
      this.renderReports();
      this.renderPagination(response.total || 0);
    } catch (error) {
      console.error('Failed to load reports:', error);
      this.loadDemoReports();
    }
  }

  private async loadTemplates(): Promise<void> {
    try {
      this.templates = await apiClient.get('/reports/templates/available');
      this.renderReportTemplates();
    } catch (error) {
      console.error('Failed to load templates:', error);
      this.loadDemoTemplates();
    }
  }

  private loadDemoReports(): void {
    this.reports = [
      {
        reportId: 'report-1',
        title: 'SOC 2 Compliance Summary',
        reportType: 'compliance_summary',
        status: 'ready',
        format: 'html',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        size: 2.4
      },
      {
        reportId: 'report-2',
        title: 'Critical Findings Report',
        reportType: 'detailed_findings',
        status: 'generating',
        format: 'pdf',
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      },
      {
        reportId: 'report-3',
        title: 'Executive Dashboard',
        reportType: 'executive_summary',
        status: 'ready',
        format: 'html',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        size: 1.8
      }
    ];
    
    this.renderReports();
  }

  private loadDemoTemplates(): void {
    this.templates = [
      {
        type: 'compliance_summary',
        name: 'Compliance Summary',
        description: 'High-level compliance overview with key metrics',
        formats: ['html', 'pdf'],
        estimatedTime: '2-5 minutes'
      },
      {
        type: 'detailed_findings',
        name: 'Detailed Findings Report',
        description: 'Comprehensive findings analysis with remediation recommendations',
        formats: ['html', 'pdf', 'csv'],
        estimatedTime: '5-10 minutes'
      },
      {
        type: 'executive_summary',
        name: 'Executive Summary',
        description: 'Executive-level compliance dashboard and trends',
        formats: ['html', 'pdf'],
        estimatedTime: '3-7 minutes'
      }
    ];
    
    this.renderReportTemplates();
  }

  private renderReports(): void {
    const container = document.getElementById('reportsContainer');
    if (!container) return;

    if (this.reports.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-file-earmark-text display-1 text-muted mb-3"></i>
          <h4>No Reports Found</h4>
          <p class="text-muted">Generate your first compliance report to get started.</p>
          <button class="btn btn-primary" onclick="document.getElementById('generateReportBtn').click()">
            <i class="bi bi-plus-circle me-2"></i>
            Generate Report
          </button>
        </div>
      `;
      return;
    }

    const isGridView = (document.getElementById('gridView') as HTMLInputElement)?.checked !== false;
    
    if (isGridView) {
      this.renderGridView(container);
    } else {
      this.renderListView(container);
    }
  }

  private renderGridView(container: HTMLElement): void {
    const reportsHtml = this.reports.map(report => this.renderReportCard(report)).join('');
    container.innerHTML = `<div class="report-grid">${reportsHtml}</div>`;
  }

  private renderListView(container: HTMLElement): void {
    const reportsHtml = this.reports.map(report => this.renderReportRow(report)).join('');
    container.innerHTML = `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>Report</th>
              <th>Type</th>
              <th>Format</th>
              <th>Status</th>
              <th>Created</th>
              <th>Size</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${reportsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  private renderReportCard(report: Report): string {
    const statusClasses = {
      ready: 'success',
      generating: 'warning',
      failed: 'danger'
    };

    const statusIcons = {
      ready: 'check-circle',
      generating: 'clock',
      failed: 'x-circle'
    };

    return `
      <div class="card report-card" data-report-id="${report.reportId}">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-3">
            <h6 class="card-title mb-0">${report.title}</h6>
            <span class="report-status ${report.status}">
              <i class="bi bi-${statusIcons[report.status]} me-1"></i>
              ${report.status.charAt(0).toUpperCase() + report.status.slice(1)}
            </span>
          </div>
          
          <div class="mb-3">
            <small class="text-muted">
              <i class="bi bi-tag me-1"></i>
              ${this.getReportTypeName(report.reportType)}
            </small>
            <br>
            <small class="text-muted">
              <i class="bi bi-file-earmark me-1"></i>
              ${report.format.toUpperCase()}
              ${report.size ? ` • ${report.size} MB` : ''}
            </small>
            <br>
            <small class="text-muted">
              <i class="bi bi-clock me-1"></i>
              ${DateUtils.formatRelative(report.updatedAt)}
            </small>
          </div>

          <div class="report-actions">
            ${report.status === 'ready' ? `
              <button class="btn btn-primary btn-sm download-report">
                <i class="bi bi-download"></i>
              </button>
              <button class="btn btn-outline-secondary btn-sm preview-report">
                <i class="bi bi-eye"></i>
              </button>
              <button class="btn btn-outline-secondary btn-sm share-report">
                <i class="bi bi-share"></i>
              </button>
            ` : ''}
            <button class="btn btn-outline-danger btn-sm delete-report">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderReportRow(report: Report): string {
    const statusBadge = `
      <span class="badge bg-${report.status === 'ready' ? 'success' : report.status === 'generating' ? 'warning' : 'danger'}">
        ${report.status.charAt(0).toUpperCase() + report.status.slice(1)}
      </span>
    `;

    const actions = report.status === 'ready' ? `
      <div class="btn-group btn-group-sm">
        <button class="btn btn-outline-primary download-report" title="Download">
          <i class="bi bi-download"></i>
        </button>
        <button class="btn btn-outline-secondary preview-report" title="Preview">
          <i class="bi bi-eye"></i>
        </button>
        <button class="btn btn-outline-secondary share-report" title="Share">
          <i class="bi bi-share"></i>
        </button>
        <button class="btn btn-outline-danger delete-report" title="Delete">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    ` : `
      <button class="btn btn-outline-danger btn-sm delete-report" title="Delete">
        <i class="bi bi-trash"></i>
      </button>
    `;

    return `
      <tr data-report-id="${report.reportId}">
        <td>
          <div class="fw-medium">${report.title}</div>
        </td>
        <td>${this.getReportTypeName(report.reportType)}</td>
        <td>${report.format.toUpperCase()}</td>
        <td>${statusBadge}</td>
        <td>${DateUtils.formatDate(report.createdAt)}</td>
        <td>${report.size ? `${report.size} MB` : '--'}</td>
        <td>${actions}</td>
      </tr>
    `;
  }

  private renderReportTemplates(): void {
    const container = document.getElementById('reportTypeCards');
    if (!container) return;

    const templatesHtml = this.templates.map(template => `
      <div class="report-type-card" data-type="${template.type}">
        <h6>${template.name}</h6>
        <p class="text-muted mb-2">${template.description}</p>
        <div class="d-flex justify-content-between align-items-center">
          <small class="text-muted">
            <i class="bi bi-clock me-1"></i>
            ${template.estimatedTime}
          </small>
          <small class="text-muted">
            Formats: ${template.formats.join(', ').toUpperCase()}
          </small>
        </div>
      </div>
    `).join('');

    container.innerHTML = templatesHtml;
  }

  private renderPagination(total: number): void {
    const container = document.getElementById('reportsPagination');
    if (!container) return;

    const totalPages = Math.ceil(total / this.pageSize);
    
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let paginationHtml = '';
    
    // Previous button
    paginationHtml += `
      <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" data-page="${this.currentPage - 1}">Previous</a>
      </li>
    `;

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
      if (i === this.currentPage || i === 1 || i === totalPages || 
          (i >= this.currentPage - 1 && i <= this.currentPage + 1)) {
        paginationHtml += `
          <li class="page-item ${i === this.currentPage ? 'active' : ''}">
            <a class="page-link" href="#" data-page="${i}">${i}</a>
          </li>
        `;
      } else if (i === this.currentPage - 2 || i === this.currentPage + 2) {
        paginationHtml += '<li class="page-item disabled"><span class="page-link">...</span></li>';
      }
    }

    // Next button
    paginationHtml += `
      <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
        <a class="page-link" href="#" data-page="${this.currentPage + 1}">Next</a>
      </li>
    `;

    container.innerHTML = paginationHtml;

    // Add pagination event listeners
    container.querySelectorAll('.page-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = parseInt((e.target as HTMLElement).getAttribute('data-page') || '1');
        if (page !== this.currentPage && page >= 1 && page <= totalPages) {
          this.currentPage = page;
          this.loadReports();
        }
      });
    });
  }

  private updateMetrics(): void {
    const metrics = {
      total: this.reports.length,
      ready: this.reports.filter(r => r.status === 'ready').length,
      generating: this.reports.filter(r => r.status === 'generating').length,
      shared: 0 // Would come from API
    };

    const elements = {
      totalReports: document.getElementById('totalReports'),
      readyReports: document.getElementById('readyReports'),
      generatingReports: document.getElementById('generatingReports'),
      sharedReports: document.getElementById('sharedReports')
    };

    Object.entries(elements).forEach(([key, element]) => {
      if (element) {
        element.textContent = metrics[key as keyof typeof metrics].toString();
      }
    });
  }

  private getReportTypeName(type: string): string {
    const template = this.templates.find(t => t.type === type);
    return template ? template.name : type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private showGenerateModal(): void {
    const modal = document.getElementById('generateReportModal');
    if (modal) {
      const bootstrapModal = new (window as any).bootstrap.Modal(modal);
      bootstrapModal.show();
    }
  }

  private async submitGenerateReport(): Promise<void> {
    try {
      const selectedType = document.querySelector('.report-type-card.selected')?.getAttribute('data-type');
      const selectedFormat = document.querySelector('.format-option.selected')?.getAttribute('data-format');
      const title = (document.getElementById('reportTitle') as HTMLInputElement)?.value;
      const description = (document.getElementById('reportDescription') as HTMLTextAreaElement)?.value;
      
      const includeCharts = (document.getElementById('includeCharts') as HTMLInputElement)?.checked;
      const includeRecommendations = (document.getElementById('includeRecommendations') as HTMLInputElement)?.checked;

      if (!selectedType || !selectedFormat) {
        NotificationManager.error('Please select a report type and format');
        return;
      }

      LoadingManager.show('generate', 'Generating report...');

      const report = await apiClient.post('/reports/generate', {
        reportType: selectedType,
        title: title || 'Untitled Report',
        description,
        format: selectedFormat,
        includeCharts,
        includeRecommendations
      });

      // Close modal
      const modal = document.getElementById('generateReportModal');
      if (modal) {
        const bootstrapModal = (window as any).bootstrap.Modal.getInstance(modal);
        bootstrapModal?.hide();
      }

      NotificationManager.success('Report generation started');
      await this.loadReports();

    } catch (error) {
      ErrorHandler.handle(error, 'Failed to generate report');
    } finally {
      LoadingManager.hide('generate');
    }
  }

  private async downloadReport(reportId: string): Promise<void> {
    try {
      LoadingManager.show('download', 'Preparing download...');
      
      const response = await fetch(`/api/reports/${reportId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ai-compliance-token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const filename = this.getFilenameFromResponse(response) || 'report.html';
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      NotificationManager.success('Report downloaded successfully');

    } catch (error) {
      ErrorHandler.handle(error, 'Failed to download report');
    } finally {
      LoadingManager.hide('download');
    }
  }

  private getFilenameFromResponse(response: Response): string | null {
    const disposition = response.headers.get('content-disposition');
    if (disposition) {
      const match = disposition.match(/filename="([^"]+)"/);
      return match ? match[1] : null;
    }
    return null;
  }

  private async previewReport(reportId: string): Promise<void> {
    try {
      LoadingManager.show('preview', 'Loading preview...');
      
      const preview = await apiClient.get(`/reports/${reportId}/preview`);
      
      const modal = document.getElementById('reportPreviewModal');
      const content = document.getElementById('reportPreviewContent');
      
      if (modal && content) {
        content.innerHTML = preview.content || '<p>Preview not available</p>';
        
        const bootstrapModal = new (window as any).bootstrap.Modal(modal);
        bootstrapModal.show();
      }

    } catch (error) {
      ErrorHandler.handle(error, 'Failed to load preview');
    } finally {
      LoadingManager.hide('preview');
    }
  }

  private async shareReport(reportId: string): Promise<void> {
    try {
      const shareLink = await apiClient.post(`/reports/${reportId}/share`, {
        expirationHours: 24
      });

      // Copy to clipboard
      await navigator.clipboard.writeText(shareLink.url);
      NotificationManager.success('Share link copied to clipboard');

    } catch (error) {
      ErrorHandler.handle(error, 'Failed to create share link');
    }
  }

  private async deleteReport(reportId: string): Promise<void> {
    if (!confirm('Are you sure you want to delete this report?')) {
      return;
    }

    try {
      await apiClient.delete(`/reports/${reportId}`);
      NotificationManager.success('Report deleted successfully');
      await this.loadReports();
    } catch (error) {
      ErrorHandler.handle(error, 'Failed to delete report');
    }
  }

  private applyFilters(): void {
    this.currentFilters = {
      reportType: (document.getElementById('reportTypeFilter') as HTMLSelectElement)?.value || '',
      status: (document.getElementById('statusFilter') as HTMLSelectElement)?.value || '',
      dateRange: (document.getElementById('dateRangeFilter') as HTMLSelectElement)?.value || ''
    };
    
    this.currentPage = 1;
    this.loadReports();
  }

  private clearFilters(): void {
    const filters = ['reportTypeFilter', 'statusFilter', 'dateRangeFilter'];
    filters.forEach(filterId => {
      const filter = document.getElementById(filterId) as HTMLSelectElement;
      if (filter) filter.value = '';
    });
    
    this.currentFilters = { reportType: '', status: '', dateRange: '' };
    this.currentPage = 1;
    this.loadReports();
  }

  private refreshReports(): void {
    NotificationManager.info('Refreshing reports...');
    this.loadReports();
  }

  private updateViewMode(): void {
    this.renderReports();
  }
}

// Initialize reports manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ReportsManager();
});

/**
 * Dashboard page functionality
 * Handles the main dashboard view with metrics, charts, and navigation
 */

import { apiClient, NotificationManager, LoadingManager, ErrorHandler, DateUtils } from './main';

class DashboardManager {
  private charts: Map<string, any> = new Map();
  private refreshInterval: number | null = null;
  private currentSection = 'dashboard';

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.setupNavigation();
    this.setupEventListeners();
    await this.loadDashboardData();
    this.startAutoRefresh();
  }

  private setupNavigation(): void {
    const navLinks = document.querySelectorAll('.sidebar .nav-link');
    const contentContainer = document.getElementById('content-container');
    const pageTitle = document.getElementById('page-title');

    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const section = (e.currentTarget as HTMLElement).getAttribute('data-section');
        
        if (section && !link.getAttribute('href')?.startsWith('/')) {
          e.preventDefault();
          this.navigateToSection(section);
        }
      });
    });

    // Mobile sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');

    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('show');
      });
    }
  }

  private setupEventListeners(): void {
    // Refresh button
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      if (target.closest('#refreshDashboard')) {
        this.refreshDashboard();
      }
    });

    // Auto-refresh toggle
    const autoRefreshToggle = document.getElementById('autoRefreshToggle') as HTMLInputElement;
    if (autoRefreshToggle) {
      autoRefreshToggle.addEventListener('change', (e) => {
        const enabled = (e.target as HTMLInputElement).checked;
        if (enabled) {
          this.startAutoRefresh();
        } else {
          this.stopAutoRefresh();
        }
      });
    }
  }

  private async navigateToSection(section: string): Promise<void> {
    this.currentSection = section;
    
    // Update active nav link
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
      link.classList.remove('active');
    });
    
    const activeLink = document.querySelector(`[data-section="${section}"]`);
    if (activeLink) {
      activeLink.classList.add('active');
    }

    // Update page title
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
      pageTitle.textContent = this.getSectionTitle(section);
    }

    // Load section content
    const contentContainer = document.getElementById('content-container');
    if (contentContainer) {
      try {
        LoadingManager.show('navigation', 'Loading...');
        await this.loadSectionContent(section, contentContainer);
      } catch (error) {
        ErrorHandler.handle(error, 'Failed to load section');
      } finally {
        LoadingManager.hide('navigation');
      }
    }
  }

  private getSectionTitle(section: string): string {
    const titles: Record<string, string> = {
      dashboard: 'Dashboard',
      scans: 'Environment Scans',
      findings: 'Findings',
      'audit-packs': 'Audit Packs',
      slack: 'Slack Integration',
      settings: 'Settings'
    };
    
    return titles[section] || section.charAt(0).toUpperCase() + section.slice(1);
  }

  private async loadSectionContent(section: string, container: HTMLElement): Promise<void> {
    switch (section) {
      case 'dashboard':
        await this.renderDashboard(container);
        break;
      case 'scans':
        await this.renderScans(container);
        break;
      case 'findings':
        await this.renderFindings(container);
        break;
      case 'audit-packs':
        await this.renderAuditPacks(container);
        break;
      case 'slack':
        await this.renderSlackIntegration(container);
        break;
      case 'settings':
        await this.renderSettings(container);
        break;
      default:
        container.innerHTML = `<div class="alert alert-warning">Section "${section}" not implemented yet.</div>`;
    }
  }

  private async loadDashboardData(): Promise<void> {
    const container = document.getElementById('content-container');
    if (container) {
      await this.renderDashboard(container);
    }
  }

  private async renderDashboard(container: HTMLElement): Promise<void> {
    try {
      // Show loading state
      container.innerHTML = `
        <div class="row mb-4">
          <div class="col-12 text-center">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading dashboard...</span>
            </div>
            <p class="mt-2 text-muted">Loading your compliance dashboard...</p>
          </div>
        </div>
      `;

      // Fetch dashboard data
      const [overview, trends, activity, criticalFindings] = await Promise.all([
        apiClient.get('/dashboard/overview'),
        apiClient.get('/dashboard/compliance-trends', { timeRange: '30d' }),
        apiClient.get('/dashboard/recent-activity', { limit: 5 }),
        apiClient.get('/dashboard/critical-findings')
      ]);

      // Render dashboard content
      container.innerHTML = this.getDashboardHTML();
      
      // Update metrics
      this.updateMetrics(overview);
      
      // Render charts
      await this.renderCharts(trends);
      
      // Update recent activity
      this.updateRecentActivity(activity);
      
      // Update critical findings
      this.updateCriticalFindings(criticalFindings);

    } catch (error) {
      container.innerHTML = `
        <div class="alert alert-warning" role="alert">
          <h4 class="alert-heading">Demo Mode</h4>
          <p>Unable to connect to backend services. Showing demo data for demonstration purposes.</p>
          <hr>
          <p class="mb-0">In a production environment, this would show real-time compliance data from your AWS environment.</p>
        </div>
      `;
      
      // Load demo data
      this.loadDemoData(container);
    }
  }

  private getDashboardHTML(): string {
    return `
      <!-- Quick Actions Bar -->
      <div class="row mb-4">
        <div class="col-12">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title mb-3">
                <i class="bi bi-lightning-charge me-2"></i>
                Quick Actions
              </h5>
              <div class="row g-2">
                <div class="col-md-3">
                  <button class="btn btn-primary w-100" id="startScanBtn">
                    <i class="bi bi-search me-2"></i>
                    Start Security Scan
                  </button>
                </div>
                <div class="col-md-3">
                  <a href="/chat" target="_blank" class="btn btn-success w-100">
                    <i class="bi bi-chat-dots me-2"></i>
                    Ask AI Assistant
                  </a>
                </div>
                <div class="col-md-3">
                  <a href="/reports" target="_blank" class="btn btn-info w-100">
                    <i class="bi bi-file-earmark-text me-2"></i>
                    Generate Report
                  </a>
                </div>
                <div class="col-md-3">
                  <button class="btn btn-warning w-100" id="auditPackBtn">
                    <i class="bi bi-archive me-2"></i>
                    Create Audit Pack
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Key Metrics -->
      <div class="row mb-4">
        <div class="col-lg-3 col-md-6 mb-3">
          <div class="metric-card">
            <div class="metric-value text-primary" id="complianceScore">--</div>
            <div class="metric-label">Compliance Score</div>
            <div class="metric-change" id="complianceChange">--</div>
          </div>
        </div>
        <div class="col-lg-3 col-md-6 mb-3">
          <div class="metric-card">
            <div class="metric-value text-danger" id="criticalFindings">--</div>
            <div class="metric-label">Critical Findings</div>
            <div class="metric-change" id="findingsChange">--</div>
          </div>
        </div>
        <div class="col-lg-3 col-md-6 mb-3">
          <div class="metric-card">
            <div class="metric-value text-info" id="totalResources">--</div>
            <div class="metric-label">Resources Scanned</div>
            <div class="metric-change" id="resourcesChange">--</div>
          </div>
        </div>
        <div class="col-lg-3 col-md-6 mb-3">
          <div class="metric-card">
            <div class="metric-value text-success" id="lastScan">--</div>
            <div class="metric-label">Last Scan</div>
            <div class="metric-change" id="scanStatus">--</div>
          </div>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="row mb-4">
        <div class="col-lg-8">
          <div class="card">
            <div class="card-header">
              <h5 class="card-title mb-0">
                <i class="bi bi-graph-up me-2"></i>
                Compliance Trends (30 Days)
              </h5>
            </div>
            <div class="card-body">
              <canvas id="complianceTrendsChart" width="400" height="200"></canvas>
            </div>
          </div>
        </div>
        <div class="col-lg-4">
          <div class="card">
            <div class="card-header">
              <h5 class="card-title mb-0">
                <i class="bi bi-pie-chart me-2"></i>
                Findings by Severity
              </h5>
            </div>
            <div class="card-body">
              <canvas id="findingsSeverityChart" width="300" height="300"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Activity and Critical Findings -->
      <div class="row">
        <div class="col-lg-6">
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="card-title mb-0">
                <i class="bi bi-clock-history me-2"></i>
                Recent Activity
              </h5>
              <button class="btn btn-outline-secondary btn-sm" id="refreshActivity">
                <i class="bi bi-arrow-clockwise"></i>
              </button>
            </div>
            <div class="card-body">
              <div id="recentActivityList">
                <!-- Activity items will be loaded here -->
              </div>
            </div>
          </div>
        </div>
        <div class="col-lg-6">
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="card-title mb-0">
                <i class="bi bi-exclamation-triangle me-2"></i>
                Critical Findings
              </h5>
              <a href="#findings" class="btn btn-outline-primary btn-sm" data-section="findings">
                View All
              </a>
            </div>
            <div class="card-body">
              <div id="criticalFindingsList">
                <!-- Critical findings will be loaded here -->
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private updateMetrics(data: any): void {
    const elements = {
      complianceScore: document.getElementById('complianceScore'),
      criticalFindings: document.getElementById('criticalFindings'),
      totalResources: document.getElementById('totalResources'),
      lastScan: document.getElementById('lastScan')
    };

    if (elements.complianceScore) {
      elements.complianceScore.textContent = `${data.complianceScore?.overall || 0}%`;
    }
    
    if (elements.criticalFindings) {
      elements.criticalFindings.textContent = data.findingsStats?.bySeverity?.critical || 0;
    }
    
    if (elements.totalResources) {
      elements.totalResources.textContent = data.resourceStats?.totalResources || 0;
    }
    
    if (elements.lastScan) {
      const lastScanTime = data.scanStatus?.lastScan;
      elements.lastScan.textContent = lastScanTime ? DateUtils.formatRelative(lastScanTime) : 'Never';
    }
  }

  private async renderCharts(trendsData: any): Promise<void> {
    // Compliance trends chart
    const trendsCtx = document.getElementById('complianceTrendsChart') as HTMLCanvasElement;
    if (trendsCtx && (window as any).Chart) {
      const Chart = (window as any).Chart;
      
      const trendsChart = new Chart(trendsCtx, {
        type: 'line',
        data: {
          labels: trendsData?.dates || ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
          datasets: [{
            label: 'Compliance Score',
            data: trendsData?.scores || [75, 78, 82, 85],
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: {
                callback: function(value) {
                  return value + '%';
                }
              }
            }
          }
        }
      });
      
      this.charts.set('trends', trendsChart);
    }

    // Findings severity chart
    const severityCtx = document.getElementById('findingsSeverityChart') as HTMLCanvasElement;
    if (severityCtx && (window as any).Chart) {
      const Chart = (window as any).Chart;
      
      const severityChart = new Chart(severityCtx, {
        type: 'doughnut',
        data: {
          labels: ['Critical', 'High', 'Medium', 'Low', 'Info'],
          datasets: [{
            data: [5, 12, 23, 18, 8],
            backgroundColor: [
              '#dc3545',
              '#fd7e14',
              '#ffc107',
              '#20c997',
              '#6f42c1'
            ],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom'
            }
          }
        }
      });
      
      this.charts.set('severity', severityChart);
    }
  }

  private updateRecentActivity(activities: any[]): void {
    const container = document.getElementById('recentActivityList');
    if (!container) return;

    if (!activities || activities.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted py-4">
          <i class="bi bi-clock-history display-6 mb-2"></i>
          <p>No recent activity</p>
        </div>
      `;
      return;
    }

    const activityHtml = activities.map(activity => `
      <div class="d-flex align-items-start mb-3">
        <div class="flex-shrink-0">
          <div class="bg-primary rounded-circle p-2">
            <i class="bi bi-${this.getActivityIcon(activity.type)} text-white"></i>
          </div>
        </div>
        <div class="flex-grow-1 ms-3">
          <div class="fw-medium">${activity.description}</div>
          <small class="text-muted">${DateUtils.formatRelative(activity.timestamp)}</small>
        </div>
      </div>
    `).join('');

    container.innerHTML = activityHtml;
  }

  private updateCriticalFindings(findings: any[]): void {
    const container = document.getElementById('criticalFindingsList');
    if (!container) return;

    if (!findings || findings.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted py-4">
          <i class="bi bi-check-circle display-6 mb-2 text-success"></i>
          <p>No critical findings</p>
        </div>
      `;
      return;
    }

    const findingsHtml = findings.map(finding => `
      <div class="border-start border-danger border-3 ps-3 mb-3">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <div class="fw-medium">${finding.title}</div>
            <small class="text-muted">${finding.resource}</small>
          </div>
          <span class="badge bg-danger">Critical</span>
        </div>
      </div>
    `).join('');

    container.innerHTML = findingsHtml;
  }

  private getActivityIcon(type: string): string {
    const iconMap: Record<string, string> = {
      scan: 'search',
      finding: 'exclamation-triangle',
      remediation: 'tools',
      report: 'file-earmark-text',
      user: 'person'
    };
    
    return iconMap[type] || 'info-circle';
  }

  private loadDemoData(container: HTMLElement): void {
    // Add demo dashboard HTML
    container.innerHTML += this.getDashboardHTML();
    
    // Load demo metrics
    this.updateMetrics({
      complianceScore: { overall: 87 },
      findingsStats: { bySeverity: { critical: 3 } },
      resourceStats: { totalResources: 245 },
      scanStatus: { lastScan: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() }
    });

    // Load demo activity
    this.updateRecentActivity([
      {
        type: 'scan',
        description: 'Completed environment scan',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString()
      },
      {
        type: 'finding',
        description: 'New critical finding detected',
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString()
      }
    ]);

    // Load demo findings
    this.updateCriticalFindings([
      {
        title: 'S3 Bucket Public Access Enabled',
        resource: 's3://my-bucket-example'
      },
      {
        title: 'IAM User with Overprivileged Access',
        resource: 'iam:user/service-account'
      }
    ]);

    // Render demo charts
    setTimeout(() => {
      this.renderCharts({});
    }, 100);
  }

  private async renderScans(container: HTMLElement): Promise<void> {
    container.innerHTML = `
      <div class="alert alert-info">
        <h4>Environment Scans</h4>
        <p>This section would show your AWS environment scans. In the full implementation, you would see:</p>
        <ul>
          <li>Active and completed scans</li>
          <li>Scan progress and results</li>
          <li>Start new scans with custom configurations</li>
          <li>Scan history and trends</li>
        </ul>
      </div>
    `;
  }

  private async renderFindings(container: HTMLElement): Promise<void> {
    container.innerHTML = `
      <div class="alert alert-info">
        <h4>Compliance Findings</h4>
        <p>This section would show your compliance findings. In the full implementation, you would see:</p>
        <ul>
          <li>List of all findings with filtering and sorting</li>
          <li>Finding details and remediation steps</li>
          <li>Bulk actions for managing findings</li>
          <li>Finding trends and statistics</li>
        </ul>
      </div>
    `;
  }

  private async renderAuditPacks(container: HTMLElement): Promise<void> {
    container.innerHTML = `
      <div class="alert alert-info">
        <h4>Audit Packs</h4>
        <p>This section would show your audit packages. In the full implementation, you would see:</p>
        <ul>
          <li>Generated audit packages for different frameworks</li>
          <li>Package generation status and download links</li>
          <li>Create new audit packages</li>
          <li>Share packages with auditors</li>
        </ul>
      </div>
    `;
  }

  private async renderSlackIntegration(container: HTMLElement): Promise<void> {
    container.innerHTML = `
      <div class="alert alert-info">
        <h4>Slack Integration</h4>
        <p>This section would show your Slack configuration. In the full implementation, you would see:</p>
        <ul>
          <li>Slack workspace connection status</li>
          <li>Channel configuration for different notification types</li>
          <li>Notification history and statistics</li>
          <li>Test notifications and troubleshooting</li>
        </ul>
      </div>
    `;
  }

  private async renderSettings(container: HTMLElement): Promise<void> {
    container.innerHTML = `
      <div class="alert alert-info">
        <h4>Settings</h4>
        <p>This section would show your account settings. In the full implementation, you would see:</p>
        <ul>
          <li>User profile and preferences</li>
          <li>Tenant configuration and limits</li>
          <li>API keys and integrations</li>
          <li>Notification preferences</li>
        </ul>
      </div>
    `;
  }

  private refreshDashboard(): void {
    NotificationManager.info('Refreshing dashboard...');
    this.loadDashboardData();
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.refreshInterval = window.setInterval(() => {
      this.loadDashboardData();
    }, 60000); // Refresh every minute
  }

  private stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new DashboardManager();
});

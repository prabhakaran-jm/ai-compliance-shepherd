/**
 * Main client-side application entry point
 * Shared utilities and initialization for all pages
 */

// Import global styles
import './styles/main.scss';

// API configuration
export const API_CONFIG = {
  baseURL: window.location.origin,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
};

// Authentication utilities
export class AuthManager {
  private static readonly TOKEN_KEY = 'ai-compliance-token';
  
  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }
  
  static setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }
  
  static removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }
  
  static isAuthenticated(): boolean {
    const token = this.getToken();
    return token !== null && token.length > 0;
  }
  
  static getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}

// API client utilities
export class ApiClient {
  private baseURL: string;
  
  constructor(baseURL: string = API_CONFIG.baseURL) {
    this.baseURL = baseURL;
  }
  
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}/api${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      headers: {
        ...API_CONFIG.headers,
        ...AuthManager.getAuthHeaders(),
        ...options.headers
      }
    };
    
    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error?.message || 'API request failed');
      }
      
      return data.data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }
  
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(`${this.baseURL}/api${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    
    return this.request<T>(endpoint + url.search, { method: 'GET' });
  }
  
  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }
  
  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }
  
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Notification utilities
export class NotificationManager {
  private static toastContainer: HTMLElement | null = null;
  
  private static getToastContainer(): HTMLElement {
    if (!this.toastContainer) {
      this.toastContainer = document.querySelector('.toast-container');
      
      if (!this.toastContainer) {
        this.toastContainer = document.createElement('div');
        this.toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
        document.body.appendChild(this.toastContainer);
      }
    }
    
    return this.toastContainer;
  }
  
  static show(
    message: string, 
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
    duration: number = 5000
  ): void {
    const container = this.getToastContainer();
    
    const toastId = `toast-${Date.now()}`;
    const iconMap = {
      success: 'bi-check-circle-fill',
      error: 'bi-exclamation-triangle-fill',
      warning: 'bi-exclamation-triangle-fill',
      info: 'bi-info-circle-fill'
    };
    
    const colorMap = {
      success: 'text-success',
      error: 'text-danger',
      warning: 'text-warning',
      info: 'text-primary'
    };
    
    const toastHtml = `
      <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="toast-header">
          <i class="bi ${iconMap[type]} ${colorMap[type]} me-2"></i>
          <strong class="me-auto">${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
          <small class="text-muted">now</small>
          <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">
          ${message}
        </div>
      </div>
    `;
    
    container.insertAdjacentHTML('beforeend', toastHtml);
    
    const toastElement = document.getElementById(toastId)!;
    const toast = new (window as any).bootstrap.Toast(toastElement, {
      delay: duration
    });
    
    toast.show();
    
    // Clean up after toast is hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
      toastElement.remove();
    });
  }
  
  static success(message: string, duration?: number): void {
    this.show(message, 'success', duration);
  }
  
  static error(message: string, duration?: number): void {
    this.show(message, 'error', duration);
  }
  
  static warning(message: string, duration?: number): void {
    this.show(message, 'warning', duration);
  }
  
  static info(message: string, duration?: number): void {
    this.show(message, 'info', duration);
  }
}

// Loading utilities
export class LoadingManager {
  private static activeLoaders = new Set<string>();
  
  static show(id: string = 'default', message: string = 'Loading...'): void {
    this.activeLoaders.add(id);
    
    let modal = document.getElementById('loadingModal');
    
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'loadingModal';
      modal.className = 'modal fade';
      modal.setAttribute('data-bs-backdrop', 'static');
      modal.innerHTML = `
        <div class="modal-dialog modal-sm modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-body text-center py-4">
              <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <p class="mb-0" id="loadingMessage">${message}</p>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    
    const messageElement = modal.querySelector('#loadingMessage');
    if (messageElement) {
      messageElement.textContent = message;
    }
    
    const bootstrapModal = new (window as any).bootstrap.Modal(modal);
    bootstrapModal.show();
  }
  
  static hide(id: string = 'default'): void {
    this.activeLoaders.delete(id);
    
    if (this.activeLoaders.size === 0) {
      const modal = document.getElementById('loadingModal');
      if (modal) {
        const bootstrapModal = (window as any).bootstrap.Modal.getInstance(modal);
        if (bootstrapModal) {
          bootstrapModal.hide();
        }
      }
    }
  }
  
  static hideAll(): void {
    this.activeLoaders.clear();
    this.hide();
  }
}

// Date formatting utilities
export class DateUtils {
  static formatRelative(date: string | Date): string {
    const now = new Date();
    const target = new Date(date);
    const diffMs = now.getTime() - target.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    
    return target.toLocaleDateString();
  }
  
  static formatDateTime(date: string | Date): string {
    return new Date(date).toLocaleString();
  }
  
  static formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString();
  }
  
  static formatTime(date: string | Date): string {
    return new Date(date).toLocaleTimeString();
  }
}

// Error handling utilities
export class ErrorHandler {
  static handle(error: any, context?: string): void {
    console.error('Error occurred:', error, context);
    
    let message = 'An unexpected error occurred';
    
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    } else if (error?.message) {
      message = error.message;
    }
    
    if (context) {
      message = `${context}: ${message}`;
    }
    
    NotificationManager.error(message);
  }
  
  static async withErrorHandling<T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      this.handle(error, context);
      return null;
    }
  }
}

// Initialize authentication check
document.addEventListener('DOMContentLoaded', () => {
  // Set demo token for development
  if (!AuthManager.isAuthenticated()) {
    AuthManager.setToken('demo-token');
  }
  
  // Initialize Bootstrap tooltips
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  tooltipTriggerList.forEach(tooltipTriggerEl => {
    new (window as any).bootstrap.Tooltip(tooltipTriggerEl);
  });
  
  // Initialize Bootstrap popovers
  const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
  popoverTriggerList.forEach(popoverTriggerEl => {
    new (window as any).bootstrap.Popover(popoverTriggerEl);
  });
});

// Export global API client instance
export const apiClient = new ApiClient();

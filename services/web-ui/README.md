# AI Compliance Shepherd - Web UI

A comprehensive web interface for the AI Compliance Shepherd platform, providing unified access to compliance management, AI-powered assistance, and reporting capabilities.

## Overview

The Web UI serves as the primary interface for users to interact with the AI Compliance Shepherd platform. It features a modern, responsive design with three main components:

1. **Dashboard** - Main overview with metrics, charts, and quick actions
2. **Chat Interface** - Real-time AI assistant powered by AWS Bedrock
3. **Reports** - Professional compliance reports and audit packages

## Features

### 🎯 **Unified Dashboard**
- **Real-time Metrics**: Compliance scores, critical findings, resource counts
- **Interactive Charts**: Compliance trends, findings by severity, resource distribution
- **Quick Actions**: Start scans, generate reports, access AI assistant
- **Recent Activity**: Live feed of system actions and changes
- **Mobile Responsive**: Full functionality on desktop, tablet, and mobile

### 🤖 **AI-Powered Chat Interface**
- **Conversational AI**: Natural language interaction with Claude 3
- **Real-time Communication**: WebSocket-based chat with typing indicators
- **Rich Message Formatting**: Markdown support, code highlighting, charts
- **Session Management**: Multiple chat sessions with history
- **Quick Actions**: Pre-built prompts for common tasks
- **Mobile Optimized**: Touch-friendly interface for mobile devices

### 📊 **Professional Reports**
- **Multiple Formats**: HTML, PDF, CSV exports
- **Visual Reports**: Charts, graphs, and executive summaries
- **Custom Generation**: Configurable report types and options
- **Preview & Share**: Live preview and shareable links
- **Download Management**: Progress tracking and file management
- **Audit Ready**: Professional formatting for compliance audits

### 🔐 **Security & Authentication**
- **Token-based Authentication**: JWT tokens with automatic refresh
- **Tenant Isolation**: Complete data separation between customers
- **CORS Protection**: Secure cross-origin resource sharing
- **Input Sanitization**: XSS protection with DOMPurify
- **Secure Headers**: Helmet.js security headers

### 🚀 **Performance & UX**
- **Webpack Bundling**: Optimized JavaScript and CSS bundles
- **Code Splitting**: Lazy loading for better performance
- **Progressive Enhancement**: Works without JavaScript for basic functionality
- **Accessibility**: WCAG 2.1 compliant with keyboard navigation
- **Dark Mode Ready**: CSS variables for theme customization

## Architecture

### Frontend Stack
```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Architecture                    │
└─────────────────────────────────────────────────────────────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
         ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
         │Dashboard│ │  Chat   │ │ Reports │
         │  (SPA)  │ │ (Real-  │ │ (CRUD)  │
         │         │ │ time)   │ │         │
         └─────────┘ └─────────┘ └─────────┘
              │           │           │
              └───────────┼───────────┘
                          │
                    ┌─────▼─────┐
                    │ Shared    │
                    │ Components│
                    │ & Utils   │
                    └───────────┘
```

### Backend Integration
```
┌─────────────────────────────────────────────────────────────┐
│                   Backend Integration                       │
└─────────────────────────────────────────────────────────────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
         ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
         │   API   │ │WebSocket│ │  Auth   │
         │Gateway  │ │ Chat    │ │Service  │
         │(REST)   │ │(Socket) │ │ (JWT)   │
         └─────────┘ └─────────┘ └─────────┘
              │           │           │
              └───────────┼───────────┘
                          │
            ┌─────────────▼─────────────┐
            │     Lambda Functions      │
            │ • Scan Environment        │
            │ • Findings Storage        │
            │ • Report Generator        │
            │ • Bedrock Agent           │
            │ • Audit Pack Generator    │
            │ • Slack Notifications     │
            └───────────────────────────┘
```

## Technology Stack

### Core Technologies
- **Node.js** - Runtime environment
- **Express.js** - Web server framework
- **TypeScript** - Type-safe JavaScript
- **Socket.IO** - Real-time WebSocket communication
- **Webpack** - Module bundler and build tool

### Frontend Libraries
- **Bootstrap 5** - UI framework and components
- **Chart.js** - Interactive charts and visualizations
- **Marked.js** - Markdown parsing and rendering
- **Highlight.js** - Code syntax highlighting
- **DOMPurify** - XSS protection and HTML sanitization

### Security & Authentication
- **Passport.js** - Authentication middleware
- **Helmet.js** - Security headers
- **Express Rate Limit** - API rate limiting
- **CORS** - Cross-origin resource sharing

## File Structure

```
services/web-ui/
├── package.json                 # Dependencies and scripts
├── webpack.config.js           # Webpack build configuration
├── tsconfig.server.json        # Server TypeScript config
├── tsconfig.client.json        # Client TypeScript config
├── src/
│   ├── server.ts              # Express server entry point
│   ├── routes/                # API route handlers
│   │   ├── index.ts          # Route aggregation
│   │   ├── dashboard.ts      # Dashboard data endpoints
│   │   ├── chat.ts           # Chat session management
│   │   ├── reports.ts        # Report CRUD operations
│   │   ├── scans.ts          # Scan management
│   │   ├── findings.ts       # Findings operations
│   │   ├── tenants.ts        # Multi-tenant management
│   │   ├── auditPacks.ts     # Audit package operations
│   │   └── slack.ts          # Slack integration
│   ├── services/              # Business logic services
│   │   ├── DashboardService.ts    # Dashboard data aggregation
│   │   ├── ChatService.ts         # AI chat management
│   │   ├── ReportsService.ts      # Report generation
│   │   ├── ScansService.ts        # Environment scanning
│   │   ├── FindingsService.ts     # Findings management
│   │   ├── TenantsService.ts      # Tenant operations
│   │   ├── AuditPacksService.ts   # Audit packages
│   │   └── SlackService.ts        # Slack notifications
│   ├── middleware/            # Express middleware
│   │   ├── authMiddleware.ts  # Authentication/authorization
│   │   └── errorHandler.ts   # Error handling
│   ├── auth/                  # Authentication setup
│   │   └── index.ts          # Passport configuration
│   ├── socket/                # WebSocket handlers
│   │   └── index.ts          # Socket.IO event handlers
│   ├── utils/                 # Utility functions
│   │   ├── logger.ts         # Structured logging
│   │   └── asyncHandler.ts   # Async error handling
│   └── client/                # Frontend application
│       ├── main.ts           # Shared utilities
│       ├── dashboard.ts      # Dashboard functionality
│       ├── chat.ts           # Chat interface
│       ├── reports.ts        # Reports interface
│       ├── styles/           # SCSS stylesheets
│       │   └── main.scss     # Main stylesheet
│       └── templates/        # HTML templates
│           ├── index.html    # Dashboard template
│           ├── chat.html     # Chat template
│           └── reports.html  # Reports template
└── tests/                     # Test files
    └── ...                   # Test implementations
```

## API Endpoints

### Dashboard APIs
```
GET  /api/dashboard/overview              # Key metrics and status
GET  /api/dashboard/compliance-trends     # Historical compliance data
GET  /api/dashboard/recent-activity       # Recent system activity
GET  /api/dashboard/critical-findings     # High-priority findings
GET  /api/dashboard/scan-status          # Current scan information
GET  /api/dashboard/resource-stats       # Resource statistics
```

### Chat APIs
```
POST /api/chat/sessions                  # Create new chat session
GET  /api/chat/sessions                  # List user sessions
GET  /api/chat/sessions/:id              # Get specific session
GET  /api/chat/sessions/:id/messages     # Get session messages
POST /api/chat/sessions/:id/messages     # Send message to AI
PUT  /api/chat/sessions/:id              # Update session
DELETE /api/chat/sessions/:id            # Delete session
GET  /api/chat/capabilities              # Get AI capabilities
```

### Reports APIs
```
GET  /api/reports                        # List reports
GET  /api/reports/:id                    # Get specific report
POST /api/reports/generate               # Generate new report
GET  /api/reports/:id/download           # Download report
GET  /api/reports/:id/preview            # Preview report
DELETE /api/reports/:id                  # Delete report
GET  /api/reports/templates/available    # Get report templates
POST /api/reports/:id/share              # Create share link
```

### Additional APIs
```
# Scans
GET  /api/scans                          # List scans
POST /api/scans/start                    # Start new scan
GET  /api/scans/:id/status               # Get scan status
GET  /api/scans/:id/results              # Get scan results

# Findings
GET  /api/findings                       # List findings
GET  /api/findings/:id                   # Get specific finding
PUT  /api/findings/:id/status            # Update finding status
POST /api/findings/:id/suppress          # Suppress finding
POST /api/findings/:id/remediate         # Apply remediation

# Tenants
GET  /api/tenants/current                # Get current tenant info
PUT  /api/tenants/current/settings       # Update tenant settings
GET  /api/tenants/current/usage          # Get usage statistics
GET  /api/tenants/current/users          # List tenant users

# Audit Packs
GET  /api/audit-packs                    # List audit packs
POST /api/audit-packs/generate           # Generate audit pack
GET  /api/audit-packs/:id/download       # Download audit pack

# Slack Integration
GET  /api/slack/config                   # Get Slack configuration
PUT  /api/slack/config                   # Update Slack config
POST /api/slack/test-connection          # Test Slack connection
GET  /api/slack/channels                 # Get Slack channels
```

## WebSocket Events

### Chat Events
```javascript
// Client to Server
socket.emit('chat:message', {
  sessionId: 'session-id',
  message: 'User message content',
  messageId: 'unique-id'
});

socket.emit('chat:typing', {
  sessionId: 'session-id',
  typing: true
});

socket.emit('chat:join', {
  sessionId: 'session-id'
});

// Server to Client
socket.on('chat:message:received', {
  messageId: 'unique-id',
  timestamp: '2024-01-01T00:00:00Z'
});

socket.on('chat:typing', {
  sessionId: 'session-id',
  userId: 'user-id',
  typing: true
});

socket.on('chat:error', {
  error: 'Error message'
});
```

### Notification Events
```javascript
// Server to Client
socket.on('notifications:scan:complete', {
  scanId: 'scan-id',
  status: 'completed',
  findingsCount: 42
});

socket.on('notifications:finding:critical', {
  findingId: 'finding-id',
  severity: 'critical',
  resource: 'resource-name'
});

socket.on('notifications:report:ready', {
  reportId: 'report-id',
  title: 'Report Title',
  downloadUrl: 'https://...'
});
```

## Development

### Prerequisites
- Node.js 18+ and npm
- TypeScript 5+
- Modern browser with WebSocket support

### Setup
```bash
# Install dependencies
npm install

# Development mode (with hot reload)
npm run dev

# Build for production
npm run build:prod

# Start production server
npm start
```

### Development Scripts
```bash
npm run build              # Build both server and client
npm run build:server       # Build server TypeScript
npm run build:client       # Build client bundles
npm run dev                # Start development servers
npm run dev:server         # Start server with hot reload
npm run dev:client         # Start webpack dev server
npm test                   # Run test suite
npm run lint               # Lint TypeScript code
npm run clean              # Clean build artifacts
```

### Environment Variables
```bash
# Server Configuration
PORT=3000                              # Server port
NODE_ENV=development                   # Environment mode

# API Endpoints
API_BASE_URL=http://localhost:8080     # Main API gateway
BEDROCK_AGENT_URL=http://localhost:8081 # AI agent service
CHAT_INTERFACE_URL=http://localhost:8082 # Chat service
HTML_REPORT_GENERATOR_URL=http://localhost:8083 # Reports
SCAN_ENVIRONMENT_URL=http://localhost:8084 # Scanning
FINDINGS_STORAGE_URL=http://localhost:8085 # Findings
# ... other service URLs

# Authentication
JWT_SECRET=your-secret-key             # JWT signing secret
JWT_ISSUER=ai-compliance-shepherd      # JWT issuer
JWT_AUDIENCE=web-ui                    # JWT audience
SESSION_SECRET=session-secret          # Session secret

# CORS and Security
ALLOWED_ORIGINS=http://localhost:3001  # Allowed origins
```

### Testing
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- dashboard.test.ts
```

## Production Deployment

### Build Process
```bash
# Production build
NODE_ENV=production npm run build:prod

# Package for deployment
npm run package
```

### Docker Deployment
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY public/ ./public/

EXPOSE 3000
CMD ["npm", "start"]
```

### Performance Optimization
- **Webpack Code Splitting**: Separate bundles for each page
- **Asset Compression**: Gzip compression for static files
- **CDN Integration**: External libraries served from CDN
- **Caching Headers**: Appropriate cache headers for assets
- **Bundle Analysis**: Use `webpack-bundle-analyzer` for optimization

## Security Considerations

### Frontend Security
- **CSP Headers**: Content Security Policy for XSS protection
- **Input Sanitization**: DOMPurify for HTML sanitization
- **HTTPS Only**: Force HTTPS in production
- **Token Storage**: Secure token storage practices

### API Security
- **Rate Limiting**: Prevent API abuse
- **Input Validation**: Validate all user inputs
- **CORS Policy**: Restrict cross-origin requests
- **Authentication**: JWT-based authentication
- **Tenant Isolation**: Prevent cross-tenant data access

### WebSocket Security
- **Authentication**: Token-based WebSocket auth
- **Message Validation**: Validate all incoming messages
- **Rate Limiting**: Prevent WebSocket spam
- **Room Isolation**: Tenant-specific chat rooms

## Monitoring & Observability

### Logging
- **Structured Logging**: JSON-formatted logs
- **Correlation IDs**: Request tracking across services
- **Error Tracking**: Comprehensive error logging
- **Performance Metrics**: Response time tracking

### Health Checks
```
GET /health              # Basic health check
GET /health/ready        # Readiness probe
GET /health/live         # Liveness probe
```

### Metrics
- **User Sessions**: Active user tracking
- **API Performance**: Response time metrics
- **WebSocket Connections**: Real-time connection counts
- **Error Rates**: Application error tracking

## Troubleshooting

### Common Issues

**1. WebSocket Connection Failed**
```bash
# Check if Socket.IO server is running
curl http://localhost:3000/socket.io/
# Should return Socket.IO info
```

**2. Authentication Errors**
```bash
# Verify JWT token
# Check browser developer tools -> Application -> Local Storage
# Look for 'ai-compliance-token' key
```

**3. API Connection Issues**
```bash
# Verify API services are running
curl http://localhost:8080/health
curl http://localhost:8081/health
```

**4. Build Errors**
```bash
# Clear node_modules and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=web-ui:* npm run dev

# Enable verbose webpack output
npm run dev:client -- --verbose
```

## Integration Guide

### Embedding Components
```html
<!-- Include compiled CSS and JS -->
<link rel="stylesheet" href="/dist/main.css">
<script src="/dist/main.js"></script>

<!-- Dashboard component -->
<div id="compliance-dashboard" 
     data-tenant-id="tenant-123"
     data-auth-token="jwt-token">
</div>

<script>
  // Initialize dashboard
  new ComplianceDashboard('#compliance-dashboard');
</script>
```

### API Integration
```javascript
// Initialize API client
import { ApiClient } from './main';

const client = new ApiClient('https://api.compliance-shepherd.com');

// Authenticate
client.setAuthToken('your-jwt-token');

// Use APIs
const overview = await client.get('/dashboard/overview');
const reports = await client.get('/reports');
```

### WebSocket Integration
```javascript
// Connect to WebSocket
import io from 'socket.io-client';

const socket = io('wss://chat.compliance-shepherd.com', {
  auth: { token: 'your-jwt-token' }
});

// Handle events
socket.on('connect', () => {
  console.log('Connected to chat');
});

socket.on('chat:message', (message) => {
  console.log('New message:', message);
});
```

## Contributing

### Code Style
- **TypeScript**: Strict mode enabled
- **ESLint**: Enforced code style
- **Prettier**: Automatic code formatting
- **Naming**: camelCase for variables, PascalCase for classes

### Pull Request Process
1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -m 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit pull request

### Testing Requirements
- Unit tests for all new functionality
- Integration tests for API endpoints
- E2E tests for critical user flows
- Minimum 80% code coverage

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- **Documentation**: [docs.compliance-shepherd.com](https://docs.compliance-shepherd.com)
- **Issues**: GitHub Issues
- **Email**: support@compliance-shepherd.com
- **Slack**: #ai-compliance-shepherd

---

**AI Compliance Shepherd Web UI** - Professional compliance management interface with AI-powered assistance and comprehensive reporting capabilities.

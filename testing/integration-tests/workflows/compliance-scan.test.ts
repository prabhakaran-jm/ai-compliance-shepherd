/**
 * Integration tests for complete compliance scan workflow
 * 
 * This test suite validates the end-to-end compliance scanning process,
 * from triggering a scan through API Gateway to generating reports and notifications.
 */

import { ScanEnvironmentService } from '../../../services/scan-environment/src/services/ScanEnvironmentService';
import { FindingsStorageService } from '../../../services/findings-storage/src/services/FindingsStorageService';
import { HTMLReportGeneratorService } from '../../../services/html-report-generator/src/services/HTMLReportGeneratorService';
import { dynamoDBClient, s3Client } from '../setup/localstack';
import { PutItemCommand, GetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

describe('Complete Compliance Scan Workflow', () => {
  let scanService: ScanEnvironmentService;
  let findingsService: FindingsStorageService;
  let reportService: HTMLReportGeneratorService;
  let testTenantId: string;
  let testUserId: string;

  beforeEach(async () => {
    // Initialize services
    scanService = new ScanEnvironmentService();
    findingsService = new FindingsStorageService();
    reportService = new HTMLReportGeneratorService();
    
    // Generate test identifiers
    testTenantId = global.integrationTestUtils.generateTenantId();
    testUserId = global.integrationTestUtils.generateUserId();
    
    // Create test tenant in DynamoDB
    await dynamoDBClient.send(new PutItemCommand({
      TableName: 'ai-compliance-tenants-test',
      Item: marshall({
        tenantId: testTenantId,
        name: 'Integration Test Tenant',
        tier: 'STANDARD',
        status: 'ACTIVE',
        settings: {
          scanRegions: ['us-east-1'],
          enabledServices: ['s3', 'iam', 'ec2', 'cloudtrail'],
          notificationsEnabled: true
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    }));
  });

  describe('Full Scan Workflow', () => {
    it('should execute complete scan from trigger to report generation', async () => {
      // Step 1: Trigger compliance scan
      console.log('🚀 Step 1: Triggering compliance scan...');
      
      const scanRequest = {
        tenantId: testTenantId,
        scanType: 'FULL_COMPLIANCE' as const,
        regions: ['us-east-1'],
        services: ['s3', 'iam', 'ec2'],
        configuration: {
          includeCompliant: false,
          excludeRules: []
        }
      };
      
      const scanResult = await scanService.startScan(scanRequest);
      
      expect(scanResult).toBeDefined();
      expect(scanResult.scanId).toMatch(/^scan-/);
      expect(scanResult.status).toBe('IN_PROGRESS');
      expect(scanResult.tenantId).toBe(testTenantId);
      
      const scanId = scanResult.scanId;
      console.log(`✅ Scan started with ID: ${scanId}`);
      
      // Step 2: Verify scan job created in DynamoDB
      console.log('📊 Step 2: Verifying scan job in DynamoDB...');
      
      const scanJobResult = await dynamoDBClient.send(new GetItemCommand({
        TableName: 'ai-compliance-scan-jobs-test',
        Key: marshall({ scanId })
      }));
      
      expect(scanJobResult.Item).toBeDefined();
      const scanJob = unmarshall(scanJobResult.Item!);
      expect(scanJob.scanId).toBe(scanId);
      expect(scanJob.tenantId).toBe(testTenantId);
      expect(scanJob.status).toBe('IN_PROGRESS');
      
      console.log('✅ Scan job verified in DynamoDB');
      
      // Step 3: Process scan (simulate async processing)
      console.log('⚙️ Step 3: Processing scan results...');
      
      // Simulate resource discovery and rule evaluation
      await scanService.processAsyncScan(scanId, testTenantId);
      
      // Wait for processing to complete
      await global.integrationTestUtils.waitFor(async () => {
        const status = await scanService.getScanStatus(scanId, testTenantId);
        return status.status === 'COMPLETED';
      }, 30000);
      
      console.log('✅ Scan processing completed');
      
      // Step 4: Verify findings created
      console.log('🔍 Step 4: Verifying findings created...');
      
      const findingsResult = await findingsService.listFindings(
        testTenantId,
        { scanId: [scanId] },
        { maxResults: 100 }
      );
      
      expect(findingsResult.findings).toBeDefined();
      expect(findingsResult.findings.length).toBeGreaterThan(0);
      expect(findingsResult.totalCount).toBeGreaterThan(0);
      
      // Verify findings are properly structured
      const firstFinding = findingsResult.findings[0];
      expect(firstFinding.findingId).toMatch(/^finding-/);
      expect(firstFinding.tenantId).toBe(testTenantId);
      expect(firstFinding.scanId).toBe(scanId);
      expect(firstFinding.severity).toMatch(/^(CRITICAL|HIGH|MEDIUM|LOW)$/);
      expect(firstFinding.status).toBe('OPEN');
      
      console.log(`✅ Found ${findingsResult.findings.length} findings`);
      
      // Step 5: Generate HTML report
      console.log('📄 Step 5: Generating HTML report...');
      
      const reportRequest = {
        tenantId: testTenantId,
        scanId: scanId,
        reportType: 'COMPLIANCE_SUMMARY' as const,
        format: 'HTML' as const,
        includeCharts: true,
        includeEvidence: true
      };
      
      const reportResult = await reportService.generateReport(reportRequest);
      
      expect(reportResult).toBeDefined();
      expect(reportResult.reportId).toMatch(/^report-/);
      expect(reportResult.status).toBe('COMPLETED');
      expect(reportResult.downloadUrl).toBeDefined();
      
      console.log(`✅ Report generated: ${reportResult.reportId}`);
      
      // Step 6: Verify report stored in S3
      console.log('🪣 Step 6: Verifying report in S3...');
      
      const reportKey = `reports/${testTenantId}/${scanId}/${reportResult.reportId}.html`;
      
      const s3Result = await s3Client.send(new GetObjectCommand({
        Bucket: 'ai-compliance-test-reports',
        Key: reportKey
      }));
      
      expect(s3Result.Body).toBeDefined();
      expect(s3Result.ContentType).toBe('text/html');
      
      // Verify report content
      const reportContent = await s3Result.Body!.transformToString();
      expect(reportContent).toContain('AI Compliance Shepherd');
      expect(reportContent).toContain('Compliance Report');
      expect(reportContent).toContain(scanId);
      expect(reportContent).toContain('Chart.js'); // Verify charts included
      
      console.log('✅ Report verified in S3');
      
      // Step 7: Verify scan statistics
      console.log('📈 Step 7: Verifying scan statistics...');
      
      const finalScanStatus = await scanService.getScanStatus(scanId, testTenantId);
      
      expect(finalScanStatus.status).toBe('COMPLETED');
      expect(finalScanStatus.results).toBeDefined();
      expect(finalScanStatus.results.totalFindings).toBe(findingsResult.totalCount);
      expect(finalScanStatus.results.totalResources).toBeGreaterThan(0);
      
      // Verify finding breakdown
      const { results } = finalScanStatus;
      const totalByseverity = results.criticalFindings + results.highFindings + 
                             results.mediumFindings + results.lowFindings;
      expect(totalByseverity).toBe(results.totalFindings);
      
      console.log('✅ Scan statistics verified');
      
      // Step 8: Verify data consistency across services
      console.log('🔄 Step 8: Verifying data consistency...');
      
      // Check that all findings reference the correct scan
      for (const finding of findingsResult.findings) {
        expect(finding.scanId).toBe(scanId);
        expect(finding.tenantId).toBe(testTenantId);
        
        // Verify finding exists in DynamoDB
        const findingResult = await dynamoDBClient.send(new GetItemCommand({
          TableName: 'ai-compliance-findings-test',
          Key: marshall({ findingId: finding.findingId })
        }));
        
        expect(findingResult.Item).toBeDefined();
        const storedFinding = unmarshall(findingResult.Item!);
        expect(storedFinding.scanId).toBe(scanId);
        expect(storedFinding.tenantId).toBe(testTenantId);
      }
      
      console.log('✅ Data consistency verified');
      
      console.log('🎉 Complete compliance scan workflow test passed!');
    }, 120000); // 2 minute timeout for full workflow
    
    it('should handle scan failures gracefully', async () => {
      console.log('🚀 Testing scan failure handling...');
      
      const scanRequest = {
        tenantId: testTenantId,
        scanType: 'FULL_COMPLIANCE' as const,
        regions: ['invalid-region'], // Invalid region to trigger failure
        services: ['s3']
      };
      
      // This should either reject or create a scan that fails
      try {
        const scanResult = await scanService.startScan(scanRequest);
        
        // If scan starts, wait for it to fail
        await global.integrationTestUtils.waitFor(async () => {
          const status = await scanService.getScanStatus(scanResult.scanId, testTenantId);
          return status.status === 'FAILED';
        }, 30000);
        
        const finalStatus = await scanService.getScanStatus(scanResult.scanId, testTenantId);
        expect(finalStatus.status).toBe('FAILED');
        expect(finalStatus.error).toBeDefined();
        
      } catch (error) {
        // Scan should fail with validation error
        expect(error).toBeDefined();
        expect(error.message).toContain('region');
      }
      
      console.log('✅ Scan failure handling verified');
    });
    
    it('should support scan cancellation', async () => {
      console.log('🚀 Testing scan cancellation...');
      
      const scanRequest = {
        tenantId: testTenantId,
        scanType: 'FULL_COMPLIANCE' as const,
        regions: ['us-east-1'],
        services: ['s3', 'iam', 'ec2']
      };
      
      const scanResult = await scanService.startScan(scanRequest);
      expect(scanResult.status).toBe('IN_PROGRESS');
      
      // Cancel the scan
      const cancelResult = await scanService.cancelScan(scanResult.scanId, testTenantId);
      expect(cancelResult.status).toBe('CANCELLED');
      
      // Verify scan is cancelled in database
      const finalStatus = await scanService.getScanStatus(scanResult.scanId, testTenantId);
      expect(finalStatus.status).toBe('CANCELLED');
      
      console.log('✅ Scan cancellation verified');
    });
  });
  
  describe('Multi-Tenant Isolation', () => {
    it('should isolate scan data between tenants', async () => {
      console.log('🚀 Testing multi-tenant isolation...');
      
      // Create second tenant
      const tenant2Id = global.integrationTestUtils.generateTenantId();
      
      await dynamoDBClient.send(new PutItemCommand({
        TableName: 'ai-compliance-tenants-test',
        Item: marshall({
          tenantId: tenant2Id,
          name: 'Integration Test Tenant 2',
          tier: 'BASIC',
          status: 'ACTIVE',
          createdAt: new Date().toISOString()
        })
      }));
      
      // Start scans for both tenants
      const scan1 = await scanService.startScan({
        tenantId: testTenantId,
        scanType: 'FULL_COMPLIANCE',
        regions: ['us-east-1'],
        services: ['s3']
      });
      
      const scan2 = await scanService.startScan({
        tenantId: tenant2Id,
        scanType: 'FULL_COMPLIANCE',
        regions: ['us-east-1'],
        services: ['s3']
      });
      
      // Process both scans
      await scanService.processAsyncScan(scan1.scanId, testTenantId);
      await scanService.processAsyncScan(scan2.scanId, tenant2Id);
      
      // Wait for completion
      await global.integrationTestUtils.waitFor(async () => {
        const status1 = await scanService.getScanStatus(scan1.scanId, testTenantId);
        const status2 = await scanService.getScanStatus(scan2.scanId, tenant2Id);
        return status1.status === 'COMPLETED' && status2.status === 'COMPLETED';
      }, 60000);
      
      // Verify tenant 1 cannot access tenant 2's scan
      try {
        await scanService.getScanStatus(scan2.scanId, testTenantId);
        fail('Should not be able to access other tenant\'s scan');
      } catch (error) {
        expect(error.message).toContain('not found');
      }
      
      // Verify tenant 2 cannot access tenant 1's scan
      try {
        await scanService.getScanStatus(scan1.scanId, tenant2Id);
        fail('Should not be able to access other tenant\'s scan');
      } catch (error) {
        expect(error.message).toContain('not found');
      }
      
      // Verify findings isolation
      const findings1 = await findingsService.listFindings(testTenantId, {}, { maxResults: 100 });
      const findings2 = await findingsService.listFindings(tenant2Id, {}, { maxResults: 100 });
      
      // Each tenant should only see their own findings
      for (const finding of findings1.findings) {
        expect(finding.tenantId).toBe(testTenantId);
      }
      
      for (const finding of findings2.findings) {
        expect(finding.tenantId).toBe(tenant2Id);
      }
      
      console.log('✅ Multi-tenant isolation verified');
    });
  });
  
  describe('Performance and Scalability', () => {
    it('should handle concurrent scans efficiently', async () => {
      console.log('🚀 Testing concurrent scan handling...');
      
      const concurrentScans = 3;
      const scanPromises: Promise<any>[] = [];
      
      // Start multiple concurrent scans
      for (let i = 0; i < concurrentScans; i++) {
        const scanPromise = scanService.startScan({
          tenantId: testTenantId,
          scanType: 'FULL_COMPLIANCE',
          regions: ['us-east-1'],
          services: ['s3']
        });
        scanPromises.push(scanPromise);
      }
      
      // Wait for all scans to start
      const scanResults = await Promise.all(scanPromises);
      
      // Verify all scans started successfully
      expect(scanResults).toHaveLength(concurrentScans);
      for (const result of scanResults) {
        expect(result.scanId).toMatch(/^scan-/);
        expect(result.status).toBe('IN_PROGRESS');
      }
      
      // Process all scans concurrently
      const processPromises = scanResults.map(result =>
        scanService.processAsyncScan(result.scanId, testTenantId)
      );
      
      await Promise.all(processPromises);
      
      // Wait for all scans to complete
      await global.integrationTestUtils.waitFor(async () => {
        const statusPromises = scanResults.map(result =>
          scanService.getScanStatus(result.scanId, testTenantId)
        );
        const statuses = await Promise.all(statusPromises);
        return statuses.every(status => status.status === 'COMPLETED');
      }, 90000);
      
      console.log('✅ Concurrent scan handling verified');
    });
  });
});

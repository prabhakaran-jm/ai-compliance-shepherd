#!/usr/bin/env node

/**
 * Performance Benchmarks Script for AI Compliance Shepherd
 * 
 * This script creates comprehensive performance benchmarks and
 * metrics for validating system performance characteristics.
 */

const fs = require('fs');
const path = require('path');

// Performance benchmark configurations
const performanceBenchmarks = {
  
  // API Performance Benchmarks
  apiPerformance: [
    {
      id: 'api-gateway-response-times',
      category: 'api',
      name: 'API Gateway Response Times',
      description: 'Validate API Gateway response times across all endpoints',
      endpoints: [
        {
          method: 'GET',
          path: '/health',
          expectedLatency: '<100ms',
          targetRPS: 1000
        },
        {
          method: 'POST',
          path: '/scans',
          expectedLatency: '<500ms',
          targetRPS: 100,
          payload: 'scan-request-payload'
        },
        {
          method: 'GET',
          path: '/scans/{scanId}',
          expectedLatency: '<200ms',
          targetRPS: 500
        },
        {
          method: 'GET',
          path: '/findings',
          expectedLatency: '<300ms',
          targetRPS: 200,
          query: 'pagination-enabled'
        },
        {
          method: 'GET',
          path: '/findings/{findingId}',
          expectedLatency: '<150ms',
          targetRPS: 300
        },
        {
          method: 'POST',
          path: '/reports/generate',
          expectedLatency: '<2000ms',
          targetRPS: 50
        },
        {
          method: 'GET',
          path: '/chat/sessions',
          expectedLatency: '<150ms',
          targetRPS: 200
        },
        {
          method: 'POST',
          path: '/chat/messages',
          expectedLatency: '<300ms',
          targetRPS: 100
        }
      ],
      metrics: {
        p95Latency: '<2s',
        p99Latency: '<5s',
        errorRate: '<1%',
        throughput: '500+ RPS'
      }
    },
    
    {
      id: 'lambda-function-performance',
      category: 'lambda',
      name: 'Lambda Function Performance',
      description: 'Validate Lambda function execution performance',
      functions: [
        {
          function: 'scan-environment',
          expectedDuration: '<300s',
          memoryAllocated: '2048MB',
          concurrency: 50,
          metrics: {
            coldStart: '<2s',
            warmDuration: '<5s',
            timeout: '15min',
            memoryUtilization: '<80%'
          }
        },
        {
          function: 'findings-storage',
          expectedDuration: '<10s',
          memoryAllocated: '1024MB',
          concurrency: 100,
          metrics: {
            coldStart: '<1s',
            warmDuration: '<2s',
            timeout: '30s',
            memoryUtilization: '<70%'
          }
        },
        {
          function: 'html-report-generator',
          expectedDuration: '<60s',
          memoryAllocated: '512MB',
          concurrency: 20,
          metrics: {
            coldStart: '<1s',
            warmDuration: '<5s',
            timeout: '5min',
            memoryUtilization: '<80%'
          }
        },
        {
          function: 'bedrock-agent',
          expectedDuration: '<30s',
          memoryAllocated: '1024MB',
          concurrency: 30,
          metrics: {
            coldStart: '<2s',
            warmDuration: '<10s',
            timeout: '5min',
            memoryUtilization: '<75%'
          }
        },
        {
          function: 'slack-notifications',
          expectedDuration: '<15s',
          memoryAllocated: '256MB',
          concurrency: 50,
          metrics: {
            coldStart: '<1s',
            warmDuration: '<3s',
            timeout: '30s',
            memoryUtilization: '<60%'
          }
        }
      ]
    }
  ],
  
  // Database Performance Benchmarks
  databasePerformance: [
    {
      id: 'dynamodb-read-performance',
      category: 'database',
      name: 'DynamoDB Read Performance',
      description: 'Validate DynamoDB table read performance',
      tests: [
        {
          table: 'tenants',
          operation: 'get-item',
          itemSize: '1KB',
          expectedLatency: '<10ms',
          targetThroughput: '4000 RCU'
        },
        {
          table: 'findings',
          operation: 'query',
          indexName: 'TenantIndex',
          itemSize: '2KB',
          expectedLatency: '<20ms',
          targetThroughput: '2000 RCU'
        },
        {
          table: 'findings',
          operation: 'scan',
          itemSize: '2KB',
          expectedLatency: '<100ms',
          targetThroughput: '1000 RCU',
          pagination: 'enabled'
        },
        {
          table: 'scan-jobs',
          operation: 'query',
          indexName: 'StatusIndex',
          itemSize: '1KB',
          expectedLatency: '<15ms',
          targetThroughput: '1500 RCU'
        },
        {
          table: 'audit-logs',
          operation: 'query',
          indexName: 'TenantTimeIndex',
          itemSize: '512B',
          expectedLatency: '<10ms',
          targetThroughput: '3000 RCU'
        }
      ],
      metrics: {
        averageLatency: '<50ms',
        p99Latency: '<200ms',
        throttles: '<1%',
        consumedReads: 'optimal'
      }
    },
    
    {
      id: 'dynamodb-write-performance',
      category: 'database',
      name: 'DynamoDB Write Performance',
      description: 'Validate DynamoDB table write performance',
      tests: [
        {
          table: 'findings',
          operation: 'put-item',
          itemSize: '2KB',
          expectedLatency: '<15ms',
          targetThroughput: '2000 WCU'
        },
        {
          table: 'scan-jobs',
          operation: 'update-item',
          itemSize: '1KB',
          expectedLatency: '<10ms',
          targetThroughput: '1000 WCU'
        },
        {
          table: 'audit-logs',
          operation: 'put-item',
          itemSize: '512B',
          expectedLatency: '<5ms',
          targetThroughput: '4000 WCU'
        },
        {
          table: 'chat-sessions',
          operation: 'put-item',
          itemSize: '1KB',
          expectedLatency: '<8ms',
          targetThroughput: '2000 WCU'
        }
      ],
      metrics: {
        averageLatency: '<30ms',
        p99Latency: '<100ms',
        throttles: '<1%',
        consumedWrites: 'optimal'
      }
    }
  ],
  
  // Storage Performance Benchmarks
  storagePerformance: [
    {
      id: 's3-object-operations',
      category: 'storage',
      name: 'S3 Object Operations Performance',
      description: 'Validate S3 bucket operation performance',
      operations: [
        {
          operation: 'put-object',
          objectSize: '1MB',
          bucket: 'reports',
          expectedLatency: '<500ms',
          targetThroughput: '100 ops/min'
        },
        {
          operation: 'get-object',
          objectSize: '5MB',
          bucket: 'reports',
          expectedLatency: '<1000ms',
          targetThroughput: '200 ops/min'
        },
        {
          operation: 'put-object',
          objectSize: '100MB',
          bucket: 'artifacts',
          expectedLatency: '<3000ms',
          targetThroughput: '50 ops/min'
        },
        {
          operation: 'delete-object',
          bucket: 'reports',
          expectedLatency: '<100ms',
          targetThroughput: '500 ops/min'
        }
      ],
      metrics: {
        averageLatency: '<1500ms',
        p99Latency: '<5000ms',
        errorRate: '<0.1%',
        throughput: '200+ ops/min'
      }
    }
  ],
  
  // Scan Performance Benchmarks
  scanPerformance: [
    {
      id: 'aws-resource-discovery-performance',
      category: 'scanning',
      name: 'AWS Resource Discovery Performance',
      description: 'Validate AWS resource discovery scan performance',
      services: [
        {
          service: 's3',
          regionCount: 5,
          expectedDuration: '<60s',
          resourcesPerRegion: '100-500',
          total: '500-2500 buckets'
        },
        {
          service: 'iam',
          regionCount: 2,
          expectedDuration: '<30s',
          resourcesPerRegion: '50-200',
          total: '100-400 resources'
        },
        {
          service: 'ec2',
          regionCount: 5,
          expectedDuration: '<45s',
          resourcesPerRegion: '50-300',
          total: '250-1500 instances'
        },
        {
          service: 'cloudtrail',
          regionCount: 2,
          expectedDuration: '<20s',
          resourcesPerRegion: '10-50',
          total: '20-100 trails'
        },
        {
          service: 'rds',
          regionCount: 3,
          expectedDuration: '<25s',
          resourcesPerRegion: '20-100',
          total: '60-300 instances'
        }
      ],
      totalScanMetrics: {
        completeScanDuration: '<10min',
        resourcesPerSecond: '10-30',
        parallelServiceScanning: true,
        regionConcurrency: 5,
        serviceConcurrency: 3
      }
    },
    
    {
      id: 'compliance-rule-evaluation-performance',
      category: 'scanning',
      name: 'Compliance Rule Evaluation Performance',
      description: 'Validate compliance rule execution performance',
      rules: [
        {
          rule: 'S3_BUCKET_PUBLIC_READ_PROHIBITED',
          expectedEvaluationTime: '<50ms',
          targetResourcesPerSecond: 100,
          resourceComplexity: 'low'
        },
        {
          rule: 'IAM_USER_MFA_ENABLED',
          expectedEvaluationTime: '<30ms',
          targetResourcesPerSecond: 200,
          resourceComplexity: 'low'
        },
        {
          rule: 'EC2_SECURITY_GROUP_RULES',
          expectedEvaluationTime: '<100ms',
          targetResourcesPerSecond: 50,
          resourceComplexity: 'medium'
        },
        {
          rule: 'CLOUDTRAIL_ENCRYPTION_REGION_VALIDATION',
          expectedEvaluationTime: '<75ms',
          targetResourcesPerSecond: 80,
          resourceComplexity: 'medium'
        }
      ],
      ruleMetrics: {
        totalEvaluationTime: '<2000ms',
        rulesParallelized: 'true',
        cacheHitRate: '>80%',
        evaluationThroughput: '500+ resources/min'
      }
    }
  ],
  
  // Concurrent Load Benchmarks
  concurrentLoad: [
    {
      id: 'multi-tenant-concurrent-operations',
      category: 'concurrency',
      name: 'Multi-Tenant Concurrent Operations',
      description: 'Validate system performance under concurrent multi-tenant load',
      loadProfile: {
        tenants: 50,
        scansPerTenant: 5,
        totalConcurrentScans: 250,
        averageScanDuration: '5min',
        peakConcurrency: 300
      },
      metrics: {
        scanCompletionRate: '>95%',
        averageScanTime: '<300s',
        resourceContention: 'minimal',
        tenantIsolation: '100%',
        degradedPerformanceAtPeak: '<20%'
      }
    },
    
    {
      id: 'api-concurrent-requests',
      category: 'concurrency',
      name: 'API Concurrent Request Handling',
      description: 'Validate API Gateway performance under concurrent load',
      loadProfile: {
        concurrentUsers: 1000,
        requestsPerSecond: 500,
        burstCapacity: 1000,
        sustainedLoad: '30min'
      },
      endpointDistribution: {
        'GET /health': '30%',
        'GET /findings': '25%',
        'GET /scans/{id}': '20%',
        'POST /chat/messages': '15%',
        'POST /reports/generate': '10%'
      },
      metrics: {
        responseTime95th: '<2000ms',
        responseTime99th: '<5000ms',
        errorRate: '<1%',
        throughput: '500+ RPS',
        connectionHandling: 'optimal'
      }
    },
    
    {
      id: 'database-concurrent-access',
      category: 'concurrency',
      name: 'Database Concurrent Access Patterns',
      description: 'Validate DynamoDB performance under concurrent access',
      accessPatterns: [
        {
          pattern: 'high-read-concurrency',
          operations: 'queries',
          concurrency: 200,
          table: 'findings',
          expectedLatency: '<25ms'
        },
        {
          pattern: 'write-heavy-scenarios',
          operations: 'puts',
          concurrency: 100,
          table: 'audit-logs',
          expectedLatency: '<15ms'
        },
        {
          pattern: 'mixed-workload',
          operations: 'queries+puts',
          concurrency: 150,
          tables: 'all',
          expectedLatency: '<50ms'
        }
      ],
      metrics: {
        throttlingEvents: '<5%',
        partitionHotSpots: 'none',
        consumedCapacity: 'optimal',
        eventualConsistency: 'acceptable'
      }
    }
  ],
  
  // Memory and Resource Benchmarks
  resourceUtilization: [
    {
      id: 'lambda-memory-utilization',
      category: 'resources',
      name: 'Lambda Memory Utilization Patterns',
      description: 'Validate Lambda function memory usage patterns',
      functions: [
        {
          function: 'scan-environment',
          memoryAllocated: '2048MB',
          peakUsage: '<1600MB',
          averageUsage: '800MB',
          garbageCollectionFrequency: 'normal'
        },
        {
          function: 'html-report-generator',
          memoryAllocated: '512MB',
          peakUsage: '<400MB',
          averageUsage: '200MB',
          garbageCollectionFrequency: 'normal'
        },
        {
          function: 'bedrock-agent',
          memoryAllocated: '1024MB',
          peakUsage: '<750MB',
          averageUsage: '400MB',
          garbageCollectionFrequency: 'low'
        }
      ],
      metrics: {
        memoryLeaks: 'zero',
        gcPressure: 'normal',
        coldStartOptimized: true,
        memoryEfficiency: '>75%'
      }
    },
    
    {
      id: 'dynamodb-capacity-optimization',
      category: 'resources',
      name: 'DynamoDB Capacity Optimization',
      description: 'Validate DynamoDB capacity utilization efficiency',
      tables: [
        {
          table: 'tenants',
          readCapacityUnits: 4000,
          writeCapacityUnits: 2000,
          readUtilization: '60-80%',
          writeUtilization: '40-60%',
          autoScaling: 'enabled'
        },
        {
          table: 'findings',
          readCapacityUnits: 8000,
          writeCapacityUnits: 6000,
          readUtilization: '70-85%',
          writeUtilization: '60-75%',
          autoScaling: 'enabled'
        },
        {
          table: 'scan-jobs',
          readCapacityUnits: 2000,
          writeCapacityUnits: 1000,
          readUtilization: '50-70%',
          writeUtilization: '30-50%',
          autoScaling: 'enabled'
        }
      ],
      metrics: {
        throttlingEvents: '<2%',
        burstCapacityUsage: '<80%',
        costEfficiency: 'optimal',
        predictableScaling: 'true'
      }
    }
  ],
  
  // AI/ML Performance Benchmarks
  aiPerformance: [
    {
      id: 'bedrock-agent-response-times',
      category: 'ai',
      name: 'Bedrock Agent Response Times',
      description: 'Validate AI agent response performance',
      testCases: [
        {
          query: 'Simple compliance question',
          expectedResponseTime: '<30s',
          tokenCount: 100,
          responseQuality: 'high'
        },
        {
          query: 'Complex multi-step analysis',
          expectedResponseTime: '<45s',
          tokenCount: 500,
          responseQuality: 'high'
        },
        {
          query: 'Knowledge base lookup',
          expectedResponseTime: '<15s',
          tokenCount: 200,
          responseQuality: 'medium'
          }
      ],
      metrics: {
        averageResponseTime: '<30s',
        p95ResponseTime: '<45s',
        responseQuality: '>85%',
        tokenEfficiency: 'optimal'
      }
    },
    
    {
      id: 'bedrock-knowledge-base-performance',
      category: 'ai',
      name: 'Knowledge Base Retrieval Performance',
      description: 'Validate knowledge base query performance',
      queries: [
        {
          query: 'SOC 2 compliance requirements',
          expectedLatency: '<5s',
          resultRelevance: '>90%',
          sourceConfidence: 'high'
        },
        {
          query: 'S3 bucket security best practices',
          expectedLatency: '<3s',
          resultRelevance: '>85%',
          sourceConfidence: 'high'
        },
        {
          query: 'HIPAA database encryption',
          expectedLatency: '<4s',
          resultRelevance: '>88%',
          sourceConfidence: 'high'
        }
      ],
      metrics: {
        averageQueryLatency: '<4s',
        resultAccuracy: '>90%',
        sourceCoverage: 'comprehensive',
        retrievalEfficiency: 'optimal'
      }
    }
  ]
};

// Generate comprehensive performance benchmarks documentation
function generatePerformanceReport() {
  console.log('🏃 AI Compliance Shepherd Performance Benchmarks Report\n');
  console.log('=' .repeat(60));
  
  // Calculate total benchmarks
  const totalBenchmarks = Object.values(performanceBenchmarks)
    .reduce((sum, category) => sum + category.length, 0);
  
  console.log(`📊 Performance Benchmark Statistics:`);
  console.log(`   Total Benchmark Categories: ${Object.keys(performanceBenchmarks).length}`);
  console.log(`   Total Individual Benchmarks: ${totalBenchmarks}`);
  
  console.log('\n🎯 Benchmark Categories:');
  Object.keys(performanceBenchmarks).forEach(category => {
    const count = performanceBenchmarks[category].length;
    console.log(`   ${category}: ${count} benchmarks`);
  });
  
  console.log('\n📈 Performance Targets Summary:');
  console.log('   API Response Times: <5s (95th percentile)');
  console.log('   Lambda Cold Start: <2s');
  console.log('   DynamoDB Query: <50ms');
  console.log('   S3 Object Operations: <1500ms');
  console.log('   Complete Scan: <10min');
  console.log('   AI Response Time: <30s');
  console.log('   Concurrent Users: 1000');
  console.log('   Throughput: 500+ RPS');
  
  console.log('\n📁 Performance Files:');
  console.log('   📊 benchmarks/api-performance.json         - API performance benchmarks');
  console.log('   💾 benchmarks/database-performance.json   - Database benchmarks');
  console.log('   🔍 benchmarks/scan-performance.json       - Scanning benchmarks');
  console.log('   ⚡ benchmarks/concurrent-load.json        - Concurrent load tests');
  console.log('   🤖 benchmarks/ai-performance.json        - AI/ML performance');
  console.log('   📈 benchmarks/PERFORMANCE_GUIDE.md        - Complete documentation');
}

// Write performance benchmarks to files
function writePerformanceFiles() {
  const benchmarksDir = path.join(__dirname, 'benchmarks');
  if (!fs.existsSync(benchmarksDir)) {
    fs.mkdirSync(benchmarksDir, { recursive: true });
  }
  
  // Write individual benchmark category files
  Object.keys(performanceBenchmarks).forEach(category => {
    const filename = `${category}.json`;
    const filepath = path.join(benchmarksDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(performanceBenchmarks[category], null, 2));
  });
  
  // Write comprehensive performance documentation
  const documentation = `
# AI Compliance Shepherd - Performance Benchmarks Guide

## 🏃 Performance Overview

This document defines comprehensive performance benchmarks and metrics for the AI Compliance Shepherd platform, ensuring optimal system performance across all components and use cases.

## 📊 Benchmark Summary

### Performance Targets

| Component | Target | Measurement | Notes |
|-----------|--------|-------------|-------|
| API Gateway | <5s | 95th percentile response time | Includes all endpoints |
| Lambda Functions | <2s | Cold start time | Optimized for performance |
| DynamoDB Queries | <50ms | Average query latency | With optimal capacity |
| S3 Operations | <1500ms | Average operation time | For standard objects |
| Complete Scans | <10min | End-to-end scan duration | All services, all regions |
| AI Responses | <30s | Bedrock agent response time | Complex queries |
| Concurrent Load | 1000 users | Peak simultaneous users | Without degradation |

### Scalability Targets

| Metric | Target | Validation Method |
|--------|---------|-------------------|
| Throughput | 500+ RPS | Sustained load testing |
| Concurrent Scans | 250 scans | Multi-tenant simultaneous |
| Database RCU | 10,000+ | Read capacity optimization |
| Database WCU | 5,000+ | Write capacity optimization |
| Lambda Concurrency | 100+ | Per function limit |
| Memory Efficiency | >75% | Utilization monitoring |

## 🎯 Benchmark Categories

### 1. API Performance
**Components**: API Gateway, Lambda functions, integration points
**Focus**: Response times, throughput, error rates
**Critical Metrics**:
- Response time percentiles (50th, 95th, 99th)
- Requests per second capacity
- Error rates under load
- Cold start optimization

### 2. Database Performance
**Components**: DynamoDB tables, indexes, queries
**Focus**: Query latency, throughput, capacity utilization
**Critical Metrics**:
- Read/Write capacity utilization
- Query performance optimization
- Index efficiency
- Throttling prevention

### 3. Scanning Performance
**Components**: AWS resource discovery, rule evaluation
**Focus**: Scan duration, resource discovery speed
**Critical Metrics**:
- Resources discovered per second
- Rule evaluation performance
- Multi-region scanning efficiency
- Concurrent service discovery

### 4. Concurrent Load Performance
**Components**: Multi-tenant operations, simultaneous users
**Focus**: Resource contention, isolation, degradation
**Critical Metrics**:
- Tenant isolation validation
- Resource sharing efficiency
- Performance degradation thresholds
- Peak capacity management

### 5. AI/ML Performance
**Components**: Bedrock Agent, Knowledge Base
**Focus**: Response times, token efficiency, accuracy
**Critical Metrics**:
- Query response latency
- Token consumption optimization
- Response accuracy rates
- Knowledge retrieval efficiency

## 🔧 Performance Monitoring

### Real-Time Metrics
- **CloudWatch Metrics**: Response times, throughput, error rates
- **X-Ray Tracing**: Request flow analysis and bottleneck identification
- **Custom Business Metrics**: Scan completion rates, user satisfaction
- **Resource Utilization**: CPU, memory, network, storage usage

### Performance Alerts
- **Threshold Monitoring**: Automatic alerts for SLA violations
- **Trend Analysis**: Proactive performance degradation detection
- **Capacity Planning**: Predictive scaling recommendations
- **Cost Optimization**: Resource utilization vs. cost analysis

## 📈 Benchmarking Methodology

### Test Environments
1. **Development Environment**: Feature validation and basic performance
2. **Staging Environment**: Production-equivalent load testing
3. **Production Environment**: Continuous performance monitoring
4. **Load Testing Environment**: Dedicated stress testing

### Test Data
- **Realistic Datasets**: Production-sized data volumes
- **Concurrent Users**: Actual usage pattern simulation
- **Resource Variations**: Various AWS resource configurations
- **Failure Scenarios**: Performance under degraded conditions

### Tools and Techniques
- **Load Testing**: Artillery, k6, JMeter for API load testing
- **Monitoring**: CloudWatch, DataDog, New Relic for metrics
- **Profiling**: X-Ray, Application Insights for debugging
- **Capacity Planning**: AWS Cost Explorer, Resource Tagging

## ✅ Performance Validation Checklist

### Pre-Deployment Validation
- [ ] All API endpoints meet response time targets
- [ ] Lambda functions optimized for cold start performance
- [ ] Database capacity planning completed
- [ ] Concurrent load testing validates multi-tenant isolation
- [ ] AI/ML response times meet user experience requirements
- [ ] Resource utilization within optimal ranges
- [ ] Performance regression testing completed

### Post-Deployment Monitoring
- [ ] Continuous performance monitoring enabled
- [ ] Performance alerts configured
- [ ] Trend analysis automated
- [ ] Capacity planning processes established
- [ ] Performance metrics dashboard available
- [ ] Regular performance reviews scheduled

## 📋 Benchmark Files

- \`api-performance.json\` - API Gateway and Lambda performance
- \`database-performance.json\` - DynamoDB query and operation performance
- \`scan-performance.json\` - AWS resource discovery and scanning
- \`concurrent-load.json\` - Multi-user and multi-tenant performance
- \`ai-performance.json\` - Bedrock Agent and Knowledge Base performance
- \`PERFORMANCE_GUIDE.md\` - This comprehensive guide

## 🎯 Continuous Performance Improvement

### Performance Optimization Cycle
1. **Measure**: Comprehensive performance monitoring
2. **Analyze**: Identify bottlenecks and optimization opportunities
3. **Optimize**: Implement performance improvements
4. **Validate**: Re-benchmark to confirm improvements
5. **Monitor**: Continue monitoring for regression

### Performance Goals Evolution
- **Initial Release**: Meeting baseline performance requirements
- **Growth Phase**: Maintaining performance under increased load
- **Scale Phase**: Optimizing for enterprise-level scaling
- **Optimization Phase**: Continuous improvement and cost optimization

---

**Performance Benchmark Standards**: Industry-leading performance targets
**Validation Methodology**: Comprehensive testing and monitoring framework
**Continuous Improvement**: Regular benchmarking and optimization cycles
**Goal**: Maintain optimal performance while scaling to meet enterprise demands

*Generated: ${new Date().toISOString()}*
*Platform Version: 1.0.0*
*Performance Focus: Enterprise-grade scalability and responsiveness*
`;

  const docPath = path.join(benchmarksDir, 'PERFORMANCE_GUIDE.md');
  fs.writeFileSync(docPath, documentation);
  
  console.log('✅ Performance benchmarks written to files');
}

// Main execution
if (require.main === module) {
  console.log('🏃 Generating AI Compliance Shepherd Performance Benchmarks...\n');
  
  try {
    writePerformanceFiles();
    generatePerformanceReport();
    
    console.log('\n✅ Performance benchmarks generation complete!');
    console.log('\n📁 Generated Files:');
    console.log('   📊 benchmarks/api-performance.json         - API performance tests');
    console.log('   💾 benchmarks/database-performance.json   - Database benchmarks');
    console.log('   🔍 benchmarks/scan-performance.json       - Scanning performance');
    console.log('   ⚡ benchmarks/concurrent-load.json        - Concurrent load tests');
    console.log('   🤖 benchmarks/ai-performance.json        - AI/ML performance');
    console.log('   📈 benchmarks/PERFORMANCE_GUIDE.md        - Documentation');
    
    console.log('\n🎯 Key Performance Targets:');
    console.log('   ⚡ API Response: <5s (95th percentile)');
    console.log('   ⚡ Scan Duration: <10min (full AWS environment)');
    console.log('   ⚡ AI Response: <30s (complex queries)');
    console.log('   ⚡ Concurrent Users: 1000+ (without degradation)');
    console.log('   ⚡ Database Queries: <50ms (average latency)');
    
  } catch (error) {
    console.error('❌ Failed to generate performance benchmarks:', error.message);
    process.exit(1);
  }
}

module.exports = { performanceBenchmarks, generatePerformanceReport, writePerformanceFiles };

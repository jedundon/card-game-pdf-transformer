/**
 * @fileoverview Performance monitoring panel component
 * 
 * This component provides a comprehensive dashboard for monitoring
 * application performance including memory usage, cache statistics,
 * and operation progress. Useful for debugging and optimization.
 * 
 * **Key Features:**
 * - Real-time performance metrics
 * - Memory usage visualization
 * - Cache statistics and management
 * - Operation progress tracking
 * - Performance recommendations
 * 
 * @author Card Game PDF Transformer
 */

import { useState, useEffect } from 'react';
import { 
  Activity, 
  BarChart3, 
  Cpu, 
  HardDrive, 
  RefreshCw, 
  Trash2, 
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { usePerformanceMonitoring } from '../../utils/performanceUtils';
import { useProgressManager } from '../../utils/progressManager';
import { getThumbnailCacheStats, clearThumbnailCache } from '../../utils/card/cardRendering';
import { globalPerformanceMonitor } from '../../utils/performanceUtils';
void globalPerformanceMonitor; // Mark as intentionally unused for now

interface PerformanceMonitoringPanelProps {
  /** Whether the panel is visible */
  isOpen: boolean;
  /** Callback to close the panel */
  onClose: () => void;
  /** Custom class name */
  className?: string;
}

/**
 * Performance monitoring panel component
 * 
 * Provides a comprehensive view of application performance metrics
 * and controls for optimization.
 */
export function PerformanceMonitoringPanel({
  isOpen,
  onClose,
  className = ''
}: PerformanceMonitoringPanelProps) {
  const { metrics, getMemoryUsage, getPerformanceSummary, forceGarbageCollection } = usePerformanceMonitoring();
  void metrics; // Mark as intentionally unused for now
  const { operations } = useProgressManager();
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Update cache stats periodically
  useEffect(() => {
    const updateCacheStats = () => {
      try {
        const stats = getThumbnailCacheStats();
        setCacheStats(stats);
      } catch (error) {
        console.warn('Failed to get cache stats:', error);
      }
    };

    updateCacheStats();
    const interval = setInterval(updateCacheStats, 2000);

    return () => clearInterval(interval);
  }, [refreshKey]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleClearCache = () => {
    clearThumbnailCache();
    handleRefresh();
  };

  const handleForceGC = () => {
    const success = forceGarbageCollection();
    if (success) {
      setTimeout(handleRefresh, 100);
    }
  };

  if (!isOpen) {
    return null;
  }

  const memoryUsage = getMemoryUsage?.();
  const performanceSummary = getPerformanceSummary?.();
  const runningOperations = operations.filter(op => op.status === 'running');

  const getMemoryStatusIcon = (status?: string) => {
    switch (status) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'high':
        return <TrendingUp className="w-4 h-4 text-orange-500" />;
      case 'medium':
        return <Minus className="w-4 h-4 text-yellow-500" />;
      default:
        return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
  };

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'decreasing':
        return <TrendingDown className="w-4 h-4 text-green-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center ${className}`}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Performance Monitor</h2>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              className="p-2 text-gray-500 hover:text-gray-700 rounded"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 rounded"
              title="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-6">
          {/* Memory Usage */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Cpu className="w-5 h-5 text-blue-500" />
                <h3 className="font-medium">Memory Usage</h3>
                {memoryUsage && getMemoryStatusIcon(memoryUsage.status)}
              </div>
              
              <button
                onClick={handleForceGC}
                className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                title="Force Garbage Collection"
              >
                Force GC
              </button>
            </div>
            
            {memoryUsage ? (
              <div className="space-y-3">
                {/* Progress bar */}
                <div className="relative">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${
                        memoryUsage.status === 'critical' ? 'bg-red-500' :
                        memoryUsage.status === 'high' ? 'bg-orange-500' :
                        memoryUsage.status === 'medium' ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${memoryUsage.usagePercentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-600 mt-1 flex justify-between">
                    <span>{memoryUsage.usedFormatted}</span>
                    <span>{memoryUsage.usagePercentage.toFixed(1)}%</span>
                    <span>{memoryUsage.totalFormatted}</span>
                  </div>
                </div>

                {/* Performance summary */}
                {performanceSummary && (
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600">Average Usage</div>
                      <div className="font-medium">{performanceSummary.avgMemoryUsage.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Peak Usage</div>
                      <div className="font-medium">{performanceSummary.peakMemoryUsage.toFixed(1)}%</div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="text-gray-600">Trend</div>
                      {getTrendIcon(performanceSummary.memoryTrend)}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {performanceSummary?.recommendations && performanceSummary.recommendations.length > 0 && (
                  <div className="mt-3">
                    <div className="text-sm text-gray-600 mb-1">Recommendations:</div>
                    <ul className="text-xs space-y-1">
                      {performanceSummary.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start space-x-1">
                          <AlertTriangle className="w-3 h-3 text-orange-500 mt-0.5 flex-shrink-0" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-500 text-sm">Memory information not available</div>
            )}
          </div>

          {/* Cache Statistics */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-5 h-5 text-green-500" />
                <h3 className="font-medium">Cache Performance</h3>
              </div>
              
              <button
                onClick={handleClearCache}
                className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                title="Clear All Caches"
              >
                <Trash2 className="w-3 h-3 mr-1 inline" />
                Clear
              </button>
            </div>
            
            {cacheStats ? (
              <div className="space-y-3">
                {/* Cache metrics */}
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600">Entries</div>
                    <div className="font-medium">{cacheStats.entryCount}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Hit Rate</div>
                    <div className="font-medium">{cacheStats.hitRate.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Memory</div>
                    <div className="font-medium text-xs">{cacheStats.memoryUsage}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Efficiency</div>
                    <div className={`font-medium text-xs ${
                      cacheStats.performanceInfo?.cacheEffectiveness === 'excellent' ? 'text-green-600' :
                      cacheStats.performanceInfo?.cacheEffectiveness === 'good' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {cacheStats.performanceInfo?.cacheEffectiveness || 'Unknown'}
                    </div>
                  </div>
                </div>

                {/* Hit rate visualization */}
                <div className="relative">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        cacheStats.hitRate >= 70 ? 'bg-green-500' :
                        cacheStats.hitRate >= 50 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${cacheStats.hitRate}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-600 mt-1 text-center">
                    Cache Hit Rate: {cacheStats.hitRate.toFixed(1)}%
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-sm">Cache statistics not available</div>
            )}
          </div>

          {/* Active Operations */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              <h3 className="font-medium">Active Operations</h3>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                {runningOperations.length}
              </span>
            </div>
            
            {runningOperations.length > 0 ? (
              <div className="space-y-2">
                {runningOperations.map((operation) => (
                  <div key={operation.id} className="bg-white rounded p-3 border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{operation.label}</span>
                      <span className="text-xs text-gray-500">
                        {operation.progress.toFixed(0)}%
                      </span>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="h-1.5 bg-purple-500 rounded-full transition-all duration-300"
                        style={{ width: `${operation.progress}%` }}
                      />
                    </div>
                    
                    {operation.startTime && (
                      <div className="text-xs text-gray-500 mt-1">
                        Running for {Math.round((Date.now() - operation.startTime) / 1000)}s
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 text-sm">No active operations</div>
            )}
          </div>

          {/* System Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Activity className="w-5 h-5 text-gray-500" />
              <h3 className="font-medium">System Information</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-600">CPU Cores</div>
                <div className="font-medium">{navigator.hardwareConcurrency || 'Unknown'}</div>
              </div>
              <div>
                <div className="text-gray-600">User Agent</div>
                <div className="font-medium text-xs truncate" title={navigator.userAgent}>
                  {navigator.userAgent.split(' ')[0]}
                </div>
              </div>
              <div>
                <div className="text-gray-600">Connection</div>
                <div className="font-medium">
                  {(navigator as any).connection?.effectiveType || 'Unknown'}
                </div>
              </div>
              <div>
                <div className="text-gray-600">Online</div>
                <div className="font-medium">
                  {navigator.onLine ? 'Yes' : 'No'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <div className="text-xs text-gray-500">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
          
          <div className="text-xs text-gray-500">
            Monitoring active since page load
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Floating performance indicator button
 * 
 * Shows current memory usage and provides quick access to the monitoring panel.
 */
export function FloatingPerformanceIndicator({
  onOpenPanel,
  className = ''
}: {
  onOpenPanel: () => void;
  className?: string;
}) {
  const { getMemoryUsage } = usePerformanceMonitoring();
  const [memoryUsage, setMemoryUsage] = useState<any>(null);

  useEffect(() => {
    const updateMemory = () => {
      const usage = getMemoryUsage?.();
      setMemoryUsage(usage);
    };

    updateMemory();
    const interval = setInterval(updateMemory, 5000);

    return () => clearInterval(interval);
  }, [getMemoryUsage]);

  if (!memoryUsage) {
    return null;
  }

  const getStatusColor = () => {
    switch (memoryUsage.status) {
      case 'critical':
        return 'bg-red-500 hover:bg-red-600';
      case 'high':
        return 'bg-orange-500 hover:bg-orange-600';
      case 'medium':
        return 'bg-yellow-500 hover:bg-yellow-600';
      default:
        return 'bg-green-500 hover:bg-green-600';
    }
  };

  return (
    <button
      onClick={onOpenPanel}
      className={`
        fixed bottom-4 right-4 z-40 
        ${getStatusColor()}
        text-white rounded-full p-3 shadow-lg
        transition-all duration-200 hover:scale-105
        ${className}
      `}
      title={`Memory: ${memoryUsage.usagePercentage.toFixed(1)}% (${memoryUsage.usedFormatted})`}
    >
      <div className="flex items-center space-x-2">
        <Activity className="w-4 h-4" />
        <span className="text-xs font-medium">
          {memoryUsage.usagePercentage.toFixed(0)}%
        </span>
      </div>
    </button>
  );
}

export default PerformanceMonitoringPanel;
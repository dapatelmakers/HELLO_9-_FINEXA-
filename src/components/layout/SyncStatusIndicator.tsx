import React from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle, HardDrive } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export const SyncStatusIndicator: React.FC = () => {
  const { syncState, triggerSync } = useData();
  const { isCloudMode } = useAuth();

  const getStatusIcon = () => {
    if (!isCloudMode) {
      return <HardDrive className="w-4 h-4" />;
    }

    switch (syncState.status) {
      case 'online':
        return <Cloud className="w-4 h-4 text-green-500" />;
      case 'syncing':
        return <RefreshCw className="w-4 h-4 text-primary animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'offline':
      default:
        return <CloudOff className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    if (!isCloudMode) {
      return 'Offline Mode';
    }

    switch (syncState.status) {
      case 'online':
        return syncState.lastSynced 
          ? `Synced ${formatDistanceToNow(new Date(syncState.lastSynced), { addSuffix: true })}`
          : 'Online';
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return 'Sync Error';
      case 'offline':
      default:
        return 'Offline';
    }
  };

  const getStatusColor = () => {
    if (!isCloudMode) return 'bg-muted';
    
    switch (syncState.status) {
      case 'online':
        return 'bg-green-500/10 text-green-600 dark:text-green-400';
      case 'syncing':
        return 'bg-primary/10 text-primary';
      case 'error':
        return 'bg-destructive/10 text-destructive';
      case 'offline':
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => isCloudMode && triggerSync()}
            disabled={syncState.status === 'syncing' || !isCloudMode}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${getStatusColor()} hover:opacity-80 disabled:cursor-not-allowed`}
          >
            {getStatusIcon()}
            <span className="hidden sm:inline">{getStatusText()}</span>
            {syncState.pendingChanges > 0 && (
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                {syncState.pendingChanges}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <p className="font-medium">{isCloudMode ? 'Cloud Mode' : 'Offline Mode'}</p>
            {isCloudMode && syncState.lastSynced && (
              <p className="text-muted-foreground text-xs">
                Last synced: {new Date(syncState.lastSynced).toLocaleString()}
              </p>
            )}
            {isCloudMode && syncState.pendingChanges > 0 && (
              <p className="text-xs text-primary">
                {syncState.pendingChanges} changes pending
              </p>
            )}
            {syncState.error && (
              <p className="text-xs text-destructive">{syncState.error}</p>
            )}
            {isCloudMode && <p className="text-xs mt-1">Click to sync now</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

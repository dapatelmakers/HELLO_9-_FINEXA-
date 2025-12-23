import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { storage } from '@/lib/storage';
import { SyncState, SyncStatus, Customer, Supplier, Product, Invoice, LedgerEntry, BankTransaction } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface SyncableTable {
  localKey: string;
  remoteTable: string;
  transform: (item: any, userId: string) => any;
  reverseTransform: (item: any) => any;
}

const SYNC_TABLES: SyncableTable[] = [
  {
    localKey: 'customers',
    remoteTable: 'customers',
    transform: (item: Customer, userId: string) => ({
      id: item.id,
      user_id: userId,
      name: item.name,
      email: item.email || null,
      phone: item.phone || null,
      gstin: item.gstin || null,
      address: item.address || null,
      city: item.city || null,
      state: item.state || null,
      pin_code: item.pin_code || null,
      created_at: item.createdAt,
      synced_at: new Date().toISOString(),
    }),
    reverseTransform: (item: any): Customer => ({
      id: item.id,
      user_id: item.user_id,
      name: item.name,
      email: item.email,
      phone: item.phone,
      gstin: item.gstin,
      address: item.address,
      city: item.city,
      state: item.state || '',
      pin_code: item.pin_code,
      createdAt: item.created_at,
      synced_at: item.synced_at,
    }),
  },
  {
    localKey: 'suppliers',
    remoteTable: 'suppliers',
    transform: (item: Supplier, userId: string) => ({
      id: item.id,
      user_id: userId,
      name: item.name,
      email: item.email || null,
      phone: item.phone || null,
      gstin: item.gstin || null,
      address: item.address || null,
      city: item.city || null,
      state: item.state || null,
      pin_code: item.pin_code || null,
      created_at: item.createdAt,
      synced_at: new Date().toISOString(),
    }),
    reverseTransform: (item: any): Supplier => ({
      id: item.id,
      user_id: item.user_id,
      name: item.name,
      email: item.email,
      phone: item.phone,
      gstin: item.gstin,
      address: item.address,
      city: item.city,
      state: item.state || '',
      pin_code: item.pin_code,
      createdAt: item.created_at,
      synced_at: item.synced_at,
    }),
  },
  {
    localKey: 'products',
    remoteTable: 'products',
    transform: (item: Product, userId: string) => ({
      id: item.id,
      user_id: userId,
      name: item.name,
      sku: item.sku || null,
      hsn_code: item.hsn_code || null,
      description: item.description || null,
      quantity: item.quantity || 0,
      unit: item.unit || 'pcs',
      price: item.price || 0,
      cost: item.cost || 0,
      gst_rate: item.gst_rate || 0,
      low_stock_alert: item.low_stock_alert || 10,
      created_at: item.createdAt,
      synced_at: new Date().toISOString(),
    }),
    reverseTransform: (item: any): Product => ({
      id: item.id,
      user_id: item.user_id,
      name: item.name,
      sku: item.sku,
      hsn_code: item.hsn_code,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      price: parseFloat(item.price) || 0,
      cost: parseFloat(item.cost) || 0,
      gst_rate: parseFloat(item.gst_rate) || 0,
      low_stock_alert: item.low_stock_alert,
      createdAt: item.created_at,
      synced_at: item.synced_at,
    }),
  },
  {
    localKey: 'ledgerEntries',
    remoteTable: 'ledger_entries',
    transform: (item: LedgerEntry, userId: string) => ({
      id: item.id,
      user_id: userId,
      entry_type: item.type,
      category: item.category,
      amount: item.amount,
      description: item.description || null,
      reference: item.reference || null,
      entry_date: item.date,
      created_at: item.createdAt,
      synced_at: new Date().toISOString(),
    }),
    reverseTransform: (item: any): LedgerEntry => ({
      id: item.id,
      user_id: item.user_id,
      date: item.entry_date,
      type: item.entry_type,
      category: item.category,
      description: item.description,
      amount: parseFloat(item.amount) || 0,
      reference: item.reference,
      createdAt: item.created_at,
      synced_at: item.synced_at,
    }),
  },
];

export const useSyncService = () => {
  const { user, isCloudMode, session } = useAuth();
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'offline',
    pendingChanges: 0,
  });
  const syncInProgress = useRef(false);

  // Calculate pending changes
  const calculatePendingChanges = useCallback(() => {
    let pending = 0;
    for (const table of SYNC_TABLES) {
      const localData = storage.get<any[]>(table.localKey, []);
      const unsyncedItems = localData.filter(item => !item.synced_at);
      pending += unsyncedItems.length;
    }
    return pending;
  }, []);

  // Update sync status
  useEffect(() => {
    if (!isCloudMode || !session) {
      setSyncState(prev => ({ ...prev, status: 'offline' }));
      return;
    }

    const pending = calculatePendingChanges();
    setSyncState(prev => ({
      ...prev,
      status: 'online',
      pendingChanges: pending,
    }));
  }, [isCloudMode, session, calculatePendingChanges]);

  // Sync data to cloud
  const syncToCloud = useCallback(async () => {
    if (!user || !isCloudMode || syncInProgress.current) {
      return { success: false, error: 'Not ready to sync' };
    }

    syncInProgress.current = true;
    setSyncState(prev => ({ ...prev, status: 'syncing' }));

    try {
      for (const table of SYNC_TABLES) {
        const localData = storage.get<any[]>(table.localKey, []);
        const unsyncedItems = localData.filter(item => !item.synced_at);

        if (unsyncedItems.length > 0) {
          const transformedItems = unsyncedItems.map(item => 
            table.transform(item, user.id)
          );

          const { error } = await supabase
            .from(table.remoteTable)
            .upsert(transformedItems, { onConflict: 'id' });

          if (error) {
            console.error(`Error syncing ${table.localKey}:`, error);
            continue;
          }

          // Mark items as synced locally
          const updatedData = localData.map(item => {
            const wasSynced = unsyncedItems.some(u => u.id === item.id);
            return wasSynced ? { ...item, synced_at: new Date().toISOString() } : item;
          });
          storage.set(table.localKey, updatedData);
        }
      }

      setSyncState(prev => ({
        ...prev,
        status: 'online',
        lastSynced: new Date().toISOString(),
        pendingChanges: 0,
      }));

      return { success: true };
    } catch (error: any) {
      setSyncState(prev => ({
        ...prev,
        status: 'error',
        error: error.message,
      }));
      return { success: false, error: error.message };
    } finally {
      syncInProgress.current = false;
    }
  }, [user, isCloudMode]);

  // Sync from cloud (Cloud Priority)
  const syncFromCloud = useCallback(async () => {
    if (!user || !isCloudMode || syncInProgress.current) {
      return { success: false, error: 'Not ready to sync' };
    }

    syncInProgress.current = true;
    setSyncState(prev => ({ ...prev, status: 'syncing' }));

    try {
      for (const table of SYNC_TABLES) {
        const { data, error } = await supabase
          .from(table.remoteTable)
          .select('*')
          .eq('user_id', user.id);

        if (error) {
          console.error(`Error fetching ${table.remoteTable}:`, error);
          continue;
        }

        if (data && data.length > 0) {
          const transformedData = data.map(table.reverseTransform);
          storage.set(table.localKey, transformedData);
        }
      }

      setSyncState(prev => ({
        ...prev,
        status: 'online',
        lastSynced: new Date().toISOString(),
        pendingChanges: 0,
      }));

      return { success: true };
    } catch (error: any) {
      setSyncState(prev => ({
        ...prev,
        status: 'error',
        error: error.message,
      }));
      return { success: false, error: error.message };
    } finally {
      syncInProgress.current = false;
    }
  }, [user, isCloudMode]);

  // Full sync (cloud priority)
  const fullSync = useCallback(async () => {
    // First pull from cloud (cloud priority)
    const pullResult = await syncFromCloud();
    if (!pullResult.success) {
      return pullResult;
    }

    // Then push local changes
    const pushResult = await syncToCloud();
    return pushResult;
  }, [syncFromCloud, syncToCloud]);

  // Manual sync trigger
  const triggerSync = useCallback(async () => {
    toast.info('Syncing data...');
    const result = await fullSync();
    if (result.success) {
      toast.success('Sync completed successfully');
    } else {
      toast.error(result.error || 'Sync failed');
    }
    return result;
  }, [fullSync]);

  return {
    syncState,
    syncToCloud,
    syncFromCloud,
    fullSync,
    triggerSync,
    calculatePendingChanges,
  };
};

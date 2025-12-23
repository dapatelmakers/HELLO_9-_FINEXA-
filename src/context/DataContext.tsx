import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Customer, Supplier, Product, Invoice, Purchase, LedgerEntry, AppSettings, DashboardStats, SyncState } from '@/types';
import { storage, generateId } from '@/lib/storage';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface DataContextType {
  // Customers
  customers: Customer[];
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => void;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  // Suppliers
  suppliers: Supplier[];
  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => void;
  updateSupplier: (id: string, supplier: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;

  // Products
  products: Product[];
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;

  // Invoices
  invoices: Invoice[];
  addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => void;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  getNextInvoiceNumber: () => string;

  // Purchases
  purchases: Purchase[];
  addPurchase: (purchase: Omit<Purchase, 'id' | 'createdAt'>) => void;
  updatePurchase: (id: string, purchase: Partial<Purchase>) => void;
  deletePurchase: (id: string) => void;

  // Ledger
  ledgerEntries: LedgerEntry[];
  addLedgerEntry: (entry: Omit<LedgerEntry, 'id' | 'createdAt'>) => void;
  updateLedgerEntry: (id: string, entry: Partial<LedgerEntry>) => void;
  deleteLedgerEntry: (id: string) => void;

  // Settings
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;

  // Stats
  getStats: () => DashboardStats;

  // Data Management
  clearAllData: () => void;
  exportData: () => string;
  importData: (data: string) => boolean;

  // Sync
  syncState: SyncState;
  triggerSync: () => Promise<void>;

  // Loading
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

const defaultSettings: AppSettings = {
  theme: 'light',
  darkMode: false,
  invoicePrefix: 'INV-',
  purchasePrefix: 'PO-',
  currency: 'INR',
  fiscalYearStart: '04-01',
  cloudSyncEnabled: false,
  storageMode: 'offline',
  autoSync: true,
  syncInterval: 300,
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isCloudMode, isAuthenticated } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'offline',
    pendingChanges: 0,
  });

  // Load data from local storage or cloud
  const loadData = useCallback(async () => {
    setIsLoading(true);
    
    if (isCloudMode && user) {
      // Load from cloud
      try {
        const [customersRes, suppliersRes, productsRes, ledgerRes] = await Promise.all([
          supabase.from('customers').select('*').eq('user_id', user.id),
          supabase.from('suppliers').select('*').eq('user_id', user.id),
          supabase.from('products').select('*').eq('user_id', user.id),
          supabase.from('ledger_entries').select('*').eq('user_id', user.id),
        ]);

        if (customersRes.data) {
          const transformedCustomers = customersRes.data.map(c => ({
            id: c.id,
            user_id: c.user_id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            gstin: c.gstin,
            address: c.address,
            city: c.city,
            state: c.state || '',
            pin_code: c.pin_code,
            createdAt: c.created_at,
            synced_at: c.synced_at,
          }));
          setCustomers(transformedCustomers);
          storage.set('customers', transformedCustomers);
        }

        if (suppliersRes.data) {
          const transformedSuppliers = suppliersRes.data.map(s => ({
            id: s.id,
            user_id: s.user_id,
            name: s.name,
            email: s.email,
            phone: s.phone,
            gstin: s.gstin,
            address: s.address,
            city: s.city,
            state: s.state || '',
            pin_code: s.pin_code,
            createdAt: s.created_at,
            synced_at: s.synced_at,
          }));
          setSuppliers(transformedSuppliers);
          storage.set('suppliers', transformedSuppliers);
        }

        if (productsRes.data) {
          const transformedProducts = productsRes.data.map(p => ({
            id: p.id,
            user_id: p.user_id,
            name: p.name,
            sku: p.sku,
            hsn_code: p.hsn_code,
            description: p.description,
            quantity: p.quantity,
            unit: p.unit,
            price: parseFloat(p.price) || 0,
            cost: parseFloat(p.cost) || 0,
            gst_rate: parseFloat(p.gst_rate) || 0,
            low_stock_alert: p.low_stock_alert,
            createdAt: p.created_at,
            synced_at: p.synced_at,
          }));
          setProducts(transformedProducts);
          storage.set('products', transformedProducts);
        }

        if (ledgerRes.data) {
          const transformedLedger = ledgerRes.data.map(l => ({
            id: l.id,
            user_id: l.user_id,
            date: l.entry_date,
            type: l.entry_type as 'income' | 'expense',
            category: l.category,
            description: l.description,
            amount: parseFloat(l.amount) || 0,
            reference: l.reference,
            createdAt: l.created_at,
            synced_at: l.synced_at,
          }));
          setLedgerEntries(transformedLedger);
          storage.set('ledgerEntries', transformedLedger);
        }

        // Load settings from cloud
        const { data: settingsData } = await supabase
          .from('app_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (settingsData) {
          const cloudSettings: AppSettings = {
            ...defaultSettings,
            theme: settingsData.theme as AppSettings['theme'],
            darkMode: settingsData.dark_mode,
            cloudSyncEnabled: settingsData.cloud_sync_enabled,
            autoSync: settingsData.auto_sync,
            syncInterval: settingsData.sync_interval,
          };
          setSettings(cloudSettings);
          storage.set('settings', cloudSettings);
        }

        setSyncState(prev => ({
          ...prev,
          status: 'online',
          lastSynced: new Date().toISOString(),
        }));
      } catch (error) {
        console.error('Error loading cloud data:', error);
        // Fall back to local storage
        loadFromLocalStorage();
        setSyncState(prev => ({ ...prev, status: 'error' }));
      }
    } else {
      // Load from local storage
      loadFromLocalStorage();
    }

    setIsLoading(false);
  }, [isCloudMode, user]);

  const loadFromLocalStorage = () => {
    setCustomers(storage.get('customers', []));
    setSuppliers(storage.get('suppliers', []));
    setProducts(storage.get('products', []));
    setInvoices(storage.get('invoices', []));
    setPurchases(storage.get('purchases', []));
    setLedgerEntries(storage.get('ledgerEntries', []));
    setSettings(storage.get('settings', defaultSettings));
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    } else {
      loadFromLocalStorage();
      setIsLoading(false);
    }
  }, [isAuthenticated, loadData]);

  const refreshData = async () => {
    await loadData();
  };

  const triggerSync = async () => {
    if (!isCloudMode || !user) return;

    setSyncState(prev => ({ ...prev, status: 'syncing' }));

    try {
      // Sync customers
      const unsyncedCustomers = customers.filter(c => !c.synced_at);
      for (const customer of unsyncedCustomers) {
        await supabase.from('customers').upsert({
          id: customer.id,
          user_id: user.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          gstin: customer.gstin,
          address: customer.address,
          city: customer.city,
          state: customer.state,
          pin_code: customer.pin_code,
          created_at: customer.createdAt,
          synced_at: new Date().toISOString(),
        });
      }

      // Sync suppliers
      const unsyncedSuppliers = suppliers.filter(s => !s.synced_at);
      for (const supplier of unsyncedSuppliers) {
        await supabase.from('suppliers').upsert({
          id: supplier.id,
          user_id: user.id,
          name: supplier.name,
          email: supplier.email,
          phone: supplier.phone,
          gstin: supplier.gstin,
          address: supplier.address,
          city: supplier.city,
          state: supplier.state,
          pin_code: supplier.pin_code,
          created_at: supplier.createdAt,
          synced_at: new Date().toISOString(),
        });
      }

      // Sync products
      const unsyncedProducts = products.filter(p => !p.synced_at);
      for (const product of unsyncedProducts) {
        await supabase.from('products').upsert({
          id: product.id,
          user_id: user.id,
          name: product.name,
          sku: product.sku,
          hsn_code: product.hsn_code,
          description: product.description,
          quantity: product.quantity,
          unit: product.unit,
          price: product.price,
          cost: product.cost,
          gst_rate: product.gst_rate,
          low_stock_alert: product.low_stock_alert,
          created_at: product.createdAt,
          synced_at: new Date().toISOString(),
        });
      }

      // Reload data from cloud
      await loadData();

      setSyncState(prev => ({
        ...prev,
        status: 'online',
        lastSynced: new Date().toISOString(),
        pendingChanges: 0,
      }));
    } catch (error) {
      console.error('Sync error:', error);
      setSyncState(prev => ({ ...prev, status: 'error' }));
    }
  };

  // CRUD operations for Customers
  const addCustomer = async (customer: Omit<Customer, 'id' | 'createdAt'>) => {
    const newCustomer: Customer = {
      ...customer,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    
    const updated = [...customers, newCustomer];
    setCustomers(updated);
    storage.set('customers', updated);

    if (isCloudMode && user) {
      await supabase.from('customers').insert({
        id: newCustomer.id,
        user_id: user.id,
        name: newCustomer.name,
        email: newCustomer.email,
        phone: newCustomer.phone,
        gstin: newCustomer.gstin,
        address: newCustomer.address,
        city: newCustomer.city,
        state: newCustomer.state,
        pin_code: newCustomer.pin_code,
        created_at: newCustomer.createdAt,
        synced_at: new Date().toISOString(),
      });
    }
  };

  const updateCustomer = async (id: string, customer: Partial<Customer>) => {
    const updated = customers.map(c => c.id === id ? { ...c, ...customer } : c);
    setCustomers(updated);
    storage.set('customers', updated);

    if (isCloudMode && user) {
      await supabase.from('customers').update({
        ...customer,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
    }
  };

  const deleteCustomer = async (id: string) => {
    const updated = customers.filter(c => c.id !== id);
    setCustomers(updated);
    storage.set('customers', updated);

    if (isCloudMode && user) {
      await supabase.from('customers').delete().eq('id', id);
    }
  };

  // CRUD operations for Suppliers
  const addSupplier = async (supplier: Omit<Supplier, 'id' | 'createdAt'>) => {
    const newSupplier: Supplier = {
      ...supplier,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...suppliers, newSupplier];
    setSuppliers(updated);
    storage.set('suppliers', updated);

    if (isCloudMode && user) {
      await supabase.from('suppliers').insert({
        id: newSupplier.id,
        user_id: user.id,
        name: newSupplier.name,
        email: newSupplier.email,
        phone: newSupplier.phone,
        gstin: newSupplier.gstin,
        address: newSupplier.address,
        city: newSupplier.city,
        state: newSupplier.state,
        pin_code: newSupplier.pin_code,
        created_at: newSupplier.createdAt,
        synced_at: new Date().toISOString(),
      });
    }
  };

  const updateSupplier = async (id: string, supplier: Partial<Supplier>) => {
    const updated = suppliers.map(s => s.id === id ? { ...s, ...supplier } : s);
    setSuppliers(updated);
    storage.set('suppliers', updated);

    if (isCloudMode && user) {
      await supabase.from('suppliers').update({
        ...supplier,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
    }
  };

  const deleteSupplier = async (id: string) => {
    const updated = suppliers.filter(s => s.id !== id);
    setSuppliers(updated);
    storage.set('suppliers', updated);

    if (isCloudMode && user) {
      await supabase.from('suppliers').delete().eq('id', id);
    }
  };

  // CRUD operations for Products
  const addProduct = async (product: Omit<Product, 'id' | 'createdAt'>) => {
    const newProduct: Product = {
      ...product,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...products, newProduct];
    setProducts(updated);
    storage.set('products', updated);

    if (isCloudMode && user) {
      await supabase.from('products').insert({
        id: newProduct.id,
        user_id: user.id,
        name: newProduct.name,
        sku: newProduct.sku,
        hsn_code: newProduct.hsn_code,
        description: newProduct.description,
        quantity: newProduct.quantity,
        unit: newProduct.unit,
        price: newProduct.price,
        cost: newProduct.cost,
        gst_rate: newProduct.gst_rate,
        low_stock_alert: newProduct.low_stock_alert,
        created_at: newProduct.createdAt,
        synced_at: new Date().toISOString(),
      });
    }
  };

  const updateProduct = async (id: string, product: Partial<Product>) => {
    const updated = products.map(p => p.id === id ? { ...p, ...product } : p);
    setProducts(updated);
    storage.set('products', updated);

    if (isCloudMode && user) {
      await supabase.from('products').update({
        ...product,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
    }
  };

  const deleteProduct = async (id: string) => {
    const updated = products.filter(p => p.id !== id);
    setProducts(updated);
    storage.set('products', updated);

    if (isCloudMode && user) {
      await supabase.from('products').delete().eq('id', id);
    }
  };

  // CRUD operations for Invoices (local only for now)
  const addInvoice = (invoice: Omit<Invoice, 'id' | 'createdAt'>) => {
    const newInvoice: Invoice = {
      ...invoice,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...invoices, newInvoice];
    setInvoices(updated);
    storage.set('invoices', updated);

    addLedgerEntry({
      date: invoice.date,
      type: 'income',
      category: 'Sales',
      description: `Invoice ${invoice.invoiceNumber} - ${invoice.customerName}`,
      amount: invoice.total,
      reference: invoice.invoiceNumber,
    });
  };

  const updateInvoice = (id: string, invoice: Partial<Invoice>) => {
    const updated = invoices.map(i => i.id === id ? { ...i, ...invoice } : i);
    setInvoices(updated);
    storage.set('invoices', updated);
  };

  const deleteInvoice = (id: string) => {
    const updated = invoices.filter(i => i.id !== id);
    setInvoices(updated);
    storage.set('invoices', updated);
  };

  const getNextInvoiceNumber = (): string => {
    const year = new Date().getFullYear().toString().slice(-2);
    const count = invoices.length + 1;
    return `${settings.invoicePrefix}${year}${count.toString().padStart(4, '0')}`;
  };

  // CRUD operations for Purchases
  const addPurchase = (purchase: Omit<Purchase, 'id' | 'createdAt'>) => {
    const newPurchase: Purchase = {
      ...purchase,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...purchases, newPurchase];
    setPurchases(updated);
    storage.set('purchases', updated);

    addLedgerEntry({
      date: purchase.date,
      type: 'expense',
      category: 'Purchases',
      description: `Purchase ${purchase.purchaseNumber} - ${purchase.supplierName}`,
      amount: purchase.total,
      reference: purchase.purchaseNumber,
    });
  };

  const updatePurchase = (id: string, purchase: Partial<Purchase>) => {
    const updated = purchases.map(p => p.id === id ? { ...p, ...purchase } : p);
    setPurchases(updated);
    storage.set('purchases', updated);
  };

  const deletePurchase = (id: string) => {
    const updated = purchases.filter(p => p.id !== id);
    setPurchases(updated);
    storage.set('purchases', updated);
  };

  // CRUD operations for Ledger
  const addLedgerEntry = async (entry: Omit<LedgerEntry, 'id' | 'createdAt'>) => {
    const newEntry: LedgerEntry = {
      ...entry,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...ledgerEntries, newEntry];
    setLedgerEntries(updated);
    storage.set('ledgerEntries', updated);

    if (isCloudMode && user) {
      await supabase.from('ledger_entries').insert({
        id: newEntry.id,
        user_id: user.id,
        entry_type: newEntry.type,
        category: newEntry.category,
        amount: newEntry.amount,
        description: newEntry.description,
        reference: newEntry.reference,
        entry_date: newEntry.date,
        created_at: newEntry.createdAt,
        synced_at: new Date().toISOString(),
      });
    }
  };

  const updateLedgerEntry = async (id: string, entry: Partial<LedgerEntry>) => {
    const updated = ledgerEntries.map(e => e.id === id ? { ...e, ...entry } : e);
    setLedgerEntries(updated);
    storage.set('ledgerEntries', updated);

    if (isCloudMode && user) {
      await supabase.from('ledger_entries').update({
        entry_type: entry.type,
        category: entry.category,
        amount: entry.amount,
        description: entry.description,
        reference: entry.reference,
        entry_date: entry.date,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
    }
  };

  const deleteLedgerEntry = async (id: string) => {
    const updated = ledgerEntries.filter(e => e.id !== id);
    setLedgerEntries(updated);
    storage.set('ledgerEntries', updated);

    if (isCloudMode && user) {
      await supabase.from('ledger_entries').delete().eq('id', id);
    }
  };

  // Settings
  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    storage.set('settings', updated);

    if (isCloudMode && user) {
      await supabase.from('app_settings').update({
        theme: updated.theme,
        dark_mode: updated.darkMode,
        cloud_sync_enabled: updated.cloudSyncEnabled,
        auto_sync: updated.autoSync,
        sync_interval: updated.syncInterval,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);
    }
  };

  // Stats
  const getStats = (): DashboardStats => {
    const totalIncome = ledgerEntries
      .filter(e => e.type === 'income')
      .reduce((sum, e) => sum + e.amount, 0);
    
    const totalExpense = ledgerEntries
      .filter(e => e.type === 'expense')
      .reduce((sum, e) => sum + e.amount, 0);

    const stockValue = products.reduce((sum, p) => sum + (p.cost * p.quantity), 0);

    const receivables = invoices
      .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
      .reduce((sum, i) => sum + i.total, 0);

    const payables = purchases
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + p.total, 0);

    return {
      totalIncome,
      totalExpense,
      profit: totalIncome - totalExpense,
      stockValue,
      cashBalance: totalIncome - totalExpense,
      receivables,
      payables,
      invoiceCount: invoices.length,
      customerCount: customers.length,
    };
  };

  // Data Management
  const clearAllData = () => {
    storage.clear();
    setCustomers([]);
    setSuppliers([]);
    setProducts([]);
    setInvoices([]);
    setPurchases([]);
    setLedgerEntries([]);
    setSettings(defaultSettings);
  };

  const exportData = (): string => {
    return storage.exportAll();
  };

  const importData = (data: string): boolean => {
    const success = storage.importAll(data);
    if (success) {
      loadFromLocalStorage();
    }
    return success;
  };

  return (
    <DataContext.Provider
      value={{
        customers,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        suppliers,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        products,
        addProduct,
        updateProduct,
        deleteProduct,
        invoices,
        addInvoice,
        updateInvoice,
        deleteInvoice,
        getNextInvoiceNumber,
        purchases,
        addPurchase,
        updatePurchase,
        deletePurchase,
        ledgerEntries,
        addLedgerEntry,
        updateLedgerEntry,
        deleteLedgerEntry,
        settings,
        updateSettings,
        getStats,
        clearAllData,
        exportData,
        importData,
        syncState,
        triggerSync,
        isLoading,
        refreshData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

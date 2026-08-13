import React, { useState, useEffect } from 'react';
import { Screen, Batch, ScanItem, AppSettings } from './types';
import {
  getStoredBatches,
  getStoredScanItems,
  getStoredExpectedItems,
  getStoredAuditLogs,
  getStoredSettings,
  createBatch,
  deleteBatch,
  processScanItem,
  deleteScanItemAndSync,
  addExpectedItemsToBatch,
} from './services/storage';

import { syncToCloud, downloadFromCloud, addChangelog } from './services/firebase';

import { MainScreen } from './components/MainScreen';
import { ScanScreen } from './components/ScanScreen';
import { SequentialScanScreen } from './components/SequentialScanScreen';
import { BatchListScreen } from './components/BatchListScreen';
import { AssetsListScreen } from './components/AssetsListScreen';
import { NewBatchScreen } from './components/NewBatchScreen';
import { ImportInventoryScreen } from './components/ImportInventoryScreen';
import { BatchScanScreen } from './components/BatchScanScreen';
import { VerificationScanScreen } from './components/VerificationScanScreen';
import { BatchDetailsScreen } from './components/BatchDetailsScreen';
import { AuditResultsScreen } from './components/AuditResultsScreen';
import { AuditLogScreen } from './components/AuditLogScreen';
import { ExportBatchesScreen } from './components/ExportBatchesScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { GeneralReportsScreen } from './components/GeneralReportsScreen';

import { QrImportScannerScreen } from './components/QrImportScannerScreen';

export function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('menu');
  const [activeBatchId, setActiveBatchId] = useState<number | null>(null);
  const [qrImportBatchName, setQrImportBatchName] = useState<string>('Conferência QR');
  const [targetBatchId, setTargetBatchId] = useState<number | null>(null);
  const [qrInitialContent, setQrInitialContent] = useState<string | null>(null);
  const [batchListFilter, setBatchListFilter] = useState<'ALL' | 'COLLECTION' | 'VERIFICATION' | 'PENDING' | 'COMPLETED'>('ALL');
  const [auditFilterTab, setAuditFilterTab] = useState<'all' | 'found' | 'missing' | 'extra'>('all');

  const [batches, setBatches] = useState<Batch[]>([]);
  const [scanItems, setScanItems] = useState<ScanItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>(getStoredSettings());

  useEffect(() => {
    if (!localStorage.getItem('changelog_v2.1_demo_data_removed')) {
      addChangelog(
        "Remoção de Dados de Exemplo", 
        "Os botões e funções de carregamento de dados de demonstração (lotes fantasmas) foram totalmente removidos da aplicação."
      ).then(() => {
        localStorage.setItem('changelog_v2.1_demo_data_removed', 'true');
      }).catch(console.error);
    }
  }, []);

  const refreshData = () => {
    setBatches(getStoredBatches());
    setScanItems(getStoredScanItems());
  };

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark-mode');
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light-mode');
    }
  }, [settings.theme]);

  const handleCreateCollectionBatch = (name: string, description: string) => {
    const newB = createBatch(name, description, 'COLLECTION');
    refreshData();
    setActiveBatchId(newB.id);
    setCurrentScreen('batch_scan');
  };

  const handleCreateVerificationBatch = (
    name: string,
    description: string,
    expectedItems: { barcode: string; description?: string; category?: string }[]
  ) => {
    const newB = createBatch(name, description, 'VERIFICATION', expectedItems);
    refreshData();
    setActiveBatchId(newB.id);
    setCurrentScreen('batch_details');
  };

  const handleAddExpectedToBatch = (
    batchId: number,
    items: { barcode: string; description?: string; category?: string }[]
  ) => {
    addExpectedItemsToBatch(batchId, items);
    refreshData();
    setActiveBatchId(batchId);
    setCurrentScreen('batch_details');
  };

  const handleDeleteBatch = (id: number) => {
    deleteBatch(id);
    refreshData();
    if (activeBatchId === id) {
      setActiveBatchId(null);
    }
  };

  const handleAddScanItem = (barcode: string, format: string) => {
    if (!activeBatchId) return;
    processScanItem(activeBatchId, barcode, format);
    refreshData();
  };

  const handleDeleteScanItem = (itemId: number) => {
    deleteScanItemAndSync(itemId);
    refreshData();
  };

  const handleResetData = () => {
    localStorage.setItem('inventario_batches_v2', '[]');
    localStorage.setItem('inventario_scan_items_v2', '[]');
    localStorage.setItem('inventario_expected_items_v2', '[]');
    localStorage.setItem('inventario_audit_logs_v2', '[]');
    refreshData();
    setCurrentScreen('menu');
  };

  const handleSyncToCloud = async () => {
    try {
      await syncToCloud(
        getStoredBatches(),
        getStoredExpectedItems(),
        getStoredScanItems(),
        getStoredAuditLogs()
      );
      alert('Sincronização com o Firebase concluída com sucesso!');
    } catch (e: any) {
      alert('Erro ao sincronizar com a nuvem: ' + e.message);
    }
  };

  const handleDownloadFromCloud = async () => {
    try {
      const data = await downloadFromCloud();
      localStorage.setItem('inventario_batches_v2', JSON.stringify(data.batches));
      localStorage.setItem('inventario_expected_items_v2', JSON.stringify(data.expectedItems));
      localStorage.setItem('inventario_scan_items_v2', JSON.stringify(data.scanItems));
      localStorage.setItem('inventario_audit_logs_v2', JSON.stringify(data.auditLogs));
      refreshData();
      alert('Dados carregados do Firebase com sucesso!');
    } catch (e: any) {
      alert('Erro ao baixar da nuvem: ' + e.message);
    }
  };

  const handleOpenBatch = (batch: Batch) => {
    setActiveBatchId(batch.id);
    setCurrentScreen('batch_details');
  };

  const allStoredBatches = getStoredBatches();
  const allStoredScanItems = getStoredScanItems();

  const activeBatch = activeBatchId
    ? batches.find((b) => b.id === activeBatchId) || allStoredBatches.find((b) => b.id === activeBatchId)
    : undefined;

  const activeBatchItems = activeBatchId
    ? scanItems.filter((item) => item.batchId === activeBatchId)
    : [];

  return (
    <div className={`min-h-screen font-['Inter',sans-serif] transition-colors scanner-active-transparent ${currentScreen === 'sequential_scan' || currentScreen === 'scan' || currentScreen === 'verification_scan' || currentScreen === 'batch_scan' || currentScreen === 'qr_import' || currentScreen === 'settings' ? 'bg-transparent' : 'bg-[var(--bg-gradient)]'}`}>
      {currentScreen === 'menu' && (
        <MainScreen
          onNavigate={(screen, filter) => {
            if (filter) {
              setBatchListFilter(filter as any);
            } else {
              setBatchListFilter('ALL');
            }
            setCurrentScreen(screen as Screen);
          }}
          onOpenBatchDetails={(batchId) => {
            setActiveBatchId(batchId);
            setCurrentScreen('batch_details');
          }}
        />
      )}

      {currentScreen === 'scan' && (
        <ScanScreen onBack={() => setCurrentScreen('menu')} />
      )}

      {currentScreen === 'sequential_scan' && (
        <SequentialScanScreen onBack={() => setCurrentScreen('menu')} />
      )}

      {currentScreen === 'batch_list' && (
        <BatchListScreen
          batches={batches}
          initialFilter={batchListFilter}
          hideQuickActions={batchListFilter === 'PENDING' || batchListFilter === 'COMPLETED'}
          onBack={() => setCurrentScreen('menu')}
          onNewBatchClick={() => setCurrentScreen('new_batch')}
          onImportInventoryClick={() => {
            setTargetBatchId(null);
            setCurrentScreen('import_inventory');
          }}
          onBatchClick={handleOpenBatch}
          onDeleteBatch={handleDeleteBatch}
          onExportClick={() => setCurrentScreen('export_batches')}
        />
      )}

      {currentScreen === 'general_reports' && (
        <GeneralReportsScreen
          batches={batches}
          onBack={() => setCurrentScreen('menu')}
          onOpenBatchDetails={(batchId) => {
            setActiveBatchId(batchId);
            setCurrentScreen('batch_details');
          }}
          onNavigateBatchList={() => setCurrentScreen('batch_list')}
        />
      )}

      {currentScreen === 'assets_list' && (
        <AssetsListScreen
          onBack={() => setCurrentScreen('menu')}
          onOpenBatchDetails={(batchId) => {
            setActiveBatchId(batchId);
            setCurrentScreen('batch_details');
          }}
        />
      )}

      {currentScreen === 'new_batch' && (
        <NewBatchScreen
          onBack={() => setCurrentScreen('batch_list')}
          onCreateBatch={handleCreateCollectionBatch}
        />
      )}

      {currentScreen === 'import_inventory' && (
        <ImportInventoryScreen
          onBack={() => {
            if (targetBatchId) setCurrentScreen('batch_details');
            else setCurrentScreen('batch_list');
          }}
          onCreateVerificationBatch={handleCreateVerificationBatch}
          onAddExpectedToBatch={handleAddExpectedToBatch}
          onNavigateQrImport={(batchName, targetId, initialContent) => {
            setQrImportBatchName(batchName);
            setTargetBatchId(targetId || null);
            setQrInitialContent(initialContent || null);
            setCurrentScreen('qr_import');
          }}
          onNavigate={(screen) => setCurrentScreen(screen as Screen)}
          onOpenBatchDetails={(batchId) => {
            setActiveBatchId(batchId);
            setCurrentScreen('audit_results');
          }}
          targetBatchId={targetBatchId}
          settings={settings}
        />
      )}

      {currentScreen === 'qr_import' && (
        <QrImportScannerScreen
          batchName={qrImportBatchName}
          onBack={() => {
            setQrInitialContent(null);
            setCurrentScreen('import_inventory');
          }}
          onImported={(batchId) => {
            setQrInitialContent(null);
            refreshData();
            setActiveBatchId(batchId);
            setCurrentScreen('batch_details');
          }}
          onAddExpectedToBatch={handleAddExpectedToBatch}
          targetBatchId={targetBatchId || undefined}
          settings={settings}
          initialContent={qrInitialContent || undefined}
        />
      )}

      {currentScreen === 'batch_scan' && activeBatch && (
        <BatchScanScreen
          batch={activeBatch}
          scanItems={activeBatchItems}
          onBack={() => setCurrentScreen('batch_list')}
          onAddScanItem={handleAddScanItem}
          onViewDetails={() => setCurrentScreen('batch_details')}
        />
      )}

      {currentScreen === 'verification_scan' && activeBatch && (
        <VerificationScanScreen
          batch={activeBatch}
          onBack={() => setCurrentScreen('batch_list')}
          onViewAuditResults={() => setCurrentScreen('audit_results')}
        />
      )}

      {currentScreen === 'batch_details' && activeBatch && (
        <BatchDetailsScreen
          batch={activeBatch}
          scanItems={activeBatchItems}
          onBack={() => setCurrentScreen('batch_list')}
          onDone={() => setCurrentScreen('batch_list')}
          onContinueScanning={() => {
            if (activeBatch.type === 'VERIFICATION') {
               setCurrentScreen('verification_scan');
            } else {
               setCurrentScreen('batch_scan');
            }
          }}
          onImportMore={() => {
            setTargetBatchId(activeBatch.id);
            setCurrentScreen('import_inventory');
          }}
          onViewResults={(tab = 'all') => {
            setAuditFilterTab(tab);
            setCurrentScreen('audit_results');
          }}
          onViewAuditLog={() => setCurrentScreen('audit_log')}
          onRefresh={refreshData}
          onDeleteItem={handleDeleteScanItem}
        />
      )}

      {currentScreen === 'audit_log' && activeBatch && (
        <AuditLogScreen
          batch={activeBatch}
          onBack={() => setCurrentScreen('batch_details')}
        />
      )}

      {currentScreen === 'audit_results' && activeBatch && (
        <AuditResultsScreen
          batch={activeBatch}
          initialFilterTab={auditFilterTab}
          onBack={() => setCurrentScreen('batch_details')}
          onContinueScanning={() => setCurrentScreen('verification_scan')}
          onNavigate={(screen) => setCurrentScreen(screen as Screen)}
        />
      )}

      {currentScreen === 'export_batches' && (
        <ExportBatchesScreen
          batches={batches}
          allItems={scanItems}
          onBack={() => setCurrentScreen('batch_list')}
        />
      )}

      {currentScreen === 'settings' && (
        <SettingsScreen
          settings={settings}
          onUpdateSettings={(s) => setSettings(s)}
          onBack={() => setCurrentScreen('menu')}
          onResetData={handleResetData}
          onSyncToCloud={handleSyncToCloud}
          onDownloadFromCloud={handleDownloadFromCloud}
        />
      )}
    </div>
  );
}

export default App;

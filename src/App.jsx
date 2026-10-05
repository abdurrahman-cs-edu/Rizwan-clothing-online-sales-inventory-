// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  // Server-verified 4-digit action PIN
  const [pinModal, setPinModal] = useState({
    open: false,
    actionLabel: '',
    value: '',
    error: '',
    verifying: false
  });
  const pinResolverRef = useRef(null);

  useEffect(() => {
    document.title = "Dashboard - Rizwan Clothing";
  }, []);

  const requestActionPin = (actionLabel = 'perform this action') => {
    const cachedPin = sessionStorage.getItem('rizwan_action_pin_v2');
    if (cachedPin && /^\d{4}$/.test(cachedPin)) {
      return Promise.resolve(cachedPin);
    }

    return new Promise((resolve) => {
      pinResolverRef.current = resolve;
      setPinModal({
        open: true,
        actionLabel,
        value: '',
        error: '',
        verifying: false
      });
    });
  };

  const closePinModal = () => {
    if (pinModal.verifying) return;
    if (pinResolverRef.current) pinResolverRef.current(null);
    pinResolverRef.current = null;
    setPinModal({
      open: false,
      actionLabel: '',
      value: '',
      error: '',
      verifying: false
    });
  };

  const submitPinModal = async () => {
    const pin = pinModal.value.trim();

    if (!/^\d{4}$/.test(pin)) {
      setPinModal((prev) => ({
        ...prev,
        error: 'Please enter exactly 4 digits.'
      }));
      return;
    }

    setPinModal((prev) => ({ ...prev, verifying: true, error: '' }));

    try {
      const { data, error } = await supabase.functions.invoke('protected-mutation', {
        body: {
          action: 'verify_pin',
          pin
        }
      });

      if (error) {
        console.error('PIN verification function error:', error);
        setPinModal((prev) => ({
          ...prev,
          verifying: false,
          error: 'Could not verify the PIN. Check the Edge Function settings and try again.'
        }));
        return;
      }

      if (!data?.ok) {
        setPinModal((prev) => ({
          ...prev,
          verifying: false,
          value: '',
          error: data?.error || 'Incorrect PIN.'
        }));
        return;
      }

      // Store only after Supabase has confirmed that the PIN is correct.
      sessionStorage.setItem('rizwan_action_pin_v2', pin);

      const resolve = pinResolverRef.current;
      pinResolverRef.current = null;
      setPinModal({
        open: false,
        actionLabel: '',
        value: '',
        error: '',
        verifying: false
      });

      if (resolve) resolve(pin);
    } catch (err) {
      console.error('PIN verification exception:', err);
      setPinModal((prev) => ({
        ...prev,
        verifying: false,
        error: 'PIN verification failed. Please try again.'
      }));
    }
  };

  const clearActionPinSession = () => {
    sessionStorage.removeItem('rizwan_action_pin_v2');
    setPendingActionPin('');
    setCodActionPin('');
  };

  const callProtectedMutation = async (action, payload, actionLabel, providedPin = '') => {
    const pin = providedPin || await requestActionPin(actionLabel);
    if (!pin) return { ok: false };

    const { data, error } = await supabase.functions.invoke('protected-mutation', {
      body: { action, pin, ...payload }
    });

    if (error) {
      console.error('Protected mutation function error:', error);
      window.alert('The protected action could not reach Supabase. Please check the Edge Function configuration.');
      return { ok: false };
    }

    if (!data?.ok) {
      if (
        data?.error === 'Incorrect PIN.' ||
        data?.error === 'Protected action PIN is not configured on the server.'
      ) {
        clearActionPinSession();
      }
      window.alert(data?.error || 'Action was not allowed.');
      return { ok: false };
    }

    return { ok: true, data };
  };

  function toTitleCase(str) {
    if (!str) return '';
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  }

  // Relative Time Ago Helper (e.g., "Paid 3 minutes ago", "Paid 2 hours ago")
  function timeAgo(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Paid just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Paid ${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Paid ${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `Paid ${days} day${days > 1 ? 's' : ''} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `Paid ${months} month${months > 1 ? 's' : ''} ago`;
    return `Paid ${Math.floor(days / 365)} year${Math.floor(days / 365) > 1 ? 's' : ''} ago`;
  }

  // 12-Hour Time Formatting Helper (e.g., new Date() -> "3:21pm")
  function formatTime12hr(date) {
    if (!date) return '';
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : String(minutes);
    return `${hours}:${minutesStr}${ampm}`;
  }

  // Readable Date Formatting Helper (e.g., "2026-08-01" -> "1 Aug 2026")
  function formatReadableDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    if (!y || !m || !d) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = months[parseInt(m, 10) - 1];
    const dayNum = parseInt(d, 10);
    return `${dayNum} ${monthName} ${y}`;
  }

  // Readable Month-Year Helper (e.g., "2026-08" -> "August 2026")
  function formatMonthYear(monthStr) {
    if (!monthStr) return '';
    const [y, m] = monthStr.split('-');
    if (!y || !m) return monthStr;
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  // Live Current Date Calculations
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  const todayStr = `${year}-${month}-${day}`;
  const currentMonthPrefix = `${year}-${month}`;
  const currentMonthName = now.toLocaleString('default', { month: 'long' });

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  // Separate Khata ledger (shop-owner credit) - never included in sales totals
  const [khataEntries, setKhataEntries] = useState([]);
  const [khataLoading, setKhataLoading] = useState(true);

  // Live clock used to refresh relative payment timestamps
  const [, setRelativeTimeTick] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setRelativeTimeTick((tick) => tick + 1);
    }, 30 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  // Navigation & Filter States
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [pendingFilter, setPendingFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [khataSearchTerm, setKhataSearchTerm] = useState('');
  const [khataSelectedOwner, setKhataSelectedOwner] = useState(null);
  
  // DATE RANGE FILTER STATES
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [appliedRange, setAppliedRange] = useState(null);

  // SALES HISTORY SPECIFIC MONTH/RANGE STATES
  const [historySelectedMonth, setHistorySelectedMonth] = useState(currentMonthPrefix);
  const [historyFilterType, setHistoryFilterType] = useState('Month');
  const [historyStartDate, setHistoryStartDate] = useState(todayStr);
  const [historyEndDate, setHistoryEndDate] = useState(todayStr);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [codModalSale, setCodModalSale] = useState(null);
  const [modalCodPaid, setModalCodPaid] = useState('No');
  const [modalCodType, setModalCodType] = useState('Cash');
  const [detailsModalSale, setDetailsModalSale] = useState(null);
  const [isKhataModalOpen, setIsKhataModalOpen] = useState(false);
  const [editingKhataId, setEditingKhataId] = useState(null);
  const [khataOwnerName, setKhataOwnerName] = useState('');
  const [khataCustomerMode, setKhataCustomerMode] = useState(null); // 'old' | 'new'
  const [khataModalStep, setKhataModalStep] = useState('choose'); // choose | old-list | new-name | purchase
  const [khataOwnerSearch, setKhataOwnerSearch] = useState('');
  const [khataNewCustomerConfirmed, setKhataNewCustomerConfirmed] = useState(false);
  const [khataNote, setKhataNote] = useState('');
  const [khataProfileOwner, setKhataProfileOwner] = useState(null);
  const [khataDesignItems, setKhataDesignItems] = useState([
    { id: Date.now(), designName: '', price: '', sizeQty: { S: 0, M: 0, L: 0, XL: 0 } }
  ]);
  const [khataPaid, setKhataPaid] = useState('No');
  const [khataPaymentType, setKhataPaymentType] = useState('Cash');
  const [pendingActionPin, setPendingActionPin] = useState('');
  const [codActionPin, setCodActionPin] = useState('');

  // Form States
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Advance Payment');
  const [codSubOption, setCodSubOption] = useState('PostEx'); 
  const [localRiderSubOption, setLocalRiderSubOption] = useState('D&D'); 
  const [orderCode, setOrderCode] = useState('');
  const [city, setCity] = useState(''); // Added city state
  
  const [orderItems, setOrderItems] = useState([
    { id: Date.now(), itemName: '', price: '', sizeQty: { S: 0, M: 0, L: 0, XL: 0 } }
  ]);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchSalesData();
    fetchKhataData();
  }, []);

  const fetchSalesData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      console.error('Error fetching sales:', error);
    } else {
      setSales(data || []);
    }
    setLoading(false);
  };

  const fetchKhataData = async () => {
    setKhataLoading(true);
    const { data, error } = await supabase
      .from('khata_entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching Khata:', error);
      setKhataEntries([]);
    } else {
      setKhataEntries(data || []);
    }
    setKhataLoading(false);
  };

  const formatKhataDateTime = (dateValue) => {
    if (!dateValue) return '';
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.toLocaleDateString('default', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })} • ${formatTime12hr(d)}`;
  };

  const handleOpenKhataModal = async () => {
    const pin = await requestActionPin('add a Khata purchase');
    if (!pin) return;
    setPendingActionPin(pin);
    setEditingKhataId(null);
    setKhataOwnerName('');
    setKhataCustomerMode(null);
    setKhataModalStep('choose');
    setKhataOwnerSearch('');
    setKhataNewCustomerConfirmed(false);
    setKhataNote('');
    setKhataDesignItems([{ id: Date.now(), designName: '', price: '', sizeQty: { S: 0, M: 0, L: 0, XL: 0 } }]);
    setKhataPaid('No');
    setKhataPaymentType('Cash');
    setIsKhataModalOpen(true);
  };

  const openKhataPurchaseForOwner = async (ownerName) => {
    const pin = await requestActionPin(`add a Khata purchase for ${ownerName}`);
    if (!pin) return;
    setPendingActionPin(pin);
    setEditingKhataId(null);
    setKhataOwnerName(ownerName);
    setKhataCustomerMode('old');
    setKhataModalStep('purchase');
    setKhataOwnerSearch(ownerName);
    setKhataNewCustomerConfirmed(true);
    setKhataNote('');
    setKhataDesignItems([{ id: Date.now(), designName: '', price: '', sizeQty: { S: 0, M: 0, L: 0, XL: 0 } }]);
    setKhataPaid('No');
    setKhataPaymentType('Cash');
    setKhataProfileOwner(null);
    setIsKhataModalOpen(true);
  };

  const handleEditKhata = async (entry, providedPin = '') => {
    const pin = providedPin || await requestActionPin('edit this Khata entry');
    if (!pin) return;
    setPendingActionPin(pin);
    setKhataProfileOwner(null);

    setEditingKhataId(entry.id);
    setKhataOwnerName(entry.owner_name || '');
    setKhataCustomerMode('old');
    setKhataModalStep('purchase');
    setKhataOwnerSearch('');
    setKhataNewCustomerConfirmed(true);
    setKhataNote(entry.note || '');
    const savedSizeQty = entry.size_qty && typeof entry.size_qty === 'object'
      ? {
          S: Number(entry.size_qty.S) || 0,
          M: Number(entry.size_qty.M) || 0,
          L: Number(entry.size_qty.L) || 0,
          XL: Number(entry.size_qty.XL) || 0
        }
      : { S: 0, M: 0, L: 0, XL: 0 };

    const savedQty = Object.values(savedSizeQty).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
    const fallbackPrice = savedQty > 0 ? (Number(entry.amount) || 0) / savedQty : (Number(entry.amount) || 0);

    setKhataDesignItems([{
      id: Date.now(),
      designName: entry.design_name || '',
      price: String(entry.unit_price ?? fallbackPrice ?? ''),
      sizeQty: savedQty > 0 ? savedSizeQty : { S: 1, M: 0, L: 0, XL: 0 }
    }]);
    setKhataPaid(entry.paid ? 'Yes' : 'No');
    setKhataPaymentType(entry.payment_method || 'Cash');
    setIsKhataModalOpen(true);
  };

  const handleKhataDesignSizeChange = (itemId, sizeKey, value) => {
    const val = parseInt(value, 10);
    setKhataDesignItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? {
              ...item,
              sizeQty: {
                ...item.sizeQty,
                [sizeKey]: Number.isNaN(val) ? 0 : Math.max(0, val)
              }
            }
          : item
      )
    );
  };

  const getKhataItemQty = (item) =>
    Object.values(item?.sizeQty || {}).reduce((sum, qty) => sum + (Number(qty) || 0), 0);

  const getKhataItemAmount = (item) => {
    const qty = getKhataItemQty(item);
    const price = parseFloat(item?.price);
    return Number.isFinite(price) ? qty * price : 0;
  };

  const handleKhataDesignChange = (itemId, field, value) => {
    setKhataDesignItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, [field]: field === 'designName' ? toTitleCase(value) : value }
          : item
      )
    );
  };

  const handleAddKhataDesign = () => {
    setKhataDesignItems(prev => [
      ...prev,
      { id: Date.now() + Math.floor(Math.random() * 1000), designName: '', price: '', sizeQty: { S: 0, M: 0, L: 0, XL: 0 } }
    ]);
  };

  const handleRemoveKhataDesign = (itemId) => {
    if (khataDesignItems.length === 1) return;
    setKhataDesignItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleSubmitKhata = async (e) => {
    e.preventDefault();

    const ownerName = (editingKhataId || khataCustomerMode === 'old')
      ? khataOwnerName.trim()
      : toTitleCase(khataOwnerName.trim());
    if (!ownerName) return alert('Please select or enter the shop owner name.');

    if (!editingKhataId) {
      if (!khataCustomerMode) return alert('Please choose Old Customer or Add New Customer first.');

      if (khataCustomerMode === 'old') {
        const selectedOldOwner = khataOwners.find(owner => owner.name === ownerName);
        if (!selectedOldOwner) return alert('Please select an existing customer from the Old Customer list.');
      }

      if (khataCustomerMode === 'new') {
        if (khataExactOwnerMatch) {
          return alert(`${khataExactOwnerMatch.name} already exists. Please choose Old Customer instead.`);
        }
        if (khataSimilarOwners.length > 0 && !khataNewCustomerConfirmed) {
          return alert('A similar customer already exists. Select that customer or confirm that this is really a new customer.');
        }
      }
    }

    const cleanedDesignItems = khataDesignItems.map(item => {
      const sizeQty = {
        S: Number(item.sizeQty?.S) || 0,
        M: Number(item.sizeQty?.M) || 0,
        L: Number(item.sizeQty?.L) || 0,
        XL: Number(item.sizeQty?.XL) || 0
      };
      const quantity = Object.values(sizeQty).reduce((sum, qty) => sum + qty, 0);
      const unitPrice = parseFloat(item.price);
      const amount = quantity * (Number.isFinite(unitPrice) ? unitPrice : 0);

      return {
        ...item,
        designName: toTitleCase((item.designName || '').trim()),
        sizeQty,
        quantity,
        unitPrice,
        amount
      };
    });

    if (cleanedDesignItems.some(item => !item.designName || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice <= 0)) {
      return alert('Please enter a design name, at least one suit quantity, and a valid price for every design.');
    }

    const pin = pendingActionPin || await requestActionPin(editingKhataId ? 'save this Khata edit' : 'add this Khata entry');
    if (!pin) return;

    try {
      const isNowPaid = khataPaid === 'Yes';

      if (editingKhataId) {
        const existingEntry = khataEntries.find(entry => String(entry.id) === String(editingKhataId));
        const wasPaid = !!existingEntry?.paid;
        const paidAt = isNowPaid
          ? (wasPaid && existingEntry?.paid_at ? existingEntry.paid_at : new Date().toISOString())
          : null;

        const payload = {
          id: editingKhataId,
          owner_name: ownerName,
          design_name: cleanedDesignItems[0].designName,
          unit_price: cleanedDesignItems[0].unitPrice,
          size_qty: cleanedDesignItems[0].sizeQty,
          quantity: cleanedDesignItems[0].quantity,
          amount: cleanedDesignItems[0].amount,
          paid: isNowPaid,
          paid_at: paidAt,
          payment_method: isNowPaid ? khataPaymentType : 'Cash',
          purchase_id: existingEntry?.purchase_id || null,
          note: khataNote.trim()
        };

        const result = await callProtectedMutation('update_khata', { id: editingKhataId, payload }, 'save this Khata edit', pin);
        if (!result.ok) return;
      } else {
        const paidAt = isNowPaid ? new Date().toISOString() : null;
        const purchaseId = `kh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const payloads = cleanedDesignItems.map(item => ({
          owner_name: ownerName,
          design_name: item.designName,
          unit_price: item.unitPrice,
          size_qty: item.sizeQty,
          quantity: item.quantity,
          amount: item.amount,
          paid: isNowPaid,
          paid_at: paidAt,
          payment_method: isNowPaid ? khataPaymentType : 'Cash',
          purchase_id: purchaseId,
          note: khataNote.trim()
        }));

        const result = await callProtectedMutation('insert_khata', { rows: payloads }, 'add this Khata entry', pin);
        if (!result.ok) return;
      }

      setIsKhataModalOpen(false);
      setEditingKhataId(null);
      setPendingActionPin('');
      setKhataNote('');
      setKhataDesignItems([{ id: Date.now(), designName: '', price: '', sizeQty: { S: 0, M: 0, L: 0, XL: 0 } }]);
      await fetchKhataData();
      setKhataProfileOwner(ownerName);
    } catch (error) {
      console.error('Error saving Khata entry:', error);
      alert(`Unable to save Khata entry.\n\n${error?.message || 'Unknown Supabase error'}`);
    }
  };

  const handleDeleteKhata = async (id) => {
    const pin = await requestActionPin('delete this Khata entry');
    if (!pin) return;
    if (!window.confirm('Are you sure you want to delete this Khata entry?')) return;

    const result = await callProtectedMutation('delete_khata', { id }, 'delete this Khata entry', pin);
    if (result.ok) await fetchKhataData();
  };

  const handleExportKhata = () => {
    const dataStr = JSON.stringify(khataEntries, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rizwan-clothing-khata-backup-${todayStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleApplyDateFilter = () => {
    if (startDate && endDate && startDate > endDate) {
      alert('"From" date cannot be after "To" date.');
      return;
    }
    setAppliedRange({ start: startDate, end: endDate });
  };

  const handleResetDateFilter = () => {
    setStartDate(todayStr);
    setEndDate(todayStr);
    setAppliedRange(null);
  };

  const handleExportBackup = () => {
    const dataStr = JSON.stringify(sales, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `rizwan-clothing-backup-${todayStr}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const pin = await requestActionPin('import online sales data');
    if (!pin) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (!Array.isArray(importedData)) {
          alert('Invalid JSON format: Root element must be an array.');
          return;
        }
        setLoading(true);

        const payloads = importedData.map((item, index) => {
          const cleanCustomerName = toTitleCase(item.customerName || item.name || 'Unknown');
          const cleanPaymentMethod = item.paymentMethod || 'Advance Payment';
          let formattedItems = [];

          if (item.items && Array.isArray(item.items)) {
            formattedItems = item.items.map(it => {
              const sizeQty = {
                S: Number(it.sizeQty?.S) || 0,
                M: Number(it.sizeQty?.M) || 0,
                L: Number(it.sizeQty?.L) || 0,
                XL: Number(it.sizeQty?.XL) || 0
              };
              const q = Object.values(sizeQty).reduce((a, b) => a + b, 0);
              const p = parseFloat(it.price || 0);
              return {
                itemName: toTitleCase(it.itemName || it.design || 'Design'),
                price: p,
                sizeQty,
                itemTotalQty: q,
                itemTotalAmount: q * p
              };
            });
          } else {
            const sizes = item.sizes || { S: 0, M: 0, L: 0, XL: 0 };
            const sizeQty = {
              S: Number(sizes.S) || 0,
              M: Number(sizes.M) || 0,
              L: Number(sizes.L) || 0,
              XL: Number(sizes.XL) || 0
            };
            const price = parseFloat(item.price || 0);
            const q = Object.values(sizeQty).reduce((a, b) => a + b, 0);
            formattedItems = [{
              itemName: toTitleCase(item.design || item.itemName || 'Design'),
              price,
              sizeQty,
              itemTotalQty: q,
              itemTotalAmount: q * price
            }];
          }

          const totalQty = formattedItems.reduce((acc, curr) => acc + curr.itemTotalQty, 0);
          const totalAmount = formattedItems.reduce((acc, curr) => acc + curr.itemTotalAmount, 0);
          const nowIso = item.isoDate || todayStr;
          const nextOrderNum = sales.length > 0
            ? Math.max(...sales.map(s => Number(s.orderNumber) || 0)) + 1 + index
            : 1 + index;

          return {
            id: item.id ? Number(item.id) : Date.now() + index,
            orderNumber: nextOrderNum,
            customerName: cleanCustomerName,
            paymentMethod: cleanPaymentMethod,
            cod_sub_option: item.cod_sub_option || 'PostEx',
            local_rider_sub_option: item.local_rider_sub_option || 'D&D',
            orderCode: item.orderCode || '',
            city: item.city || '',
            cod_paid: item.cod_paid || 'No',
            cod_payment_type: item.cod_payment_type || 'Cash',
            cod_paid_at: item.cod_paid_at || null,
            items: formattedItems,
            totalQty,
            totalAmount,
            dateStr: nowIso,
            displayDate: item.date || nowIso,
            displayTime: item.time || '12:00 PM',
            isEdited: false
          };
        });

        const result = await callProtectedMutation('upsert_sales', { rows: payloads }, 'import online sales data', pin);
        if (!result.ok) return;

        alert(`Successfully imported ${payloads.length} orders!`);
        await fetchSalesData();
      } catch (err) {
        console.error(err);
        alert('Error reading or importing JSON file.');
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleItemSizeChange = (itemId, sizeKey, value) => {
    const val = parseInt(value, 10);
    setOrderItems(prevItems =>
      prevItems.map(item => item.id === itemId ? { ...item, sizeQty: { ...item.sizeQty, [sizeKey]: isNaN(val) ? 0 : Math.max(0, val) } } : item)
    );
  };

  const handleItemFieldChange = (itemId, field, value) => {
    setOrderItems(prevItems =>
      prevItems.map(item => item.id === itemId ? { ...item, [field]: field === 'itemName' ? toTitleCase(value) : value } : item)
    );
  };

  const handleAddAnotherDesign = () => {
    setOrderItems(prev => [...prev, { id: Date.now(), itemName: '', price: '', sizeQty: { S: 0, M: 0, L: 0, XL: 0 } }]);
  };

  const handleRemoveDesignItem = (itemId) => {
    if (orderItems.length === 1) return alert('An order must have at least one design.');
    setOrderItems(prev => prev.filter(item => item.id !== itemId));
  };

  const closeSaleModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setPendingActionPin('');
  };

  const closeKhataModal = () => {
    setIsKhataModalOpen(false);
    setEditingKhataId(null);
    setKhataOwnerName('');
    setKhataCustomerMode(null);
    setKhataModalStep('choose');
    setKhataOwnerSearch('');
    setKhataNewCustomerConfirmed(false);
    setKhataNote('');
    setPendingActionPin('');
  };

  const closeCodModal = () => {
    setCodModalSale(null);
    setCodActionPin('');
  };

  const handleOpenAddModal = async () => {
    const pin = await requestActionPin('add a new online order');
    if (!pin) return;
    setPendingActionPin(pin);

    setEditingId(null);
    setCustomerName('');
    setPaymentMethod('Advance Payment');
    setCodSubOption('PostEx');
    setLocalRiderSubOption('D&D');
    setOrderCode('');
    setCity('');
    setOrderItems([{ id: Date.now(), itemName: '', price: '', sizeQty: { S: 0, M: 0, L: 0, XL: 0 } }]);
    setIsModalOpen(true);
  };

  const handleEditClick = async (sale) => {
    const pin = await requestActionPin('edit this online order');
    if (!pin) return;
    setPendingActionPin(pin);

    setEditingId(sale.id);
    setCustomerName(sale.customerName);
    setPaymentMethod(sale.paymentMethod || 'Advance Payment');
    setCodSubOption(sale.cod_sub_option || sale.codSubOption || 'PostEx');
    setLocalRiderSubOption(sale.local_rider_sub_option || sale.localRiderSubOption || 'D&D');
    setOrderCode(sale.orderCode || '');
    setCity(sale.city || '');

    if (sale.items && sale.items.length > 0) {
      setOrderItems(sale.items.map((it, idx) => ({
        id: Date.now() + idx,
        itemName: it.itemName,
        price: it.price?.toString() || '',
        sizeQty: { S: Number(it.sizeQty?.S) || 0, M: Number(it.sizeQty?.M) || 0, L: Number(it.sizeQty?.L) || 0, XL: Number(it.sizeQty?.XL) || 0 }
      })));
    } else {
      setOrderItems([{ id: Date.now(), itemName: sale.itemName || '', price: sale.price?.toString() || '', sizeQty: { ...sale.sizeQty } }]);
    }
    setIsModalOpen(true);
  };

  const handleUpdateCodStatus = async (saleId, newPaid, newType, providedPin = '') => {
    const pin = providedPin || codActionPin || await requestActionPin('change this online order payment status');
    if (!pin) return false;

    const currentPaidAt = newPaid === 'Yes' ? new Date().toISOString() : null;
    const result = await callProtectedMutation('update_cod', {
      saleId,
      cod_paid: newPaid,
      cod_payment_type: newPaid === 'Yes' ? newType : 'Cash',
      cod_paid_at: currentPaidAt
    }, 'change this online order payment status', pin);

    if (result.ok) {
      await fetchSalesData();
      return true;
    }
    return false;
  };

  const handleSaveCodModal = async () => {
    if (!codModalSale) return;
    const pin = codActionPin || await requestActionPin('save this online order payment status');
    if (!pin) return;
    const ok = await handleUpdateCodStatus(codModalSale.id, modalCodPaid, modalCodType, pin);
    if (ok) closeCodModal();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerName.trim()) return;

    const isCod = paymentMethod === 'Cash on Delivery';
    const isPostEx = isCod && codSubOption === 'PostEx';
    const isLocalRider = isCod && codSubOption === 'Local Rider';

    if (isPostEx && !orderCode.trim()) return alert('Please enter an order code for PostEx.');
    if (isLocalRider && !city.trim()) return alert('Please enter a city for the Local Rider.');

    let totalQty = 0;
    let totalAmount = 0;
    const formattedItems = orderItems.map(item => {
      const q = Object.values(item.sizeQty).reduce((a, b) => a + b, 0);
      const p = parseFloat(item.price);
      const amt = q * p;
      totalQty += q;
      totalAmount += amt;
      return { itemName: toTitleCase(item.itemName.trim()), price: p, sizeQty: { ...item.sizeQty }, itemTotalQty: q, itemTotalAmount: amt };
    });

    if (formattedItems.some(item => !item.itemName || !Number.isFinite(item.price) || item.price <= 0 || item.itemTotalQty <= 0)) {
      return alert('Please enter a design name, a valid unit price, and at least one suit quantity for every design.');
    }

    const pin = pendingActionPin || await requestActionPin(editingId ? 'save this online order edit' : 'add this online order');
    if (!pin) return;

    const currentDate = new Date();

    try {
      if (editingId) {
        const existingSale = sales.find(s => s.id === editingId);
        const updatedData = {
          customerName: toTitleCase(customerName.trim()),
          paymentMethod,
          cod_sub_option: isCod ? codSubOption : '',
          local_rider_sub_option: isLocalRider ? localRiderSubOption : '',
          orderCode: isPostEx ? orderCode.trim() : '',
          city: isLocalRider ? toTitleCase(city.trim()) : '',
          cod_paid: isCod ? (existingSale?.cod_paid || 'No') : 'No',
          cod_payment_type: isCod ? (existingSale?.cod_payment_type || 'Cash') : 'Cash',
          cod_paid_at: isCod ? (existingSale?.cod_paid_at || null) : null,
          items: formattedItems,
          totalQty,
          totalAmount,
          isEdited: true,
        };

        const result = await callProtectedMutation('update_sale', { id: editingId, payload: updatedData }, 'save this online order edit', pin);
        if (!result.ok) return;
      } else {
        const nextOrderNum = sales.length > 0
          ? Math.max(...sales.map(s => Number(s.orderNumber) || 0)) + 1
          : 1;

        const newSale = {
          id: Date.now(),
          orderNumber: nextOrderNum,
          customerName: toTitleCase(customerName.trim()),
          paymentMethod,
          cod_sub_option: isCod ? codSubOption : '',
          local_rider_sub_option: isLocalRider ? localRiderSubOption : '',
          orderCode: isPostEx ? orderCode.trim() : '',
          city: isLocalRider ? toTitleCase(city.trim()) : '',
          cod_paid: 'No',
          cod_payment_type: 'Cash',
          cod_paid_at: null,
          items: formattedItems,
          totalQty,
          totalAmount,
          dateStr: todayStr,
          displayDate: currentDate.toLocaleDateString(),
          displayTime: formatTime12hr(currentDate),
          isEdited: false,
        };

        const result = await callProtectedMutation('insert_sale', { row: newSale }, 'add this online order', pin);
        if (!result.ok) return;
      }

      await fetchSalesData();
      closeSaleModal();
    } catch (error) {
      console.error('Error saving order:', error);
      alert(`Unable to save order.\n\n${error?.message || 'Unknown Supabase error'}`);
    }
  };

  const handleDelete = async (id) => {
    const pin = await requestActionPin('delete this online order');
    if (!pin) return;
    if (!window.confirm('Are you sure you want to delete this order?')) return;

    const result = await callProtectedMutation('delete_sale', { id }, 'delete this online order', pin);
    if (result.ok) await fetchSalesData();
  };

  // DYNAMIC FILTERING & KPI CALCULATIONS
  const dateFilteredSales = sales.filter(s => {
    if (appliedRange) {
      if (appliedRange.start && s.dateStr && s.dateStr < appliedRange.start) return false;
      if (appliedRange.end && s.dateStr && s.dateStr > appliedRange.end) return false;
      return true;
    } else {
      return s.dateStr && s.dateStr.startsWith(currentMonthPrefix);
    }
  });

  const displayRevenue = dateFilteredSales.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
  const displayItemsSold = dateFilteredSales.reduce((acc, curr) => acc + (curr.totalQty || 0), 0);
  const displayOrdersCount = dateFilteredSales.length;

  const todaysSales = sales.filter(s => s.dateStr === todayStr);
  const todaysRevenue = todaysSales.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

  // PENDING PAYMENTS CALCULATIONS
  const pendingSales = sales.filter(s => s.paymentMethod === 'Cash on Delivery' && (s.cod_paid || s.codPaid || 'No') === 'No');
  const globalPendingCount = pendingSales.length;

  const displayedPendingSales = pendingSales.filter(s => {
    const subOpt = s.cod_sub_option || s.codSubOption;
    const riderOpt = s.local_rider_sub_option || s.localRiderSubOption;
    if (pendingFilter === 'PostEx') return subOpt === 'PostEx';
    if (pendingFilter === 'D&D') return subOpt === 'Local Rider' && riderOpt === 'D&D';
    if (pendingFilter === 'Service Delivery') return subOpt === 'Local Rider' && riderOpt !== 'D&D';
    return true;
  });

  const displayedPendingCount = displayedPendingSales.length;
  const displayedPendingAmount = displayedPendingSales.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

  const getEntryQtyFallback = (entry) => {
    if (entry?.size_qty && typeof entry.size_qty === 'object') {
      const qty = Object.values(entry.size_qty).reduce((sum, value) => sum + (Number(value) || 0), 0);
      if (qty > 0) return qty;
    }
    return Number(entry?.quantity) || 1;
  };

  // KHATA CALCULATIONS (fully separate from Online Sales)
  const getKhataPurchaseKey = (entry) => entry?.purchase_id || `legacy-${entry?.id}`;

  const groupKhataPurchases = (entries = []) => {
    const groups = {};

    entries.forEach(entry => {
      const key = getKhataPurchaseKey(entry);
      if (!groups[key]) {
        groups[key] = {
          id: key,
          created_at: entry.created_at,
          note: entry.note || '',
          entries: [],
          totalAmount: 0,
          totalQty: 0
        };
      }

      groups[key].entries.push(entry);
      groups[key].totalAmount += Number(entry.amount) || 0;
      groups[key].totalQty += Number(entry.quantity) || getEntryQtyFallback(entry);
      if (!groups[key].note && entry.note) groups[key].note = entry.note;
    });

    return Object.values(groups).sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
  };

  const khataOwnerMap = {};
  khataEntries.forEach(entry => {
    const ownerName = (entry.owner_name || 'Unknown Owner').trim();

    if (!khataOwnerMap[ownerName]) {
      khataOwnerMap[ownerName] = {
        name: ownerName,
        pending: 0,
        total: 0,
        purchaseKeys: new Set()
      };
    }

    const amount = Number(entry.amount) || 0;
    khataOwnerMap[ownerName].total += amount;
    khataOwnerMap[ownerName].purchaseKeys.add(getKhataPurchaseKey(entry));

    if (!entry.paid) {
      khataOwnerMap[ownerName].pending += amount;
    }
  });

  const khataOwners = Object.values(khataOwnerMap)
    .map(owner => ({
      name: owner.name,
      pending: owner.pending,
      total: owner.total,
      count: owner.purchaseKeys.size
    }))
    .sort((a, b) => {
      if (b.pending !== a.pending) return b.pending - a.pending;
      return a.name.localeCompare(b.name);
    });

  const khataProfileEntries = khataProfileOwner
    ? khataEntries.filter(entry => entry.owner_name === khataProfileOwner)
    : [];
  const khataProfilePurchases = groupKhataPurchases(khataProfileEntries);
  const khataProfileSummary = khataProfileOwner
    ? (khataOwners.find(owner => owner.name === khataProfileOwner) || null)
    : null;

  const normalizeKhataOwnerName = (value = '') =>
    value.toLowerCase().replace(/[^a-z0-9]/g, '');

  const khataNameDistance = (a, b) => {
    const x = normalizeKhataOwnerName(a);
    const y = normalizeKhataOwnerName(b);
    const matrix = Array.from({ length: x.length + 1 }, () => Array(y.length + 1).fill(0));
    for (let i = 0; i <= x.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= y.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= x.length; i++) {
      for (let j = 1; j <= y.length; j++) {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1)
        );
      }
    }
    return matrix[x.length][y.length];
  };

  const khataOldCustomerMatches = khataOwners.filter(owner => {
    const query = khataOwnerSearch.trim().toLowerCase();
    return !query || owner.name.toLowerCase().includes(query);
  });

  const normalizedNewKhataOwner = normalizeKhataOwnerName(khataOwnerName);
  const khataExactOwnerMatch = normalizedNewKhataOwner
    ? khataOwners.find(owner => normalizeKhataOwnerName(owner.name) === normalizedNewKhataOwner)
    : null;

  const khataSimilarOwners = khataOwnerName.trim().length >= 2
    ? khataOwners.filter(owner => {
        const existing = normalizeKhataOwnerName(owner.name);
        if (!existing || existing === normalizedNewKhataOwner) return false;
        const longest = Math.max(existing.length, normalizedNewKhataOwner.length);
        const distance = khataNameDistance(existing, normalizedNewKhataOwner);
        return (
          existing.includes(normalizedNewKhataOwner) ||
          normalizedNewKhataOwner.includes(existing) ||
          distance <= 1 ||
          (longest >= 7 && distance <= 2)
        );
      }).slice(0, 5)
    : [];

  const khataCustomerReady = Boolean(
    editingKhataId ||
    (khataCustomerMode === 'old' && khataOwnerName.trim()) ||
    (
      khataCustomerMode === 'new' &&
      khataOwnerName.trim() &&
      !khataExactOwnerMatch &&
      (khataSimilarOwners.length === 0 || khataNewCustomerConfirmed)
    )
  );

  const khataPendingTotal = khataEntries.reduce(
    (acc, entry) => acc + (!entry.paid ? (Number(entry.amount) || 0) : 0),
    0
  );

  const khataPendingOwners = khataOwners.filter(owner => owner.pending > 0).length;

  const khataFilteredEntries = khataEntries.filter(entry => {
    const matchesOwner = !khataSelectedOwner || entry.owner_name === khataSelectedOwner;
    const query = khataSearchTerm.toLowerCase().trim();

    const matchesSearch =
      !query ||
      (entry.owner_name && entry.owner_name.toLowerCase().includes(query)) ||
      (entry.design_name && entry.design_name.toLowerCase().includes(query));

    return matchesOwner && matchesSearch;
  });

  // DESIGN NAME SUGGESTIONS
  // Built from Supabase-backed sales + Khata history, so the same saved designs
  // appear as suggestions on any laptop/device using this project.
  const designSuggestions = Array.from(new Set([
    ...sales.flatMap(sale => (sale.items || []).map(item => toTitleCase((item.itemName || '').trim()))),
    ...khataEntries.map(entry => toTitleCase((entry.design_name || '').trim()))
  ].filter(Boolean))).sort((a, b) => a.localeCompare(b));

  // D&D PARCELS CALCULATIONS
  // Uses existing Online Sales records only. No separate table is created.
  // With no date filter, this includes the complete historical D&D record.
  const allDndParcels = sales.filter(sale => {
    const paymentMethodValue = sale.paymentMethod || '';
    const codOption = sale.cod_sub_option || sale.codSubOption || '';
    const riderOption = sale.local_rider_sub_option || sale.localRiderSubOption || '';

    return paymentMethodValue === 'Cash on Delivery' &&
      codOption === 'Local Rider' &&
      riderOption === 'D&D';
  });

  const dndRangeFiltered = allDndParcels.filter(sale => {
    if (!appliedRange) return true;
    if (appliedRange.start && sale.dateStr && sale.dateStr < appliedRange.start) return false;
    if (appliedRange.end && sale.dateStr && sale.dateStr > appliedRange.end) return false;
    return true;
  });

  const dndDisplayedParcels = dndRangeFiltered.filter(sale => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return true;

    return (
      (sale.customerName && sale.customerName.toLowerCase().includes(query)) ||
      (sale.city && sale.city.toLowerCase().includes(query)) ||
      (sale.items && sale.items.some(item => item.itemName && item.itemName.toLowerCase().includes(query))) ||
      String(sale.orderNumber || '').includes(query)
    );
  });

  const dndTotalParcels = dndRangeFiltered.length;
  const dndTotalAmount = dndRangeFiltered.reduce((sum, sale) => sum + (Number(sale.totalAmount) || 0), 0);
  const dndTotalSuits = dndRangeFiltered.reduce((sum, sale) => sum + (Number(sale.totalQty) || 0), 0);
  const dndPaidCount = dndRangeFiltered.filter(sale => (sale.cod_paid || sale.codPaid || 'No') === 'Yes').length;
  const dndPendingCount = dndTotalParcels - dndPaidCount;

  const dndCityMap = {};
  dndRangeFiltered.forEach(sale => {
    const rawCity = (sale.city || '').trim();
    const cityName = rawCity || 'Unknown City';

    if (!dndCityMap[cityName]) {
      dndCityMap[cityName] = { city: cityName, parcels: 0, suits: 0, amount: 0 };
    }

    dndCityMap[cityName].parcels += 1;
    dndCityMap[cityName].suits += Number(sale.totalQty) || 0;
    dndCityMap[cityName].amount += Number(sale.totalAmount) || 0;
  });

  const dndCityStats = Object.values(dndCityMap).sort((a, b) => {
    if (b.parcels !== a.parcels) return b.parcels - a.parcels;
    return b.amount - a.amount;
  });

  const dndTopCity = dndCityStats.length > 0 ? dndCityStats[0] : null;

  // SALES HISTORY CALCULATIONS
  const salesHistoryFiltered = sales.filter(s => {
    if (historyFilterType === 'Month') {
      return s.dateStr && s.dateStr.startsWith(historySelectedMonth);
    } else {
      if (historyStartDate && s.dateStr && s.dateStr < historyStartDate) return false;
      if (historyEndDate && s.dateStr && s.dateStr > historyEndDate) return false;
      return true;
    }
  });

  const historyTotalRevenue = salesHistoryFiltered.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
  const historyTotalOrders = salesHistoryFiltered.length;
  const historyTotalItemsSold = salesHistoryFiltered.reduce((acc, curr) => acc + (curr.totalQty || 0), 0);

  const historyDesignCounts = {};
  salesHistoryFiltered.forEach(sale => {
    if (sale.items) sale.items.forEach(it => {
      historyDesignCounts[it.itemName] = (historyDesignCounts[it.itemName] || 0) + (it.itemTotalQty || 0);
    });
  });
  const historyTopDesigns = Object.entries(historyDesignCounts).sort((a, b) => b[1] - a[1]);
  const historyTopDesignName = historyTopDesigns.length > 0 ? historyTopDesigns[0][0] : 'None';
  const historyTopDesignQty = historyTopDesigns.length > 0 ? historyTopDesigns[0][1] : 0;

  const revenueLabel = appliedRange 
    ? (appliedRange.start === appliedRange.end 
        ? `Revenue (${formatReadableDate(appliedRange.start)})` 
        : `Revenue (${formatReadableDate(appliedRange.start)} to ${formatReadableDate(appliedRange.end)})`)
    : `Revenue (${currentMonthName})`;

  const revenueSubtext = appliedRange 
    ? `Sales for selected date range` 
    : `Sales in ${currentMonthName}`;

  const recentOrders = dateFilteredSales.filter(s => {
    const query = searchTerm.toLowerCase().trim();
    return query === '' || 
      (s.customerName && s.customerName.toLowerCase().includes(query)) ||
      (s.paymentMethod && s.paymentMethod.toLowerCase().includes(query)) ||
      (s.orderCode && s.orderCode.toLowerCase().includes(query)) ||
      (s.city && s.city.toLowerCase().includes(query)) ||
      (s.items && s.items.some(it => it.itemName && it.itemName.toLowerCase().includes(query))) ||
      String(s.orderNumber).includes(query);
  });

  const filteredSales = sales.filter(s => {
    if (appliedRange) {
      if (appliedRange.start && s.dateStr && s.dateStr < appliedRange.start) return false;
      if (appliedRange.end && s.dateStr && s.dateStr > appliedRange.end) return false;
    }

    if (activeTab === 'Pending Payments') {
      if (s.paymentMethod !== 'Cash on Delivery' || (s.cod_paid || s.codPaid || 'No') === 'Yes') return false;
      const subOpt = s.cod_sub_option || s.codSubOption;
      const riderOpt = s.local_rider_sub_option || s.localRiderSubOption;
      if (pendingFilter === 'PostEx' && subOpt !== 'PostEx') return false;
      if (pendingFilter === 'D&D' && (subOpt !== 'Local Rider' || riderOpt !== 'D&D')) return false;
      if (pendingFilter === 'Service Delivery' && (subOpt !== 'Local Rider' || riderOpt === 'D&D')) return false;
    }
    if (activeTab === 'PostEx Orders' && (s.paymentMethod !== 'Cash on Delivery' || (s.cod_sub_option || s.codSubOption) !== 'PostEx')) return false;
    
    const query = searchTerm.toLowerCase().trim();
    return query === '' || 
      (s.customerName && s.customerName.toLowerCase().includes(query)) ||
      (s.paymentMethod && s.paymentMethod.toLowerCase().includes(query)) ||
      (s.orderCode && s.orderCode.toLowerCase().includes(query)) ||
      (s.city && s.city.toLowerCase().includes(query)) ||
      (s.items && s.items.some(it => it.itemName && it.itemName.toLowerCase().includes(query))) ||
      String(s.orderNumber).includes(query);
  });

  const designCounts = {};
  filteredSales.forEach(sale => {
    if (sale.items) sale.items.forEach(it => {
      designCounts[it.itemName] = (designCounts[it.itemName] || 0) + (it.itemTotalQty || 0);
    });
  });
  const topDesigns = Object.entries(designCounts).sort((a, b) => b[1] - a[1]);

  const renderOrdersTable = (ordersToRender = filteredSales) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 bg-gray-50/50">
              <th className="py-4 px-2 sm:px-6 w-[34%] sm:w-auto">Product name & Customer</th>
              <th className="py-4 px-2 sm:px-6 w-[20%] sm:w-auto">Sizes</th>
              <th className="py-4 px-2 sm:px-6 w-[12%] sm:w-auto">Total Qty</th>
              <th className="py-4 px-2 sm:px-6 w-[19%] sm:w-auto">Amount</th>
              <th className="py-4 px-2 sm:px-6 text-right w-[15%] sm:w-auto">Action</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {ordersToRender.length > 0 ? (
              ordersToRender.map((sale) => {
                const currentCodPaid = sale.cod_paid || sale.codPaid || 'No';
                const currentCodType = sale.cod_payment_type || sale.codPaymentType || 'Cash';
                const currentPaidAt = sale.cod_paid_at || sale.codPaidAt;

                return (
                  <tr key={sale.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-2 sm:py-4 sm:px-6 align-top break-words">
                      <div className="flex flex-col gap-1">
                         <button onClick={() => setDetailsModalSale(sale)} className="text-left font-bold text-gray-900 hover:text-purple-600 transition-colors text-sm sm:text-base break-words">
                           {sale.customerName}
                         </button>
                         
                         <div className="flex flex-wrap items-center gap-2 mt-0.5">
                           <span className="text-xs font-medium text-gray-500">{sale.displayDate}</span>
                           
                           {sale.paymentMethod === 'Advance Payment' ? (
                             <div className="flex flex-col">
                               <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded text-[11px] font-bold tracking-wide uppercase">Advance</span>
                             </div>
                           ) : (
                             <div className="flex gap-1.5 items-center">
                               <span className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded text-[11px] font-bold tracking-wide uppercase">COD</span>
                               <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-[11px] font-bold tracking-wide uppercase">
                                 {sale.cod_sub_option === 'Local Rider' ? (sale.local_rider_sub_option || 'D&D') : 'PostEx'}
                               </span>
                               {sale.orderCode && <span className="text-xs text-gray-500 font-medium">({sale.orderCode})</span>}
                             </div>
                           )}
                         </div>

                         <div className="mt-2 flex flex-col gap-1">
                           {(sale.items || []).map((it, idx) => (
                             <div key={idx} className="text-sm">
                                <span className="font-bold text-blue-600">{it.itemName}</span>
                                <span className="text-gray-500 text-xs ml-1 font-medium">- PKR {it.price}</span>
                             </div>
                           ))}
                         </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 sm:py-4 sm:px-6 align-top text-gray-600 break-words">
                      <div className="flex flex-col gap-2 mt-1">
                        {(sale.items || []).map((it, idx) => (
                          <div key={idx} className="flex gap-1.5 flex-wrap">
                            {it.sizeQty && Object.entries(it.sizeQty).map(([sz, qty]) => 
                              qty > 0 ? (
                                <span key={sz} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-md font-medium">
                                  {sz}: {qty}
                                </span>
                              ) : null
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-2 sm:py-4 sm:px-6 font-medium text-gray-900 align-top mt-1 break-words">{sale.totalQty}</td>
                    
                    <td className="py-3 px-2 sm:py-4 sm:px-6 font-bold text-gray-900 align-top text-xs sm:text-base break-words">
                      PKR {(sale.totalAmount || 0).toLocaleString()}
                    </td>
                    
                    <td className="py-3 px-1 sm:py-4 sm:px-6 text-right align-top">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex gap-1 sm:gap-2 justify-end">
                          <button onClick={() => handleEditClick(sale)} className="text-gray-400 hover:text-purple-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                          </button>
                          <button onClick={() => handleDelete(sale.id)} className="text-gray-400 hover:text-red-500">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </div>
                        
                        {sale.paymentMethod === 'Cash on Delivery' && (
                          <div className="flex flex-col items-end mt-1">
                            <button
                              onClick={async () => {
                                const pin = await requestActionPin('change this online payment status');
                                if (!pin) return;
                                setCodActionPin(pin);
                                setCodModalSale(sale);
                                setModalCodPaid(sale.cod_paid || 'No');
                                setModalCodType(sale.cod_payment_type || 'Cash');
                              }}
                              className={`px-3 py-1 rounded-full text-[11px] uppercase tracking-wide font-bold flex items-center gap-1 transition-colors ${currentCodPaid === 'No' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                            >
                              {currentCodPaid === 'No' ? 'Unpaid' : `Paid (${currentCodType})`}
                            </button>

                            {/* RELATIVE TIME AGO TEXT UNDER PAID BUTTON */}
                            {currentCodPaid === 'Yes' && (
                              <span className="text-[10px] text-gray-400 font-semibold mt-1 italic">
                                {timeAgo(currentPaidAt || sale.id)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="5" className="py-8 text-center text-gray-400 text-sm font-medium">
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F8F9FB] font-sans text-gray-800">
      {pinModal.open && (
        <div className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c1.657 0 3-1.343 3-3V6a3 3 0 10-6 0v2c0 1.657 1.343 3 3 3zm0 0v2m-7 8h14a2 2 0 002-2v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Admin PIN Required</h2>
              <p className="text-sm text-gray-500 mt-1">Enter your 4-digit PIN to {pinModal.actionLabel}.</p>
            </div>

            <div className="px-6 pb-6">
              <input
                autoFocus
                disabled={pinModal.verifying}
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pinModal.value}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPinModal((prev) => ({ ...prev, value: digits, error: '' }));
                }}
                onKeyDown={(e) => {
                  if (pinModal.verifying) return;
                  if (e.key === 'Enter') submitPinModal();
                  if (e.key === 'Escape') closePinModal();
                }}
                placeholder="••••"
                className="w-full text-center text-3xl tracking-[0.6em] font-black px-4 py-4 rounded-2xl border-2 border-gray-200 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition"
              />
              {pinModal.error && (
                <p className="mt-2 text-center text-xs font-semibold text-red-600">{pinModal.error}</p>
              )}
              <p className="mt-3 text-center text-xs text-gray-400">Once unlocked, you won't be asked again until this browser tab is closed.</p>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <button
                  type="button"
                  onClick={closePinModal}
                  disabled={pinModal.verifying}
                  className="px-4 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitPinModal}
                  disabled={pinModal.verifying}
                  className="px-4 py-3 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 shadow-sm transition disabled:opacity-60 disabled:cursor-wait"
                >
                  {pinModal.verifying ? 'Checking...' : 'Unlock'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" style={{ display: 'none' }} />

      <datalist id="design-name-suggestions">
        {designSuggestions.map((designName) => (
          <option key={designName} value={designName} />
        ))}
      </datalist>

      {/* LEFT SIDEBAR */}
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
        />
      )}

      <aside className={`fixed inset-y-0 left-0 w-72 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 z-40 transform transition-transform duration-200 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:z-10 md:translate-x-0`}>
        <div className="h-20 flex items-center px-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">R</div>
            <span className="text-sm font-bold text-gray-900 tracking-tight leading-snug">Rizwan clothing online sales Inventory</span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          {[
            { name: 'Analytics', id: 'Dashboard', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
            { name: 'Customer Orders', id: 'Orders', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
            { name: 'PostEx COD Orders', id: 'PostEx Orders', icon: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4' },
            { name: 'D&D Parcels', id: 'D&D Parcels', icon: 'M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7M12 11v10' },
            { name: 'Pending Payments', id: 'Pending Payments', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
            { name: 'Khata', id: 'Khata', icon: 'M3 10h18M5 10V21M19 10V21M4 21h16M12 3l8 4H4l8-4zm-4 7v6m8-6v6' },
            { name: 'Sales History', id: 'Sales History', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
            { name: 'Top Selling Designs', id: 'Top Selling Designs', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
            { name: 'Items Sold', id: 'Items Sold', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-purple-50 text-purple-700 font-semibold relative after:absolute after:left-0 after:top-2 after:bottom-2 after:w-1 after:bg-purple-600 after:rounded-r-full' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 font-medium'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon}></path></svg>
              <span>{item.name}</span>
              {item.id === 'Pending Payments' && globalPendingCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                  {globalPendingCount}
                </span>
              )}
              {item.id === 'Khata' && khataPendingOwners > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                  {khataPendingOwners}
                </span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-hidden w-full min-w-0">
        <header className="min-h-20 bg-white border-b border-gray-100 flex items-center justify-between gap-3 px-4 sm:px-6 md:px-8 py-3 z-10 shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden w-10 h-10 shrink-0 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
              </svg>
            </button>
            <div className="flex-1 max-w-md relative min-w-0">
            <svg className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input 
              type="text" 
              placeholder={
                activeTab === 'Khata'
                  ? 'Search shop owners or designs...'
                  : activeTab === 'D&D Parcels'
                    ? 'Search D&D parcels by customer, city, design or order...'
                    : 'Search orders, customers, or cities...'
              }
              value={activeTab === 'Khata' ? khataSearchTerm : searchTerm}
              onChange={(e) => activeTab === 'Khata' ? setKhataSearchTerm(e.target.value) : setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-purple-600 outline-none"
            />
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-6 ml-4">
            <div className="flex items-center gap-3 border-l border-gray-200 pl-6">
              <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold">AR</div>
              <span className="font-semibold text-sm hidden sm:block">Abdur Rahman</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-8">
          
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 md:mb-8 gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">{activeTab === 'Dashboard' ? 'Morning, Abdur!' : activeTab}</h1>
              <p className="text-sm text-gray-500 mt-1">{activeTab === 'Dashboard' ? "Here's what's happening with your store today." : `Manage your ${activeTab.toLowerCase()} data.`}</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
              {activeTab !== 'Sales History' && activeTab !== 'Dashboard' && activeTab !== 'Khata' && (
                <div className="w-full xl:w-auto flex flex-wrap items-center gap-2 bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-sm">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider hidden sm:inline">From</span>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm border-none outline-none text-gray-700 bg-transparent cursor-pointer font-medium flex-1 min-w-[130px]" />
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 hidden sm:inline">To</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm border-none outline-none text-gray-700 bg-transparent cursor-pointer font-medium flex-1 min-w-[130px]" />
                  
                  <button 
                    onClick={handleApplyDateFilter}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-sm transition-colors ml-1"
                  >
                    Submit
                  </button>

                  {appliedRange && (
                    <button 
                      onClick={handleResetDateFilter}
                      className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors text-xs font-bold ml-1" 
                      title="Reset to current month"
                    >
                      Reset
                    </button>
                  )}
                </div>
              )}

              {activeTab === 'Khata' ? (
                <>
                  <button onClick={handleExportKhata} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-colors flex-1 sm:flex-none">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                    Export Khata
                  </button>
                  <button onClick={handleOpenKhataModal} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors flex items-center justify-center flex-1 sm:flex-none">
                    + Add Khata Entry
                  </button>
                </>
              ) : (
                <>
                  <button onClick={handleExportBackup} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-colors flex-1 sm:flex-none">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                    Export
                  </button>
                  <button onClick={handleOpenAddModal} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors flex items-center justify-center flex-1 sm:flex-none">
                    + New Order
                  </button>
                </>
              )}
            </div>
          </div>

          {activeTab === 'Dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-50/90 p-6 rounded-2xl border-2 border-gray-200 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-4">
                    <div className="p-1.5 bg-green-100 text-green-700 rounded-md">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                    {revenueLabel}
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">PKR {displayRevenue.toLocaleString()}</h2>
                    <p className="text-sm font-medium text-green-600 mt-2">{revenueSubtext}</p>
                  </div>
                </div>

                <div className="bg-slate-50/90 p-6 rounded-2xl border-2 border-gray-200 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-4">
                    <div className="p-1.5 bg-blue-100 text-blue-700 rounded-md">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012-2h-2a2 2 0 01-2-2z"></path></svg>
                    </div>
                    {appliedRange ? 'Selected Period Sales' : "Today's Sales"}
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">
                      PKR {(appliedRange ? displayRevenue : todaysRevenue).toLocaleString()}
                    </h2>
                    <p className="text-sm font-medium text-blue-600 mt-2">
                      {appliedRange ? `${displayOrdersCount} orders in range` : `${todaysSales.length} orders today`}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50/90 p-6 rounded-2xl border-2 border-gray-200 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-4">
                     <div className="p-1.5 bg-purple-100 text-purple-700 rounded-md">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                     </div>
                     Items Sold
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">{displayItemsSold}</h2>
                    <p className="text-sm font-medium text-gray-500 mt-2">
                      {appliedRange ? 'In selected date range' : `Total volume in ${currentMonthName}`}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50/90 p-6 rounded-2xl border-2 border-gray-200 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-4">
                     <div className="p-1.5 bg-orange-100 text-orange-700 rounded-md">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                     </div>
                     Total Orders
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">{displayOrdersCount}</h2>
                    <p className="text-sm font-medium text-gray-500 mt-2">
                      {appliedRange ? 'Filtered orders logged' : `Orders logged in ${currentMonthName}`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900">
                    Recent Orders {appliedRange 
                      ? (appliedRange.start === appliedRange.end 
                          ? `(${formatReadableDate(appliedRange.start)})` 
                          : `(${formatReadableDate(appliedRange.start)} to ${formatReadableDate(appliedRange.end)})`)
                      : `(${currentMonthName})`}
                  </h3>
                  {appliedRange && (
                    <span className="text-xs bg-purple-100 text-purple-700 font-bold px-2.5 py-1 rounded-md">
                      Filtered View Active
                    </span>
                  )}
                </div>
                {renderOrdersTable(recentOrders)}
              </div>
            </div>
          )}

          {activeTab === 'Orders' && <div className="space-y-4">{renderOrdersTable(filteredSales)}</div>}
          {activeTab === 'PostEx Orders' && <div className="space-y-4">{renderOrdersTable(filteredSales)}</div>}
          
          {/* D&D PARCELS TAB */}
          {activeTab === 'D&D Parcels' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total D&D Parcels</p>
                  <p className="text-3xl font-black text-gray-900 mt-2">{dndTotalParcels}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {appliedRange ? 'In selected date range' : 'All-time D&D history'}
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total D&D Amount</p>
                  <p className="text-3xl font-black text-gray-900 mt-2">PKR {dndTotalAmount.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-2">{dndTotalSuits.toLocaleString()} suits in these parcels</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Top D&D City</p>
                  <p className="text-2xl font-black text-purple-700 mt-2 break-words">{dndTopCity?.city || 'No data'}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {dndTopCity ? `${dndTopCity.parcels} parcels • PKR ${dndTopCity.amount.toLocaleString()}` : 'No D&D parcels found'}
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Payment Status</p>
                  <div className="flex items-end gap-4 mt-2">
                    <div>
                      <p className="text-2xl font-black text-green-600">{dndPaidCount}</p>
                      <p className="text-xs text-gray-500">Paid</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-red-600">{dndPendingCount}</p>
                      <p className="text-xs text-gray-500">Pending</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">D&D City Breakdown</h3>
                    <p className="text-xs text-gray-500 mt-1">Cities ranked by number of D&D parcels sent.</p>
                  </div>
                  <span className="text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1.5 rounded-full">
                    {dndCityStats.length} Cities
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 bg-gray-50/50">
                        <th className="py-3 px-5">Rank</th>
                        <th className="py-3 px-5">City</th>
                        <th className="py-3 px-5 text-right">Parcels</th>
                        <th className="py-3 px-5 text-right">Suits</th>
                        <th className="py-3 px-5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {dndCityStats.length > 0 ? dndCityStats.map((city, index) => (
                        <tr key={city.city} className="border-b border-gray-50 hover:bg-gray-50/70">
                          <td className="py-3 px-5 font-semibold text-gray-500">#{index + 1}</td>
                          <td className="py-3 px-5 font-bold text-gray-900">{city.city}</td>
                          <td className="py-3 px-5 text-right font-bold text-purple-700">{city.parcels}</td>
                          <td className="py-3 px-5 text-right font-medium text-gray-700">{city.suits}</td>
                          <td className="py-3 px-5 text-right font-bold text-gray-900">PKR {city.amount.toLocaleString()}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="5" className="py-8 text-center text-gray-400">No D&D city data found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">
                    Complete D&D Parcel History
                    <span className="ml-2 text-sm font-semibold text-gray-400">({dndDisplayedParcels.length})</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {appliedRange
                      ? `${formatReadableDate(appliedRange.start)} to ${formatReadableDate(appliedRange.end)}`
                      : 'Showing all old and new D&D parcels saved in Online Sales'}
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 bg-gray-50/50">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">City</th>
                        <th className="py-3 px-4">Designs</th>
                        <th className="py-3 px-4 text-right">Qty</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                        <th className="py-3 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {dndDisplayedParcels.length > 0 ? dndDisplayedParcels.map(sale => {
                        const isPaid = (sale.cod_paid || sale.codPaid || 'No') === 'Yes';
                        return (
                          <tr key={sale.id} className="border-b border-gray-50 hover:bg-gray-50/70">
                            <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                              <span className="font-medium">{sale.displayDate || sale.dateStr || '-'}</span>
                              {sale.displayTime && <span className="block text-[11px] text-gray-400 mt-0.5">{sale.displayTime}</span>}
                            </td>
                            <td className="py-3 px-4">
                              <button
                                type="button"
                                onClick={() => setDetailsModalSale(sale)}
                                className="font-bold text-gray-900 hover:text-purple-600 text-left"
                              >
                                {sale.customerName || 'Unknown'}
                              </button>
                              <span className="block text-[11px] text-gray-400 mt-0.5">Order #{sale.orderNumber || '-'}</span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-gray-800">{sale.city || 'Unknown City'}</td>
                            <td className="py-3 px-4">
                              <div className="space-y-1">
                                {(sale.items || []).map((item, index) => (
                                  <div key={index} className="text-xs">
                                    <span className="font-bold text-blue-600">{item.itemName}</span>
                                    <span className="text-gray-400 ml-1">× {item.itemTotalQty || 0}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-gray-900">{Number(sale.totalQty) || 0}</td>
                            <td className="py-3 px-4 text-right font-black text-gray-900">PKR {(Number(sale.totalAmount) || 0).toLocaleString()}</td>
                            <td className="py-3 px-4 text-right">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${
                                isPaid ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                              }`}>
                                {isPaid ? 'Paid' : 'Unpaid'}
                              </span>
                            </td>
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td colSpan="7" className="py-10 text-center text-gray-400">
                            No D&D parcels found for this view.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          
          {/* SALES HISTORY TAB */}
          {activeTab === 'Sales History' && (
            <div className="space-y-6">
              
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 text-purple-700 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Select Sales Period / Month</h2>
                    <p className="text-xs text-gray-500">Pick any month or custom dates to see complete historical metrics.</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button 
                      onClick={() => setHistoryFilterType('Month')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${historyFilterType === 'Month' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500'}`}
                    >
                      Monthly View
                    </button>
                    <button 
                      onClick={() => setHistoryFilterType('Custom')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${historyFilterType === 'Custom' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500'}`}
                    >
                      Custom Dates
                    </button>
                  </div>

                  {historyFilterType === 'Month' ? (
                    <input 
                      type="month" 
                      value={historySelectedMonth} 
                      onChange={(e) => setHistorySelectedMonth(e.target.value)}
                      className="bg-gray-50 border border-gray-200 px-4 py-2 rounded-xl text-sm font-bold text-purple-700 outline-none focus:ring-2 focus:ring-purple-600 cursor-pointer"
                    />
                  ) : (
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
                      <span className="text-xs font-bold text-gray-400 uppercase">From</span>
                      <input type="date" value={historyStartDate} onChange={(e) => setHistoryStartDate(e.target.value)} className="text-sm bg-transparent outline-none font-medium text-gray-700" />
                      <span className="text-xs font-bold text-gray-400 uppercase">To</span>
                      <input type="date" value={historyEndDate} onChange={(e) => setHistoryEndDate(e.target.value)} className="text-sm bg-transparent outline-none font-medium text-gray-700" />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-6 rounded-2xl text-white shadow-md flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-200">Total Sales</span>
                    <div className="p-2 bg-white/15 backdrop-blur-md rounded-lg">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                  </div>
                  <div>
                    <h2 className="text-3xl font-extrabold">PKR {historyTotalRevenue.toLocaleString()}</h2>
                    <p className="text-xs text-purple-200 mt-2 font-medium">
                      {historyFilterType === 'Month' ? formatMonthYear(historySelectedMonth) : `${formatReadableDate(historyStartDate)} - ${formatReadableDate(historyEndDate)}`}
                    </p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Orders</span>
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                    </div>
                  </div>
                  <div>
                    <h2 className="text-3xl font-extrabold text-gray-900">{historyTotalOrders}</h2>
                    <p className="text-xs text-blue-600 mt-2 font-semibold">Orders Logged</p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Items Sold</span>
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
                    </div>
                  </div>
                  <div>
                    <h2 className="text-3xl font-extrabold text-gray-900">{historyTotalItemsSold}</h2>
                    <p className="text-xs text-emerald-600 mt-2 font-semibold">Individual Suits Sold</p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Top Selling Design</span>
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg>
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-blue-600 truncate">{historyTopDesignName}</h2>
                    <p className="text-xs font-bold text-amber-600 mt-2">
                      {historyTopDesignQty > 0 ? `${historyTopDesignQty} Suits Sold` : 'No sales in period'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Sales History Orders {historyFilterType === 'Month' ? `(${formatMonthYear(historySelectedMonth)})` : `(${formatReadableDate(historyStartDate)} to ${formatReadableDate(historyEndDate)})`}
                </h3>
                {renderOrdersTable(salesHistoryFiltered)}
              </div>

            </div>
          )}

          {activeTab === 'Pending Payments' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-red-50/80 border-2 border-red-200 p-5 rounded-2xl flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-xs font-bold text-red-600 uppercase tracking-wider">
                      {pendingFilter === 'All' ? 'Total Pending Orders' : `${pendingFilter} Pending Orders`}
                    </p>
                    <p className="text-3xl font-black text-gray-900 mt-1">{displayedPendingCount} Orders</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                  </div>
                </div>
                <div className="bg-red-50/80 border-2 border-red-200 p-5 rounded-2xl flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-xs font-bold text-red-600 uppercase tracking-wider">
                      {pendingFilter === 'All' ? 'Total Pending Amount' : `${pendingFilter} Pending Amount`}
                    </p>
                    <p className="text-3xl font-black text-gray-900 mt-1">PKR {displayedPendingAmount.toLocaleString()}</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'All', label: 'All Pending Payments' },
                  { key: 'PostEx', label: 'PostEx Pending' },
                  { key: 'D&D', label: 'D&D Pending' },
                  { key: 'Service Delivery', label: 'Service Delivery Pending' }
                ].map((flt) => (
                  <button
                    key={flt.key}
                    onClick={() => setPendingFilter(flt.key)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      pendingFilter === flt.key
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {flt.label}
                  </button>
                ))}
              </div>
              <div className="space-y-4">{renderOrdersTable(filteredSales)}</div>
            </div>
          )}
          
          {activeTab === 'Khata' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-red-50/80 border-2 border-red-200 p-5 rounded-2xl flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Total Pending Payment</p>
                    <p className="text-3xl font-semibold text-gray-800 mt-1">PKR {khataPendingTotal.toLocaleString()}</p>
                    <p className="text-xs text-red-500 mt-1 font-medium">Khata only • excluded from online sales</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 0 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                </div>

                <div className="bg-white border-2 border-gray-200 p-5 rounded-2xl flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Shop Owners</p>
                    <p className="text-3xl font-semibold text-gray-800 mt-1">{khataOwners.length}</p>
                    <p className="text-xs text-gray-500 mt-1 font-medium">One profile per customer</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5V10H2v10h5m10 0v-5a5 5 0 00-10 0v5m10 0H7m5-13V3"></path></svg>
                  </div>
                </div>

                <div className="bg-white border-2 border-gray-200 p-5 rounded-2xl flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pending Owners</p>
                    <p className="text-3xl font-semibold text-gray-800 mt-1">{khataPendingOwners}</p>
                    <p className="text-xs text-gray-500 mt-1 font-medium">Currently owing money</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">Customer Khata Profiles</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      One card per customer. Click a customer to see every purchase, design, size, date/time, payment status and note in one popup.
                    </p>
                  </div>
                </div>

                {khataOwners.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {khataOwners
                      .filter(owner => {
                        const query = khataSearchTerm.toLowerCase().trim();
                        return !query || owner.name.toLowerCase().includes(query);
                      })
                      .map(owner => (
                        <button
                          key={owner.name}
                          type="button"
                          onClick={() => setKhataProfileOwner(owner.name)}
                          className="text-left border border-gray-200 hover:border-purple-400 hover:shadow-md bg-white p-5 rounded-2xl shadow-sm transition-all"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="text-base font-semibold text-gray-800 truncate">{owner.name}</h3>
                              <p className="text-xs text-gray-500 mt-1">
                                {owner.count} {owner.count === 1 ? 'purchase' : 'purchases'}
                              </p>
                            </div>
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${
                              owner.pending > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                            }`}>
                              {owner.pending > 0 ? 'Pending' : 'Clear'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-gray-100">
                            <div>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Pending</p>
                              <p className={`text-lg font-semibold mt-1 ${owner.pending > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                PKR {owner.pending.toLocaleString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Bought</p>
                              <p className="text-lg font-semibold text-gray-800 mt-1">PKR {owner.total.toLocaleString()}</p>
                            </div>
                          </div>

                          <div className="mt-4 text-xs font-bold text-purple-600 flex items-center justify-end gap-1">
                            Open full profile
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                            </svg>
                          </div>
                        </button>
                      ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-gray-400">
                    <p className="font-medium">No Khata customers yet.</p>
                    <p className="text-xs mt-1">Use “Add Khata Entry” to create the first customer purchase.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Top Selling Designs' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 bg-gray-50/50">
                    <th className="py-4 px-6">Rank</th>
                    <th className="py-4 px-6">Design Name</th>
                    <th className="py-4 px-6 text-right">Total Qty Sold</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {topDesigns.length > 0 ? topDesigns.map(([name, qty], index) => (
                    <tr key={index} className="border-b border-gray-50">
                      <td className="py-4 px-6 font-medium text-gray-900">#{index + 1}</td>
                      <td className="py-4 px-6 font-bold text-blue-600">{name}</td>
                      <td className="py-4 px-6 text-right font-medium text-gray-900">{qty}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="3" className="py-8 text-center text-gray-400">No designs found.</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          )}
          
          {activeTab === 'Items Sold' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 bg-gray-50/50">
                    <th className="py-4 px-6">Date</th>
                    <th className="py-4 px-6">Customer & Order #</th>
                    <th className="py-4 px-6">Design Name</th>
                    <th className="py-4 px-6">Sizes</th>
                    <th className="py-4 px-6 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {filteredSales.flatMap(sale => 
                    (sale.items || []).map((it, idx) => (
                      <tr key={`${sale.id}-${idx}`} className="border-b border-gray-50">
                        <td className="py-4 px-6 font-medium text-gray-500">{sale.displayDate}</td>
                        <td className="py-4 px-6">
                          <span className="font-bold text-gray-900 block">{sale.customerName}</span>
                          <span className="text-xs text-gray-500">Order #{sale.orderNumber}</span>
                        </td>
                        <td className="py-4 px-6 font-bold text-blue-600">{it.itemName}</td>
                        <td className="py-4 px-6">
                          <div className="flex gap-1 flex-wrap">
                            {it.sizeQty && Object.entries(it.sizeQty).map(([sz, qty]) => 
                              qty > 0 ? <span key={sz} className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-md font-medium">{sz}: {qty}</span> : null
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right font-medium text-gray-900">{it.itemTotalQty}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ADD / EDIT ORDER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900">{editingId ? 'Edit Order' : 'New Order'}</h2>
              <button onClick={closeSaleModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
              
              <div className="space-y-4 bg-gray-50/50 p-5 rounded-xl border border-gray-100">
                <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider">Customer Details</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name <span className="text-red-500">*</span></label>
                  <input type="text" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-600 outline-none transition-shadow" placeholder="John Doe" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select value={paymentMethod} onChange={(e) => {
                    setPaymentMethod(e.target.value);
                    if(e.target.value === 'Cash on Delivery') setCodSubOption('PostEx');
                  }} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-600 outline-none transition-shadow">
                    <option value="Advance Payment">Advance Payment</option>
                    <option value="Cash on Delivery">Cash on Delivery</option>
                  </select>
                </div>

                {paymentMethod === 'Cash on Delivery' && (
                  <div className="pl-4 border-l-2 border-purple-200 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">COD Option</label>
                      <select value={codSubOption} onChange={(e) => {
                        setCodSubOption(e.target.value);
                        if(e.target.value === 'Local Rider') setLocalRiderSubOption('D&D');
                      }} className="w-full px-4 py-2 bg-white border border-purple-100 rounded-lg focus:ring-2 focus:ring-purple-600 outline-none">
                        <option value="PostEx">PostEx</option>
                        <option value="Local Rider">Local Rider</option>
                      </select>
                    </div>

                    {codSubOption === 'PostEx' && (
                      <div>
                        <label className="block text-sm font-medium text-purple-800 mb-1">PostEx Order Code <span className="text-red-500">*</span></label>
                        <input type="text" required value={orderCode} onChange={(e) => setOrderCode(e.target.value)} className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="e.g. PX-12345" />
                      </div>
                    )}

                    {codSubOption === 'Local Rider' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-orange-800 mb-1">Select Rider</label>
                          <select value={localRiderSubOption} onChange={(e) => setLocalRiderSubOption(e.target.value)} className="w-full px-4 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none">
                            <option value="D&D">D&D</option>
                            <option value="Service Delivery">Service Delivery</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-orange-800 mb-1">City <span className="text-red-500">*</span></label>
                          <input type="text" required value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-4 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Enter city name" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider">Order Items</h3>
                  <button type="button" onClick={handleAddAnotherDesign} className="text-xs font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    Add Design
                  </button>
                </div>

                {orderItems.map((item, index) => (
                  <div key={item.id} className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4 relative">
                    {orderItems.length > 1 && (
                      <button type="button" onClick={() => handleRemoveDesignItem(item.id)} className="absolute top-4 right-4 text-red-400 hover:text-red-600 bg-white rounded-full p-1 shadow-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Design Name <span className="text-red-500">*</span></label>
                        <input type="text" list="design-name-suggestions" autoComplete="off" required value={item.itemName} onChange={(e) => handleItemFieldChange(item.id, 'itemName', e.target.value)} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-600 outline-none transition-shadow" placeholder={`Design ${index + 1}`} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (PKR) <span className="text-red-500">*</span></label>
                        <input type="number" required min="0" value={item.price} onChange={(e) => handleItemFieldChange(item.id, 'price', e.target.value)} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-600 outline-none transition-shadow" placeholder="2500" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Sizes & Quantities</label>
                      <div className="grid grid-cols-2 sm:flex gap-3">
                        {['S', 'M', 'L', 'XL'].map(sz => (
                          <div key={sz} className="flex-1 flex flex-col items-center bg-white border border-gray-200 rounded-lg p-2 focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-transparent transition-all">
                            <span className="text-xs font-bold text-gray-500 mb-1">{sz}</span>
                            <input 
                              type="number" 
                              min="0" 
                              value={item.sizeQty[sz] === 0 ? '' : item.sizeQty[sz]} 
                              onChange={(e) => handleItemSizeChange(item.id, sz, e.target.value)}
                              className="w-full text-center text-sm font-medium outline-none bg-transparent"
                              placeholder="0"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={closeSaleModal} className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors">
                  {editingId ? 'Update Order' : 'Save Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MARK AS PAID MODAL (COD ONLY) */}
      {codModalSale && (
         <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
               <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h2 className="text-lg font-bold text-gray-900">Update COD Status</h2>
                  <button onClick={closeCodModal} className="text-gray-400 hover:text-gray-600">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
               </div>
               
               <div className="p-5 space-y-5">
                 
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status</label>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                      <button 
                        onClick={async () => {
                          const pin = codActionPin || await requestActionPin('change this online order payment status');
                          if (pin) { setCodActionPin(pin); setModalCodPaid('No'); }
                        }}
                        className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${modalCodPaid === 'No' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
                      >
                        Unpaid
                      </button>
                      <button 
                        onClick={async () => {
                          const pin = codActionPin || await requestActionPin('mark this online order as paid');
                          if (pin) { setCodActionPin(pin); setModalCodPaid('Yes'); }
                        }}
                        className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${modalCodPaid === 'Yes' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}
                      >
                        Paid
                      </button>
                    </div>
                  </div>

                  {modalCodPaid === 'Yes' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Payment Received Via</label>
                      <select value={modalCodType} onChange={(e) => setModalCodType(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-green-500 outline-none">
                         <option value="Cash">Cash</option>
                         <option value="Easypaisa">Easypaisa</option>
                         <option value="Jazzcash">Jazzcash</option>
                         <option value="Bank Transfer">Bank Transfer</option>
                      </select>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                     <button onClick={closeCodModal} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                        Cancel
                     </button>
                     <button onClick={handleSaveCodModal} className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-sm font-bold rounded-lg shadow-sm transition-colors">
                        Save Status
                     </button>
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* KHATA ADD / EDIT MODAL */}
      {isKhataModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3 min-w-0">
                {!editingKhataId && khataModalStep !== 'choose' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (khataModalStep === 'purchase') {
                        setKhataModalStep(khataCustomerMode === 'old' ? 'old-list' : 'new-name');
                      } else {
                        setKhataModalStep('choose');
                        setKhataCustomerMode(null);
                      }
                    }}
                    className="w-9 h-9 shrink-0 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"
                    title="Back"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                    </svg>
                  </button>
                )}
                <div className="min-w-0">
                  <h2 className="text-lg font-medium text-gray-800 truncate">
                    {editingKhataId
                      ? 'Edit Khata Purchase'
                      : khataModalStep === 'choose'
                        ? 'Add Khata Entry'
                        : khataModalStep === 'old-list'
                          ? 'Choose Old Customer'
                          : khataModalStep === 'new-name'
                            ? 'Add New Customer'
                            : `Add Purchase • ${khataOwnerName}`}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    {khataModalStep === 'purchase' || editingKhataId
                      ? 'Add all designs from this purchase together in one form.'
                      : 'Choose a customer first, then enter the purchase details.'}
                  </p>
                </div>
              </div>
              <button onClick={closeKhataModal} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            {!editingKhataId && khataModalStep === 'choose' && (
              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setKhataCustomerMode('old');
                      setKhataOwnerName('');
                      setKhataOwnerSearch('');
                      setKhataNewCustomerConfirmed(false);
                      setKhataModalStep('old-list');
                    }}
                    className="text-left p-5 rounded-lg border border-gray-300 bg-white shadow-sm hover:border-blue-400 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-4">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m6-4a4 4 0 10-8 0 4 4 0 008 0z"></path>
                      </svg>
                    </div>
                    <h3 className="font-medium text-gray-800">Old Customer</h3>
                    <p className="text-xs text-gray-500 mt-1">Search and select an existing Khata customer.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setKhataCustomerMode('new');
                      setKhataOwnerName('');
                      setKhataOwnerSearch('');
                      setKhataNewCustomerConfirmed(false);
                      setKhataModalStep('new-name');
                    }}
                    className="text-left p-5 rounded-lg border border-gray-300 bg-white shadow-sm hover:border-blue-400 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-11 h-11 rounded-xl bg-green-100 text-green-700 flex items-center justify-center mb-4">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                      </svg>
                    </div>
                    <h3 className="font-medium text-gray-800">Add New Customer</h3>
                    <p className="text-xs text-gray-500 mt-1">Create a customer only if they are not already listed.</p>
                  </button>
                </div>
              </div>
            )}

            {!editingKhataId && khataModalStep === 'old-list' && (
              <div className="p-5 flex flex-col max-h-[78vh]">
                <div className="relative mb-4">
                  <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                  <input
                    autoFocus
                    type="text"
                    value={khataOwnerSearch}
                    onChange={(e) => setKhataOwnerSearch(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-white text-sm text-gray-700 border border-gray-300 rounded-md shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-colors"
                    placeholder="Search customer name..."
                  />
                </div>

                <div className="overflow-y-auto pr-1 space-y-2">
                  {khataOldCustomerMatches.length > 0 ? khataOldCustomerMatches.map(owner => (
                    <button
                      key={owner.name}
                      type="button"
                      onClick={() => {
                        setKhataOwnerName(owner.name);
                        setKhataCustomerMode('old');
                        setKhataNewCustomerConfirmed(true);
                        setKhataNote('');
                        setKhataDesignItems([{ id: Date.now(), designName: '', price: '', sizeQty: { S: 0, M: 0, L: 0, XL: 0 } }]);
                        setKhataPaid('No');
                        setKhataPaymentType('Cash');
                        setKhataModalStep('purchase');
                      }}
                      className="w-full flex items-center justify-between gap-3 p-4 rounded-lg border border-gray-300 bg-white shadow-sm hover:border-blue-400 hover:bg-gray-50 text-left transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-gray-800 truncate">{owner.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{owner.count} {owner.count === 1 ? 'purchase' : 'purchases'}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-normal text-gray-500">Pending</div>
                        <div className={`text-sm font-medium ${owner.pending > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          PKR {owner.pending.toLocaleString()}
                        </div>
                      </div>
                    </button>
                  )) : (
                    <div className="py-12 text-center text-gray-400">
                      <p className="font-semibold">No old customer found.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setKhataCustomerMode('new');
                          setKhataOwnerName(toTitleCase(khataOwnerSearch));
                          setKhataNewCustomerConfirmed(false);
                          setKhataModalStep('new-name');
                        }}
                        className="mt-3 text-xs font-medium text-purple-600 hover:underline"
                      >
                        Add as new customer
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!editingKhataId && khataModalStep === 'new-name' && (
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-normal text-gray-700 mb-1.5">New Shop Owner Name</label>
                  <input
                    autoFocus
                    type="text"
                    value={khataOwnerName}
                    onChange={(e) => {
                      setKhataOwnerName(toTitleCase(e.target.value));
                      setKhataNewCustomerConfirmed(false);
                    }}
                    className="w-full px-3 py-2.5 bg-white text-sm text-gray-700 border border-gray-300 rounded-md shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-colors"
                    placeholder="Enter customer name"
                  />
                </div>

                {khataOwnerName.trim().length >= 2 && khataExactOwnerMatch && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-semibold text-red-700">Customer already exists</p>
                    <p className="text-xs text-red-600 mt-1">Use the existing profile instead of creating a duplicate.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setKhataOwnerName(khataExactOwnerMatch.name);
                        setKhataCustomerMode('old');
                        setKhataModalStep('purchase');
                        setKhataNewCustomerConfirmed(true);
                      }}
                      className="mt-3 px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-bold"
                    >
                      Use {khataExactOwnerMatch.name}
                    </button>
                  </div>
                )}

                {khataOwnerName.trim().length >= 2 && !khataExactOwnerMatch && khataSimilarOwners.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-800">Possible old customer found</p>
                    <p className="text-xs text-amber-700 mt-1">Check these names before creating a new profile.</p>

                    <div className="mt-3 space-y-2">
                      {khataSimilarOwners.map(owner => (
                        <button
                          key={owner.name}
                          type="button"
                          onClick={() => {
                            setKhataOwnerName(owner.name);
                            setKhataCustomerMode('old');
                            setKhataNewCustomerConfirmed(true);
                            setKhataModalStep('purchase');
                          }}
                          className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-amber-200 bg-white hover:border-purple-400 text-left"
                        >
                          <span className="font-bold text-gray-800">{owner.name}</span>
                          <span className="text-xs font-bold text-red-600">PKR {owner.pending.toLocaleString()} pending</span>
                        </button>
                      ))}
                    </div>

                    {!khataNewCustomerConfirmed ? (
                      <button
                        type="button"
                        onClick={() => setKhataNewCustomerConfirmed(true)}
                        className="mt-3 text-xs font-bold text-amber-800 underline"
                      >
                        This is a different person — create new customer anyway
                      </button>
                    ) : (
                      <p className="mt-3 text-xs font-bold text-green-700">Confirmed as a different/new customer.</p>
                    )}
                  </div>
                )}

                {khataOwnerName.trim().length >= 2 && !khataExactOwnerMatch && khataSimilarOwners.length === 0 && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                    <p className="text-sm font-semibold text-green-700">Customer not found</p>
                    <p className="text-xs text-green-600 mt-1">No matching old Khata customer was found.</p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeKhataModal}
                    className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={
                      !khataOwnerName.trim() ||
                      !!khataExactOwnerMatch ||
                      (khataSimilarOwners.length > 0 && !khataNewCustomerConfirmed)
                    }
                    onClick={() => {
                      setKhataCustomerMode('new');
                      setKhataModalStep('purchase');
                      setKhataNote('');
                      setKhataDesignItems([{ id: Date.now(), designName: '', price: '', sizeQty: { S: 0, M: 0, L: 0, XL: 0 } }]);
                      setKhataPaid('No');
                      setKhataPaymentType('Cash');
                    }}
                    className="px-4 py-2.5 bg-purple-600 text-white text-sm font-bold rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {(editingKhataId || khataModalStep === 'purchase') && (
              <form onSubmit={handleSubmitKhata} className="p-5 space-y-5 overflow-y-auto max-h-[78vh]">
                <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-purple-500">Customer</p>
                    <p className="text-lg font-medium text-gray-800 truncate">{khataOwnerName}</p>
                  </div>
                  {!editingKhataId && (
                    <button
                      type="button"
                      onClick={() => {
                        setKhataOwnerName('');
                        setKhataCustomerMode(null);
                        setKhataModalStep('choose');
                      }}
                      className="text-xs font-medium text-purple-600 hover:underline shrink-0"
                    >
                      Change
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700">
                        Designs <span className="text-red-500">*</span>
                      </label>
                      <p className="text-xs text-gray-400 mt-1">All designs below belong to this single purchase.</p>
                    </div>
                    {!editingKhataId && (
                      <button
                        type="button"
                        onClick={handleAddKhataDesign}
                        className="shrink-0 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-2 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                        </svg>
                        Add Design
                      </button>
                    )}
                  </div>

                  {khataDesignItems.map((item, index) => (
                    <div key={item.id} className="relative bg-gray-50/40 border border-gray-200 rounded-lg p-4 space-y-3">
                      {!editingKhataId && khataDesignItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveKhataDesign(item.id)}
                          className="absolute top-3 right-3 text-red-400 hover:text-red-600 bg-white rounded-full p-1 shadow-sm"
                          title="Remove this design"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                          </svg>
                        </button>
                      )}

                      <div className="text-xs font-medium text-gray-600">Design {index + 1}</div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-normal text-gray-700 mb-1.5">Design Name</label>
                          <input
                            type="text"
                            list="design-name-suggestions"
                            autoComplete="off"
                            required
                            value={item.designName}
                            onChange={(e) => handleKhataDesignChange(item.id, 'designName', e.target.value)}
                            className="w-full px-3 py-2.5 bg-white text-sm text-gray-700 border border-gray-300 rounded-md shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-colors"
                            placeholder="Black Embroidered Suit"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-normal text-gray-700 mb-1.5">Price Per Suit (PKR)</label>
                          <input
                            type="number"
                            required
                            min="0.01"
                            step="0.01"
                            value={item.price}
                            onChange={(e) => handleKhataDesignChange(item.id, 'price', e.target.value)}
                            className="w-full px-3 py-2.5 bg-white text-sm text-gray-700 border border-gray-300 rounded-md shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-colors"
                            placeholder="20000"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">Sizes & Quantity</label>
                        <div className="grid grid-cols-4 gap-2">
                          {['S', 'M', 'L', 'XL'].map(size => (
                            <div key={size}>
                              <label className="block text-xs font-normal text-gray-600 text-center mb-1.5">{size}</label>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={item.sizeQty?.[size] ?? 0}
                                onChange={(e) => handleKhataDesignSizeChange(item.id, size, e.target.value)}
                                className="w-full px-2 py-2.5 bg-white text-sm text-gray-700 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-center font-normal transition-colors"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-200">
                        <div>
                          <span className="text-xs font-normal text-gray-600">Qty: </span>
                          <span className="text-sm font-medium text-gray-800">{getKhataItemQty(item)}</span>
                        </div>
                        <div>
                          <span className="text-xs font-normal text-gray-600">Amount: </span>
                          <span className="text-sm font-medium text-gray-800">PKR {getKhataItemAmount(item).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-normal text-gray-600">Purchase Total</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {khataDesignItems.reduce((sum, item) => sum + getKhataItemQty(item), 0)} suits
                    </p>
                  </div>
                  <p className="text-xl font-medium text-gray-800">
                    PKR {khataDesignItems.reduce((sum, item) => sum + getKhataItemAmount(item), 0).toLocaleString()}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-normal text-gray-700 mb-1.5">Note <span className="text-gray-400 font-normal">(optional)</span></label>
                  <textarea
                    value={khataNote}
                    onChange={(e) => setKhataNote(e.target.value.slice(0, 500))}
                    rows="3"
                    className="w-full px-3 py-2.5 bg-white text-sm text-gray-700 border border-gray-300 rounded-md shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-colors resize-none"
                    placeholder="e.g. Promised payment on Friday, special rate, returned one piece..."
                  />
                  <p className="text-[10px] text-gray-400 text-right mt-1">{khataNote.length}/500</p>
                </div>

                <div>
                  <label className="block text-xs font-normal text-gray-700 mb-1.5">Payment Status</label>
                  <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setKhataPaid('No')}
                      className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                        khataPaid === 'No' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      Unpaid
                    </button>
                    <button
                      type="button"
                      onClick={() => setKhataPaid('Yes')}
                      className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                        khataPaid === 'Yes' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      Paid
                    </button>
                  </div>
                </div>

                {khataPaid === 'Yes' && (
                  <div>
                    <label className="block text-xs font-normal text-gray-700 mb-1.5">Payment Received Via</label>
                    <select
                      value={khataPaymentType}
                      onChange={(e) => setKhataPaymentType(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white text-sm font-normal text-gray-700 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-colors"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Easypaisa">Easypaisa</option>
                      <option value="Jazzcash">Jazzcash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={closeKhataModal}
                    className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg shadow-sm"
                  >
                    {editingKhataId ? 'Update Purchase' : 'Save Purchase'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* KHATA CUSTOMER PROFILE MODAL */}
      {khataProfileOwner && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 z-[60]">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden shadow-2xl">
            <div className="p-5 sm:p-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-purple-200">Khata Customer Profile</p>
                <h2 className="text-2xl sm:text-3xl font-semibold mt-1 truncate">{khataProfileOwner}</h2>
                <p className="text-sm text-purple-100 mt-1">
                  {khataProfilePurchases.length} {khataProfilePurchases.length === 1 ? 'purchase' : 'purchases'} in complete history
                </p>
              </div>
              <button
                type="button"
                onClick={() => setKhataProfileOwner(null)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(92vh-120px)] space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-500">Pending Balance</p>
                  <p className="text-xl font-semibold text-red-600 mt-1">PKR {(khataProfileSummary?.pending || 0).toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Purchased</p>
                  <p className="text-xl font-semibold text-gray-800 mt-1">PKR {(khataProfileSummary?.total || 0).toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-purple-500">Purchases</p>
                  <p className="text-xl font-semibold text-purple-700 mt-1">{khataProfilePurchases.length}</p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => openKhataPurchaseForOwner(khataProfileOwner)}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold shadow-sm"
                >
                  + Add New Purchase
                </button>
              </div>

              <div className="space-y-4">
                {khataProfilePurchases.length > 0 ? khataProfilePurchases.map((purchase, purchaseIndex) => {
                  const purchasePaid = purchase.entries.every(entry => !!entry.paid);
                  const latestPaidAt = purchase.entries
                    .map(entry => entry.paid_at)
                    .filter(Boolean)
                    .sort()
                    .slice(-1)[0];

                  return (
                    <div key={purchase.id} className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                      <div className="p-4 sm:p-5 bg-gray-50/80 border-b border-gray-200 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Purchase #{khataProfilePurchases.length - purchaseIndex}</p>
                          <p className="font-semibold text-gray-800 mt-1">{formatKhataDateTime(purchase.created_at)}</p>
                          {purchasePaid && latestPaidAt && (
                            <p className="text-[10px] font-semibold text-green-600 mt-1">{timeAgo(latestPaidAt)}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            purchasePaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {purchasePaid ? 'Paid' : 'Pending'}
                          </span>
                          <p className="text-xl font-semibold text-gray-800 mt-2">PKR {purchase.totalAmount.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">{purchase.totalQty} suits</p>
                        </div>
                      </div>

                      <div className="divide-y divide-gray-100">
                        {purchase.entries.map(entry => (
                          <div key={entry.id} className="p-4 sm:p-5">
                            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="font-semibold text-blue-600">{entry.design_name}</h4>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    entry.paid ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                                  }`}>
                                    {entry.paid ? `Paid • ${entry.payment_method || 'Cash'}` : 'Unpaid'}
                                  </span>
                                </div>

                                <p className="text-xs text-gray-500 mt-1">
                                  PKR {(Number(entry.unit_price) || 0).toLocaleString()} per suit
                                </p>

                                <div className="flex flex-wrap gap-1.5 mt-3">
                                  {['S', 'M', 'L', 'XL'].map(sz => {
                                    const qty = Number(entry.size_qty?.[sz]) || 0;
                                    return qty > 0 ? (
                                      <span key={sz} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-semibold">
                                        {sz}: {qty}
                                      </span>
                                    ) : null;
                                  })}
                                </div>
                              </div>

                              <div className="lg:text-right shrink-0">
                                <p className="text-xs text-gray-500">Qty {Number(entry.quantity) || getEntryQtyFallback(entry)}</p>
                                <p className="font-semibold text-gray-800 mt-1">PKR {(Number(entry.amount) || 0).toLocaleString()}</p>
                                <div className="flex lg:justify-end gap-2 mt-3">
                                  <button
                                    type="button"
                                    onClick={() => handleEditKhata(entry)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-purple-600 bg-purple-50 hover:bg-purple-100"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteKhata(entry.id)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="p-4 sm:p-5 bg-slate-50 border-t border-gray-200">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Note</p>
                        <p className={`text-sm mt-1 ${purchase.note ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                          {purchase.note || 'No note added for this purchase.'}
                        </p>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="py-12 text-center text-gray-400">No purchase history found.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER DETAILS MODAL */}
      {detailsModalSale && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden shadow-2xl animate-in zoom-in-95 duration-200">
             
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 sm:p-6 flex justify-between items-start text-white relative overflow-hidden">
               <div className="absolute -right-4 -top-12 opacity-10">
                 <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"></path></svg>
               </div>
               
               <div className="relative z-10">
                 <h2 className="text-xl sm:text-2xl font-black break-words pr-2">{detailsModalSale.customerName}</h2>
                 <p className="text-purple-100 font-medium text-sm mt-1">Order Details • #{detailsModalSale.orderNumber}</p>
               </div>
               <button onClick={() => setDetailsModalSale(null)} className="text-white/70 hover:text-white relative z-10 bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
               </button>
            </div>
             
            <div className="p-4 sm:p-6 space-y-6">
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                 <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Date Logged</p>
                    <p className="font-semibold text-gray-900 flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                      {detailsModalSale.displayDate}
                      {detailsModalSale.displayTime && (
                        <span className="text-gray-400 font-medium">• {detailsModalSale.displayTime}</span>
                      )}
                    </p>
                 </div>
                 
                 <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Payment Type</p>
                    {detailsModalSale.paymentMethod === 'Advance Payment' ? (
                       <span className="inline-flex px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold uppercase tracking-wide">Advance</span>
                    ) : (
                       <div className="flex flex-col gap-1">
                          <span className="inline-flex px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-bold uppercase tracking-wide w-fit">COD</span>
                          <span className="text-xs font-medium text-gray-600">
                            Via {detailsModalSale.cod_sub_option === 'Local Rider' ? (detailsModalSale.local_rider_sub_option || 'D&D') : 'PostEx'}
                          </span>
                       </div>
                    )}
                 </div>

                 {/* Show City if it exists and is Local Rider */}
                 {detailsModalSale.paymentMethod === 'Cash on Delivery' && detailsModalSale.cod_sub_option === 'Local Rider' && detailsModalSale.city && (
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 sm:col-span-2">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">City</p>
                      <p className="font-semibold text-gray-900">{detailsModalSale.city}</p>
                    </div>
                 )}
                 
                 {detailsModalSale.orderCode && (
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 col-span-2 flex items-center justify-between">
                       <div>
                         <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">PostEx Tracking Code</p>
                         <p className="font-mono font-bold text-purple-700 text-base">{detailsModalSale.orderCode}</p>
                       </div>
                       <button onClick={() => {
                           navigator.clipboard.writeText(detailsModalSale.orderCode);
                           alert('Tracking code copied!');
                         }} 
                         className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                         title="Copy Code"
                       >
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                       </button>
                    </div>
                 )}
               </div>
               
               <div>
                 <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 mb-3">Order Items ({detailsModalSale.totalQty} total)</h3>
                 <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {(detailsModalSale.items || []).map((it, idx) => (
                       <div key={idx} className="bg-white border border-gray-100 p-3 rounded-xl shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                             <span className="font-bold text-blue-600">{it.itemName}</span>
                             <span className="font-bold text-gray-900">PKR {(it.itemTotalAmount || 0).toLocaleString()}</span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                             <div className="flex gap-1.5 flex-wrap">
                               {it.sizeQty && Object.entries(it.sizeQty).map(([sz, qty]) => 
                                 qty > 0 ? (
                                   <span key={sz} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] rounded font-bold">
                                     {sz}: {qty}
                                   </span>
                                 ) : null
                               )}
                             </div>
                             <span className="text-xs text-gray-500 font-medium">{it.itemTotalQty} x PKR {it.price}</span>
                          </div>
                       </div>
                    ))}
                 </div>
               </div>
               
               <div className="bg-gray-900 text-white p-4 rounded-xl flex justify-between items-center shadow-md">
                 <span className="font-medium text-sm text-gray-300 uppercase tracking-wider">Grand Total</span>
                 <span className="text-2xl font-black">PKR {(detailsModalSale.totalAmount || 0).toLocaleString()}</span>
               </div>
               
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

export default function RizwanClothingApp() {
  // Update browser tab title
  useEffect(() => {
    document.title = "Dashboard - Rizwan Clothing";
  }, []);

  function toTitleCase(str) {
    if (!str) return '';
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthPrefix = new Date().toISOString().slice(0, 7); 
  const currentMonthName = new Date().toLocaleString('default', { month: 'long' });

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  // Navigation State
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [pendingFilter, setPendingFilter] = useState('All');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [codModalSale, setCodModalSale] = useState(null);
  const [modalCodPaid, setModalCodPaid] = useState('No');
  const [modalCodType, setModalCodType] = useState('Cash');
  const [detailsModalSale, setDetailsModalSale] = useState(null);

  // Form States
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Advance Payment');
  const [codSubOption, setCodSubOption] = useState('PostEx'); 
  const [localRiderSubOption, setLocalRiderSubOption] = useState('D&D'); 
  const [orderCode, setOrderCode] = useState('');
  
  const [orderItems, setOrderItems] = useState([
    { id: Date.now(), itemName: '', price: '', sizeQty: { S: 0, M: 0, L: 0, XL: 0 } }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchSalesData();
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

  const handleExportBackup = () => {
    const dataStr = JSON.stringify(sales, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `rizwan-clothing-backup-${dateStr}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (!Array.isArray(importedData)) {
          alert('Invalid JSON format: Root element must be an array.');
          return;
        }
        setLoading(true);
        let successCount = 0;

        for (let item of importedData) {
          const cleanCustomerName = toTitleCase(item.customerName || item.name || 'Unknown');
          const cleanPaymentMethod = item.paymentMethod || 'Advance Payment';
          
          let formattedItems = [];
          if (item.items && Array.isArray(item.items)) {
            formattedItems = item.items.map(it => ({
              itemName: toTitleCase(it.itemName || it.design || 'Design'),
              price: parseFloat(it.price || 0),
              sizeQty: it.sizeQty || { S: 0, M: 0, L: 0, XL: 0 },
              itemTotalQty: Object.values(it.sizeQty || {}).reduce((a, b) => a + b, 0),
              itemTotalAmount: Object.values(it.sizeQty || {}).reduce((a, b) => a + b, 0) * parseFloat(it.price || 0)
            }));
          } else {
            const sizes = item.sizes || { S: 0, M: 0, L: 0, XL: 0 };
            const price = parseFloat(item.price || 0);
            const q = Object.values(sizes).reduce((a, b) => a + b, 0);
            formattedItems = [{
              itemName: toTitleCase(item.design || item.itemName || 'Design'),
              price: price,
              sizeQty: sizes,
              itemTotalQty: q,
              itemTotalAmount: q * price
            }];
          }

          const totalQty = formattedItems.reduce((acc, curr) => acc + curr.itemTotalQty, 0);
          const totalAmount = formattedItems.reduce((acc, curr) => acc + curr.itemTotalAmount, 0);
          const nowIso = item.isoDate || new Date().toISOString().split('T')[0];
          const nextOrderNum = sales.length > 0 ? Math.max(...sales.map(s => s.orderNumber || 0)) + 1 + successCount : 1 + successCount;

          const newRecord = {
            id: item.id ? Number(item.id) : Date.now() + Math.floor(Math.random() * 1000),
            orderNumber: nextOrderNum,
            customerName: cleanCustomerName,
            paymentMethod: cleanPaymentMethod,
            cod_sub_option: item.cod_sub_option || 'PostEx',
            local_rider_sub_option: item.local_rider_sub_option || 'D&D',
            orderCode: item.orderCode || '',
            cod_paid: item.cod_paid || 'No',
            cod_payment_type: item.cod_payment_type || 'Cash',
            items: formattedItems,
            totalQty: totalQty,
            totalAmount: totalAmount,
            dateStr: nowIso,
            displayDate: item.date || nowIso,
            displayTime: item.time || '12:00 PM',
            isEdited: false
          };

          const { error } = await supabase.from('sales').upsert([newRecord]);
          if (!error) successCount++;
        }
        alert(`Successfully imported ${successCount} orders!`);
        fetchSalesData();
      } catch (err) {
        alert('Error reading JSON file.');
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

  const handleOpenAddModal = () => {
    setEditingId(null);
    setCustomerName('');
    setPaymentMethod('Advance Payment');
    setCodSubOption('PostEx');
    setLocalRiderSubOption('D&D');
    setOrderCode('');
    setOrderItems([{ id: Date.now(), itemName: '', price: '', sizeQty: { S: 0, M: 0, L: 0, XL: 0 } }]);
    setIsModalOpen(true);
  };

  const handleEditClick = (sale) => {
    setEditingId(sale.id);
    setCustomerName(sale.customerName);
    setPaymentMethod(sale.paymentMethod || 'Advance Payment');
    setCodSubOption(sale.cod_sub_option || sale.codSubOption || 'PostEx');
    setLocalRiderSubOption(sale.local_rider_sub_option || sale.localRiderSubOption || 'D&D');
    setOrderCode(sale.orderCode || '');
    
    if (sale.items && sale.items.length > 0) {
      setOrderItems(sale.items.map((it, idx) => ({
        id: Date.now() + idx,
        itemName: it.itemName,
        price: it.price.toString(),
        sizeQty: { ...it.sizeQty }
      })));
    } else {
      setOrderItems([{ id: Date.now(), itemName: sale.itemName || '', price: sale.price?.toString() || '', sizeQty: { ...sale.sizeQty } }]);
    }
    setIsModalOpen(true);
  };

  const handleUpdateCodStatus = async (saleId, newPaid, newType) => {
    const { error } = await supabase.from('sales').update({ cod_paid: newPaid, cod_payment_type: newPaid === 'Yes' ? newType : 'Cash' }).eq('id', saleId);
    if (error) alert('Supabase Error: ' + error.message);
    else fetchSalesData();
  };

  const handleSaveCodModal = async () => {
    if (!codModalSale) return;
    await handleUpdateCodStatus(codModalSale.id, modalCodPaid, modalCodType);
    setCodModalSale(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerName.trim()) return;

    const isCod = paymentMethod === 'Cash on Delivery';
    const isPostEx = isCod && codSubOption === 'PostEx';
    if (isPostEx && !orderCode.trim()) return alert('Please enter an order code for PostEx.');

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

    const now = new Date();

    if (editingId) {
      const existingSale = sales.find(s => s.id === editingId);
      const updatedData = {
        customerName: toTitleCase(customerName.trim()),
        paymentMethod,
        cod_sub_option: isCod ? codSubOption : '',
        local_rider_sub_option: (isCod && codSubOption === 'Local Rider') ? localRiderSubOption : '',
        orderCode: isPostEx ? orderCode.trim() : '',
        cod_paid: isCod ? (existingSale?.cod_paid || 'No') : 'No',
        cod_payment_type: isCod ? (existingSale?.cod_payment_type || 'Cash') : 'Cash',
        items: formattedItems,
        totalQty,
        totalAmount,
        isEdited: true,
      };
      await supabase.from('sales').update(updatedData).eq('id', editingId);
    } else {
      const nextOrderNum = sales.length > 0 ? Math.max(...sales.map(s => s.orderNumber || 0)) + 1 : 1;
      const newSale = {
        id: Date.now(),
        orderNumber: nextOrderNum,
        customerName: toTitleCase(customerName.trim()),
        paymentMethod,
        cod_sub_option: isCod ? codSubOption : '',
        local_rider_sub_option: (isCod && codSubOption === 'Local Rider') ? localRiderSubOption : '',
        orderCode: isPostEx ? orderCode.trim() : '',
        cod_paid: isCod ? 'No' : 'No',
        cod_payment_type: 'Cash',
        items: formattedItems,
        totalQty,
        totalAmount,
        dateStr: now.toISOString().split('T')[0],
        displayDate: now.toLocaleDateString(),
        displayTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isEdited: false,
      };
      await supabase.from('sales').insert([newSale]);
    }
    fetchSalesData();
    setIsModalOpen(false);
  };

  const handleDelete = async (id) => {
    if(window.confirm('Are you sure you want to delete this order?')) {
      await supabase.from('sales').delete().eq('id', id);
      fetchSalesData();
    }
  };

  // KPI & Pending Calculations
  const currentMonthSales = sales.filter(s => s.dateStr && s.dateStr.startsWith(currentMonthPrefix));
  const currentMonthRevenue = currentMonthSales.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
  
  const totalItemsSold = sales.reduce((acc, curr) => acc + (curr.totalQty || 0), 0);
  const todaysSales = sales.filter(s => s.dateStr === todayStr);
  const todaysRevenue = todaysSales.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

  // Pending payments calculations
  const pendingSales = sales.filter(s => s.paymentMethod === 'Cash on Delivery' && (s.cod_paid || s.codPaid || 'No') === 'No');
  const totalPendingCount = pendingSales.length;
  const totalPendingAmount = pendingSales.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

  const designCounts = {};
  sales.forEach(sale => {
    if (sale.items) sale.items.forEach(it => {
      designCounts[it.itemName] = (designCounts[it.itemName] || 0) + (it.itemTotalQty || 0);
    });
  });
  const topDesigns = Object.entries(designCounts).sort((a, b) => b[1] - a[1]);

  const filteredSales = sales.filter(s => {
    if (activeTab === 'Pending Payments') {
      if (s.paymentMethod !== 'Cash on Delivery' || (s.cod_paid || s.codPaid || 'No') === 'Yes') return false;
      const subOpt = s.cod_sub_option || s.codSubOption;
      const riderOpt = s.local_rider_sub_option || s.localRiderSubOption;
      if (pendingFilter === 'PostEx' && subOpt !== 'PostEx') return false;
      if (pendingFilter === 'D&D' && (subOpt !== 'Local Rider' || riderOpt !== 'D&D')) return false;
      if (pendingFilter === 'Other' && (subOpt !== 'Local Rider' || riderOpt === 'D&D')) return false;
    }
    if (activeTab === 'PostEx Orders' && (s.paymentMethod !== 'Cash on Delivery' || (s.cod_sub_option || s.codSubOption) !== 'PostEx')) return false;
    const query = searchTerm.toLowerCase().trim();
    return query === '' || 
      (s.customerName && s.customerName.toLowerCase().includes(query)) ||
      (s.paymentMethod && s.paymentMethod.toLowerCase().includes(query)) ||
      (s.orderCode && s.orderCode.toLowerCase().includes(query)) ||
      (s.items && s.items.some(it => it.itemName && it.itemName.toLowerCase().includes(query))) ||
      String(s.orderNumber).includes(query);
  });

  const renderOrdersTable = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 bg-gray-50/50">
              <th className="py-4 px-6">Product name & Customer</th>
              <th className="py-4 px-6">Sizes</th>
              <th className="py-4 px-6">Total Qty</th>
              <th className="py-4 px-6">Amount</th>
              <th className="py-4 px-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {filteredSales.map((sale) => {
               const currentCodPaid = sale.cod_paid || sale.codPaid || 'No';
               const currentCodType = sale.cod_payment_type || sale.codPaymentType || 'Cash';

               return (
                 <tr key={sale.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                   <td className="py-4 px-6 align-top">
                     <div className="flex flex-col gap-1">
                        <button onClick={() => setDetailsModalSale(sale)} className="text-left font-bold text-gray-900 hover:text-purple-600 transition-colors text-base">
                          {sale.customerName}
                        </button>
                        
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="text-xs font-medium text-gray-500">{sale.displayDate}</span>
                          
                          {sale.paymentMethod === 'Advance Payment' ? (
                            <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded text-[11px] font-bold tracking-wide uppercase">Advance</span>
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
                   <td className="py-4 px-6 align-top text-gray-600">
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
                   <td className="py-4 px-6 font-medium text-gray-900 align-top mt-1">{sale.totalQty}</td>
                   
                   <td className="py-4 px-6 font-bold text-gray-900 align-top text-base">
                     PKR {(sale.totalAmount || 0).toLocaleString()}
                   </td>
                   
                   <td className="py-4 px-6 text-right align-top">
                     <div className="flex flex-col items-end gap-2">
                       <div className="flex gap-2">
                         <button onClick={() => handleEditClick(sale)} className="text-gray-400 hover:text-purple-600">
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                         </button>
                         <button onClick={() => handleDelete(sale.id)} className="text-gray-400 hover:text-red-500">
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                         </button>
                       </div>
                       
                       {sale.paymentMethod === 'Cash on Delivery' && (
                         <button
                           onClick={() => {
                             setCodModalSale(sale);
                             setModalCodPaid(sale.cod_paid || 'No');
                             setModalCodType(sale.cod_payment_type || 'Cash');
                           }}
                           className={`mt-1 px-3 py-1.5 rounded-full text-[11px] uppercase tracking-wide font-bold flex items-center gap-1 transition-colors ${currentCodPaid === 'No' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                         >
                           {currentCodPaid === 'No' ? 'Unpaid' : `Paid (${currentCodType})`}
                         </button>
                       )}
                     </div>
                   </td>
                 </tr>
               );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F8F9FB] font-sans text-gray-800">
      
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" style={{ display: 'none' }} />

      {/* LEFT SIDEBAR - ALWAYS VISIBLE */}
      <aside className="w-72 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 z-10">
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
            { name: 'Pending Payments', id: 'Pending Payments', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
            { name: 'Top Selling Designs', id: 'Top Selling Designs', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
            { name: 'Items Sold', id: 'Items Sold', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-purple-50 text-purple-700 font-semibold relative after:absolute after:left-0 after:top-2 after:bottom-2 after:w-1 after:bg-purple-600 after:rounded-r-full' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 font-medium'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon}></path></svg>
              <span>{item.name}</span>
              {item.id === 'Pending Payments' && totalPendingCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                  {totalPendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-8 z-10 shrink-0">
          <div className="flex-1 max-w-md relative">
            <svg className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input 
              type="text" 
              placeholder="Search orders, customers..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-purple-600 outline-none"
            />
          </div>
          <div className="flex items-center gap-6 ml-4">
            <div className="flex items-center gap-3 border-l border-gray-200 pl-6">
              <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold">AR</div>
              <span className="font-semibold text-sm hidden sm:block">Abdur Rahman</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{activeTab === 'Dashboard' ? 'Morning, Abdur!' : activeTab}</h1>
              <p className="text-sm text-gray-500 mt-1">{activeTab === 'Dashboard' ? "Here's what's happening with your store today." : `Manage your ${activeTab.toLowerCase()} data.`}</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleExportBackup} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                Export
              </button>
              <button onClick={handleOpenAddModal} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors hidden sm:block">
                + New Order
              </button>
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
                    Revenue ({currentMonthName})
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">PKR {currentMonthRevenue.toLocaleString()}</h2>
                    <p className="text-sm font-medium text-green-600 mt-2">Sales in {currentMonthName}</p>
                  </div>
                </div>

                <div className="bg-slate-50/90 p-6 rounded-2xl border-2 border-gray-200 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-4">
                    <div className="p-1.5 bg-blue-100 text-blue-700 rounded-md">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                    </div>
                    Today's Sales
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">PKR {todaysRevenue.toLocaleString()}</h2>
                    <p className="text-sm font-medium text-blue-600 mt-2">{todaysSales.length} orders today</p>
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
                    <h2 className="text-3xl font-bold text-gray-900">{totalItemsSold}</h2>
                    <p className="text-sm font-medium text-gray-500 mt-2">Total lifetime volume</p>
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
                    <h2 className="text-3xl font-bold text-gray-900">{sales.length}</h2>
                    <p className="text-sm font-medium text-gray-500 mt-2">Total logged entries</p>
                  </div>
                </div>
              </div>
              <div className="mt-8">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Orders</h3>
                {renderOrdersTable()}
              </div>
            </div>
          )}

          {activeTab === 'Orders' && <div className="space-y-4">{renderOrdersTable()}</div>}
          {activeTab === 'PostEx Orders' && <div className="space-y-4">{renderOrdersTable()}</div>}
          
          {activeTab === 'Pending Payments' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-red-50/80 border-2 border-red-200 p-5 rounded-2xl flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Total Pending Orders</p>
                    <p className="text-3xl font-black text-gray-900 mt-1">{totalPendingCount} Orders</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                  </div>
                </div>
                <div className="bg-red-50/80 border-2 border-red-200 p-5 rounded-2xl flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Total Pending Amount</p>
                    <p className="text-3xl font-black text-gray-900 mt-1">PKR {totalPendingAmount.toLocaleString()}</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                </div>
              </div>

              {/* Pending Filter Buttons */}
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'All', label: 'All Pending Payments' },
                  { key: 'PostEx', label: 'PostEx Pending' },
                  { key: 'D&D', label: 'D&D Pending' },
                  { key: 'Other', label: 'Service Delivery / Other' }
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

              {renderOrdersTable()}
            </div>
          )}

          {activeTab === 'Top Selling Designs' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden max-w-2xl">
               <ul className="divide-y divide-gray-100">
                  {topDesigns.map(([design, qty], index) => (
                    <li key={design} className="flex justify-between items-center px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <span className="text-gray-400 font-bold w-4">{index + 1}</span>
                        <span className="font-medium text-blue-600">{design}</span>
                      </div>
                      <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold">{qty} sold</span>
                    </li>
                  ))}
               </ul>
            </div>
          )}
          {activeTab === 'Items Sold' && (
             <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 max-w-md text-center">
               <h3 className="text-gray-500 font-semibold text-sm uppercase tracking-wider mb-2">Total Individual Items Sold</h3>
               <p className="text-5xl font-black text-gray-900">{totalItemsSold}</p>
             </div>
          )}
        </div>
      </main>

      {/* Add / Edit Order Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
              <h2 className="text-xl font-bold text-gray-900">{editingId ? 'Edit Order' : 'Add New Order'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                  <input type="text" required value={customerName} onChange={(e) => setCustomerName(toTitleCase(e.target.value))} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-600 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-600 outline-none">
                    <option value="Advance Payment">Advance Payment</option>
                    <option value="Cash on Delivery">Cash on Delivery</option>
                  </select>
                </div>
              </div>

              {paymentMethod === 'Cash on Delivery' && (
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-orange-800 mb-1">COD Option</label>
                    <select value={codSubOption} onChange={(e) => setCodSubOption(e.target.value)} className="w-full px-4 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none">
                      <option value="PostEx">PostEx</option>
                      <option value="Local Rider">Local Rider</option>
                    </select>
                  </div>
                  
                  {codSubOption === 'PostEx' && (
                    <div>
                      <label className="block text-sm font-medium text-orange-800 mb-1">PostEx Order Code</label>
                      <input type="text" required value={orderCode} onChange={(e) => setOrderCode(e.target.value)} className="w-full px-4 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="e.g. PE-12345" />
                    </div>
                  )}

                  {codSubOption === 'Local Rider' && (
                    <div>
                      <label className="block text-sm font-medium text-orange-800 mb-1">Select Rider</label>
                      <select value={localRiderSubOption} onChange={(e) => setLocalRiderSubOption(e.target.value)} className="w-full px-4 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none">
                        <option value="D&D">D&D</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <h3 className="font-semibold text-gray-900">Designs & Sizes</h3>
                </div>
                
                {orderItems.map((item) => (
                  <div key={item.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 relative">
                    <button type="button" onClick={() => handleRemoveDesignItem(item.id)} className="absolute top-2 right-2 text-red-400 hover:text-red-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 pr-6">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Design Name</label>
                        <input type="text" required value={item.itemName} onChange={(e) => handleItemFieldChange(item.id, 'itemName', e.target.value)} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md outline-none focus:border-purple-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Price (PKR)</label>
                        <input type="number" required min="0" value={item.price} onChange={(e) => handleItemFieldChange(item.id, 'price', e.target.value)} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md outline-none focus:border-purple-500" />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2">Quantities by Size</label>
                      <div className="flex gap-3">
                        {['S', 'M', 'L', 'XL'].map(sz => (
                          <div key={sz} className="flex-1 flex items-center border border-gray-200 rounded-md overflow-hidden bg-white">
                            <span className="bg-gray-100 px-2 py-1.5 text-xs font-bold text-gray-600 border-r border-gray-200">{sz}</span>
                            <input type="number" min="0" value={item.sizeQty[sz] || 0} onChange={(e) => handleItemSizeChange(item.id, sz, e.target.value)} className="w-full px-2 py-1.5 text-sm outline-none text-center" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                
                <button type="button" onClick={handleAddAnotherDesign} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-medium hover:border-purple-500 hover:text-purple-600 transition-colors">
                  + Add Another Design
                </button>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 shadow-sm">{editingId ? 'Update Order' : 'Save Order'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update COD Status Modal */}
      {codModalSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-900">Update COD Status</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Has this order been paid?</label>
                <select value={modalCodPaid} onChange={(e) => setModalCodPaid(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-600">
                  <option value="No">No (Unpaid)</option>
                  <option value="Yes">Yes (Paid)</option>
                </select>
              </div>
              {modalCodPaid === 'Yes' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Received Via</label>
                  <select value={modalCodType} onChange={(e) => setModalCodType(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-600">
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              )}
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setCodModalSale(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium text-sm">Cancel</button>
              <button onClick={handleSaveCodModal} className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium text-sm hover:bg-purple-700">Save Update</button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Details Modal */}
      {detailsModalSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50 rounded-t-2xl">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{detailsModalSale.customerName}</h2>
                <p className="text-sm text-gray-500 mt-1">Order #{detailsModalSale.orderNumber} • {detailsModalSale.displayDate}</p>
              </div>
              <button onClick={() => setDetailsModalSale(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-6">
              <div className="mb-6 pb-6 border-b border-gray-100">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Delivery Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Payment Method</p>
                    <p className="font-semibold text-gray-900">{detailsModalSale.paymentMethod}</p>
                  </div>
                  {detailsModalSale.paymentMethod === 'Cash on Delivery' && (
                    <>
                      <div>
                        <p className="text-gray-500">Courier/Rider</p>
                        <p className="font-semibold text-gray-900">
                          {detailsModalSale.cod_sub_option === 'Local Rider' 
                            ? detailsModalSale.local_rider_sub_option 
                            : detailsModalSale.cod_sub_option}
                        </p>
                      </div>
                      {detailsModalSale.orderCode && (
                        <div>
                          <p className="text-gray-500">Tracking Code</p>
                          <p className="font-semibold text-gray-900">{detailsModalSale.orderCode}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-gray-500">Payment Status</p>
                        <p className={`font-bold ${detailsModalSale.cod_paid === 'Yes' ? 'text-green-600' : 'text-red-500'}`}>
                          {detailsModalSale.cod_paid === 'Yes' ? `Paid (${detailsModalSale.cod_payment_type})` : 'Unpaid'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Order Items</h3>
                <div className="space-y-3">
                  {(detailsModalSale.items || []).map((it, idx) => (
                    <div key={idx} className="bg-gray-50 p-3 rounded-lg flex justify-between items-center border border-gray-100">
                      <div>
                        <p className="font-bold text-blue-600">{it.itemName}</p>
                        <div className="flex gap-2 mt-1">
                          {Object.entries(it.sizeQty).map(([sz, qty]) => qty > 0 ? (
                            <span key={sz} className="text-xs bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-600 font-medium">{sz}: {qty}</span>
                          ) : null)}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-700">PKR {it.price}</p>
                        <p className="text-xs text-gray-500">Qty: {it.itemTotalQty}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 bg-gray-50 border-t border-gray-100 rounded-b-2xl flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">Total Items</p>
                <p className="text-lg font-bold text-gray-900">{detailsModalSale.totalQty}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Grand Total</p>
                <p className="text-2xl font-black text-gray-900">PKR {(detailsModalSale.totalAmount || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
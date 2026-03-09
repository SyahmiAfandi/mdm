import React, { useEffect, useState } from 'react';
import { db } from '../../firebaseClient';
import {
    collection,
    getDocs,
    doc,
    setDoc,
    query,
    orderBy,
    serverTimestamp,
} from 'firebase/firestore';
import { useUser } from '../../context/UserContext';
import toast from 'react-hot-toast';
import { Save, RefreshCcw, LayoutGrid, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MAPPING_COL = 'recons_button_mapping';
const REPORT_TYPE_COL = 'master_reporttypes';

const IC_BUTTONS = [
    'Daily Sales Summary',
    'EFOS Outlet',
    'EFOS Salesman',
    'FCS IC',
    'IC IQ Performance',
    'Raw Data Invoice Level',
];

const HPC_BUTTONS = [
    'Daily Sales Summary',
    'EFOS Outlet',
    'EFOS Salesman',
    'FCS HPC',
    'IQ Performance Outlet',
    'IQ Performance Salesman',
    'Raw Data Invoice Level',
];

export default function ReconsButtonMappingPage() {
    const { user } = useUser();
    const email = user?.email || user?.uid || 'unknown';
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [reportTypes, setReportTypes] = useState([]);
    const [mappings, setMappings] = useState({}); // { "page_buttonLabel": "reportTypeId" }

    async function loadData() {
        try {
            setLoading(true);

            // 1. Load Report Types
            let rtSnap;
            try {
                rtSnap = await getDocs(query(collection(db, REPORT_TYPE_COL), orderBy('code', 'asc')));
            } catch (err) {
                console.error("Error loading report types:", err);
                toast.error(`Report Types error: ${err.message}`);
                return;
            }
            setReportTypes(rtSnap.docs.map(d => ({ id: d.id, ...d.data() })));

            // 2. Load Mappings
            let mapSnap;
            try {
                mapSnap = await getDocs(collection(db, MAPPING_COL));
            } catch (err) {
                // If it's just missing collection, don't throw error
                console.warn("Mappings collection empty or missing:", err);
                setMappings({});
                return;
            }

            const mapObj = {};
            mapSnap.docs.forEach(d => {
                const data = d.data();
                if (data.page && data.buttonLabel) {
                    mapObj[`${data.page}_${data.buttonLabel}`] = data.reportTypeId;
                }
            });
            setMappings(mapObj);
        } catch (e) {
            console.error(e);
            toast.error(`Load failed: ${e.message}`);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadData();
    }, []);

    const handleMappingChange = (page, buttonLabel, reportTypeId) => {
        setMappings(prev => ({
            ...prev,
            [`${page}_${buttonLabel}`]: reportTypeId,
        }));
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            const batchPromises = [];

            // Save IC mappings
            IC_BUTTONS.forEach(btn => {
                const key = `IC_${btn}`;
                const reportTypeId = mappings[key] || '';
                const rtObj = reportTypes.find(rt => rt.code === reportTypeId);
                const reportTypeName = rtObj ? rtObj.name : '';

                const docId = `IC_${btn.replace(/\s+/g, '_')}`;
                batchPromises.push(
                    setDoc(doc(db, MAPPING_COL, docId), {
                        page: 'IC',
                        buttonLabel: btn,
                        reportTypeId,
                        reportTypeName,
                        updatedAt: serverTimestamp(),
                        updatedBy: email,
                    }, { merge: true })
                );
            });

            // Save HPC mappings
            HPC_BUTTONS.forEach(btn => {
                const key = `HPC_${btn}`;
                const reportTypeId = mappings[key] || '';
                const rtObj = reportTypes.find(rt => rt.code === reportTypeId);
                const reportTypeName = rtObj ? rtObj.name : '';

                const docId = `HPC_${btn.replace(/\s+/g, '_')}`;
                batchPromises.push(
                    setDoc(doc(db, MAPPING_COL, docId), {
                        page: 'HPC',
                        buttonLabel: btn,
                        reportTypeId,
                        reportTypeName,
                        updatedAt: serverTimestamp(),
                        updatedBy: email,
                    }, { merge: true })
                );
            });

            await Promise.all(batchPromises);
            toast.success('Mappings saved successfully ✅');
        } catch (e) {
            console.error("Save error:", e);
            toast.error(`Save failed: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const renderSection = (title, page, buttons) => (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden mb-6 shadow-sm">
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">{title} Page Buttons</h3>
            </div>
            <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {buttons.map(btn => (
                        <div key={btn} className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {btn}
                            </label>
                            <select
                                value={mappings[`${page}_${btn}`] || ''}
                                onChange={(e) => handleMappingChange(page, btn, e.target.value)}
                                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 outline-none focus:border-violet-500 transition-colors"
                                disabled={loading}
                            >
                                <option value="">-- No Mapping --</option>
                                {reportTypes.map(rt => (
                                    <option key={rt.id} value={rt.code}>
                                        {rt.code} - {rt.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
                <div className="flex items-start gap-3">
                    <button
                        onClick={() => navigate('/recons')}
                        className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <LayoutGrid className="w-6 h-6 text-violet-600" />
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                Reconciliation Button Mapping
                            </h1>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Map UI buttons to their corresponding Master Data Report Type IDs.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 transition-all"
                    >
                        <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-violet-700 dark:bg-violet-700 dark:hover:bg-violet-800 transition-all disabled:opacity-60"
                    >
                        <Save className="h-4 w-4" />
                        Save Mappings
                    </button>
                </div>
            </div>

            {loading && !Object.keys(mappings).length ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-500 animate-pulse">Loading configurations...</p>
                </div>
            ) : (
                <>
                    {renderSection('IC', 'IC', IC_BUTTONS)}
                    {renderSection('HPC', 'HPC', HPC_BUTTONS)}

                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 mt-8">
                        <h4 className="text-amber-800 dark:text-amber-400 font-bold mb-1 flex items-center gap-2 text-sm">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-800 text-[10px]">!</span>
                            Important Note
                        </h4>
                        <p className="text-amber-700 dark:text-amber-500 text-xs leading-relaxed">
                            Mapped Report Type IDs (e.g., R001) are sent to the reconciliation upload page.
                            Ensure these codes match the "Code" field in Master Data — Report Types exactly.
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}

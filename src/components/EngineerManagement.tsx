import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Phone, Briefcase, Hash, Plus, Edit2, Trash2, Check, X, Search } from 'lucide-react';

interface Engineer {
  id: string;
  name: string;
  phone: string;
  project: string;
  code: string;
}

interface EngineerManagementProps {
  engineers: Engineer[];
  projectsList: string[];
  onSave: (updatedEngineers: Engineer[]) => void;
}

export default function EngineerManagement({ engineers, projectsList, onSave }: EngineerManagementProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [project, setProject] = useState('');
  const [code, setCode] = useState('');

  const handleResetForm = () => {
    setName('');
    setPhone('');
    setProject('');
    setCode('');
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleStartEdit = (eng: Engineer) => {
    setEditingId(eng.id);
    setName(eng.name);
    setPhone(eng.phone);
    setProject(eng.project);
    setCode(eng.code);
    setShowAddForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !project) {
      alert('الرجاء تعبئة اسم المهندس واختيار المشروع!');
      return;
    }

    if (editingId) {
      // Update
      const updated = engineers.map(eng => 
        eng.id === editingId ? { ...eng, name: name.trim(), phone: phone.trim(), project, code: code.trim() } : eng
      );
      onSave(updated);
    } else {
      // Create
      const newEngineer: Engineer = {
        id: `eng-${Date.now()}`,
        name: name.trim(),
        phone: phone.trim(),
        project,
        code: code.trim() || `ENG-${Math.floor(100 + Math.random() * 900)}`
      };
      onSave([newEngineer, ...engineers]);
    }

    handleResetForm();
  };

  const handleDelete = (id: string, engName: string) => {
    if (window.confirm(`هل أنت متأكد من حذف المهندس "${engName}" من النظام؟`)) {
      const updated = engineers.filter(eng => eng.id !== id);
      onSave(updated);
    }
  };

  const filteredEngineers = engineers.filter(eng => 
    eng.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    eng.project.toLowerCase().includes(searchQuery.toLowerCase()) ||
    eng.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header Panel */}
      <div className="bg-[#111827] border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 shadow-md">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-3 justify-end">
            <span>لوحة إدارة المهندسين</span>
            <User className="text-indigo-400 w-6 h-6" />
          </h2>
          <p className="text-slate-400 text-xs mt-1">إضافة، تعديل، وحذف المهندسين وتحديد مشاريعهم المسؤولين عنها لربطها بعهد المصروفات والمقاولين تلقائياً.</p>
        </div>
        <button
          onClick={() => {
            handleResetForm();
            setShowAddForm(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-3 rounded-xl flex items-center gap-2 shadow-lg cursor-pointer transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة مهندس جديد</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Side: CRUD Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md space-y-4"
            >
              <h3 className="text-sm font-bold text-white border-b border-slate-850 pb-3 flex items-center justify-end gap-2">
                <span>{editingId ? 'تعديل بيانات مهندس' : 'تسجيل مهندس جديد'}</span>
                <User className="text-indigo-400 w-4 h-4" />
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4 text-right">
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1.5">اسم المهندس الثلاثي *</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="مثال: م. محمد أحمد علي"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pr-10 pl-3.5 py-2.5 text-xs font-medium outline-none focus:border-indigo-500 text-right"
                    />
                    <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1.5">رقم الهاتف</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="مثال: 01012345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pr-10 pl-3.5 py-2.5 text-xs text-left outline-none focus:border-indigo-500"
                    />
                    <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1.5">المشروع المسؤول عنه حالياً *</label>
                  <div className="relative">
                    <select
                      value={project}
                      onChange={(e) => setProject(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pr-10 pl-3.5 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 cursor-pointer text-right appearance-none"
                    >
                      <option value="">-- اختر المشروع --</option>
                      {projectsList.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                      <option value="عام">عام / كافة المواقع</option>
                    </select>
                    <Briefcase className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1.5">الرقم الوظيفي / الكود</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="مثال: ENG-250"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pr-10 pl-3.5 py-2.5 text-xs text-left outline-none focus:border-indigo-500"
                    />
                    <Hash className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>حفظ البيانات</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-700"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right Side: Engineers Table */}
        <div className={`bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md space-y-4 ${showAddForm ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          {/* Search bar */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-850 pb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 shrink-0">
              <User className="text-indigo-400 w-4 h-4" />
              <span>جدول البحث والفلترة للمهندسين</span>
            </h3>
            
            <div className="relative w-full md:max-w-xs">
              <input
                type="text"
                placeholder="ابحث بالاسم، المشروع، أو الكود..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pr-10 pl-3.5 py-2 text-xs outline-none focus:border-indigo-500 text-right"
              />
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs font-bold">
                  <th className="pb-3 text-right">كود المهندس</th>
                  <th className="pb-3 text-right">الاسم الثلاثي</th>
                  <th className="pb-3 text-right">رقم الهاتف</th>
                  <th className="pb-3 text-right">المشروع الحالي</th>
                  <th className="pb-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredEngineers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-xs text-slate-500 font-bold">
                      لا يوجد مهندسين مسجلين يطابقون البحث.
                    </td>
                  </tr>
                ) : (
                  filteredEngineers.map((eng) => (
                    <tr key={eng.id} className="border-b border-slate-850 text-slate-300 text-xs hover:bg-slate-900/30 transition-all">
                      <td className="py-3.5 font-mono text-indigo-400 font-bold">
                        {eng.code}
                      </td>
                      <td className="py-3.5 font-bold text-white">
                        {eng.name}
                      </td>
                      <td className="py-3.5 font-mono text-slate-400">
                        {eng.phone || '-'}
                      </td>
                      <td className="py-3.5">
                        <span className="bg-indigo-950/40 text-indigo-400 border border-indigo-900/40 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                          {eng.project}
                        </span>
                      </td>
                      <td className="py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleStartEdit(eng)}
                            className="text-indigo-400 hover:text-indigo-300 p-1.5 rounded hover:bg-indigo-500/10 cursor-pointer transition-all"
                            title="تعديل البيانات"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(eng.id, eng.name)}
                            className="text-rose-500 hover:text-rose-400 p-1.5 rounded hover:bg-rose-500/10 cursor-pointer transition-all"
                            title="حذف المهندس"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

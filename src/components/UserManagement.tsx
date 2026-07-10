import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Trash2, 
  RefreshCw, 
  AlertCircle, 
  Check, 
  Loader2, 
  Shield, 
  ShieldAlert, 
  X, 
  Plus,
  Key,
  Save,
  CheckCircle,
  ArrowLeft,
  Edit
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'blocked';
  allowed_departments?: string[];
  createdAt?: string;
}

interface UserManagementProps {
  currentUser: any;
  onUpdateCurrentUser?: (user: any) => void;
  onBackToMain: () => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ currentUser, onUpdateCurrentUser, onBackToMain }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create User Modal/Form State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');
  const [newUserDepartments, setNewUserDepartments] = useState<string[]>(['procurement', 'petty_cash', 'subcontractors', 'labor_timesheet', 'cost_analysis']);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit User State (Edit User Modal)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editUserId, setEditUserId] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserNewEmail, setEditUserNewEmail] = useState('');
  const [editUserName, setEditUserName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editUserDepartments, setEditUserDepartments] = useState<string[]>(['procurement', 'petty_cash', 'subcontractors', 'labor_timesheet', 'cost_analysis']);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState('');

  const safeJson = async (res: Response) => {
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('تلقى المتصفح استجابة غير صالحة من السيرفر (ليست بتنسيق JSON). يرجى المحاولة لاحقاً.');
    }
    return await res.json();
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users');
      const data = await safeJson(res);
      if (res.ok && data.success) {
        setUsers(data.users);
      } else {
        setError(data.error || 'فشل تحميل قائمة المستخدمين');
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('حدث خطأ غير متوقع أثناء الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail || !newUserPassword) {
      setCreateError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    setCreatingUser(true);
    setCreateError('');
    try {
      const res = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
          allowed_departments: newUserDepartments
        })
      });
      const data = await safeJson(res);
      if (res.ok && data.success) {
        setSuccess('تم إنشاء حساب الموظف الجديد بنجاح!');
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserRole('user');
        setNewUserDepartments(['procurement', 'petty_cash', 'subcontractors', 'labor_timesheet', 'cost_analysis']);
        setCreateModalOpen(false);
        fetchUsers();
        setTimeout(() => setSuccess(''), 4000);
      } else {
        setCreateError(data.error || 'حدث خطأ أثناء إنشاء الحساب');
      }
    } catch (err) {
      console.error('Error creating user:', err);
      setCreateError('فشل الاتصال بالخادم.');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleUpdateUserRole = async (email: string, role: 'admin' | 'user') => {
    try {
      const res = await fetch('/api/admin/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role })
      });
      const data = await safeJson(res);
      if (res.ok && data.success) {
        setSuccess('تم تحديث الرتبة بنجاح!');
        fetchUsers();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        alert('فشل التحديث: ' + (data.error || 'خطأ غير معروف'));
      }
    } catch (err) {
      console.error('Error updating role:', err);
      alert('فشل الاتصال بالخادم لتحديث الرتبة.');
    }
  };

  const handleUpdateUserStatus = async (email: string, status: 'active' | 'blocked') => {
    try {
      const res = await fetch('/api/admin/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, status })
      });
      const data = await safeJson(res);
      if (res.ok && data.success) {
        setSuccess('تم تحديث حالة الموظف بنجاح!');
        fetchUsers();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        alert('فشل التحديث: ' + (data.error || 'خطأ غير معروف'));
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('فشل الاتصال بالخادم لتحديث الحالة.');
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserName || editUserName.trim().length === 0) {
      setEditError('الرجاء إدخال اسم الموظف');
      return;
    }
    if (!editUserNewEmail || editUserNewEmail.trim().length === 0) {
      setEditError('الرجاء إدخال البريد الإلكتروني للموظف');
      return;
    }

    setEditing(true);
    setEditError('');
    try {
      const payload: any = {
        id: editUserId,
        email: editUserEmail,
        name: editUserName.trim(),
        allowed_departments: editUserDepartments
      };

      if (editUserNewEmail.toLowerCase().trim() !== editUserEmail.toLowerCase().trim()) {
        payload.newEmail = editUserNewEmail.toLowerCase().trim();
      }

      if (editPassword && editPassword.trim().length > 0) {
        if (editPassword.trim().length < 6) {
          setEditError('يجب أن تكون كلمة المرور الجديدة مكونة من 6 أحرف على الأقل');
          setEditing(false);
          return;
        }
        payload.password = editPassword;
      }

      const res = await fetch('/api/admin/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await safeJson(res);
      if (res.ok && data.success) {
        setSuccess(`تم تحديث بيانات الموظف ${editUserName} بنجاح!`);

        // If updating the active logged-in user, update App.tsx current user state immediately
        if (editUserEmail.toLowerCase() === currentUser?.email?.toLowerCase() && onUpdateCurrentUser) {
          const updatedUser = {
            ...currentUser,
            name: editUserName.trim(),
            email: editUserNewEmail.toLowerCase().trim(),
            allowed_departments: editUserDepartments
          };
          onUpdateCurrentUser(updatedUser);
        }

        setEditPassword('');
        setEditModalOpen(false);
        fetchUsers();
        setTimeout(() => setSuccess(''), 4000);
      } else {
        setEditError(data.error || 'فشل تحديث البيانات');
      }
    } catch (err) {
      console.error('Error editing user:', err);
      setEditError('فشل الاتصال بالخادم.');
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteUser = async (email: string, name: string) => {
    const confirmDelete = window.confirm(`هل أنت متأكد تماماً من رغبتك في حذف حساب الموظف (${name}) نهائياً من قواعد البيانات؟ لا يمكن التراجع عن هذا الإجراء.`);
    if (!confirmDelete) return;

    try {
      const res = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await safeJson(res);
      if (res.ok && data.success) {
        setSuccess('تم حذف الموظف بنجاح من قاعدة البيانات!');
        fetchUsers();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        alert('فشل الحذف: ' + (data.error || 'خطأ غير معروف'));
      }
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('فشل الاتصال بالخادم لإتمام الحذف.');
    }
  };

  // Stats
  const activeCount = users.filter(u => u.status === 'active').length;
  const blockedCount = users.filter(u => u.status === 'blocked').length;

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans overflow-x-hidden w-full max-w-full p-6 text-right select-none" dir="rtl">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        
        {/* Header */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-md flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl">
          <div className="flex items-center gap-4 text-right md:order-2">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-400 border border-sky-500/20 shadow-md">
              <Users className="w-6 h-6" />
            </div>
            <div className="text-right">
              <h1 className="text-xl font-bold text-white font-sans flex items-center gap-2">
                <span>لوحة التحكم بالمستخدمين والصلاحيات</span>
                <span className="text-xs bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2.5 py-1 rounded-full font-mono">Role-Based System</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">إدارة حسابات الموظفين وتعيين رتبهم (admin / user) وصلاحياتهم الأمنية</p>
            </div>
          </div>

          <div className="flex items-center gap-3 md:order-1">
            <button
              onClick={onBackToMain}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 px-5 rounded-xl border border-slate-700 transition-all text-sm flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              العودة للموقع الرئيسي
            </button>

            <button
              onClick={fetchUsers}
              disabled={loading}
              className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 text-slate-300 font-bold py-2.5 px-5 rounded-xl border border-slate-700 transition-all text-sm flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              تحديث القائمة
            </button>

            <button
              onClick={() => {
                setCreateError('');
                setCreateModalOpen(true);
              }}
              className="bg-sky-500 hover:bg-sky-600 text-slate-950 font-bold py-2.5 px-5 rounded-xl shadow-lg shadow-sky-500/10 transition-all text-sm flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              إضافة موظف جديد
            </button>
          </div>
        </div>

        {/* Global Notification Alerts */}
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm py-3 px-5 rounded-xl font-bold flex items-center gap-2 justify-start shadow-md">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm py-3 px-5 rounded-xl font-bold flex items-center gap-2 justify-start shadow-md">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Counters / Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between text-right shadow-md">
            <div>
              <span className="text-xs text-slate-400 block mb-1">الموظفين المسجلين</span>
              <span className="text-2xl font-black text-sky-400 font-mono">
                {users.length}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between text-right shadow-md">
            <div>
              <span className="text-xs text-slate-400 block mb-1">الحسابات النشطة</span>
              <span className="text-2xl font-black text-emerald-400 font-mono">
                {activeCount}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Check className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between text-right shadow-md">
            <div>
              <span className="text-xs text-slate-400 block mb-1">الحسابات المعطلة</span>
              <span className="text-2xl font-black text-red-400 font-mono">
                {blockedCount}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* User Management List */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-sky-400" />
              <span className="text-sm text-slate-400">جاري تحميل حسابات الموظفين والاعتمادات...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="p-20 text-center text-slate-500">
              <AlertCircle className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <span>لا يوجد موظفون مسجلون حالياً في النظام.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-xs font-bold uppercase select-none">
                    <th className="py-4 px-6 text-center">حالة الحساب</th>
                    <th className="py-4 px-6 text-center">رتبة الصلاحيات (Role)</th>
                    <th className="py-4 px-6 text-right">الأقسام المصرح بها</th>
                    <th className="py-4 px-6 text-right">البريد الإلكتروني</th>
                    <th className="py-4 px-6 text-right">اسم الموظف</th>
                    <th className="py-4 px-6 text-center">#</th>
                    <th className="py-4 px-6 text-center">إجراءات التحكم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 bg-slate-900/20">
                  {users.map((user, index) => {
                    const isSelf = user.email.toLowerCase() === currentUser?.email?.toLowerCase();
                    return (
                      <tr key={`${user.id || index}_${user.email}`} className={`hover:bg-slate-800/25 transition-all ${isSelf ? 'bg-sky-500/5' : ''}`}>
                        
                        {/* Account Status */}
                        <td className="py-4 px-6 align-middle text-center">
                          <button
                            disabled={isSelf}
                            onClick={() => handleUpdateUserStatus(user.email, user.status === 'active' ? 'blocked' : 'active')}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all border ${
                              isSelf ? 'opacity-55 cursor-not-allowed' : 'cursor-pointer'
                            } ${
                              user.status === 'active' 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' 
                                : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                            }`}
                          >
                            {user.status === 'active' ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>حساب نشط (Active)</span>
                              </>
                            ) : (
                              <>
                                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                                <span>حساب معطل (Blocked)</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Role Select */}
                        <td className="py-4 px-6 align-middle text-center">
                          <select
                            disabled={isSelf}
                            value={user.role || 'user'}
                            onChange={(e) => handleUpdateUserRole(user.email, e.target.value as 'admin' | 'user')}
                            className={`bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-sky-500 transition-all font-bold font-sans text-center min-w-[150px] ${
                              isSelf ? 'opacity-55 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                          >
                            <option value="user">👨‍💻 موظف عادي (User)</option>
                            <option value="admin">👑 مدير النظام (Admin)</option>
                          </select>
                        </td>

                        {/* Allowed Departments badges */}
                        <td className="py-4 px-6 align-middle text-right">
                          <div className="flex flex-wrap gap-1 justify-end max-w-xs">
                            {(user.allowed_departments || ['procurement', 'petty_cash', 'subcontractors', 'labor_timesheet', 'cost_analysis']).map((dep) => {
                              let label = "";
                              let colorClass = "";
                              if (dep === "procurement") {
                                label = "المشتريات";
                                colorClass = "bg-sky-500/10 text-sky-400 border-sky-500/20";
                              } else if (dep === "petty_cash") {
                                label = "العهد ومصروفات المشاريع";
                                colorClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                              } else if (dep === "subcontractors") {
                                label = "مستخلصات المقاولين";
                                colorClass = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                              } else if (dep === "labor_timesheet") {
                                label = "العمالة اليومية";
                                colorClass = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
                              } else if (dep === "cost_analysis") {
                                label = "تحليل بنود المصروفات";
                                colorClass = "bg-rose-500/10 text-rose-400 border-rose-500/20";
                              }
                              if (!label) return null;
                              return (
                                <span key={dep} className={`text-[10px] px-2.5 py-1 rounded-lg border font-sans font-bold whitespace-nowrap ${colorClass}`}>
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-4 px-6 font-mono text-xs text-sky-400 align-middle text-right" dir="ltr">
                          {user.email}
                        </td>

                        {/* Employee Name */}
                        <td className="py-4 px-6 align-middle text-right font-sans">
                          <span className="text-slate-200 text-sm font-semibold block">{user.name}</span>
                          {isSelf && <span className="text-xs text-emerald-400 font-bold block mt-0.5">★ حسابك الحالي النشط</span>}
                        </td>

                        {/* Index */}
                        <td className="py-4 px-6 text-center text-slate-500 font-mono align-middle">
                          {index + 1}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-center align-middle">
                          <div className="flex items-center justify-center gap-3">
                            <button
                              onClick={() => {
                                setEditUserId(user.id);
                                setEditUserEmail(user.email);
                                setEditUserNewEmail(user.email);
                                setEditUserName(user.name);
                                setEditPassword('');
                                setEditError('');
                                setEditUserDepartments(user.allowed_departments || ['procurement', 'petty_cash', 'subcontractors', 'labor_timesheet', 'cost_analysis']);
                                setEditModalOpen(true);
                              }}
                              className="bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-slate-950 px-3 py-1.5 rounded-xl transition-all cursor-pointer text-xs font-black flex items-center gap-1.5 border border-amber-500/20 shadow-md shadow-amber-500/5"
                              title="تعديل بيانات الحساب"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>تعديل (Edit)</span>
                            </button>

                            <button
                              disabled={isSelf}
                              onClick={() => handleDeleteUser(user.email, user.name)}
                              className={`p-2 rounded-xl hover:bg-red-500/10 transition-all inline-flex items-center justify-center ${
                                isSelf ? 'text-slate-650 cursor-not-allowed' : 'text-red-500 hover:text-red-400 cursor-pointer'
                              }`}
                              title="حذف الحساب نهائياً"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => setCreateModalOpen(false)}
              className="absolute top-4 left-4 text-slate-500 hover:text-slate-300 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-right mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 justify-start">
                <Users className="w-5 h-5 text-sky-400" />
                <span>إضافة حساب موظف جديد</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">قم بتعبئة البيانات لتأمين وصلاحيات الموظف في النظام</p>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-right">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 mr-1">اسم الموظف الكامل</label>
                <input 
                  type="text"
                  required
                  placeholder="أدخل الاسم..."
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-4 py-2.5 text-slate-200 text-sm outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 mr-1">البريد الإلكتروني الموظف (Email)</label>
                <input 
                  type="email"
                  required
                  placeholder="employee@delta.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-4 py-2.5 text-slate-200 text-sm outline-none transition-all text-left font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 mr-1">كلمة مرور أولية</label>
                <input 
                  type="text"
                  required
                  placeholder="أدخل كلمة المرور..."
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-4 py-2.5 text-slate-200 text-sm outline-none transition-all text-left font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 mr-1">الرتبة في النظام</label>
                <select 
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'user')}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-4 py-2.5 text-slate-200 text-sm outline-none transition-all cursor-pointer font-bold font-sans"
                >
                  <option value="user">👨‍💻 موظف عادي (تصفح فواتير POs فقط)</option>
                  <option value="admin">👑 مدير النظام (صلاحية تحكم كاملة)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">الأقسام المصرح بالوصول إليها (Allowed Departments)</label>
                <div className="space-y-2.5 bg-slate-950 border border-slate-850 p-4 rounded-xl text-right">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-300 hover:text-white transition-all select-none">
                    <input 
                      type="checkbox"
                      checked={newUserDepartments.includes('procurement')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewUserDepartments([...newUserDepartments, 'procurement']);
                        } else {
                          setNewUserDepartments(newUserDepartments.filter(d => d !== 'procurement'));
                        }
                      }}
                      className="rounded border-slate-800 text-sky-500 focus:ring-sky-500 h-4 w-4 bg-slate-900 accent-sky-500"
                    />
                    <span>المشتريات والموردين (Procurement & Vendors)</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-300 hover:text-white transition-all select-none">
                    <input 
                      type="checkbox"
                      checked={newUserDepartments.includes('petty_cash')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewUserDepartments([...newUserDepartments, 'petty_cash']);
                        } else {
                          setNewUserDepartments(newUserDepartments.filter(d => d !== 'petty_cash'));
                        }
                      }}
                      className="rounded border-slate-800 text-sky-500 focus:ring-sky-500 h-4 w-4 bg-slate-900 accent-sky-500"
                    />
                    <span>العهد النقدية ومصروفات المشاريع (Petty Cash & Site Expenses)</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-300 hover:text-white transition-all select-none">
                    <input 
                      type="checkbox"
                      checked={newUserDepartments.includes('subcontractors')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewUserDepartments([...newUserDepartments, 'subcontractors']);
                        } else {
                          setNewUserDepartments(newUserDepartments.filter(d => d !== 'subcontractors'));
                        }
                      }}
                      className="rounded border-slate-800 text-sky-500 focus:ring-sky-500 h-4 w-4 bg-slate-900 accent-sky-500"
                    />
                    <span>مستخلصات المقاولين (Subcontractor Certificates)</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-300 hover:text-white transition-all select-none">
                    <input 
                      type="checkbox"
                      checked={newUserDepartments.includes('labor_timesheet')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewUserDepartments([...newUserDepartments, 'labor_timesheet']);
                        } else {
                          setNewUserDepartments(newUserDepartments.filter(d => d !== 'labor_timesheet'));
                        }
                      }}
                      className="rounded border-slate-800 text-sky-500 focus:ring-sky-500 h-4 w-4 bg-slate-900 accent-sky-500"
                    />
                    <span>كشوف وحضور العمالة اليومية (Labor Timesheet)</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-300 hover:text-white transition-all select-none">
                    <input 
                      type="checkbox"
                      checked={newUserDepartments.includes('cost_analysis')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewUserDepartments([...newUserDepartments, 'cost_analysis']);
                        } else {
                          setNewUserDepartments(newUserDepartments.filter(d => d !== 'cost_analysis'));
                        }
                      }}
                      className="rounded border-slate-800 text-sky-500 focus:ring-sky-500 h-4 w-4 bg-slate-900 accent-sky-500"
                    />
                    <span>تحليل بنود المصروفات (Cost Analysis)</span>
                  </label>
                </div>
              </div>

              {createError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-2 px-3 rounded-xl font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <button 
                type="submit"
                disabled={creatingUser}
                className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-sky-700 text-slate-950 font-black py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {creatingUser ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                إنشاء الحساب وتفعيل الصلاحيات
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => setEditModalOpen(false)}
              className="absolute top-4 left-4 text-slate-500 hover:text-slate-300 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-right mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 justify-start">
                <Edit className="w-5 h-5 text-amber-500 animate-pulse" />
                <span>تعديل بيانات حساب الموظف</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">تعديل حساب: <span className="text-sky-400 font-bold">{editUserEmail}</span></p>
            </div>

            <form onSubmit={handleEditUser} className="space-y-4 text-right">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 mr-1">اسم الموظف الكامل (Name)</label>
                <input 
                  type="text"
                  required
                  placeholder="أدخل الاسم..."
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-slate-200 text-sm outline-none transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 mr-1">البريد الإلكتروني (Email)</label>
                <input 
                  type="email"
                  required
                  placeholder="أدخل البريد الإلكتروني..."
                  value={editUserNewEmail}
                  onChange={(e) => setEditUserNewEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-slate-200 text-sm outline-none transition-all text-left font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 mr-1">كلمة المرور الجديدة (New Password)</label>
                <input 
                  type="text"
                  placeholder="اتركها فارغة للاحتفاظ بكلمة المرور الحالية..."
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-slate-200 text-sm outline-none transition-all text-left font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">الأقسام المصرح بالوصول إليها (Allowed Departments)</label>
                <div className="space-y-2.5 bg-slate-950 border border-slate-850 p-4 rounded-xl text-right">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-300 hover:text-white transition-all select-none">
                    <input 
                      type="checkbox"
                      checked={editUserDepartments.includes('procurement')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditUserDepartments([...editUserDepartments, 'procurement']);
                        } else {
                          setEditUserDepartments(editUserDepartments.filter(d => d !== 'procurement'));
                        }
                      }}
                      className="rounded border-slate-800 text-amber-500 focus:ring-amber-500 h-4 w-4 bg-slate-900 accent-amber-500"
                    />
                    <span>المشتريات والموردين (Procurement & Vendors)</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-300 hover:text-white transition-all select-none">
                    <input 
                      type="checkbox"
                      checked={editUserDepartments.includes('petty_cash')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditUserDepartments([...editUserDepartments, 'petty_cash']);
                        } else {
                          setEditUserDepartments(editUserDepartments.filter(d => d !== 'petty_cash'));
                        }
                      }}
                      className="rounded border-slate-800 text-amber-500 focus:ring-amber-500 h-4 w-4 bg-slate-900 accent-amber-500"
                    />
                    <span>العهد النقدية ومصروفات المشاريع (Petty Cash & Site Expenses)</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-300 hover:text-white transition-all select-none">
                    <input 
                      type="checkbox"
                      checked={editUserDepartments.includes('subcontractors')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditUserDepartments([...editUserDepartments, 'subcontractors']);
                        } else {
                          setEditUserDepartments(editUserDepartments.filter(d => d !== 'subcontractors'));
                        }
                      }}
                      className="rounded border-slate-800 text-amber-500 focus:ring-amber-500 h-4 w-4 bg-slate-900 accent-amber-500"
                    />
                    <span>مستخلصات المقاولين (Subcontractor Certificates)</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-300 hover:text-white transition-all select-none">
                    <input 
                      type="checkbox"
                      checked={editUserDepartments.includes('labor_timesheet')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditUserDepartments([...editUserDepartments, 'labor_timesheet']);
                        } else {
                          setEditUserDepartments(editUserDepartments.filter(d => d !== 'labor_timesheet'));
                        }
                      }}
                      className="rounded border-slate-800 text-amber-500 focus:ring-amber-500 h-4 w-4 bg-slate-900 accent-amber-500"
                    />
                    <span>كشوف وحضور العمالة اليومية (Labor Timesheet)</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-300 hover:text-white transition-all select-none">
                    <input 
                      type="checkbox"
                      checked={editUserDepartments.includes('cost_analysis')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditUserDepartments([...editUserDepartments, 'cost_analysis']);
                        } else {
                          setEditUserDepartments(editUserDepartments.filter(d => d !== 'cost_analysis'));
                        }
                      }}
                      className="rounded border-slate-800 text-amber-500 focus:ring-amber-500 h-4 w-4 bg-slate-900 accent-amber-500"
                    />
                    <span>تحليل بنود المصروفات (Cost Analysis)</span>
                  </label>
                </div>
              </div>

              {editError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-2 px-3 rounded-xl font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <button 
                type="submit"
                disabled={editing}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-amber-700 text-slate-950 font-black py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {editing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                حفظ التعديلات
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

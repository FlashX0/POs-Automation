import React, { useState, FormEvent } from 'react';
import { Mail, Lock, Shield, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: any) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('الرجاء إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        onLoginSuccess(data.user);
      } else {
        setError(data.error || 'فشل تسجيل الدخول. يرجى التحقق من بيانات الاعتماد.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة لاحقاً.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center font-sans p-6 relative overflow-hidden select-none" dir="rtl">
      {/* Dynamic Ambient Background Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-sky-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-md w-full bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-md shadow-2xl relative overflow-hidden z-10">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500"></div>

        {/* Brand Header */}
        <div className="text-center flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-400 mb-4 border border-sky-500/20 shadow-lg shadow-sky-500/5">
            <Shield className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2 font-sans tracking-tight">بوابة تسجيل الدخول الآمنة</h2>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
            نظام إدارة المشتريات والاعتمادات. يرجى إدخال البريد الإلكتروني وكلمة المرور الخاصة بك.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 mr-1 text-right">البريد الإلكتروني (Email)</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="employee@delta.com"
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-700 text-sm outline-none transition-all pr-10 text-right font-mono"
                required
                autoFocus
              />
              <div className="absolute inset-y-0 right-3 flex items-center text-slate-600">
                <Mail className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 mr-1 text-right">كلمة المرور (Password)</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-700 text-sm outline-none transition-all pr-10 pl-10 text-right font-mono"
                required
              />
              <div className="absolute inset-y-0 right-3 flex items-center text-slate-600">
                <Lock className="w-4 h-4" />
              </div>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 left-3 flex items-center text-slate-500 hover:text-slate-300 transition-all cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-2.5 px-4 rounded-xl font-bold flex items-center gap-2 justify-start animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-sky-700 text-slate-950 font-black py-3.5 px-6 rounded-xl shadow-lg shadow-sky-500/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer font-sans"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Shield className="w-4 h-4" />
            )}
            {loading ? 'جاري التحقق من الصلاحيات...' : 'تسجيل الدخول'}
          </button>
        </form>


      </div>
    </div>
  );
};

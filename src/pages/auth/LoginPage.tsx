import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, LogIn, UserPlus, Cloud, HardDrive, ArrowLeft } from 'lucide-react';
import { indianStates } from '@/lib/storage';
import { toast } from 'sonner';
import { UserRole } from '@/types';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    login, 
    loginLocal, 
    register, 
    registerLocal, 
    isAuthenticated, 
    isCloudMode,
    switchToCloudMode,
    switchToLocalMode,
    loading 
  } = useAuth();
  
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showModeSelection, setShowModeSelection] = useState(true);

  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    companyName: '',
    gstState: '',
    role: 'admin' as UserRole,
  });

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, loading, navigate]);

  const handleModeSelect = (mode: 'cloud' | 'local') => {
    if (mode === 'cloud') {
      switchToCloudMode();
    } else {
      switchToLocalMode();
    }
    setShowModeSelection(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (isCloudMode) {
        // Cloud mode
        if (isRegister) {
          if (formData.password !== formData.confirmPassword) {
            toast.error('Passwords do not match');
            return;
          }

          if (formData.password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
          }

          const result = await register({
            email: formData.email,
            password: formData.password,
            fullName: formData.fullName,
            companyName: formData.companyName,
            gstState: formData.gstState,
            role: formData.role,
          });

          if (result.success) {
            toast.success('Account created! You can now login.');
            setIsRegister(false);
            setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
          } else {
            toast.error(result.error || 'Registration failed');
          }
        } else {
          const result = await login(formData.email, formData.password);
          
          if (result.success) {
            toast.success('Welcome back!');
            navigate('/dashboard');
          } else {
            toast.error(result.error || 'Login failed');
          }
        }
      } else {
        // Local mode
        if (isRegister) {
          if (formData.password !== formData.confirmPassword) {
            toast.error('Passwords do not match');
            return;
          }

          const result = registerLocal({
            username: formData.username,
            password: formData.password,
            role: formData.role,
            companyName: formData.companyName,
            gstState: formData.gstState,
          });

          if (result.success) {
            toast.success('Account created successfully! Please login.');
            setIsRegister(false);
            setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
          } else {
            toast.error(result.error || 'Registration failed');
          }
        } else {
          const result = loginLocal(formData.username, formData.password);
          
          if (result.success) {
            toast.success('Welcome back!');
            navigate('/dashboard');
          } else {
            toast.error(result.error || 'Login failed');
          }
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Mode Selection Screen
  if (showModeSelection) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-12">
            <div className="w-20 h-20 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-6 floating-logo">
              <span className="text-3xl font-bold text-primary-foreground">H9</span>
            </div>
            <h1 className="text-4xl font-bold gradient-text mb-2">Hello9 FINEXA™</h1>
            <p className="text-muted-foreground">Smart Accounting • GST • Offline + Cloud</p>
          </div>

          <h2 className="text-2xl font-semibold text-center mb-8">Choose Your Mode</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => handleModeSelect('local')}
              className="p-8 rounded-2xl border-2 border-border hover:border-primary transition-all duration-300 bg-card hover:shadow-lg group"
            >
              <HardDrive className="w-16 h-16 mx-auto mb-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <h3 className="text-xl font-semibold mb-2">Offline Mode</h3>
              <p className="text-sm text-muted-foreground mb-4">
                100% offline. Data stored locally on this device only.
                No internet required.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <span className="px-3 py-1 bg-muted rounded-full text-xs">No Internet</span>
                <span className="px-3 py-1 bg-muted rounded-full text-xs">Local Storage</span>
                <span className="px-3 py-1 bg-muted rounded-full text-xs">Single Device</span>
              </div>
            </button>

            <button
              onClick={() => handleModeSelect('cloud')}
              className="p-8 rounded-2xl border-2 border-border hover:border-primary transition-all duration-300 bg-card hover:shadow-lg group relative overflow-hidden"
            >
              <div className="absolute top-2 right-2 px-2 py-1 bg-primary text-primary-foreground text-xs rounded-full">
                Recommended
              </div>
              <Cloud className="w-16 h-16 mx-auto mb-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <h3 className="text-xl font-semibold mb-2">Cloud Mode</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Secure cloud sync. Access from any device.
                Automatic backups included.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <span className="px-3 py-1 bg-muted rounded-full text-xs">Multi-Device</span>
                <span className="px-3 py-1 bg-muted rounded-full text-xs">Cloud Backup</span>
                <span className="px-3 py-1 bg-muted rounded-full text-xs">Secure</span>
              </div>
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-8">
            Made in India 🇮🇳 • Developed by Dhairya Patel
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-bg relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-30" />
        
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-primary-foreground">
          <div className="w-24 h-24 rounded-2xl bg-white/10 backdrop-blur-lg flex items-center justify-center mb-8 floating-logo shadow-2xl">
            <span className="text-4xl font-bold">H9</span>
          </div>
          
          <h1 className="text-4xl font-bold mb-4 text-center">Hello9 FINEXA™</h1>
          <p className="text-xl opacity-90 mb-2">Smart Accounting • GST • {isCloudMode ? 'Cloud' : 'Offline'}</p>
          <p className="text-sm opacity-70 mb-12">Made in India 🇮🇳</p>
          
          <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
            {[
              isCloudMode ? 'Cloud Sync' : '100% Offline',
              'Multi-User',
              'GST Compliant',
              'Secure Data',
            ].map((feature) => (
              <div key={feature} className="bg-white/10 backdrop-blur-lg rounded-xl p-4 text-center">
                <span className="text-sm font-medium">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Back button */}
          <button
            onClick={() => setShowModeSelection(true)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft size={16} />
            <span className="text-sm">Change mode</span>
          </button>

          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-xl gradient-bg flex items-center justify-center mb-4 floating-logo">
              <span className="text-2xl font-bold text-primary-foreground">H9</span>
            </div>
            <h1 className="text-2xl font-bold gradient-text">Hello9 FINEXA™</h1>
          </div>

          {/* Mode Badge */}
          <div className="flex justify-center mb-6">
            <span className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${
              isCloudMode 
                ? 'bg-primary/10 text-primary' 
                : 'bg-muted text-muted-foreground'
            }`}>
              {isCloudMode ? <Cloud size={16} /> : <HardDrive size={16} />}
              {isCloudMode ? 'Cloud Mode' : 'Offline Mode'}
            </span>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2">
              {isRegister ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-muted-foreground">
              {isRegister
                ? 'Start managing your business today'
                : 'Sign in to continue to your dashboard'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isCloudMode ? (
              // Cloud mode - Email based
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-field"
                  placeholder="you@company.com"
                  required
                />
              </div>
            ) : (
              // Local mode - Username based
              <div>
                <label className="block text-sm font-medium mb-2">Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="input-field"
                  placeholder="Enter your username"
                  required
                />
              </div>
            )}

            {isRegister && (
              <>
                {isCloudMode && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Full Name</label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="input-field"
                      placeholder="Your full name"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-2">Company Name</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="input-field"
                    placeholder="Your business name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">GST State</label>
                  <select
                    value={formData.gstState}
                    onChange={(e) => setFormData({ ...formData, gstState: e.target.value })}
                    className="input-field"
                    required
                  >
                    <option value="">Select State</option>
                    {indianStates.map((state) => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="input-field"
                  >
                    <option value="admin">Admin (Full Access)</option>
                    <option value="accountant">Accountant (No Settings)</option>
                    <option value="viewer">Viewer (Read Only)</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input-field pr-12"
                  placeholder="••••••••"
                  required
                  minLength={isCloudMode ? 6 : 4}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {isRegister && (
              <div>
                <label className="block text-sm font-medium mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="input-field"
                  placeholder="••••••••"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : isRegister ? (
                <>
                  <UserPlus size={20} />
                  Create Account
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-primary hover:underline text-sm font-medium"
            >
              {isRegister
                ? 'Already have an account? Sign in'
                : "Don't have an account? Create one"}
            </button>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            By continuing, you agree to our Privacy Policy.
            <br />
            {isCloudMode 
              ? 'Data is securely stored in the cloud.'
              : 'All data is stored locally on your device.'}
          </p>
        </div>
      </div>
    </div>
  );
};

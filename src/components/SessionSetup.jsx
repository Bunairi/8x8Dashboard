import { useState } from 'react';
import { LogIn, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SessionSetup({ onSave, sessionExpired }) {
  const [status, setStatus]   = useState('idle'); // idle | waiting | error | done
  const [errorMsg, setErrorMsg] = useState('');

  const openLogin = async () => {
    setStatus('waiting');
    setErrorMsg('');
    try {
      const resp = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || `Error ${resp.status}`);
      setStatus('done');
      setTimeout(onSave, 800);
    } catch (err) {
      setErrorMsg(err.message);
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/25">
            <span className="text-white font-bold text-lg">8×8</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">
            {sessionExpired ? 'Session Expired' : 'Connect to 8x8'}
          </h1>
          <p className="text-gray-500 text-sm">
            {sessionExpired
              ? 'Your session expired. Click below to sign in again.'
              : 'Click the button to open a login window.'}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">

          {status === 'idle' || status === 'error' ? (
            <>
              <p className="text-sm text-gray-400 leading-relaxed">
                A Chrome window will open — log in to 8x8 as you normally would
                (including any 2FA prompt). The window closes automatically once
                you're in.
              </p>

              {status === 'error' && (
                <div className="flex items-start gap-2 bg-red-900/20 border border-red-500/20 rounded-xl p-3">
                  <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-red-300 text-xs">{errorMsg}</p>
                </div>
              )}

              <button
                onClick={openLogin}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-xl text-sm transition-colors shadow-lg shadow-indigo-500/20"
              >
                <LogIn size={14} />
                Open Login Window
              </button>
            </>
          ) : status === 'waiting' ? (
            <div className="text-center py-4 space-y-3">
              <Loader2 size={28} className="animate-spin text-indigo-400 mx-auto" />
              <p className="text-sm text-gray-300 font-medium">Chrome is open — log in now</p>
              <p className="text-xs text-gray-500">Complete 2FA if prompted. This window will update automatically when you're done.</p>
            </div>
          ) : (
            <div className="text-center py-4 space-y-3">
              <CheckCircle2 size={28} className="text-green-400 mx-auto" />
              <p className="text-sm text-green-300 font-medium">Signed in successfully!</p>
            </div>
          )}
        </div>

        <p className="text-center text-gray-700 text-xs mt-4">
          Your session is saved locally — you won't need to log in again until it expires.
        </p>
      </div>
    </div>
  );
}

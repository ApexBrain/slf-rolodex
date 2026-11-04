import { useEffect, useState } from 'react';
import { Smartphone, X, Share, PlusSquare, MoreVertical, Download, ExternalLink } from 'lucide-react';
import { canPromptInstall, promptInstall, onInstallChange, isStandalone, detectPlatform } from '../install.js';

// "Get the app": puts SLF Rolodex on the phone's home screen (no app store).
// Android gets a one-tap install when the browser allows it; iPhone gets Share > Add to Home Screen steps;
// in-app browsers (Facebook, Instagram, etc.) are told to open the page in Safari/Chrome first;
// desktop gets a QR code that opens this sheet on the phone.

function Step({ n, children }) {
    return (
        <li className="flex gap-3 items-start">
            <span className="shrink-0 w-7 h-7 rounded-full bg-emerald/15 text-emerald text-[14px] font-bold flex items-center justify-center">{n}</span>
            <span className="pt-0.5 text-[15px] text-gray-200 leading-snug">{children}</span>
        </li>
    );
}

const Key = ({ children }) => (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-white/10 text-white text-[14px] font-semibold align-middle">{children}</span>
);

function InstallSheet({ open, onClose }) {
    const [platform] = useState(() => detectPlatform());
    const [tab, setTab] = useState(() => (detectPlatform().android ? 'android' : 'iphone'));
    const [canPrompt, setCanPrompt] = useState(canPromptInstall());
    const [installed, setInstalled] = useState(false);

    useEffect(() => onInstallChange(() => setCanPrompt(canPromptInstall())), []);
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    }, [open, onClose]);

    if (!open) return null;

    const doInstall = async () => {
        const outcome = await promptInstall();
        if (outcome === 'accepted') setInstalled(true);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="get-app-title">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-slate-dark border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-heavy animate-fade-in">
                <div className="sm:hidden mx-auto -mt-2 mb-4 w-10 h-1 rounded-full bg-white/20" />
                <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400">
                    <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-4 pr-10">
                    <img src="/icons/icon-192.png" alt="" className="w-16 h-16 rounded-[18px] shadow-card" />
                    <div>
                        <h2 id="get-app-title" className="text-[20px] font-bold text-white leading-tight">SLF Rolodex</h2>
                        <p className="text-[14px] text-gray-400">Free · iPhone &amp; Android · No app store</p>
                    </div>
                </div>
                <p className="mt-4 text-[15px] text-gray-300 leading-relaxed">
                    Put the Rolodex on your home screen. It opens full screen like an app, always shows the latest contacts, and takes 10 seconds to set up.
                </p>

                {installed ? (
                    <div className="mt-6 rounded-2xl bg-emerald/10 border border-emerald/30 p-4 text-[15px] text-emerald font-semibold">
                        Done. Look for the SLF icon on your home screen.
                    </div>
                ) : platform.inApp ? (
                    <div className="mt-6 rounded-2xl bg-neon-yellow/10 border border-neon-yellow/30 p-4">
                        <p className="text-[15px] font-semibold text-neon-yellow flex items-center gap-2"><ExternalLink className="w-4 h-4" /> Open in your browser first</p>
                        <p className="mt-1.5 text-[14px] text-gray-300 leading-relaxed">
                            This app's built-in browser can't add icons to your home screen. Tap the <Key>•••</Key> menu and choose
                            <b className="text-white"> Open in browser</b> (or Open in Safari / Chrome), then tap Get the app again.
                        </p>
                    </div>
                ) : (
                    <>
                        {platform.desktop && (
                            <div className="mt-6 flex items-center gap-4 rounded-2xl bg-white/5 border border-white/10 p-4">
                                <img src="/icons/qr-get-the-app.png" alt="QR code to get the app on your phone" className="w-28 h-28 rounded-lg bg-white" />
                                <p className="text-[14px] text-gray-300 leading-relaxed">
                                    <b className="text-white block mb-1">Scan with your phone's camera</b>
                                    It opens these steps on your phone.
                                </p>
                            </div>
                        )}

                        <div className="mt-6 grid grid-cols-2 gap-1 p-1 rounded-full bg-obsidian border border-white/5" role="tablist" aria-label="Phone type">
                            {[['iphone', 'iPhone'], ['android', 'Android']].map(([k, l]) => (
                                <button
                                    key={k}
                                    role="tab"
                                    aria-selected={tab === k}
                                    onClick={() => setTab(k)}
                                    className={`h-9 rounded-full text-[14px] font-bold transition-colors ${tab === k ? 'bg-white text-obsidian' : 'text-gray-400 hover:text-white'}`}
                                >
                                    {l}
                                </button>
                            ))}
                        </div>

                        {tab === 'iphone' ? (
                            <ol className="mt-5 space-y-4">
                                <Step n={1}>Open this page in <b className="text-white">Safari</b> and tap <Key><Share className="w-4 h-4" /> Share</Key> at the bottom of the screen.</Step>
                                <Step n={2}>Scroll down and tap <Key><PlusSquare className="w-4 h-4" /> Add to Home Screen</Key>.</Step>
                                <Step n={3}>Tap <b className="text-white">Add</b>. The SLF icon shows up on your home screen.</Step>
                            </ol>
                        ) : canPrompt ? (
                            <button
                                onClick={doInstall}
                                className="mt-5 w-full h-12 rounded-2xl bg-emerald text-obsidian font-bold text-[16px] flex items-center justify-center gap-2 active:scale-[0.99]"
                            >
                                <Download className="w-5 h-5" /> Install SLF Rolodex
                            </button>
                        ) : (
                            <ol className="mt-5 space-y-4">
                                <Step n={1}>Open this page in <b className="text-white">Chrome</b> and tap the <Key><MoreVertical className="w-4 h-4" /></Key> menu at the top right.</Step>
                                <Step n={2}>Tap <Key>Add to Home screen</Key> or <Key>Install app</Key>.</Step>
                                <Step n={3}>Tap <b className="text-white">Install</b>. The SLF icon shows up on your home screen.</Step>
                            </ol>
                        )}
                    </>
                )}

                <p className="mt-6 text-[13px] text-gray-500 leading-relaxed">
                    The first time you open the app from the icon, sign in once. After that it remembers you.
                </p>
            </div>
        </div>
    );
}

export function GetTheApp({ className = '' }) {
    const [open, setOpen] = useState(false);
    const [standalone] = useState(() => isStandalone());

    // QR code / shared link: /?install=1 opens the sheet straight away.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('install') === '1' && !isStandalone()) setOpen(true);
    }, []);

    if (standalone) return null; // already running as the installed app

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={`w-full flex items-center gap-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-3 text-left transition-colors ${className}`}
            >
                <img src="/icons/icon-192.png" alt="" className="w-10 h-10 rounded-xl" />
                <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold text-white">Get the app</span>
                    <span className="block text-[13px] text-gray-400">Add SLF Rolodex to your phone's home screen</span>
                </span>
                <Smartphone className="w-5 h-5 text-emerald shrink-0" />
            </button>
            <InstallSheet open={open} onClose={() => setOpen(false)} />
        </>
    );
}

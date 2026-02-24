import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRightFromBracket, faTableCellsLarge, faShieldHalved, faCirclePlus, faBolt, faBars, faXmark, faPalette } from '@fortawesome/free-solid-svg-icons';
import ThemeToggle from './ThemeToggle';
import { useLanguage } from '../context/LanguageContext';
import { AnimatePresence, motion } from 'framer-motion';

const Navbar = () => {
    const { user, logout } = useAuth();
    const { language, toggleLanguage, t } = useLanguage();
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    if (!user) return null;

    const isActive = (path: string) => location.pathname === path;

    const closeMobileMenu = () => setMobileMenuOpen(false);

    return (
        <>
            {/* ========== TOP NAVBAR ========== */}
            <nav className="navbar-blur">
                <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center justify-between">
                    {/* Left: Logo + Desktop Nav */}
                    <div className="flex items-center gap-4 md:gap-8">
                        <Link to="/" className="flex items-center gap-2 group">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center transition-all duration-300 group-hover:bg-primary/20">
                                <FontAwesomeIcon icon={faBolt} className="text-primary text-xs" />
                            </div>
                            <span className="text-sm md:text-base font-light tracking-[0.2em] uppercase">
                                MERIT<span className="font-bold opacity-60">SPACE</span>
                            </span>
                        </Link>

                        {/* Desktop Navigation Links */}
                        <div className="hidden md:flex items-center gap-1">
                            <Link
                                to="/"
                                className={`h-8 px-4 text-[10px] font-bold uppercase tracking-[0.15em] transition-all flex items-center gap-2 rounded-full ${isActive('/') ? 'text-primary bg-primary/5' : 'text-muted-foreground/60 hover:text-primary hover:bg-surface/50'
                                    }`}
                            >
                                <FontAwesomeIcon icon={faTableCellsLarge} className="text-[10px]" />
                                {t('dashboard')}
                            </Link>

                            {(user.role === 'LECTURER' || user.role === 'ADMIN') && (
                                <Link
                                    to="/create-form"
                                    className={`h-8 px-4 text-[10px] font-bold uppercase tracking-[0.15em] transition-all flex items-center gap-2 rounded-full ${isActive('/create-form') ? 'text-primary bg-primary/5' : 'text-muted-foreground/60 hover:text-primary hover:bg-surface/50'
                                        }`}
                                >
                                    <FontAwesomeIcon icon={faCirclePlus} className="text-[10px]" />
                                    {t('new_exam')}
                                </Link>
                            )}

                            {user.role === 'ADMIN' && (
                                <Link
                                    to="/admin"
                                    className={`h-8 px-4 text-[10px] font-bold uppercase tracking-[0.15em] transition-all flex items-center gap-2 rounded-full ${isActive('/admin') ? 'text-primary bg-primary/5' : 'text-muted-foreground/60 hover:text-primary hover:bg-surface/50'
                                        }`}
                                >
                                    <FontAwesomeIcon icon={faShieldHalved} className="text-[10px]" />
                                    {t('admin')}
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 md:gap-3">
                        <button
                            onClick={toggleLanguage}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-surface/40 text-[9px] font-bold text-primary/60 hover:bg-primary/10 hover:text-primary transition-all border border-border/50"
                        >
                            {language.toUpperCase()}
                        </button>
                        <Link
                            to="/appearance"
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-surface/40 text-xs text-muted-foreground/60 hover:bg-primary/10 hover:text-primary transition-all border border-border/50"
                            title="Appearance"
                        >
                            <FontAwesomeIcon icon={faPalette} />
                        </Link>

                        <ThemeToggle />

                        {/* Desktop: User info */}
                        <div className="hidden md:flex items-center gap-3 ml-2 pl-3 border-l border-border/50">
                            <div className="text-right">
                                <p className="text-[11px] font-bold text-foreground leading-none">{user.name}</p>
                                <p className="text-[8px] text-muted-foreground/40 uppercase mt-1 tracking-[0.15em] font-bold">
                                    {user.role === 'ADMIN' ? t('role_admin') : user.role === 'LECTURER' ? t('lecturer') : t('student')}
                                </p>
                            </div>
                            <div className="relative group/avatar cursor-pointer" onClick={() => navigate('/profile')}>
                                <img
                                    src={user.picture}
                                    alt={user.name}
                                    className="w-8 h-8 rounded-full border border-border/50 transition-all group-hover/avatar:border-primary/30"
                                />
                                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-card"></div>
                            </div>
                            <button
                                onClick={() => { logout(); navigate('/login'); }}
                                className="w-8 h-8 flex items-center justify-center text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/5 rounded-full transition-all"
                                aria-label="Logout"
                            >
                                <FontAwesomeIcon icon={faRightFromBracket} className="text-xs" />
                            </button>
                        </div>

                        {/* Mobile: Hamburger + Avatar */}
                        <div className="flex md:hidden items-center gap-2">
                            <div className="relative" onClick={() => navigate('/profile')}>
                                <img
                                    src={user.picture}
                                    alt={user.name}
                                    className="w-8 h-8 rounded-full border border-border/50"
                                />
                                <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border-2 border-card"></div>
                            </div>
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-surface/40 border border-border/50 text-foreground transition-all active:scale-95"
                                aria-label="Menu"
                            >
                                <FontAwesomeIcon icon={mobileMenuOpen ? faXmark : faBars} className="text-sm" />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* ========== MOBILE SLIDE-DOWN MENU ========== */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[80] md:hidden"
                            onClick={closeMobileMenu}
                        />
                        {/* Menu Panel */}
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            className="fixed top-14 inset-x-0 z-[85] mx-3 md:hidden"
                        >
                            <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
                                {/* User Section */}
                                <div className="p-4 border-b border-border/50 bg-surface/30">
                                    <div className="flex items-center gap-4">
                                        <img src={user.picture} alt={user.name} className="w-12 h-12 rounded-full border border-border/50" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-bold text-foreground truncate">{user.name}</p>
                                            <p className="text-[10px] text-muted-foreground/60 truncate italic">{user.email}</p>
                                            <span className="inline-block mt-1 text-[8px] font-bold uppercase tracking-widest bg-primary/5 text-primary/60 px-2 py-0.5 rounded-full border border-primary/10">
                                                {user.role}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Navigation Items */}
                                <div className="p-2 space-y-1">
                                    <Link
                                        to="/"
                                        onClick={closeMobileMenu}
                                        className={`flex items-center gap-4 px-4 py-3 rounded-2xl text-[12px] font-bold tracking-wide transition-all active:scale-[0.98] ${isActive('/') ? 'bg-primary/5 text-primary' : 'text-muted-foreground/80 hover:bg-surface/50'
                                            }`}
                                    >
                                        <FontAwesomeIcon icon={faTableCellsLarge} className="text-sm w-5 text-center" />
                                        {t('dashboard')}
                                    </Link>

                                    {(user.role === 'LECTURER' || user.role === 'ADMIN') && (
                                        <Link
                                            to="/create-form"
                                            onClick={closeMobileMenu}
                                            className={`flex items-center gap-4 px-4 py-3 rounded-2xl text-[12px] font-bold tracking-wide transition-all active:scale-[0.98] ${isActive('/create-form') ? 'bg-primary/5 text-primary' : 'text-muted-foreground/80 hover:bg-surface/50'
                                                }`}
                                        >
                                            <FontAwesomeIcon icon={faCirclePlus} className="text-sm w-5 text-center" />
                                            {t('new_exam')}
                                        </Link>
                                    )}

                                    {user.role === 'ADMIN' && (
                                        <Link
                                            to="/admin"
                                            onClick={closeMobileMenu}
                                            className={`flex items-center gap-4 px-4 py-3 rounded-2xl text-[12px] font-bold tracking-wide transition-all active:scale-[0.98] ${isActive('/admin') ? 'bg-primary/5 text-primary' : 'text-muted-foreground/80 hover:bg-surface/50'
                                                }`}
                                        >
                                            <FontAwesomeIcon icon={faShieldHalved} className="text-sm w-5 text-center" />
                                            {t('admin')}
                                        </Link>
                                    )}

                                    <Link
                                        to="/appearance"
                                        onClick={closeMobileMenu}
                                        className={`flex items-center gap-4 px-4 py-3 rounded-2xl text-[12px] font-bold tracking-wide transition-all active:scale-[0.98] ${isActive('/appearance') ? 'bg-primary/5 text-primary' : 'text-muted-foreground/80 hover:bg-surface/50'
                                            }`}
                                    >
                                        <FontAwesomeIcon icon={faPalette} className="text-sm w-5 text-center" />
                                        Appearance Settings
                                    </Link>
                                </div>

                                {/* Logout */}
                                <div className="p-2 border-t border-border/50">
                                    <button
                                        onClick={() => { closeMobileMenu(); logout(); navigate('/login'); }}
                                        className="flex items-center gap-4 px-4 py-3 rounded-2xl text-[12px] font-bold text-red-400 w-full transition-all active:scale-[0.98] hover:bg-red-500/5"
                                    >
                                        <FontAwesomeIcon icon={faRightFromBracket} className="text-sm w-5 text-center" />
                                        {t('logout') || 'Logout'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};

export default Navbar;

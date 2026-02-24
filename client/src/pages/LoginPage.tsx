import React from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBolt, faShieldHalved, faLock, faGraduationCap, faAdjust } from '@fortawesome/free-solid-svg-icons';
import { useNavigate, useLocation } from 'react-router-dom';
import showToast from '../utils/swal';
import { useLanguage } from '../context/LanguageContext';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

const LoginPage = () => {
    const { login } = useAuth();
    const { t } = useLanguage();
    const { theme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();

    const from = location.state?.from || '/';

    const handleSuccess = async (credentialResponse: CredentialResponse) => {
        try {
            if (!credentialResponse.credential) {
                throw new Error('No credential received');
            }
            await login(credentialResponse.credential);
            navigate(from, { replace: true });
        } catch (err) {
            console.error('Login failed', err);
            showToast.error(t('login_failed'), t('auth_failed'));
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] px-4 relative overflow-hidden bg-background">
            {/* Theme Toggle in Corner */}
            <div className="absolute top-6 right-6 z-20">
                <ThemeToggle />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="max-w-xl w-full relative z-10 py-12"
            >
                {/* Branding and Title */}
                <div className="flex flex-col items-center text-center mb-12">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-8 border border-primary/20"
                    >
                        <FontAwesomeIcon icon={faBolt} className="text-primary text-2xl" />
                    </motion.div>

                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-primary/60 mb-4">
                        <div className="w-6 h-[1px] bg-primary/30"></div>
                        {t('secure_academic_platform')}
                        <div className="w-6 h-[1px] bg-primary/30"></div>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-light tracking-[0.2em] mb-4 text-foreground uppercase">
                        MERIT<span className="font-bold opacity-60">SPACE</span>
                    </h1>

                    <p className="text-muted-foreground/60 text-[11px] font-medium tracking-wide max-w-xs mx-auto italic">
                        {t('simplicity_evaluation_consistency')}
                    </p>
                </div>

                {/* Google Login Button */}
                <div className="max-w-md mx-auto">
                    <div className="bg-surface/30 backdrop-blur-md border border-border/50 rounded-[32px] p-8 md:p-12 flex flex-col items-center shadow-sm">
                        <div className="w-full flex justify-center mb-2">
                            <GoogleLogin
                                onSuccess={handleSuccess}
                                onError={() => {
                                    console.error('[Auth] Google Login failed. Check Google Console Origins.');
                                    showToast.error(t('login_failed'), t('google_auth_failed'));
                                }}
                                shape="pill"
                                theme={theme === 'dark' ? 'filled_black' : 'outline'}
                                size="large"
                                text="signin_with"
                                width="280"
                            />
                        </div>
                        {/* Security Info */}
                        <div className="mt-12 pt-10 border-t border-border/40 w-full">
                            <div className="flex items-center justify-center gap-10">
                                <div className="flex flex-col items-center gap-2 group cursor-default">
                                    <div className="w-9 h-9 rounded-full bg-surface-hover/50 flex items-center justify-center border border-border/30 group-hover:border-primary/20 transition-all">
                                        <FontAwesomeIcon icon={faAdjust} className="text-muted-foreground/40 text-[10px] group-hover:text-primary transition-colors" />
                                    </div>
                                    <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">
                                        {t('simplicity')}
                                    </span>
                                </div>
                                <div className="flex flex-col items-center gap-2 group cursor-default">
                                    <div className="w-9 h-9 rounded-full bg-surface-hover/50 flex items-center justify-center border border-border/30 group-hover:border-primary/20 transition-all">
                                        <FontAwesomeIcon icon={faLock} className="text-muted-foreground/40 text-[10px] group-hover:text-primary transition-colors" />
                                    </div>
                                    <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">
                                        {t('secured')}
                                    </span>
                                </div>
                                <div className="flex flex-col items-center gap-2 group cursor-default">
                                    <div className="w-9 h-9 rounded-full bg-surface-hover/50 flex items-center justify-center border border-border/30 group-hover:border-primary/20 transition-all">
                                        <FontAwesomeIcon icon={faGraduationCap} className="text-muted-foreground/40 text-[10px] group-hover:text-primary transition-colors" />
                                    </div>
                                    <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">
                                        {t('academic')}
                                    </span>
                                </div>
                            </div>

                            <p className="text-[10px] text-muted-foreground/40 text-center mt-8 leading-relaxed tracking-wide italic">
                                {t('auth_powered_by')}<br />
                                {t('institutional_accounts')}
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default LoginPage;

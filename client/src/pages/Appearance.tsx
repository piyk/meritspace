import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import AppearanceSettings from '../components/AppearanceSettings';
import { useLanguage } from '../context/LanguageContext';

const Appearance = () => {
    const { t } = useLanguage();

    return (
        <div className="page-container pb-safe">
            <header className="mb-4 md:mb-12 flex flex-col gap-3 md:gap-6 md:flex-row md:items-end md:justify-between">
                <div className="space-y-2 md:space-y-4 min-w-0">
                    <Link to="/" className="inline-flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors bg-surface px-2.5 md:px-4 py-1.5 md:py-2 rounded-full border border-border">
                        <FontAwesomeIcon icon={faArrowLeft} className="text-xs md:text-sm" />
                        <span className="sm:hidden">Back</span>
                        <span className="hidden sm:inline">Back to Dashboard</span>
                    </Link>
                    <div className="min-w-0">
                        <h1 className="text-xl md:text-4xl font-bold tracking-tight mb-0.5 md:mb-2 truncate">
                            <span className="text-primary font-black">Appearance</span> Settings
                        </h1>
                        <p className="text-muted-foreground text-xs md:text-lg truncate">Customize your visual interface</p>
                    </div>
                </div>
            </header>

            <div className="card-minimal flex justify-center mt-6">
                <AppearanceSettings />
            </div>
        </div>
    );
};

export default Appearance;

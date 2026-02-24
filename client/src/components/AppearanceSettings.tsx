import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faMoon, faSun } from '@fortawesome/free-solid-svg-icons';
import { useAppearance } from '../context/AppearanceContext';
import { useTheme } from '../context/ThemeContext';

const AppearanceSettings: React.FC = () => {
    const { presetId, setPreset, allPresets } = useAppearance();
    const { theme, toggleTheme, isDark } = useTheme();
    const [savedPreset, setSavedPreset] = useState<string | null>(null);

    const handleSelectPreset = (id: string) => {
        setPreset(id);
        setSavedPreset(id);
        setTimeout(() => setSavedPreset(null), 2000);
    };

    const hslToString = (hsl: string) => `hsl(${hsl})`;

    return (
        <div className="px-4 md:px-8 py-8 md:py-12 space-y-12">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border">
                <div className="space-y-1.5">
                    <h2 className="text-xl md:text-2xl font-black tracking-tight text-foreground">
                        Appearance
                    </h2>
                    <p className="text-sm text-muted-foreground font-medium">
                        Personalize the platform's visual identity. Changes are applied globally.
                    </p>
                </div>

                {/* Minimal Dark/Light Toggle */}
                <button
                    onClick={toggleTheme}
                    className="flex items-center gap-3 px-4 py-2 rounded-xl bg-surface border border-border hover:border-primary/50 transition-colors group"
                >
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-background border border-border group-hover:bg-primary/5 transition-colors">
                        <FontAwesomeIcon icon={isDark ? faMoon : faSun} className={`text-xs ${isDark ? 'text-primary' : 'text-foreground'}`} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                        {isDark ? 'Dark Mode' : 'Light Mode'}
                    </span>
                </button>
            </div>

            {/* Presets Grid */}
            <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Color Themes
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {allPresets.map((preset) => {
                        const isActive = presetId === preset.id;
                        const mainColor = isDark ? preset.dark.primary : preset.light.primary;

                        return (
                            <button
                                key={preset.id}
                                onClick={() => handleSelectPreset(preset.id)}
                                className={`w-full h-full flex items-start gap-3 p-4 rounded-2xl border text-left bg-card transition-all duration-200 outline-none
                                    ${isActive
                                        ? 'border-primary ring-1 ring-primary/20 shadow-sm'
                                        : 'border-border hover:border-border/80 hover:bg-surface'}`}
                            >
                                {/* Color Swatch Preview */}
                                <div className="relative w-10 h-10 flex-shrink-0 mt-0.5">
                                    <div
                                        className="absolute inset-0 rounded-xl shadow-inner rotate-3 opacity-20"
                                        style={{ backgroundColor: hslToString(isDark ? preset.dark.accent : preset.light.accent) }}
                                    ></div>
                                    <div
                                        className="absolute inset-0 rounded-xl shadow-sm border border-white/10 flex items-center justify-center transition-transform hover:scale-105"
                                        style={{ backgroundColor: hslToString(mainColor) }}
                                    >
                                        {isActive && (
                                            <FontAwesomeIcon icon={faCheck} className="text-white text-[10px]" />
                                        )}
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm text-foreground truncate flex items-center gap-2">
                                        <span className="text-lg">{preset.emoji}</span>
                                        <span>{preset.name}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                                        {preset.description}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Save confirmation toast */}
            <AnimatePresence>
                {savedPreset && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="fixed bottom-8 right-8 z-50 flex items-center gap-2.5 bg-foreground text-background px-4 py-2.5 rounded-xl shadow-lg"
                    >
                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                            <FontAwesomeIcon icon={faCheck} className="text-[10px] text-primary" />
                        </div>
                        <span className="text-xs font-bold tracking-wide">Theme updated</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AppearanceSettings;

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

const ThemeToggle = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-surface/40 text-muted-foreground/60 hover:bg-primary/10 hover:text-primary transition-all border border-border/50 focus:outline-none"
            aria-label="Toggle theme"
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={theme}
                    initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.5, rotate: 45 }}
                    transition={{ duration: 0.2 }}
                >
                    <FontAwesomeIcon
                        icon={theme === 'light' ? faSun : faMoon}
                        className="text-xs"
                    />
                </motion.div>
            </AnimatePresence>
        </button>
    );
};

export default ThemeToggle;

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, IconDefinition } from '@fortawesome/free-solid-svg-icons';

interface Option {
    id: string | number;
    label: string;
    icon?: IconDefinition;
}

interface CustomSelectProps {
    options: Option[];
    value: string | number | null;
    onChange: (value: any) => void;
    placeholder?: string;
    className?: string;
    icon?: IconDefinition;
    dropdownClassName?: string;
    position?: 'top' | 'bottom';
}

const CustomSelect: React.FC<CustomSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Select option',
    className = '',
    icon,
    dropdownClassName = '',
    position = 'bottom'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.id === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-xs md:text-sm font-bold flex items-center justify-between gap-3 hover:border-primary transition-all duration-300"
            >
                <div className="flex items-center gap-2 text-muted-foreground overflow-hidden">
                    {(selectedOption?.icon || icon) && (
                        <FontAwesomeIcon icon={selectedOption?.icon || icon!} className="text-primary/60 flex-shrink-0" />
                    )}
                    <span className={`truncate ${selectedOption ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                </div>
                <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`text-[10px] flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: position === 'bottom' ? 10 : -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: position === 'bottom' ? 10 : -10, scale: 0.95 }}
                        className={`absolute left-0 ${position === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'} w-full min-w-[200px] bg-white dark:bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden py-1.5 ${dropdownClassName}`}
                    >
                        {options.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => {
                                    onChange(option.id);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-200 ${value === option.id ? 'bg-primary/5 text-primary' : 'hover:bg-surface text-muted-foreground hover:text-foreground'}`}
                            >
                                {option.icon && (
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${value === option.id ? 'bg-primary/10 text-primary' : 'bg-surface text-muted-foreground'}`}>
                                        <FontAwesomeIcon icon={option.icon} className="text-sm" />
                                    </div>
                                )}
                                <span className="text-xs md:text-sm font-bold truncate">{option.label}</span>
                                {value === option.id && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                                )}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CustomSelect;

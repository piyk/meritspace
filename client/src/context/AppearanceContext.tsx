import React, { createContext, useContext, useState, useEffect } from 'react';

// ─── Color Preset Definitions ─────────────────────────────────────────────────
// Each preset defines HSL triplets (h s% l%) for both light and dark modes.
// The CSS variables are injected on :root / .dark dynamically.

export interface ColorPreset {
    id: string;
    name: string;
    emoji: string;
    description: string;
    /** light mode HSL values */
    light: {
        primary: string;         // hue sat% light%
        accent: string;
        secondary: string;       // subtle tint of primary
        border: string;
        ring: string;
        surface: string;
        foreground?: string;     // optional text color
    };
    /** dark mode HSL values */
    dark: {
        primary: string;
        accent: string;
        secondary: string;
        border: string;
        ring: string;
        surface: string;
        background: string;      // optional override for bg
        card: string;
        muted: string;
        foreground?: string;     // optional text color
    };
}

export const COLOR_PRESETS: ColorPreset[] = [
    {
        id: 'ocean',
        name: 'Ocean Blue',
        emoji: '🌊',
        description: 'Deep, calm ocean blues — professional & focused',
        light: {
            primary: '217 85% 34%',       // Blue 900 (#0D47A1)
            accent: '224 100% 58%',      // Blue A700 (#2962FF)
            secondary: '206 91% 94%',    // Blue 50 (#E3F2FD)
            border: '206 89% 86%',       // Blue 100 (#BBDEFB)
            ring: '207 90% 54%',         // Blue 500 (#2196F3)
            surface: '206 91% 98%',      // Very light tint of Blue 50
        },
        dark: {
            primary: '207 90% 54%',       // Blue 400 — vivid, readable on dark bg
            accent: '217 100% 65%',      // Blue A200 — vivid highlight
            secondary: '220 10% 14%',    // Neutral dark
            border: '220 8% 18%',        // Neutral dark border
            ring: '207 90% 54%',         // Matches primary
            surface: '220 8% 9%',        // Neutral dark surface
            background: '220 8% 6%',     // Pure near-black background
            card: '220 8% 8%',           // Pure near-black card
            muted: '220 8% 12%',         // Neutral muted
        },
    },
    {
        id: 'violet',
        name: 'Royal Violet',
        emoji: '💜',
        description: 'Rich purple tones — creative & premium',
        light: {
            primary: '251 69% 34%',       // Deep Purple 900 (#311B92)
            accent: '265 100% 46%',      // Deep Purple A700 (#6200EA)
            secondary: '261 41% 93%',    // Deep Purple 50 (#EDE7F6)
            border: '261 46% 84%',       // Deep Purple 100 (#D1C4E9)
            ring: '262 52% 47%',         // Deep Purple 500 (#673AB7)
            surface: '261 41% 98%',      // Very light tint of Purple 50
        },
        dark: {
            primary: '258 65% 60%',       // Deep Purple 300 — vivid, readable on dark bg
            accent: '256 100% 70%',      // Deep Purple A200 — vivid highlight
            secondary: '220 10% 14%',    // Neutral dark
            border: '220 8% 18%',        // Neutral dark border
            ring: '258 65% 60%',         // Matches primary
            surface: '220 8% 9%',        // Neutral dark surface
            background: '220 8% 6%',     // Pure near-black background
            card: '220 8% 8%',           // Pure near-black card
            muted: '220 8% 12%',         // Neutral muted
        },
    },
    {
        id: 'emerald',
        name: 'Forest Green',
        emoji: '🌿',
        description: 'Lush greens — natural & refreshing',
        light: {
            primary: '124 55% 24%',       // Green 900 (#1B5E20)
            accent: '145 100% 39%',      // Green A700 (#00C853)
            secondary: '132 40% 94%',    // Green 50 (#E8F5E9)
            border: '122 39% 85%',       // Green 100 (#C8E6C9)
            ring: '122 39% 49%',         // Green 500 (#4CAF50)
            surface: '132 40% 98%',      // Very light tint of Green 50
        },
        dark: {
            primary: '142 55% 48%',       // Green 400 — vivid, readable on dark bg
            accent: '151 83% 62%',       // Green A200 — vivid highlight
            secondary: '220 10% 14%',    // Neutral dark
            border: '220 8% 18%',        // Neutral dark border
            ring: '142 55% 48%',         // Matches primary
            surface: '220 8% 9%',        // Neutral dark surface
            background: '220 8% 6%',     // Pure near-black background
            card: '220 8% 8%',           // Pure near-black card
            muted: '220 8% 12%',         // Neutral muted
        },
    },
    {
        id: 'rose',
        name: 'Rose Gold',
        emoji: '🌸',
        description: 'Warm rose tones — elegant & modern',
        light: {
            primary: '0 74% 41%',        // Red 900 (#B71C1C)
            accent: '348 100% 55%',      // Red A400 (#FF1744)
            secondary: '351 100% 96%',   // Red 50 (#FFEBEE)
            border: '353 100% 90%',      // Red 100 (#FFCDD2)
            ring: '4 90% 58%',           // Red 500 (#F44336)
            surface: '351 100% 98%',     // Very light tint of Red 50
        },
        dark: {
            primary: '4 82% 58%',        // Red 400 — vivid, readable on dark bg
            accent: '0 100% 66%',        // Red A200 — vivid highlight
            secondary: '220 10% 14%',    // Neutral dark
            border: '220 8% 18%',        // Neutral dark border
            ring: '4 82% 58%',           // Matches primary
            surface: '220 8% 9%',        // Neutral dark surface
            background: '220 8% 6%',     // Pure near-black background
            card: '220 8% 8%',           // Pure near-black card
            muted: '220 8% 12%',         // Neutral muted
        },
    },
    {
        id: 'amber',
        name: 'Amber Orange',
        emoji: '🔥',
        description: 'Bold oranges — energetic & vibrant (classic)',
        light: {
            primary: '21 100% 45%',       // Orange 900 (#E65100)
            accent: '26 100% 50%',       // Orange A700 (#FF6D00)
            secondary: '36 100% 94%',    // Orange 50 (#FFF3E0)
            border: '36 100% 85%',       // Orange 100 (#FFE0B2)
            ring: '36 100% 50%',         // Orange 500 (#FF9800)
            surface: '36 100% 98%',      // Very light tint of Orange 50
        },
        dark: {
            primary: '25 100% 53%',       // Orange 400 — vivid, readable on dark bg
            accent: '34 100% 62%',       // Orange A200 — vivid highlight
            secondary: '220 10% 14%',    // Neutral dark
            border: '220 8% 18%',        // Neutral dark border
            ring: '25 100% 53%',         // Matches primary
            surface: '220 8% 9%',        // Neutral dark surface
            background: '220 8% 6%',     // Pure near-black background
            card: '220 8% 8%',           // Pure near-black card
            muted: '220 8% 12%',         // Neutral muted
        },
    },
    {
        id: 'yellow',
        name: 'Sunlight Yellow',
        emoji: '☀️',
        description: 'Bright and cheerful — energetic & warm',
        light: {
            primary: '38 92% 40%',       // Darkened Yellow 900 for contrast
            accent: '50 100% 50%',       // Yellow A700 (#FFD600)
            secondary: '54 100% 95%',    // Yellow 50 (#FFFDE7)
            border: '54 100% 88%',       // Yellow 100 (#FFF9C4)
            ring: '54 100% 62%',         // Yellow 500 (#FFEB3B)
            surface: '54 100% 98%',
        },
        dark: {
            primary: '43 95% 50%',       // Amber 400 — vivid, readable on dark bg
            accent: '50 100% 58%',       // Yellow A200 — vivid highlight
            secondary: '220 10% 14%',    // Neutral dark
            border: '220 8% 18%',        // Neutral dark border
            ring: '43 95% 50%',          // Matches primary
            surface: '220 8% 9%',        // Neutral dark surface
            background: '220 8% 6%',     // Pure near-black background
            card: '220 8% 8%',           // Pure near-black card
            muted: '220 8% 12%',         // Neutral muted
        },
    },
    {
        id: 'slate',
        name: 'Slate Minimal',
        emoji: '🏴',
        description: 'Clean neutrals — ultra-minimal & distraction-free',
        light: {
            primary: '200 19% 18%',       // Blue Gray 900 (#263238)
            accent: '200 18% 46%',       // Blue Gray 500 (#607D8B)
            secondary: '200 27% 93%',    // Blue Gray 50 (#ECEFF1)
            border: '200 18% 84%',       // Blue Gray 100 (#CFD8DC)
            ring: '199 18% 54%',         // Blue Gray 400 (#78909C)
            surface: '200 27% 98%',
        },
        dark: {
            primary: '200 18% 55%',       // Blue Gray 300 — vivid, readable on dark bg
            accent: '201 15% 68%',       // Blue Gray 200 — subtle highlight
            secondary: '220 10% 14%',    // Neutral dark
            border: '220 8% 18%',        // Neutral dark border
            ring: '200 18% 55%',         // Matches primary
            surface: '220 8% 9%',        // Neutral dark surface
            background: '220 8% 6%',     // Pure near-black background
            card: '220 8% 8%',           // Pure near-black card
            muted: '220 8% 12%',         // Neutral muted
        },
    },

    {
        id: 'teal',
        name: 'Teal Breeze',
        emoji: '⚗️',
        description: 'Fresh teals — modern & trustworthy',
        light: {
            primary: '178 70% 38%',
            accent: '191 77% 42%',
            secondary: '178 40% 95%',
            border: '178 32% 88%',
            ring: '178 70% 38%',
            surface: '178 40% 97%',
        },
        dark: {
            primary: '178 60% 47%',       // Teal 400 — vivid, readable on dark bg
            accent: '191 77% 55%',       // Teal accent — vivid highlight
            secondary: '220 10% 14%',    // Neutral dark
            border: '220 8% 18%',        // Neutral dark border
            ring: '178 60% 47%',         // Matches primary
            surface: '220 8% 9%',        // Neutral dark surface
            background: '220 8% 6%',     // Pure near-black background
            card: '220 8% 8%',           // Pure near-black card
            muted: '220 8% 12%',         // Neutral muted
        },
    },
    {
        id: 'carbon',
        name: 'Dark Gray / Carbon',
        emoji: '🖤',
        description: 'Monochrome and stealthy — intense grayscale',
        light: {
            primary: '220 5% 15%',
            accent: '220 5% 35%',
            secondary: '220 5% 95%',
            border: '220 5% 85%',
            ring: '220 5% 15%',
            surface: '220 5% 98%',
            foreground: '220 5% 15%',
        },
        dark: {
            // Smooth "Carbon" theme — pure near-black bg, medium gray for rich buttons
            primary: '220 5% 58%',       // Medium gray — vivid enough for buttons & text
            accent: '220 5% 72%',        // Lighter gray highlight
            secondary: '220 8% 14%',     // Neutral dark
            border: '220 8% 18%',        // Neutral dark border
            ring: '220 5% 58%',          // Matches primary
            surface: '220 8% 9%',        // Neutral dark surface
            background: '220 8% 6%',     // Pure near-black background
            card: '220 8% 8%',           // Pure near-black card
            muted: '220 8% 12%',         // Neutral muted
            foreground: '220 5% 80%',    // Softer foreground for smooth contrast
        },
    },
];

// ─── Context ───────────────────────────────────────────────────────────────────

interface AppearanceContextType {
    preset: ColorPreset;
    presetId: string;
    setPreset: (id: string) => void;
    allPresets: ColorPreset[];
}

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

const STORAGE_KEY = 'ef_color_preset';
const DEFAULT_PRESET_ID = 'ocean';

function applyPreset(preset: ColorPreset, isDark: boolean) {
    const root = document.documentElement;
    const palette = isDark ? preset.dark : preset.light;

    root.style.setProperty('--primary', palette.primary);
    // In dark mode: primary is vivid (~50–60% lightness) → use near-black label text
    // In light mode: primary is dark (~18–34% lightness) → use white label text
    root.style.setProperty('--primary-foreground', isDark ? '220 10% 8%' : '0 0% 100%');
    root.style.setProperty('--accent', palette.accent);
    root.style.setProperty('--accent-foreground', isDark ? '220 10% 8%' : '0 0% 100%');
    root.style.setProperty('--secondary', palette.secondary);
    root.style.setProperty('--border', palette.border);
    root.style.setProperty('--ring', palette.ring);
    root.style.setProperty('--surface', palette.surface);

    if (palette.foreground) {
        root.style.setProperty('--foreground', palette.foreground);
    } else {
        root.style.removeProperty('--foreground');
    }

    if (isDark) {
        const dp = preset.dark;
        root.style.setProperty('--background', dp.background);
        root.style.setProperty('--card', dp.card);
        root.style.setProperty('--muted', dp.muted);
    } else {
        // Reset to light defaults
        root.style.setProperty('--background', '0 0% 100%');
        root.style.setProperty('--card', '0 0% 100%');
        root.style.setProperty('--muted', '210 40% 96%');
    }
}

export const AppearanceProvider: React.FC<{ children: React.ReactNode; isDark: boolean }> = ({ children, isDark }) => {
    const [presetId, setPresetId] = useState<string>(() => {
        return localStorage.getItem(STORAGE_KEY) || DEFAULT_PRESET_ID;
    });

    const preset = COLOR_PRESETS.find(p => p.id === presetId) || COLOR_PRESETS[0];

    // Apply preset on mount and when preset or theme changes
    useEffect(() => {
        applyPreset(preset, isDark);
    }, [preset, isDark]);

    const setPreset = (id: string) => {
        const found = COLOR_PRESETS.find(p => p.id === id);
        if (!found) return;
        localStorage.setItem(STORAGE_KEY, id);
        setPresetId(id);
    };

    return (
        <AppearanceContext.Provider value={{ preset, presetId, setPreset, allPresets: COLOR_PRESETS }}>
            {children}
        </AppearanceContext.Provider>
    );
};

export const useAppearance = () => {
    const context = useContext(AppearanceContext);
    if (!context) throw new Error('useAppearance must be used within AppearanceProvider');
    return context;
};

// Export helper to apply preset externally (used in ThemeContext)
export { applyPreset };

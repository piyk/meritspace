import Swal from 'sweetalert2';

/**
 * Multimodal Notification Utility
 * Enhances standard alerts with categorical language and premium styling.
 */

const commonConfig = {
    background: 'hsl(var(--card))',
    color: 'hsl(var(--foreground))',
    customClass: {
        popup: 'card-minimal !rounded-2xl !border-border !shadow-2xl !p-8',
        title: 'text-xl font-black tracking-tighter uppercase mb-2',
        htmlContainer: 'text-muted-foreground text-sm font-medium leading-relaxed',
        confirmButton: 'btn-primary-minimal !h-11 !px-8 !rounded-xl !text-[10px]',
        cancelButton: 'btn-minimal !h-11 !px-8 !rounded-xl !text-[10px] !ml-3',
        actions: 'mt-8',
    },
    buttonsStyling: false,
};

export const showToast = {
    success: (title: string, text?: string) => {
        return Swal.fire({
            ...commonConfig,
            icon: 'success',
            iconColor: 'hsl(var(--primary))',
            title: `STATUS: COMPLETED`,
            html: `<div class="mt-2"><strong class="text-foreground block mb-1 uppercase tracking-wider">${title}</strong>${text || ''}</div>`,
            timer: 2000,
            showConfirmButton: false,
        });
    },
    error: (title: string, text?: string) => {
        return Swal.fire({
            ...commonConfig,
            icon: 'error',
            iconColor: '#ef4444',
            title: `STATUS: ERROR`,
            html: `<div class="mt-2"><strong class="text-foreground block mb-1 uppercase tracking-wider">${title}</strong>${text || ''}</div>`,
            confirmButtonText: 'ACKNOWLEDGE',
        });
    },
    warning: (title: string, text?: string) => {
        return Swal.fire({
            ...commonConfig,
            icon: 'warning',
            iconColor: 'hsl(var(--accent))',
            title: `STATUS: ATTENTION`,
            html: `<div class="mt-2"><strong class="text-foreground block mb-1 uppercase tracking-wider">${title}</strong>${text || ''}</div>`,
            confirmButtonText: 'PROCEED',
        });
    },
    info: (title: string, text?: string) => {
        return Swal.fire({
            ...commonConfig,
            icon: 'info',
            iconColor: 'hsl(var(--accent))',
            title: `STATUS: INFORMATION`,
            html: `<div class="mt-2"><strong class="text-foreground block mb-1 uppercase tracking-wider">${title}</strong>${text || ''}</div>`,
            confirmButtonText: 'OK',
        });
    },
    question: async (title: string, text: string, confirmText: string = 'CONFIRM', cancelText: string = 'CANCEL') => {
        return Swal.fire({
            ...commonConfig,
            icon: 'question',
            iconColor: 'hsl(var(--primary))',
            title: `STATUS: PENDING`,
            html: `<div class="mt-2"><strong class="text-foreground block mb-1 uppercase tracking-wider">${title}</strong>${text}</div>`,
            showCancelButton: true,
            confirmButtonText: confirmText.toUpperCase(),
            cancelButtonText: cancelText.toUpperCase(),
        });
    }
};

export default showToast;

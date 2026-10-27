import { useEffect, useRef, useCallback, RefObject } from 'react';

export interface UseModalDismissOptions<T extends HTMLElement = HTMLDivElement> {
  /**
   * Controls whether the modal dialog is currently visible/open.
   */
  isOpen: boolean;

  /**
   * Primary callback invoked when dismissal is triggered (Escape, backdrop click, outside click).
   */
  onClose?: () => void;

  /**
   * Supplementary or alias dismiss callback invoked alongside onClose.
   */
  onDismiss?: () => void;

  /**
   * Enable/disable keyboard Escape key dismissal listener.
   * @default true
   */
  enableEscape?: boolean;

  /**
   * Enable/disable clicking outside the modal content container to dismiss.
   * @default true
   */
  closeOnOutsideClick?: boolean;

  /**
   * Automatically apply `overflow: hidden` to document body while the modal is open,
   * restoring original overflow on modal close or unmount.
   * @default true
   */
  lockScroll?: boolean;

  /**
   * Optional custom ref to use for the modal dialog element.
   */
  modalRef?: RefObject<T>;
}

export interface UseModalDismissReturn<T extends HTMLElement = HTMLDivElement> {
  /**
   * Ref to attach to the modal dialog content box.
   */
  modalRef: RefObject<T>;

  /**
   * Ref to attach to the outer backdrop / overlay container.
   */
  backdropRef: RefObject<HTMLDivElement>;

  /**
   * Helper onClick handler for the modal backdrop overlay.
   * Dismisses only when the click directly targets the backdrop (not bubbled from modal content).
   */
  handleBackdropClick: (event: React.MouseEvent<HTMLElement>) => void;

  /**
   * Programmatic dismiss action invoking registered onClose and onDismiss callbacks.
   */
  dismiss: () => void;
}

/**
 * Custom React hook for robust modal dismissal handling, supporting:
 * - Escape key listener with comprehensive lifecycle cleanup
 * - Outside / backdrop click detection
 * - Automatic document body scroll locking
 */
export function useModalDismiss<T extends HTMLElement = HTMLDivElement>(
  options: UseModalDismissOptions<T>
): UseModalDismissReturn<T> {
  const {
    isOpen,
    onClose,
    onDismiss,
    enableEscape = true,
    closeOnOutsideClick = true,
    lockScroll = true,
    modalRef: externalModalRef,
  } = options;

  const internalModalRef = useRef<T>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const activeModalRef = externalModalRef || internalModalRef;

  // Stable dismiss callback
  const dismiss = useCallback(() => {
    if (onClose) {
      onClose();
    }
    if (onDismiss) {
      onDismiss();
    }
  }, [onClose, onDismiss]);

  // Handle Escape key listener
  useEffect(() => {
    if (!isOpen || !enableEscape) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        dismiss();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, enableEscape, dismiss]);

  // Handle outside click listener (mousedown / touchstart)
  useEffect(() => {
    if (!isOpen || !closeOnOutsideClick) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      // If clicked inside modal dialog, do nothing
      if (activeModalRef.current && activeModalRef.current.contains(target)) {
        return;
      }

      dismiss();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isOpen, closeOnOutsideClick, dismiss, activeModalRef]);

  // Handle body scroll locking with clean teardown
  useEffect(() => {
    if (!isOpen || !lockScroll) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, lockScroll]);

  // Helper onClick callback specifically for backdrop elements
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (event.target === event.currentTarget) {
        dismiss();
      }
    },
    [dismiss]
  );

  return {
    modalRef: activeModalRef,
    backdropRef,
    handleBackdropClick,
    dismiss,
  };
}

export default useModalDismiss;

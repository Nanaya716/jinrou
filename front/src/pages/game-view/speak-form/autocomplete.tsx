import * as React from 'react';
import { createPortal } from 'react-dom';
import styled from '../../../util/styled';
import { PlayerInfo } from '../defs';

export interface AutocompleteItem {
  /**
   * Display text shown in the dropdown.
   */
  label: string;
  /**
   * Value to be inserted into the input.
   */
  value: string;
  /**
   * Type of the item (player or shortcut).
   */
  type: 'player' | 'shortcut';
  /**
   * Search key - what to match against (for shortcuts, this is the trigger word like "黑")
   */
  searchKey: string;
}

export interface AutocompleteProps {
  /**
   * Filtered items to display.
   */
  items: AutocompleteItem[];
  /**
   * Current search term (for highlighting).
   */
  searchTerm: string;
  /**
   * Position of the dropdown.
   */
  position: { top: number; left: number };
  /**
   * Element that the dropdown should stay aligned with.
   */
  anchor?: HTMLElement | null;
  /**
   * Currently selected index.
   */
  selectedIndex: number;
  /**
   * Callback when an item is selected.
   */
  onSelect: (item: AutocompleteItem) => void;
  /**
   * Callback to close the dropdown.
   */
  onClose: () => void;
}

/**
 * Autocomplete dropdown for chat input.
 */
export const AutocompleteDropdown: React.FC<AutocompleteProps> = ({
  items,
  searchTerm,
  position,
  anchor,
  selectedIndex,
  onSelect,
  onClose,
}) => {
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const [currentPosition, setCurrentPosition] = React.useState(position);

  // Update position when prop changes (initial open)
  React.useEffect(() => {
    setCurrentPosition(position);
  }, [position]);

  // Update position on scroll or resize - keeps dropdown aligned with input
  React.useEffect(() => {
    if (items.length === 0) return;

    let rafId: number | null = null;

    const updatePosition = () => {
      if (rafId !== null) return;

      rafId = requestAnimationFrame(() => {
        const input = anchor;
        if (input) {
          const rect = input.getBoundingClientRect();
          setCurrentPosition({
            top: rect.bottom + 4,
            left: rect.left,
          });
        }
        rafId = null;
      });
    };

    // Listen to scroll events on all elements (capture phase)
    window.addEventListener('scroll', updatePosition, true);
    // Listen to window resize
    window.addEventListener('resize', updatePosition);

    // Use ResizeObserver to detect when the input's parent resizes
    const input = anchor;
    let resizeObserver: any = null;

    if (input && input.parentElement) {
      resizeObserver = new (window as any).ResizeObserver(updatePosition);
      resizeObserver.observe(input.parentElement);
    }

    // Cleanup function - ALWAYS executed
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [anchor, items.length, position]); // Add position as dependency

  // Scroll to selected item when selectedIndex changes
  React.useEffect(() => {
    if (selectedIndex >= 0 && selectedIndex < items.length) {
      const selectedItem = itemRefs.current[selectedIndex];
      if (selectedItem && dropdownRef.current) {
        selectedItem.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [selectedIndex, items.length]);
  // Close on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  if (items.length === 0) {
    return null;
  }

  const content = (
    <DropdownStyle
      ref={dropdownRef}
      style={{
        top: `${currentPosition.top}px`,
        left: `${currentPosition.left}px`,
      }}
      role="listbox"
    >
      {items.map((item, index) => (
        <ItemStyle
          key={`${item.type}-${item.value}`}
          role="option"
          aria-selected={index === selectedIndex}
          selected={index === selectedIndex}
          onClick={() => onSelect(item)}
          ref={el => {
            itemRefs.current[index] = el;
          }}
        >
          <ItemLabel>{highlightMatch(item.label, searchTerm)}</ItemLabel>
        </ItemStyle>
      ))}
    </DropdownStyle>
  );

  return createPortal(content, document.body);
};

/**
 * Highlight matching characters in the label.
 */
function highlightMatch(text: string, searchTerm: string): React.ReactNode {
  if (!searchTerm) {
    return text;
  }
  const index = text.toLowerCase().indexOf(searchTerm.toLowerCase());
  if (index === -1) {
    return text;
  }
  return (
    <>
      {text.substring(0, index)}
      <Highlight>{text.substring(index, index + searchTerm.length)}</Highlight>
      {text.substring(index + searchTerm.length)}
    </>
  );
}

const DropdownStyle = styled.div`
  position: fixed;
  z-index: 9999;
  background: white;
  color: black;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 300px;
  overflow-y: auto;
  min-width: 200px;
  font-size: 14px;
`;

const ItemStyle = styled.div<{ selected: boolean }>`
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid #f0f0f0;
  color: black;

  &:last-child {
    border-bottom: none;
  }

  ${({ selected }) =>
    selected
      ? `
    background-color: #e6f7ff;
  `
      : `
    background-color: white;

    &:hover {
      background-color: #f5f5f5;
    }
  `}
`;

const ItemLabel = styled.span`
  flex: 1;
  color: black;
`;

const Highlight = styled.span`
  font-weight: bold;
  background-color: #ffeb3b;
  color: black;
  border-radius: 2px;
  padding: 0 2px;
`;

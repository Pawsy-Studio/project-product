import { useEffect } from 'react';

export const useOutsideClick = (
  refs: React.RefObject<HTMLElement>[],
  callback: () => void,
  dependencies: any[] = []
) => {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const isOutside = refs.every(ref => 
        !ref.current || !ref.current.contains(target)
      );
      
      if (isOutside) {
        callback();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, dependencies);
};
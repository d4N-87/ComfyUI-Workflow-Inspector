// src/components/CopyButton.tsx

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface CopyButtonProps {
  textToCopy: string;
}

const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-copy">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
    </svg>
);


const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check">
        <path d="M20 6 9 17l-5-5"></path>
    </svg>
);


const CopyButton = ({ textToCopy }: CopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const { t } = useTranslation();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`absolute top-0 right-0 p-2 rounded-lg transition-all duration-200 
                  ${isCopied 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-surface/50 hover:bg-primary-accent/20 text-secondary-text hover:text-primary-text'}`}
      aria-label={isCopied ? t('copied') : t('copyToClipboard')}
      title={isCopied ? t('copied') : t('copyToClipboard')}
    >
      {isCopied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
};

export default CopyButton;

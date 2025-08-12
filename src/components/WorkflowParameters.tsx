// src/components/WorkflowParameters.tsx

import { useTranslation } from 'react-i18next';
import type { WorkflowParameters } from '../types/comfy';
import CopyButton from './CopyButton';

interface WorkflowParametersProps {
  parameters: WorkflowParameters;
}

const WorkflowParametersDisplay = ({ parameters }: WorkflowParametersProps) => {
  const { t } = useTranslation();

  const renderParameter = (label: string, value?: string | number, allowEmpty = false, isCopyable = false) => {
    if (value === undefined || value === null) return null;
    if (!allowEmpty && value === '') return null;
    
    const stringValue = String(value);

    return (
      <div>
        <p className="text-sm text-secondary-accent">{label}</p>
        <div className="relative">
          <p className={`text-base text-primary-text bg-background/50 rounded-md px-3 py-2 mt-1 break-words min-h-[2.5rem] ${isCopyable ? 'pr-10' : ''}`}>
            {stringValue}
          </p>
          {isCopyable && <CopyButton textToCopy={stringValue} />}
        </div>
      </div>
    );
  };

  const hasParameters = parameters.positivePrompt || parameters.negativePrompt || (parameters.samplers && parameters.samplers.length > 0);

  if (!hasParameters) {
    return null;
  }

  return (
    <section className="w-full mt-8">
      <h2 className="text-2xl font-bold text-primary-accent mb-4">{t('workflowParametersTitle')}</h2>
      <div className="bg-surface border border-border rounded-xl p-6 space-y-6">
        {/* Prompts Section */}
        {(parameters.positivePrompt || parameters.negativePrompt) && (
          <div className="space-y-4">
            {renderParameter(t('positivePrompt'), parameters.positivePrompt, true, true)}
            {renderParameter(t('negativePrompt'), parameters.negativePrompt, true, true)}
          </div>
        )}

        {/* Samplers Section */}
        {parameters.samplers && parameters.samplers.map((sampler, index) => (
          <div key={sampler.id} className={`border-border ${index > 0 ? 'border-t pt-6' : ''}`}>
            <h3 className="text-md font-semibold text-primary-accent mb-3">
              {t('samplerTitle', { name: sampler.nodeTitle, id: sampler.id })}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {renderParameter(t('steps'), sampler.steps)}
              {renderParameter(t('cfg'), sampler.cfg)}
              {renderParameter(t('samplerName'), sampler.samplerName)}
              {renderParameter(t('scheduler'), sampler.scheduler)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default WorkflowParametersDisplay;

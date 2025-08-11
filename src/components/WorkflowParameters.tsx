// src/components/WorkflowParameters.tsx

import { useTranslation } from 'react-i18next';
import type { WorkflowParameters } from '../types/comfy';

interface WorkflowParametersProps {
  parameters: WorkflowParameters;
}

const WorkflowParametersDisplay = ({ parameters }: WorkflowParametersProps) => {
  const { t } = useTranslation();

  const renderParameter = (label: string, value?: string | number, allowEmpty = false) => {
    if (value === undefined || value === null) return null;
    if (!allowEmpty && value === '') return null;

    return (
      <div>
        <p className="text-sm text-yellow-400">{label}</p>
        <p className="text-base text-gray-300 bg-gray-700/50 rounded-md px-3 py-2 mt-1 break-words min-h-[2.5rem]">
          {String(value)}
        </p>
      </div>
    );
  };

  const hasParameters = parameters.positivePrompt || parameters.negativePrompt || (parameters.samplers && parameters.samplers.length > 0);

  if (!hasParameters) {
    return null;
  }

  return (
    <section className="w-full mt-8">
      <h2 className="text-2xl font-bold text-yellow-400 mb-4">{t('workflowParametersTitle')}</h2>
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-6">
        {/* Prompts Section */}
        {(parameters.positivePrompt || parameters.negativePrompt) && (
          <div className="space-y-4">
            {renderParameter(t('positivePrompt'), parameters.positivePrompt, true)}
            {renderParameter(t('negativePrompt'), parameters.negativePrompt, true)}
          </div>
        )}

        {/* Samplers Section */}
        {parameters.samplers && parameters.samplers.map((sampler, index) => (
          <div key={sampler.id} className={`border-gray-700 ${index > 0 ? 'border-t pt-6' : ''}`}>
            <h3 className="text-md font-semibold text-yellow-500 mb-3">
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

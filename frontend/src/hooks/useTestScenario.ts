import { useState } from 'react';
import testScenarioData from '../test-scenario.json';

export const useTestScenario = () => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const executeWorkflow = async (payloadString :string) => {
    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      const payloadStringObject = JSON.parse(payloadString);

      // Construct payload
      const payload = {
        workflow: payloadStringObject
      };

      const response = await fetch('http://localhost:8080/api/execute-workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      // const response = await fetch('http://localhost:8080/api/execute-workflow', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: payloadString
      // });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
      console.log('Workflow execution result:', data);
      
    } catch (error) {
      console.error('Error executing workflow:', error);
      setError(error instanceof Error ? error.message : 'Failed to execute workflow');
    } finally {
      setIsExecuting(false);
    }
  };

  return {
    executeWorkflow,
    isExecuting,
    result,
    error,
  };
};
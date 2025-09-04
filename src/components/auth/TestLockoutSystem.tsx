import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAccountLockout } from '@/hooks/useAccountLockout';
import { supabase } from '@/integrations/supabase/client';

export const TestLockoutSystem = () => {
  const [username, setUsername] = useState('');
  const [testResult, setTestResult] = useState<string>('');
  const { lockoutStatus, checkLockoutStatus, resetLockout } = useAccountLockout();

  const testCheckLockout = async () => {
    if (!username.trim()) {
      setTestResult('Please enter a username');
      return;
    }

    try {
      await checkLockoutStatus(username.trim());
      setTestResult(`Lockout status checked for: ${username}`);
    } catch (error) {
      setTestResult(`Error: ${error.message}`);
    }
  };

  const testResetLockout = async () => {
    if (!username.trim()) {
      setTestResult('Please enter a username');
      return;
    }

    try {
      await resetLockout(username.trim());
      setTestResult(`Lockout reset for: ${username}`);
    } catch (error) {
      setTestResult(`Error: ${error.message}`);
    }
  };

  const testRecordFailedAttempt = async () => {
    if (!username.trim()) {
      setTestResult('Please enter a username');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('record_failed_login_attempt', {
        p_username: username.trim(),
        p_ip_address: '127.0.0.1',
        p_user_agent: 'Test Client'
      });

      if (error) {
        setTestResult(`Error recording failed attempt: ${error.message}`);
      } else {
        setTestResult(`Failed attempt recorded: ${JSON.stringify(data, null, 2)}`);
        // Refresh lockout status
        await checkLockoutStatus(username.trim());
      }
    } catch (error) {
      setTestResult(`Exception: ${error.message}`);
    }
  };

  const testGetStatistics = async () => {
    try {
      const { data, error } = await supabase.rpc('get_lockout_statistics');

      if (error) {
        setTestResult(`Error getting statistics: ${error.message}`);
      } else {
        setTestResult(`Statistics: ${JSON.stringify(data, null, 2)}`);
      }
    } catch (error) {
      setTestResult(`Exception: ${error.message}`);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Test Lockout System
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Test the account lockout system functionality
        </p>
      </div>

      {/* Username Input */}
      <div className="space-y-2">
        <Label htmlFor="test-username">Username to test</Label>
        <Input
          id="test-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter username to test"
          className="w-full"
        />
      </div>

      {/* Test Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <Button onClick={testCheckLockout} variant="outline">
          Check Lockout Status
        </Button>
        <Button onClick={testResetLockout} variant="outline">
          Reset Lockout
        </Button>
        <Button onClick={testRecordFailedAttempt} variant="outline">
          Record Failed Attempt
        </Button>
        <Button onClick={testGetStatistics} variant="outline">
          Get Statistics
        </Button>
      </div>

      {/* Current Status Display */}
      <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
        <h3 className="font-semibold mb-2">Current Lockout Status</h3>
        <pre className="text-xs bg-white dark:bg-slate-800 p-3 rounded border overflow-auto">
          {JSON.stringify(lockoutStatus, null, 2)}
        </pre>
      </div>

      {/* Test Results */}
      <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
        <h3 className="font-semibold mb-2">Test Results</h3>
        <div className="bg-white dark:bg-slate-800 p-3 rounded border">
          <pre className="text-xs whitespace-pre-wrap">{testResult || 'No tests run yet'}</pre>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Test Instructions</h3>
        <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
          <li>Enter a username above</li>
          <li>Click "Record Failed Attempt" multiple times to trigger lockout</li>
          <li>Use "Check Lockout Status" to see current state</li>
          <li>Use "Reset Lockout" to clear lockout manually</li>
          <li>Use "Get Statistics" to see overall system status</li>
        </ol>
      </div>
    </div>
  );
};

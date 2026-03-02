import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

const LoginScreen: React.FC = () => {
    const { login } = useApp();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            await login(email, password);
        } catch (err) {
            setError('Invalid credentials. Please try again.');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-purple-50 dark:from-gray-900 dark:to-nyx-950 flex items-center justify-center p-4">
            <Card className="w-full max-w-md p-8 slide-in dark:bg-gray-800/80 dark:border-gray-700">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-nyx-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <span className="text-white font-bold text-xl">NYX</span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">NYX Career Dev</h1>
                    <p className="text-gray-600 dark:text-gray-300">Sign in to your account</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nyx-500 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                            placeholder="you@nyxagency.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nyx-500 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    {error && (
                        <div className="text-red-600 text-sm bg-red-50 dark:bg-red-900/30 dark:text-red-400 p-3 rounded-lg">{error}</div>
                    )}
                    <Button type="submit" className="w-full !py-2.5 text-base" size="lg">Sign In</Button>
                </form>
            </Card>
        </div>
    );
};

export default LoginScreen;

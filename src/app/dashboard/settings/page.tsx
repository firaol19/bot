export const dynamic = 'force-dynamic';

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Settings</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-xl font-semibold mb-4 text-white">General Settings</h3>
                    <p className="text-gray-500 text-sm mb-6">Configure application-wide preferences.</p>

                    <form className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Theme</label>
                            <select className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white">
                                <option>Dark (Default)</option>
                                <option>Light</option>
                                <option>System</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Currency</label>
                            <select className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white">
                                <option>USD (United States Dollar)</option>
                                <option>EUR (Euro)</option>
                            </select>
                        </div>
                        <button type="button" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition w-full">
                            Save Preferences
                        </button>
                    </form>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 opacity-50 pointer-events-none">
                    <h3 className="text-xl font-semibold mb-4 text-white">User Profile</h3>
                    <p className="text-gray-500 text-sm mb-6">Manage your account details (Read-only for Seed User).</p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                            <input type="email" value="admin@example.com" readOnly className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-gray-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Role</label>
                            <input type="text" value="Administrator" readOnly className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-gray-500" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
        <div className="flex items-center gap-4">
          <button className="text-gray-600 hover:text-gray-800">
            Notifications
          </button>
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
            U
          </div>
        </div>
      </div>
    </header>
  );
}

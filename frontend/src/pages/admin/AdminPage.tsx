import { useState, useMemo } from "react";
import { mockRooms } from "../../mocks/rooms";
import type { Room } from "../../mocks/rooms";
import RoomCard from "../../components/RoomCard";

type StatusFilter = Room["status"] | "All";

export default function AdminPage() {
  const [rooms, setRooms] = useState<Room[]>(mockRooms);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Статистика
  const stats = useMemo(() => {
    return {
      total: rooms.length,
      available: rooms.filter((r) => r.status === "Available").length,
      occupied: rooms.filter((r) => r.status === "Occupied").length,
      dirty: rooms.filter((r) => r.status === "Dirty").length,
      maintenance: rooms.filter((r) => r.status === "Maintenance").length,
    };
  }, [rooms]);

  // Фильтрация комнат
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchesStatus =
        statusFilter === "All" || room.status === statusFilter;
      const matchesSearch =
        searchQuery === "" ||
        room.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        room.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [rooms, statusFilter, searchQuery]);

  const handleStatusChange = (roomId: number, newStatus: Room["status"]) => {
    setRooms((prevRooms) =>
      prevRooms.map((room) =>
        room.id === roomId ? { ...room, status: newStatus } : room
      )
    );
  };

  const handleViewDetails = (roomId: number) => {
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      alert(`Детали комнаты #${room.number}\n\nКатегория: ${room.category}\nСтатус: ${room.status}\nЦена: ${room.price} ₽\nВместимость: ${room.capacity} чел.\n\n${room.description}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Панель управления</h1>
          <p className="text-gray-600 mt-1">Управление номерами и статусами</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Всего номеров</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-green-50 rounded-lg shadow-sm p-4 border border-green-200">
          <div className="text-sm text-green-700 mb-1">Доступны</div>
          <div className="text-2xl font-bold text-green-800">{stats.available}</div>
        </div>
        <div className="bg-blue-50 rounded-lg shadow-sm p-4 border border-blue-200">
          <div className="text-sm text-blue-700 mb-1">Заняты</div>
          <div className="text-2xl font-bold text-blue-800">{stats.occupied}</div>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow-sm p-4 border border-yellow-200">
          <div className="text-sm text-yellow-700 mb-1">Требуют уборки</div>
          <div className="text-2xl font-bold text-yellow-800">{stats.dirty}</div>
        </div>
        <div className="bg-red-50 rounded-lg shadow-sm p-4 border border-red-200">
          <div className="text-sm text-red-700 mb-1">На ремонте</div>
          <div className="text-2xl font-bold text-red-800">{stats.maintenance}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Поиск по номеру или категории..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="md:w-64">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="All">Все статусы</option>
              <option value="Available">Доступны</option>
              <option value="Occupied">Заняты</option>
              <option value="Dirty">Требуют уборки</option>
              <option value="Maintenance">На ремонте</option>
            </select>
          </div>
        </div>
      </div>

      {/* Rooms Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">
            Номера ({filteredRooms.length})
          </h2>
        </div>
        {filteredRooms.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 border border-gray-200 text-center">
            <p className="text-gray-500 text-lg">Номера не найдены</p>
            <p className="text-gray-400 text-sm mt-2">
              Попробуйте изменить фильтры поиска
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onStatusChange={handleStatusChange}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

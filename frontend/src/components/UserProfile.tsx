import { useEffect, useState } from "react";
import { authApi, type MeResponse } from "../api/api";
import Card from "../ui/Card";
import LoadingSpinner from "../ui/LoadingSpinner";
import toast from "react-hot-toast";

interface UserProfileProps {
  onClose?: () => void;
}

export default function UserProfile({ onClose }: UserProfileProps) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMe = async () => {
      try {
        const data = await authApi.me();
        setMe(data);
      } catch (error) {
        toast.error("Failed to load profile");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    loadMe();
  }, []);

  if (loading) {
    return <LoadingSpinner message="Loading profile..." />;
  }

  if (!me) {
    return (
      <Card>
        <p className="text-sm text-gray-500 dark:text-gray-400">Profile data is unavailable.</p>
      </Card>
    );
  }

  const roleLabel = me.role === "OWNER" ? "Administrator" : "Staff";

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">My Profile</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{roleLabel}</p>
        </div>
        <div className="w-9 h-9 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
          {me.name ? me.name.charAt(0).toUpperCase() : me.email.charAt(0).toUpperCase()}
        </div>
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
            User ID
          </div>
          <div className="text-gray-900 dark:text-white">{me.id}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
            Full name
          </div>
          <div className="text-gray-900 dark:text-white">{me.name}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
            Email
          </div>
          <div className="text-gray-900 dark:text-white">{me.email}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
            Role
          </div>
          <div className="text-gray-900 dark:text-white">{me.role}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
            Company
          </div>
          <div className="text-gray-900 dark:text-white">
            {me.companyCode || <span className="italic text-gray-500 dark:text-gray-400">Not assigned</span>}
          </div>
        </div>
      </div>

      {onClose && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </Card>
  );
}


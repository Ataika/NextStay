import { useEffect, useState } from "react";
import { authApi, type MeResponse } from "../api/api";
import Card from "../ui/Card";
import Button from "../ui/Button";
import LoadingSpinner from "../ui/LoadingSpinner";
import toast from "react-hot-toast";

export default function ProfilePage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await authApi.me();
        setMe(data);
        setFullName(data.name);
      } catch (error) {
        toast.error("Failed to load profile");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!me) return;
    const trimmed = fullName.trim();
    if (!trimmed) {
      toast.error("Full name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      const updated = await authApi.updateMe({ fullName: trimmed });
      setMe(updated);
      setFullName(updated.name);
      toast.success("Profile updated");
    } catch (error) {
      toast.error("Failed to update profile");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

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
    <div className="max-w-xl mx-auto space-y-4">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">My Profile</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{roleLabel}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white font-semibold text-base">
            {me.name ? me.name.charAt(0).toUpperCase() : me.email.charAt(0).toUpperCase()}
          </div>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
              User ID
            </label>
            <div className="text-gray-900 dark:text-white">{me.id}</div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
              Full name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
              Email
            </label>
            <div className="text-gray-900 dark:text-white">{me.email}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                Role
              </label>
              <div className="text-gray-900 dark:text-white">{me.role}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                Company
              </label>
              <div className="text-gray-900 dark:text-white">
                {me.companyCode || <span className="italic text-gray-500 dark:text-gray-400">Not assigned</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </Card>
    </div>
  );
}


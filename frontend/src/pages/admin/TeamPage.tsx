import { useCallback, useEffect, useState } from "react";
import type { AxiosError } from "axios";
import toast from "react-hot-toast";
import { usersApi, type TeamUser } from "../../api/api";
import { useI18n } from "../../i18n";
import { useAuthStore } from "../../store/authStore";
import Button from "../../ui/Button";
import Card from "../../ui/Card";
import LoadingSpinner from "../../ui/LoadingSpinner";
import Modal from "../../ui/Modal";
import PageHeader from "../../ui/PageHeader";

const inputClass =
  "w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function TeamPage() {
  const { t } = useI18n();
  const role = useAuthStore((s) => s.role);
  const isOwner = role === "OWNER" || role === "SYS_ADMIN";

  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await usersApi.list();
      setUsers(data);
    } catch {
      toast.error(t("team.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const closeInvite = () => {
    setInviteOpen(false);
    setInviteEmail("");
    setInviteSent(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviteLoading(true);
    try {
      await usersApi.invite(inviteEmail.trim());
      setInviteSent(true);
      toast.success(t("team.inviteSent"));
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      toast.error(axiosError.response?.data?.detail || t("team.inviteFailed"));
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRoleChange = async (user: TeamUser, newRole: string) => {
    if (!isOwner) return;
    try {
      await usersApi.update(user.id, { role: newRole });
      toast.success(t("team.roleUpdated"));
      void loadUsers();
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      toast.error(axiosError.response?.data?.detail || t("team.updateFailed"));
    }
  };

  const handleDeactivate = async (user: TeamUser) => {
    try {
      await usersApi.update(user.id, { is_active: !user.is_active });
      toast.success(user.is_active ? t("team.deactivated") : t("team.activated"));
      void loadUsers();
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      toast.error(axiosError.response?.data?.detail || t("team.updateFailed"));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("team.title")}
        subtitle={t("team.description")}
        action={
          <Button onClick={() => setInviteOpen(true)}>{t("team.addStaff")}</Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : users.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("team.empty")}</p>
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                  <th className="px-4 py-3 font-medium">{t("team.name")}</th>
                  <th className="px-4 py-3 font-medium">{t("team.email")}</th>
                  <th className="px-4 py-3 font-medium">{t("team.role")}</th>
                  <th className="px-4 py-3 font-medium">{t("team.status")}</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{user.full_name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{user.email}</td>
                    <td className="px-4 py-3">
                      {isOwner && user.role !== "OWNER" ? (
                        <select
                          value={user.role}
                          onChange={(e) => void handleRoleChange(user, e.target.value)}
                          className="text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1"
                        >
                          <option value="STAFF">STAFF</option>
                          <option value="MANAGER">MANAGER</option>
                          <option value="DIRECTOR">DIRECTOR</option>
                        </select>
                      ) : (
                        <span className="text-gray-700 dark:text-gray-300">{user.role}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          user.is_active
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {user.is_active ? t("team.active") : t("team.inactive")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {user.role !== "OWNER" && (
                        <button
                          type="button"
                          onClick={() => void handleDeactivate(user)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {user.is_active ? t("team.deactivate") : t("team.activate")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        isOpen={inviteOpen}
        onClose={closeInvite}
        title={t("team.addStaffTitle")}
      >
        {inviteSent ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">{t("team.inviteSentMessage")}</p>
            <Button onClick={closeInvite} fullWidth>
              {t("team.close")}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("team.inviteDescription")}</p>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                {t("team.inviteEmail")}
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className={inputClass}
                required
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={closeInvite} fullWidth>
                {t("team.cancel")}
              </Button>
              <Button type="submit" fullWidth disabled={inviteLoading}>
                {inviteLoading ? t("team.sending") : t("team.sendInvite")}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

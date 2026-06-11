import { useSearchParams, useNavigate } from "react-router-dom";
import Button from "../../ui/Button";
import Card from "../../ui/Card";
import { useI18n } from "../../i18n";

export default function BookingCancelPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const bookingId = searchParams.get("booking_id");

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4 py-8">
      <Card className="max-w-md w-full" padding="lg">
        <div className="text-center mb-6">
          <div className="inline-block bg-yellow-100 dark:bg-yellow-900/30 rounded-full p-4 mb-4">
            <svg
              className="w-16 h-16 text-yellow-600 dark:text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t("bookingCancel.title")}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
            {t("bookingCancel.subtitle")}
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t("bookingCancel.message")}
          </p>
        </div>

        <div className="space-y-3">
          <Button
            variant="primary"
            fullWidth
            onClick={() => navigate("/book")}
          >
            {t("bookingCancel.tryAgain")}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => navigate("/")}
          >
            {t("bookingCancel.goHome")}
          </Button>
        </div>
      </Card>
    </div>
  );
}

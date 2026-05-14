import { Link } from "react-router-dom";
import Button from "../ui/Button";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="text-center max-w-md w-full">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-gray-200 dark:text-gray-800">404</h1>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mt-4 mb-2">
            Page Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="space-y-4">
          <Link to="/">
            <Button variant="primary" size="lg">
              Go to Home
            </Button>
          </Link>
          <div>
            <button
              onClick={() => window.history.back()}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              ← Go back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

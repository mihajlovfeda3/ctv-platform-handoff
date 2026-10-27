"use client";
import { AlertCircle, RefreshCw } from "lucide-react";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="page">
      <section className="surface empty-state error-state">
        <AlertCircle size={32} />
        <h1>Данные временно недоступны</h1>
        <p>
          Проверьте подключение к PostgreSQL, примените миграции и загрузите
          тестовый набор по инструкции README.
        </p>
        <button className="button primary" onClick={reset}>
          <RefreshCw size={15} /> Повторить загрузку
        </button>
      </section>
    </div>
  );
}

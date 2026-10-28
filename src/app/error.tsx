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
          Не удалось отобразить рабочую область. Повторите загрузку; если ошибка
          сохранится, проверьте журнал приложения.
        </p>
        <button className="button primary" onClick={reset}>
          <RefreshCw size={15} /> Повторить загрузку
        </button>
      </section>
    </div>
  );
}

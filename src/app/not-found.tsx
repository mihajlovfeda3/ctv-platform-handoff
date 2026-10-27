import Link from "next/link";
export default function NotFound() {
  return (
    <div className="page">
      <section className="surface empty-state">
        <div className="eyebrow">404</div>
        <h1>Запись не найдена</h1>
        <p>Проверьте адрес или выберите сценарий в каталоге.</p>
        <Link href="/scenarios" className="button primary">
          Открыть сценарии
        </Link>
      </section>
    </div>
  );
}

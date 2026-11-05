"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Analytics, AnalyticRow } from "@/domain/analytics";
import { implementationLabel } from "@/domain/scenario";
import { cubePosition, cubeRadius, cubeVertex } from "@/domain/cube-geometry";
import styles from "./cube-prototype.module.css";

type Runtime = {
  reset: () => void;
  zoom: (factor: number) => void;
  focus: (index: number | null, move?: boolean) => void;
  highlight: (index: number | null) => void;
  select: (id: string) => void;
};
export function CubePrototype({ data }: { data: Analytics }) {
  const stage = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    labels = useRef<(HTMLButtonElement | null)[]>([]),
    runtime = useRef<Runtime | null>(null);
  const [status, setStatus] = useState("Загрузка сцены…"),
    [unavailable, setUnavailable] = useState(false),
    [direction, setDirection] = useState<number | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [hover, setHover] = useState<AnalyticRow | null>(null),
    [coincident, setCoincident] = useState<AnalyticRow[]>([]);
  const points = useMemo(
    () =>
      data.rows.flatMap((row) =>
        row.maturity !== null &&
        row.readiness !== null &&
        (row.implementation === "yes" || row.implementation === "no")
          ? row.directions.flatMap((d) => {
              const index = data.directions.findIndex(
                (item) => item.id === d.id,
              );
              return index >= 0
                ? [
                    {
                      row,
                      index,
                      position: cubePosition(
                        index,
                        row.maturity!,
                        row.readiness!,
                      ),
                    },
                  ]
                : [];
            })
          : [],
      ),
    [data],
  );
  const visibleRows = useMemo(
    () => data.rows.filter((row) => points.some((p) => p.row.id === row.id)),
    [data, points],
  );
  const item = data.rows.find((row) => row.id === selected);
  useEffect(() => {
    let cancelled = false,
      dispose = () => {};
    async function init() {
      const THREE = await import("three"),
        { OrbitControls } =
          await import("three/addons/controls/OrbitControls.js");
      if (cancelled) return;
      const host = stage.current!,
        element = canvas.current!;
      const renderer = new THREE.WebGLRenderer({
        canvas: element,
        antialias: true,
        alpha: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      const scene = new THREE.Scene(),
        camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40);
      camera.position.set(3.5, 2.7, 4.2);
      const controls = new OrbitControls(camera, element);
      controls.enableDamping = !matchMedia("(prefers-reduced-motion: reduce)")
        .matches;
      controls.dampingFactor = 0.14;
      controls.enablePan = false;
      controls.minDistance = 2.6;
      controls.maxDistance = 9;
      controls.saveState();
      scene.add(new THREE.HemisphereLight(0xc7eaff, 0x15203c, 2.4));
      const light = new THREE.DirectionalLight(0xffffff, 3);
      light.position.set(2, 4, 5);
      scene.add(light);
      const box = new THREE.BoxGeometry(2, 2, 2),
        edges = new THREE.EdgesGeometry(box);
      scene.add(
        new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({
            color: 0x52799d,
            transparent: true,
            opacity: 0.55,
          }),
        ),
      );
      const regionGeometry = new THREE.BoxGeometry(1, 1, 1),
        regionEdges = new THREE.EdgesGeometry(regionGeometry);
      const region = new THREE.LineSegments(
        regionEdges,
        new THREE.LineBasicMaterial({
          color: 0x81dcff,
          transparent: true,
          opacity: 0.7,
        }),
      );
      region.visible = false;
      scene.add(region);
      const sphere = new THREE.SphereGeometry(1, 20, 14);
      const meshes = points.map((p) => {
        const material = new THREE.MeshStandardMaterial({
          color: p.row.implementation === "yes" ? 0x2274c5 : 0xec963b,
          roughness: 0.28,
          metalness: 0.18,
          transparent: true,
        });
        const mesh = new THREE.Mesh(sphere, material);
        mesh.position.set(...p.position);
        mesh.scale.setScalar(cubeRadius(p.row.impact));
        scene.add(mesh);
        return mesh;
      });
      const vertices = data.directions.map((_, index) => {
        const mesh = new THREE.Mesh(
          sphere,
          new THREE.MeshStandardMaterial({
            color: 0x86bde5,
            emissive: 0x14364b,
          }),
        );
        mesh.position.set(...cubeVertex(index));
        mesh.scale.setScalar(0.023);
        scene.add(mesh);
        return mesh;
      });
      let frame = 0,
        active: number | null = null,
        chosen: string | null = null;
      function requestDraw() {
        if (!frame && !cancelled) frame = requestAnimationFrame(draw);
      }
      function draw() {
        frame = 0;
        controls.update();
        camera.updateMatrixWorld();
        renderer.render(scene, camera);
        element.dataset.camera = camera.position
          .toArray()
          .map((n) => n.toFixed(3))
          .join(",");
        vertices.forEach((mesh, i) => {
          const p = mesh.position.clone().project(camera),
            label = labels.current[i];
          if (!label) return;
          label.style.left = `${((p.x + 1) * host.clientWidth) / 2}px`;
          label.style.top = `${((1 - p.y) * host.clientHeight) / 2}px`;
          label.style.display =
            p.z > 1 || Math.abs(p.x) > 0.94 || Math.abs(p.y) > 0.94
              ? "none"
              : "block";
          label.style.opacity = active === null || active === i ? "1" : "0.35";
        });
      }
      function appearance() {
        meshes.forEach((mesh, i) => {
          const p = points[i],
            pick = p.row.id === chosen;
          mesh.material.opacity =
            pick || active === null || active === p.index ? 1 : 0.08;
          mesh.material.depthWrite = mesh.material.opacity === 1;
          mesh.material.emissive.set(pick ? 0xc6f5ff : 0x000000);
          mesh.material.emissiveIntensity = pick ? 0.75 : 0;
          mesh.scale.setScalar(cubeRadius(p.row.impact) * (pick ? 1.3 : 1));
        });
        requestDraw();
      }
      function resetCamera() {
        const damping = controls.enableDamping;
        controls.enableDamping = false;
        controls.update();
        controls.reset();
        controls.enableDamping = damping;
        requestDraw();
      }
      function focus(index: number | null, move = false) {
        active = index;
        region.visible = index !== null;
        if (index !== null) {
          const v = new THREE.Vector3(...cubeVertex(index));
          region.position.copy(v).multiplyScalar(0.5);
          if (move) {
            controls.target.copy(v).multiplyScalar(0.55);
            camera.position
              .copy(controls.target)
              .add(v.normalize().multiplyScalar(3.6));
            controls.update();
          }
        } else if (move) resetCamera();
        appearance();
      }
      function select(id: string) {
        chosen = id;
        setSelected(id);
        appearance();
      }
      runtime.current = {
        reset: resetCamera,
        zoom: (factor) => {
          camera.position
            .sub(controls.target)
            .multiplyScalar(factor)
            .clampLength(controls.minDistance, controls.maxDistance)
            .add(controls.target);
          controls.update();
          requestDraw();
        },
        focus,
        select,
        highlight: (index) => {
          vertices.forEach((v, i) => {
            v.material.emissive.set(i === index ? 0x8be1ff : 0x14364b);
          });
          requestDraw();
        },
      };
      const ray = new THREE.Raycaster(),
        mouse = new THREE.Vector2();
      function hit(event: PointerEvent) {
        const rect = element.getBoundingClientRect();
        mouse.set(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          1 - ((event.clientY - rect.top) / rect.height) * 2,
        );
        ray.setFromCamera(mouse, camera);
        return ray
          .intersectObjects(meshes)
          .find(
            (h) =>
              active === null ||
              points[meshes.indexOf(h.object as (typeof meshes)[number])]
                .index === active,
          );
      }
      let down = [0, 0];
      const pointerDown = (event: PointerEvent) => {
        down = [event.clientX, event.clientY];
      };
      const pointerMove = (event: PointerEvent) => {
        if (event.buttons) {
          setHover(null);
          return;
        }
        const h = hit(event);
        setHover(
          h
            ? points[meshes.indexOf(h.object as (typeof meshes)[number])].row
            : null,
        );
      };
      const pointerUp = (event: PointerEvent) => {
        if (Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 5)
          return;
        const h = hit(event);
        if (!h) return;
        const index = meshes.indexOf(h.object as (typeof meshes)[number]),
          point = points[index];
        const matches = points.filter(
          (p) =>
            p.index === point.index &&
            p.position.every((v, i) => Math.abs(v - point.position[i]) < 1e-10),
        );
        setCoincident(matches.map((p) => p.row));
        select(point.row.id);
      };
      const leave = () => setHover(null);
      const lost = (event: Event) => {
        event.preventDefault();
        setUnavailable(true);
        setStatus("Контекст WebGL потерян. Доступен список сценариев.");
      };
      element.addEventListener("pointerdown", pointerDown);
      element.addEventListener("pointermove", pointerMove);
      element.addEventListener("pointerup", pointerUp);
      element.addEventListener("pointerleave", leave);
      element.addEventListener("webglcontextlost", lost);
      controls.addEventListener("change", requestDraw);
      const resize = new ResizeObserver(() => {
        camera.aspect = host.clientWidth / host.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(host.clientWidth, host.clientHeight, false);
        requestDraw();
      });
      resize.observe(host);
      dispose = () => {
        cancelAnimationFrame(frame);
        resize.disconnect();
        controls.dispose();
        element.removeEventListener("pointerdown", pointerDown);
        element.removeEventListener("pointermove", pointerMove);
        element.removeEventListener("pointerup", pointerUp);
        element.removeEventListener("pointerleave", leave);
        element.removeEventListener("webglcontextlost", lost);
        scene.traverse((object) => {
          if (
            object instanceof THREE.Mesh ||
            object instanceof THREE.LineSegments
          ) {
            object.geometry.dispose();
            const materials = Array.isArray(object.material)
              ? object.material
              : [object.material];
            materials.forEach((m) => m.dispose());
          }
        });
        box.dispose();
        regionGeometry.dispose();
        renderer.dispose();
        runtime.current = null;
      };
      setStatus("Сцена готова");
      requestDraw();
    }
    init().catch(() => {
      if (!cancelled) {
        setUnavailable(true);
        setStatus("WebGL недоступен. Используйте список сценариев.");
      }
    });
    return () => {
      cancelled = true;
      dispose();
    };
  }, [data.directions, points]);
  function chooseDirection(index: number | null, move = false) {
    setDirection(index);
    runtime.current?.focus(index, move);
  }
  function chooseScenario(id: string) {
    setSelected(id);
    runtime.current?.select(id);
  }
  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>
            Лаборатория ЦТВ / Пространственная аналитика
          </div>
          <h1>Куб технологических сценариев</h1>
          <p>Восемь направлений. Три измерения. Единый контекст.</p>
        </div>
        <span className={styles.tag}>Эксперимент · 01</span>
      </header>
      <div className={styles.layout}>
        <div>
          <div className={styles.stage} ref={stage}>
            <canvas
              ref={canvas}
              className={styles.canvas}
              aria-label="Интерактивный куб сценариев"
              hidden={unavailable}
            />
            {!unavailable && (
              <>
                <div className={styles.labels}>
                  {data.directions.map((d, i) => (
                    <button
                      key={d.id}
                      ref={(el) => {
                        labels.current[i] = el;
                      }}
                      className={styles.vertex}
                      aria-label={`Вершина ${i + 1}: ${d.name}`}
                      title={d.name}
                      aria-pressed={direction === i}
                      onPointerEnter={() => runtime.current?.highlight(i)}
                      onPointerLeave={() => runtime.current?.highlight(null)}
                      onClick={() =>
                        chooseDirection(direction === i ? null : i)
                      }
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <div className={styles.toolbar}>
                  <button
                    onClick={() => runtime.current?.zoom(0.85)}
                    aria-label="Приблизить куб"
                  >
                    +
                  </button>
                  <button
                    onClick={() => runtime.current?.zoom(1.18)}
                    aria-label="Отдалить куб"
                  >
                    −
                  </button>
                  <button onClick={() => runtime.current?.reset()}>
                    Сброс камеры
                  </button>
                </div>
                <span className={styles.hint}>
                  Перетаскивайте для вращения · Колесо — масштаб
                </span>
              </>
            )}
            {unavailable && (
              <div className={styles.empty}>
                {status}
                <div className={styles.fallbackList}>
                  {visibleRows.map((row) => (
                    <button key={row.id} onClick={() => chooseScenario(row.id)}>
                      {row.externalId} · {row.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {hover && !unavailable && (
              <div className={styles.tooltip} role="tooltip">
                <b>{hover.externalId}</b>
                <br />
                {hover.name}
                <br />
                РЗ {hover.maturity} · ОГ {hover.readiness} · Влияние{" "}
                {hover.impact ?? "не указано"}
                <br />
                {implementationLabel(hover.implementation)}
              </div>
            )}
          </div>
          <div className={styles.legend}>
            <span>
              <i className={styles.dot} /> Реализуется
            </span>
            <span>
              <i className={`${styles.dot} ${styles.orange}`} /> Не реализуется
            </span>
            <span>Влияние: ● 1 · ● 2 · ● 3 — размер сферы</span>
          </div>
          <p className={styles.footer}>
            РЗ 5 — ближе к вершине · ОГ 1–7 — положение на сферическом слое.
            <br />
            Номера вершин соответствуют направлениям справа. Без произвольных
            смещений.
          </p>
        </div>
        <aside className={styles.rail}>
          <div className={styles.state} role="status">
            {status} · {visibleRows.length} / {data.total} сценариев
          </div>
          <h2>Технологические направления</h2>
          <div className={styles.directions}>
            {data.directions.map((d, i) => (
              <button
                key={d.id}
                className={styles.direction}
                aria-pressed={direction === i}
                onPointerEnter={() => runtime.current?.highlight(i)}
                onPointerLeave={() => runtime.current?.highlight(null)}
                onClick={() => chooseDirection(direction === i ? null : i)}
              >
                <b>{String(i + 1).padStart(2, "0")}</b>
                {d.name}
              </button>
            ))}
          </div>
          <button
            className={styles.focus}
            disabled={direction === null}
            onClick={() => chooseDirection(direction, true)}
          >
            Фокус направления
          </button>
          {direction !== null && (
            <button
              className={styles.focus}
              onClick={() => chooseDirection(null, true)}
            >
              Все направления
            </button>
          )}
          <div className={styles.detail} aria-live="polite">
            {item ? (
              <>
                <span>{item.externalId}</span>
                <strong>{item.name}</strong>РЗ {item.maturity} / 5 · ОГ{" "}
                {item.readiness} / 7<br />
                Влияние: {item.impact ?? "не указано"} ·{" "}
                {implementationLabel(item.implementation)}
              </>
            ) : (
              "Наведите на сферу или выберите сценарий. Совпадающие точки сохраняют точные координаты."
            )}
            {coincident.length > 1 && (
              <>
                <p>В этой позиции {coincident.length} сценариев:</p>
                {coincident.map((row) => (
                  <button key={row.id} onClick={() => chooseScenario(row.id)}>
                    {row.externalId} · {row.name}
                  </button>
                ))}
              </>
            )}
          </div>
          <details className={styles.detail}>
            <summary>Сценарии в кубе ({visibleRows.length})</summary>
            <div className={styles.fallbackList}>
              {visibleRows
                .filter(
                  (row) =>
                    direction === null ||
                    row.directions.some(
                      (d) => d.id === data.directions[direction].id,
                    ),
                )
                .map((row) => (
                  <button
                    key={row.id}
                    aria-pressed={selected === row.id}
                    onClick={() => chooseScenario(row.id)}
                  >
                    {row.externalId} · {row.name}
                  </button>
                ))}
            </div>
          </details>
          <p className={styles.footer}>
            Без РЗ, ОГ или подтверждённого статуса:{" "}
            {data.rows.length - visibleRows.length}. Такие записи не
            позиционируются предположительно.
          </p>
        </aside>
      </div>
    </section>
  );
}

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  matrixCells,
  pointRadius,
  statusColors,
  type Analytics,
  type AnalyticRow,
} from "@/domain/analytics";
import { matrixGeometry, matrixDensityScale } from "@/domain/matrix-layout";
import { matrixPosition } from "@/domain/camera";
import { SelectionHalo } from "@/features/scenarios/selection-halo";
import { implementationLabel } from "@/domain/scenario";
import { cubePosition, cubeRadius, cubeVertex } from "@/domain/cube-geometry";
import { cubeReadinessGuides } from "./cube-readiness-guides";
import { layoutCubeLabels, shortDirection } from "./cube-labels";
import styles from "./cube-prototype.module.css";

type Runtime = {
  reset: () => void;
  zoom: (factor: number) => void;
  focus: (index: number | null) => void;
  preview: (id: string | null) => void;
  highlight: (index: number | null) => void;
  select: (id: string | null, notify?: boolean) => void;
};
export function CubePrototype({
  data,
  selectedFromUrl,
  onSelectionChange,
}: {
  data: Analytics;
  selectedFromUrl?: string | null;
  onSelectionChange?: (id: string | null) => void;
}) {
  const stage = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    labels = useRef<(HTMLButtonElement | null)[]>([]),
    leaders = useRef<(SVGLineElement | null)[]>([]),
    levelLeaders = useRef<(SVGLineElement | null)[]>([]),
    levelLabels = useRef<(HTMLSpanElement | null)[]>([]),
    readinessLabels = useRef<(HTMLSpanElement | null)[]>([]),
    readinessLeaders = useRef<(SVGLineElement | null)[]>([]),
    runtime = useRef<Runtime | null>(null);
  const [status, setStatus] = useState("Загрузка сцены…"),
    [unavailable, setUnavailable] = useState(false),
    [direction, setDirection] = useState<number | null>(null),
    [localSelected, setSelected] = useState<string | null>(
      selectedFromUrl ?? null,
    ),
    [hover, setHover] = useState<AnalyticRow | null>(null),
    [coincident, setCoincident] = useState<AnalyticRow[]>([]);
  const selected =
    selectedFromUrl === undefined ? localSelected : selectedFromUrl;
  const selectedRef = useRef(selected),
    selectionCallback = useRef(onSelectionChange);
  useEffect(() => {
    selectionCallback.current = onSelectionChange;
  }, [onSelectionChange]);
  useEffect(() => {
    selectedRef.current = selected;
    runtime.current?.select(selected, false);
  }, [selected]);
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
  const inspected = hover ?? item;
  const directionRows =
    direction === null
      ? []
      : data.rows.filter((row) =>
          row.directions.some((d) => d.id === data.directions[direction].id),
        );
  const cells = matrixCells(directionRows),
    missing = cells.get("unknown") ?? [];
  const unfoldRows = directionRows.filter(
    (row) =>
      row.maturity !== null &&
      row.readiness !== null &&
      (row.implementation === "yes" || row.implementation === "no"),
  );
  const unsupported = directionRows.filter(
    (row) => row.implementation !== "yes" && row.implementation !== "no",
  ).length;
  const plot = matrixGeometry({ width: 520, height: 430 });
  const xStep = (plot.right - plot.left) / 5,
    yStep = (plot.bottom - plot.top) / 7;
  const density = matrixDensityScale(
    Math.max(
      1,
      ...[...cells.entries()]
        .filter(([key]) => key !== "unknown")
        .map(([, rows]) => rows.length),
    ),
    xStep * yStep,
  );
  const unfoldX = (value: number) => plot.left + (value - 0.5) * xStep;
  const unfoldY = (value: number) => plot.bottom - (value - 0.5) * yStep;
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
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.25;
      const scene = new THREE.Scene(),
        camera = new THREE.PerspectiveCamera(40, 1, 0.008, 40);
      camera.position.set(3.5, 2.7, 4.2);
      const controls = new OrbitControls(camera, element);
      controls.enableDamping = !matchMedia("(prefers-reduced-motion: reduce)")
        .matches;
      controls.dampingFactor = 0.14;
      controls.enablePan = false;
      controls.minDistance = 0.18;
      controls.zoomSpeed = 0.7;
      controls.maxDistance = 9;
      controls.saveState();
      scene.add(new THREE.HemisphereLight(0xd9eeff, 0x142139, 2.2));
      const light = new THREE.DirectionalLight(0xe7f5ff, 2.5);
      light.position.set(2, 4, 5);
      scene.add(light);
      const orientation = new THREE.Group();
      const planeGeometry = new THREE.PlaneGeometry(2, 2);
      for (let axis = 0; axis < 3; axis++) {
        const plane = new THREE.Mesh(
          planeGeometry,
          new THREE.MeshBasicMaterial({
            color: 0xc9ced2,
            transparent: true,
            opacity: 0.018,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        if (axis === 1) plane.rotation.x = Math.PI / 2;
        if (axis === 2) plane.rotation.y = Math.PI / 2;
        orientation.add(plane);
        const start = new THREE.Vector3(),
          end = new THREE.Vector3();
        start.setComponent(axis, -1);
        end.setComponent(axis, 1);
        orientation.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([start, end]),
            new THREE.LineBasicMaterial({
              color: 0xaeb7bd,
              transparent: true,
              opacity: 0.2,
              depthWrite: false,
            }),
          ),
        );
      }
      orientation.add(
        new THREE.Mesh(
          new THREE.SphereGeometry(0.01, 10, 8),
          new THREE.MeshBasicMaterial({ color: 0xc8ced2 }),
        ),
      );
      scene.add(orientation);
      const projectionGeometry = new THREE.BufferGeometry();
      projectionGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(18), 3),
      );
      const projection = new THREE.LineSegments(
        projectionGeometry,
        new THREE.LineBasicMaterial({
          color: 0xe1e4e6,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
        }),
      );
      projection.visible = false;
      scene.add(projection);
      const box = new THREE.BoxGeometry(2, 2, 2),
        edges = new THREE.EdgesGeometry(box);
      scene.add(
        new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({
            color: 0x79a8c5,
            transparent: true,
            opacity: 0.24,
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
          opacity: 0.32,
        }),
      );
      region.visible = false;
      scene.add(region);
      const sphere = new THREE.SphereGeometry(1, 20, 14);
      const meshes = points.map((p) => {
        const material = new THREE.MeshLambertMaterial({
          color: p.row.implementation === "yes" ? 0x2274c5 : 0xec963b,
          emissive: 0x000000,
          emissiveIntensity: 0,
          transparent: true,
        });
        const mesh = new THREE.Mesh(sphere, material);
        mesh.position.set(...p.position);
        mesh.scale.setScalar(cubeRadius(p.row.impact) * 0.85);
        scene.add(mesh);
        return mesh;
      });
      const vertices = data.directions.map((_, index) => {
        const mesh = new THREE.Mesh(
          sphere,
          new THREE.MeshLambertMaterial({
            color: 0x86bde5,
            emissive: 0x14364b,
          }),
        );
        mesh.position.set(...cubeVertex(index));
        mesh.scale.setScalar(0.023);
        scene.add(mesh);
        return mesh;
      });
      // Derive the five maturity rings directly from the existing placement function.
      // Their vertices retain the exact distance-to-vertex assigned by maturity.
      const levels = data.directions.map((_, index) => {
        const group = new THREE.Group();
        group.visible = false;
        scene.add(group);
        const anchors = Array.from({ length: 5 }, (_, i) => {
          const maturity = i + 1;
          const samples = Array.from(
            { length: 7 },
            (_, r) =>
              new THREE.Vector3(...cubePosition(index, maturity, r + 1)),
          );
          const center = samples
            .reduce((sum, p) => sum.add(p), new THREE.Vector3())
            .multiplyScalar(1 / 7);
          const u = samples[0].clone().sub(center),
            normal = new THREE.Vector3(...cubeVertex(index))
              .sub(center)
              .normalize();
          const w = normal.clone().cross(u);
          const at = (angle: number) =>
            center
              .clone()
              .addScaledVector(u, Math.cos(angle))
              .addScaledVector(w, Math.sin(angle));
          const ring = new THREE.LineLoop(
            new THREE.BufferGeometry().setFromPoints(
              Array.from({ length: 64 }, (_, step) =>
                at((step * Math.PI * 2) / 64),
              ),
            ),
            new THREE.LineBasicMaterial({
              color: 0x7fb3c8,
              transparent: true,
              opacity: 0.32,
              depthWrite: false,
            }),
          );
          group.add(ring);
          return at(i * 1.2);
        });
        const readiness = cubeReadinessGuides(index).map((guide) => {
          const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(...guide.start),
              new THREE.Vector3(...guide.end),
            ]),
            new THREE.LineBasicMaterial({
              color: 0x7fb3c8,
              transparent: true,
              opacity: 0.16,
              depthWrite: false,
            }),
          );
          group.add(line);
          return { line, anchor: new THREE.Vector3(...guide.end) };
        });
        const order = readiness.map((guide) => guide.anchor);
        group.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(order),
            new THREE.LineBasicMaterial({
              color: 0x7fb3c8,
              transparent: true,
              opacity: 0.35,
              depthWrite: false,
            }),
          ),
        );
        const tangent = order[6].clone().sub(order[5]).normalize();
        group.add(
          new THREE.ArrowHelper(
            tangent,
            order[6].clone().addScaledVector(tangent, -0.07),
            0.07,
            0x7fb3c8,
            0.035,
            0.025,
          ),
        );
        return { group, anchors, readiness };
      });
      let focused = false;
      let frame = 0,
        active: number | null = null,
        chosen: string | null = selectedRef.current,
        previewed: string | null = null;
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
        element.dataset.distance = camera.position
          .distanceTo(controls.target)
          .toFixed(3);
        const anchors = vertices.map((mesh, index) => {
          const p = mesh.position.clone().project(camera);
          const inFront =
            mesh.position.clone().applyMatrix4(camera.matrixWorldInverse).z <
            -camera.near;
          return {
            index,
            x: ((p.x + 1) * host.clientWidth) / 2,
            y: ((1 - p.y) * host.clientHeight) / 2,
            depth: p.z,
            visible:
              inFront && p.z <= 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1,
          };
        });
        const positions = layoutCubeLabels(
          anchors,
          host.clientWidth,
          host.clientHeight,
          active,
        );
        labels.current.forEach((label, i) => {
          if (!label) return;
          const placement = positions.find((p) => p.index === i),
            line = leaders.current[i];
          label.style.display = placement ? "flex" : "none";
          if (line) line.style.display = placement ? "block" : "none";
          if (!placement) return;
          label.style.left = `${placement.left}px`;
          label.style.top = `${placement.top}px`;
          label.style.width = `${placement.width}px`;
          label.style.height = `${placement.height}px`;
          label.style.opacity = active === null || active === i ? "1" : "0.4";
          if (line) {
            line.setAttribute("x1", String(placement.x));
            line.setAttribute("y1", String(placement.y));
            line.setAttribute(
              "x2",
              String(
                Math.max(
                  placement.left,
                  Math.min(placement.left + placement.width, placement.x),
                ),
              ),
            );
            line.setAttribute(
              "y2",
              String(
                Math.max(
                  placement.top,
                  Math.min(placement.top + placement.height, placement.y),
                ),
              ),
            );
          }
        });
        const scoreRow = points.find(
          (p) => p.row.id === (previewed ?? chosen) && p.index === active,
        )?.row;
        const projectGuide = (world: typeof camera.position, index: number) => {
          const p = world.clone().project(camera);
          const inFront =
            world.clone().applyMatrix4(camera.matrixWorldInverse).z <
            -camera.near;
          return {
            index,
            x: ((p.x + 1) * host.clientWidth) / 2,
            y: ((1 - p.y) * host.clientHeight) / 2,
            depth: p.z,
            visible: inFront && p.z >= -1 && p.z <= 1,
          };
        };
        const guideAnchors =
          active !== null && focused
            ? [
                ...levels[active].anchors.map((world, index) =>
                  projectGuide(world, index),
                ),
                ...levels[active].readiness.map((guide, index) =>
                  projectGuide(guide.anchor, index + 5),
                ),
              ]
            : [];
        const guideLabels = layoutCubeLabels(
          guideAnchors,
          host.clientWidth,
          host.clientHeight,
          scoreRow ? [scoreRow.maturity! - 1, scoreRow.readiness! + 4] : null,
          { width: 40, height: 18 },
          positions,
        );
        levelLabels.current.forEach((label, i) => {
          if (!label) return;
          const p = guideLabels.find((p) => p.index === i),
            line = levelLeaders.current[i];
          if (line) {
            line.style.display = p ? "block" : "none";
            if (p) {
              line.setAttribute("x1", String(p.x));
              line.setAttribute("y1", String(p.y));
              line.setAttribute(
                "x2",
                String(Math.max(p.left, Math.min(p.left + p.width, p.x))),
              );
              line.setAttribute("y2", String(p.top + p.height / 2));
            }
          }
          label.dataset.active = String(scoreRow?.maturity === i + 1);
          label.style.display = p ? "block" : "none";
          if (p) {
            label.style.left = `${p.left}px`;
            label.style.top = `${p.top}px`;
          }
        });
        readinessLabels.current.forEach((label, i) => {
          if (!label) return;
          const p = guideLabels.find((p) => p.index === i + 5),
            line = readinessLeaders.current[i];
          label.style.display = p ? "block" : "none";
          label.dataset.active = String(scoreRow?.readiness === i + 1);
          if (line) {
            line.style.display = p ? "block" : "none";
            if (p) {
              line.setAttribute("x1", String(p.x));
              line.setAttribute("y1", String(p.y));
              line.setAttribute(
                "x2",
                String(Math.max(p.left, Math.min(p.left + p.width, p.x))),
              );
              line.setAttribute("y2", String(p.top + p.height / 2));
            }
          }
          if (p) {
            label.style.left = `${p.left}px`;
            label.style.top = `${p.top}px`;
          }
        });
        element.dataset.guideMaturity = scoreRow?.maturity?.toString() ?? "";
        element.dataset.guideReadiness = scoreRow?.readiness?.toString() ?? "";
      }
      function updateProjection(id: string | null) {
        previewed = id;
        const scored = points.find(
          (p) => p.row.id === id && p.index === active,
        )?.row;
        levels.forEach((level, index) => {
          level.group.children.slice(0, 5).forEach((ring, m) => {
            const material = (ring as InstanceType<typeof THREE.LineLoop>)
              .material as InstanceType<typeof THREE.LineBasicMaterial>;
            const highlight = active === index && scored?.maturity === m + 1;
            material.color.set(highlight ? 0xc6f5ff : 0x7fb3c8);
            material.opacity = highlight ? 0.8 : 0.24;
          });
          level.readiness.forEach((guide, r) => {
            const highlight = active === index && scored?.readiness === r + 1;
            guide.line.material.color.set(highlight ? 0xc6f5ff : 0x7fb3c8);
            guide.line.material.opacity = highlight ? 0.85 : 0.16;
          });
        });

        const point =
          points.find(
            (p) => p.row.id === id && (active === null || p.index === active),
          ) ?? points.find((p) => p.row.id === id);
        projection.visible = Boolean(point);
        element.dataset.projectionScenario = point?.row.id ?? "";
        if (point) {
          const attribute = projectionGeometry.getAttribute("position");
          for (let axis = 0; axis < 3; axis++) {
            const target = [...point.position];
            target[axis] = 0;
            attribute.setXYZ(axis * 2, ...point.position);
            attribute.setXYZ(axis * 2 + 1, target[0], target[1], target[2]);
          }
          attribute.needsUpdate = true;
          projectionGeometry.computeBoundingSphere();
        }
        requestDraw();
      }
      function appearance() {
        meshes.forEach((mesh, i) => {
          const p = points[i],
            pick = p.row.id === chosen;
          mesh.material.opacity =
            pick || active === null || active === p.index ? 1 : 0.06;
          mesh.material.depthWrite = mesh.material.opacity === 1;
          mesh.material.emissive.set(pick ? 0xc6f5ff : 0x000000);
          mesh.material.emissiveIntensity = pick ? 0.45 : 0;
          mesh.scale.setScalar(
            cubeRadius(p.row.impact) * 0.85 * (pick ? 1.2 : 1),
          );
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
      function focus(index: number | null) {
        active = index;
        region.visible = index !== null;
        focused = index !== null;
        element.dataset.direction = index === null ? "" : String(index);
        levels.forEach((level, i) => {
          level.group.visible = focused && index === i;
        });
        if (index !== null) {
          const v = new THREE.Vector3(...cubeVertex(index));
          region.position.copy(v).multiplyScalar(0.5);
        }
        updateProjection(chosen);
        appearance();
      }
      function select(id: string | null, notify = true) {
        chosen = id;
        element.dataset.selected = id ?? "";
        setSelected(id);
        if (notify) selectionCallback.current?.(id);
        updateProjection(id);
        appearance();
      }
      runtime.current = {
        reset: resetCamera,
        preview: (id) => updateProjection(id ?? chosen),
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
          region.visible = index !== null || active !== null;
          const highlighted = index ?? active;
          if (highlighted !== null)
            region.position.set(...cubeVertex(highlighted)).multiplyScalar(0.5);
          element.dataset.highlightedDirection =
            highlighted === null ? "" : String(highlighted);
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
          updateProjection(chosen);
          return;
        }
        const h = hit(event);
        const row = h
          ? points[meshes.indexOf(h.object as (typeof meshes)[number])].row
          : null;
        setHover(row);
        updateProjection(row?.id ?? chosen);
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
      const leave = () => {
        setHover(null);
        updateProjection(chosen);
      };
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
          if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
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
      appearance();
      updateProjection(chosen);
      element.dataset.selected = chosen ?? "";
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
  function chooseDirection(index: number | null) {
    setDirection(index);
    runtime.current?.focus(index);
  }
  function chooseScenario(id: string) {
    setSelected(id);
    if (runtime.current) runtime.current.select(id);
    else selectionCallback.current?.(id);
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
        <div className={styles.state} role="status">
          {status} · {visibleRows.length} / {data.total} сценариев
        </div>
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
                <svg className={styles.leaders} aria-hidden="true">
                  {[1, 2, 3, 4, 5, 6, 7].map((level, i) => (
                    <line
                      key={`og-${level}`}
                      ref={(el) => {
                        readinessLeaders.current[i] = el;
                      }}
                    />
                  ))}
                  {[1, 2, 3, 4, 5].map((level, i) => (
                    <line
                      key={`level-${level}`}
                      ref={(el) => {
                        levelLeaders.current[i] = el;
                      }}
                    />
                  ))}
                  {data.directions.map((d) => (
                    <line
                      key={d.id}
                      ref={(el) => {
                        leaders.current[data.directions.indexOf(d)] = el;
                      }}
                    />
                  ))}
                </svg>
                {direction !== null && (
                  <span className={styles.readinessHint}>
                    ОГ 1 → 7 — вокруг оси направления, без перехода 7 → 1. Лучи
                    пересекают уровни РЗ.
                  </span>
                )}
                <div className={styles.labels}>
                  {[1, 2, 3, 4, 5, 6, 7].map((level, i) => (
                    <span
                      key={`og-${level}`}
                      ref={(el) => {
                        readinessLabels.current[i] = el;
                      }}
                      className={styles.levelLabel}
                      data-readiness-level={level}
                    >
                      ОГ {level}
                    </span>
                  ))}
                  {[1, 2, 3, 4, 5].map((level, i) => (
                    <span
                      key={level}
                      ref={(el) => {
                        levelLabels.current[i] = el;
                      }}
                      className={styles.levelLabel}
                      data-maturity-level={level}
                    >
                      РЗ {level}
                    </span>
                  ))}
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
                      <span className={styles.vertexIndex}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{shortDirection(d.name)}</span>
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
                  <details className={styles.directionMenu}>
                    <summary>Направления</summary>{" "}
                    <h2>Технологические направления</h2>
                    <div className={styles.directions}>
                      {data.directions.map((d, i) => (
                        <button
                          key={d.id}
                          className={styles.direction}
                          aria-pressed={direction === i}
                          onPointerEnter={() => runtime.current?.highlight(i)}
                          onPointerLeave={() =>
                            runtime.current?.highlight(null)
                          }
                          onClick={(event) => {
                            chooseDirection(direction === i ? null : i);
                            event.currentTarget
                              .closest("details")
                              ?.removeAttribute("open");
                          }}
                        >
                          <b>{String(i + 1).padStart(2, "0")}</b>
                          {d.name}
                        </button>
                      ))}
                    </div>
                  </details>{" "}
                  {direction !== null && (
                    <button
                      className={styles.focus}
                      onClick={() => chooseDirection(null)}
                    >
                      Общий обзор
                    </button>
                  )}
                </div>
                <span className={styles.hint}>
                  Перетаскивайте для вращения · Колесо — масштаб
                </span>
              </>
            )}
            {direction !== null && (
              <section
                className={styles.unfold}
                aria-label="Развёртка направления"
                onPointerLeave={() => {
                  setHover(null);
                  runtime.current?.preview(null);
                }}
              >
                <header>
                  <div>
                    <span>Фокус направления</span>
                    <h2>{data.directions[direction].name}</h2>
                  </div>
                  <button
                    onClick={() => chooseDirection(null)}
                    aria-label="Закрыть развёртку"
                  >
                    ×
                  </button>
                </header>
                <svg
                  viewBox="0 0 520 430"
                  aria-label="РЗ по X, ОГ по Y"
                  className={styles.unfoldPlot}
                >
                  <desc>
                    Рыночная зрелость 1–5 по горизонтали, организационная
                    готовность 1–7 по вертикали. Цвет — статус реализации,
                    размер — влияние.
                  </desc>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <g key={`x${value}`}>
                      <line
                        x1={unfoldX(value)}
                        x2={unfoldX(value)}
                        y1={plot.top - 12}
                        y2={plot.bottom + 12}
                      />
                      <text
                        x={unfoldX(value)}
                        y={plot.bottom + 34}
                        textAnchor="middle"
                      >
                        {value}
                      </text>
                    </g>
                  ))}
                  {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                    <g key={`y${value}`}>
                      <line
                        x1={plot.left - 12}
                        x2={plot.right + 4}
                        y1={unfoldY(value)}
                        y2={unfoldY(value)}
                      />
                      <text
                        x={plot.left - 25}
                        y={unfoldY(value) + 4}
                        textAnchor="middle"
                      >
                        {value}
                      </text>
                    </g>
                  ))}
                  <text
                    x={(plot.left + plot.right) / 2}
                    y={405}
                    textAnchor="middle"
                  >
                    Рыночная зрелость (РЗ) · 1–5
                  </text>
                  <text
                    transform={`translate(7 ${(plot.top + plot.bottom) / 2}) rotate(-90)`}
                    textAnchor="middle"
                  >
                    Организационная готовность (ОГ) · 1–7
                  </text>
                  {[
                    ...unfoldRows.filter((row) => row.id !== selected),
                    ...unfoldRows.filter((row) => row.id === selected),
                  ].map((row) => {
                    // Shared matrix offsets keep coincident scenarios individually selectable.
                    const position = matrixPosition(
                      row.id,
                      row.maturity!,
                      row.readiness!,
                    );
                    const x = unfoldX(position.y),
                      y = unfoldY(position.x),
                      r = pointRadius(row.impact) * density;
                    const tip = `${row.externalId}: ${row.name} · РЗ ${row.maturity}, ОГ ${row.readiness}, влияние ${row.impact ?? "не указано"}, ${implementationLabel(row.implementation)}`;
                    return (
                      <g key={row.id}>
                        {selected === row.id && (
                          <SelectionHalo cx={x} cy={y} r={r + 5} />
                        )}
                        <circle
                          role="button"
                          tabIndex={0}
                          aria-label={tip}
                          aria-pressed={selected === row.id}
                          data-focus-scenario={row.id}
                          data-maturity={row.maturity}
                          data-readiness={row.readiness}
                          data-impact={row.impact ?? ""}
                          cx={x}
                          cy={y}
                          r={r}
                          fill={statusColors[row.implementation]}
                          onClick={() => chooseScenario(row.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              chooseScenario(row.id);
                            }
                          }}
                          onPointerEnter={() => {
                            setHover(row);
                            runtime.current?.preview(row.id);
                          }}
                          onFocus={() => {
                            setHover(row);
                            runtime.current?.preview(row.id);
                          }}
                          onBlur={() => {
                            setHover(null);
                            runtime.current?.preview(null);
                          }}
                        >
                          <title>{tip}</title>
                        </circle>
                      </g>
                    );
                  })}
                </svg>

                <p className={styles.unfoldNote}>
                  {unfoldRows.length} на развёртке · Без РЗ или ОГ:{" "}
                  {missing.length}
                  {unsupported > 0
                    ? ` · Без подтверждённого статуса: ${unsupported}`
                    : ""}
                  . Небольшое разнесение внутри делений сохраняет выбор
                  совпадающих сценариев.
                </p>
                {unfoldRows.length === 0 && (
                  <p>Нет сценариев с обеими оценками.</p>
                )}
                {selected && !unfoldRows.some((row) => row.id === selected) && (
                  <p className={styles.unfoldNote}>
                    Выбор сохранён; сценарий вне этой развёртки.
                  </p>
                )}
                {missing.length > 0 && (
                  <details className={styles.missing}>
                    <summary>Без оценок ({missing.length})</summary>
                    {missing.map((row) => (
                      <button
                        key={row.id}
                        onClick={() => chooseScenario(row.id)}
                      >
                        {row.externalId} · {row.name}
                      </button>
                    ))}
                  </details>
                )}
              </section>
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
            {inspected && !unavailable && (
              <div className={styles.tooltip} role="tooltip">
                <b>{inspected.externalId}</b>
                <br />
                {inspected.name}
                <br />
                РЗ {inspected.maturity ?? "не указана"} · ОГ{" "}
                {inspected.readiness ?? "не указана"} · Влияние{" "}
                {inspected.impact ?? "не указано"}
                <br />
                {implementationLabel(inspected.implementation)}
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
            <span>
              Влияние:{" "}
              {[1, 2, 3].map((level) => (
                <span key={level} className={styles.impactKey}>
                  <i style={{ width: 4 + level * 2, height: 4 + level * 2 }} />
                  {level}
                </span>
              ))}{" "}
              — размер сферы
            </span>
          </div>
          <details className={styles.help}>
            <summary>Как читать куб</summary>{" "}
            <p className={styles.footer}>
              РЗ 5 — ближе к вершине · ОГ 1–7 — положение на сферическом слое.
              <br />
              Короткие подписи у вершин; полные названия — в меню «Направления».
              В фокусе показаны пять уровней РЗ: 5 — ближе к вершине.
            </p>
          </details>
        </div>
        <aside className={styles.rail}>
          <div className={styles.detail} aria-live="polite" hidden={!item}>
            {item ? (
              <>
                <span>{item.externalId}</span>
                <strong>{item.name}</strong>РЗ {item.maturity ?? "не указана"} /
                5 · ОГ {item.readiness ?? "не указана"} / 7<br />
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

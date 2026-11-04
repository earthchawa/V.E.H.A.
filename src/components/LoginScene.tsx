"use client";

import { useEffect, useRef } from "react";

/**
 * Animated 3D backdrop for the sign-in pages: a dotted globe on the horizon with flight routes
 * arcing over it, a starfield, and gentle mouse parallax. three.js is loaded only here.
 * Respects prefers-reduced-motion (renders one still frame), pauses in background tabs,
 * follows the light/dark theme, and quietly does nothing without WebGL.
 */
export function LoginScene() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const el = host.current;
      if (!el || disposed) return;

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      } catch {
        return; // no WebGL — the CSS glow behind the card is enough
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      el.appendChild(renderer.domElement);
      renderer.domElement.style.cssText = "width:100%;height:100%;display:block";

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.set(0, 0, 9);

      const css = () => getComputedStyle(document.documentElement);
      const isLight = () => document.documentElement.dataset.theme === "light";
      const accent = () => new THREE.Color(css().getPropertyValue("--color-accent").trim() || "#5b8cff");

      // ---- Globe: dots on a sphere (Fibonacci lattice) + faint wireframe ----
      const R = 3.4;
      const globe = new THREE.Group();
      globe.position.set(0, -4.6, 0);
      globe.rotation.x = 0.35;
      scene.add(globe);

      const N = 2600;
      const dots = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const y = 1 - (i / (N - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const th = i * Math.PI * (3 - Math.sqrt(5));
        dots.set([Math.cos(th) * r * R, y * R, Math.sin(th) * r * R], i * 3);
      }
      const dotGeo = new THREE.BufferGeometry();
      dotGeo.setAttribute("position", new THREE.BufferAttribute(dots, 3));
      const dotMat = new THREE.PointsMaterial({ size: 0.035, transparent: true, opacity: 0.85, depthWrite: false });
      globe.add(new THREE.Points(dotGeo, dotMat));

      const wireGeo = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(R * 0.995, 3));
      const wireMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.08 });
      globe.add(new THREE.LineSegments(wireGeo, wireMat));

      // Soft atmosphere glow (radial gradient sprite)
      const glowCanvas = document.createElement("canvas");
      glowCanvas.width = glowCanvas.height = 256;
      const g = glowCanvas.getContext("2d")!;
      const grad = g.createRadialGradient(128, 128, 40, 128, 128, 128);
      grad.addColorStop(0, "rgba(255,255,255,0.55)");
      grad.addColorStop(0.45, "rgba(255,255,255,0.18)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 256);
      const glowMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowCanvas), transparent: true, depthWrite: false, opacity: 0.5 });
      const glow = new THREE.Sprite(glowMat);
      glow.scale.set(R * 3.2, R * 3.2, 1);
      glow.position.copy(globe.position);
      scene.add(glow);

      // Orbit ring with a "satellite"
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(R * 1.35, 0.006, 8, 200),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.25 }),
      );
      ring.rotation.set(1.2, 0.3, 0);
      globe.add(ring);
      const satMat = new THREE.MeshBasicMaterial();
      const sat = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), satMat);
      globe.add(sat);

      // ---- Flight routes: arcs that draw themselves, with a bright head ----
      const SEG = 80;
      const randomOnSphere = () => {
        // Bias towards the visible upper cap so routes arc above the horizon.
        const u = Math.random() * 0.6 + 0.35;
        const phi = Math.acos(1 - 2 * (1 - u));
        const th = Math.random() * Math.PI * 2;
        return new THREE.Vector3(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)).multiplyScalar(R);
      };
      type Route = { line: import("three").Line; head: import("three").Mesh; pts: import("three").Vector3[]; t: number; speed: number; delay: number };
      const routeMat = () => new THREE.LineBasicMaterial({ transparent: true, opacity: 0.7 });
      const headGeo = new THREE.SphereGeometry(0.045, 10, 10);
      const routes: Route[] = [];
      const reset = (r: Route) => {
        const a = randomOnSphere();
        let b = randomOnSphere();
        for (let tries = 0; a.distanceTo(b) < R * 0.6 && tries < 8; tries++) b = randomOnSphere();
        const mid = a.clone().add(b).multiplyScalar(0.5);
        mid.setLength(R + a.distanceTo(b) * 0.45);
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        r.pts = curve.getPoints(SEG);
        (r.line.geometry as import("three").BufferGeometry).setFromPoints(r.pts);
        r.t = 0;
        r.speed = 0.12 + Math.random() * 0.12;
        r.delay = Math.random() * 2.5;
      };
      for (let i = 0; i < 9; i++) {
        const line = new THREE.Line(new THREE.BufferGeometry(), routeMat());
        const head = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial());
        globe.add(line, head);
        const r: Route = { line, head, pts: [], t: 0, speed: 0, delay: 0 };
        reset(r);
        r.t = Math.random(); // start mid-flight
        routes.push(r);
      }

      // ---- Starfield ----
      const S = 1400;
      const stars = new Float32Array(S * 3);
      for (let i = 0; i < S; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(18 + Math.random() * 20);
        stars.set([v.x, Math.abs(v.y) * 0.9 + 1, v.z - 10], i * 3);
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute("position", new THREE.BufferAttribute(stars, 3));
      const starMat = new THREE.PointsMaterial({ size: 0.06, transparent: true, opacity: 0.7, depthWrite: false });
      const starField = new THREE.Points(starGeo, starMat);
      scene.add(starField);

      // ---- Theme colours ----
      const applyTheme = () => {
        const a = accent();
        const light = isLight();
        dotMat.color = a.clone();
        dotMat.opacity = light ? 0.75 : 0.85;
        wireMat.color = a.clone();
        wireMat.opacity = light ? 0.12 : 0.08;
        glowMat.color = a.clone();
        glowMat.opacity = light ? 0.35 : 0.5;
        (ring.material as import("three").MeshBasicMaterial).color = a.clone();
        satMat.color = new THREE.Color(light ? "#0f1319" : "#ffffff");
        starMat.color = new THREE.Color(light ? "#5b6472" : "#ffffff");
        starMat.opacity = light ? 0.25 : 0.7;
        for (const r of routes) {
          (r.line.material as import("three").LineBasicMaterial).color = new THREE.Color(light ? "#e08a00" : "#ffd27a");
          (r.head.material as import("three").MeshBasicMaterial).color = new THREE.Color(light ? "#b45309" : "#fff4d6");
        }
      };
      applyTheme();
      const themeObserver = new MutationObserver(applyTheme);
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

      // ---- Size, parallax, loop ----
      const resize = () => {
        const w = el.clientWidth || window.innerWidth;
        const h = el.clientHeight || window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        // Narrow screens: pull back so the globe still fits.
        camera.position.z = w < 640 ? 12 : 9;
        camera.updateProjectionMatrix();
      };
      resize();
      window.addEventListener("resize", resize);

      const mouse = { x: 0, y: 0 };
      const onMove = (e: PointerEvent) => {
        mouse.x = e.clientX / window.innerWidth - 0.5;
        mouse.y = e.clientY / window.innerHeight - 0.5;
      };
      window.addEventListener("pointermove", onMove);

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const clock = new THREE.Clock();
      let raf = 0;
      let orbit = 0;

      const step = (dt: number) => {
        globe.rotation.y += dt * 0.05;
        starField.rotation.y += dt * 0.004;
        orbit += dt * 0.35;
        const p = new THREE.Vector3(Math.cos(orbit) * R * 1.35, Math.sin(orbit) * R * 1.35, 0).applyEuler(ring.rotation);
        sat.position.copy(p);
        for (const r of routes) {
          if (r.delay > 0) {
            r.delay -= dt;
            r.line.visible = r.head.visible = false;
            continue;
          }
          r.line.visible = r.head.visible = true;
          r.t += dt * r.speed;
          const drawn = Math.min(1, r.t);
          // Draw the route up to the plane; after landing, erase it from the start.
          const start = r.t > 1 ? Math.floor(Math.min(1, r.t - 1) * SEG) : 0;
          const end = Math.max(start + 1, Math.floor(drawn * SEG));
          r.line.geometry.setDrawRange(start, end - start + 1);
          r.head.position.copy(r.pts[Math.min(SEG, Math.floor(drawn * SEG))]);
          r.head.visible = r.t <= 1;
          if (r.t >= 2) reset(r);
        }
        camera.position.x += (mouse.x * 1.2 - camera.position.x) * 0.04;
        camera.position.y += (-mouse.y * 0.8 - camera.position.y) * 0.04;
        camera.lookAt(0, -0.6, 0);
      };

      const loop = () => {
        raf = requestAnimationFrame(loop);
        step(Math.min(clock.getDelta(), 0.05));
        renderer.render(scene, camera);
      };
      if (reduced) {
        step(0);
        renderer.render(scene, camera);
      } else loop();

      const onVisibility = () => {
        if (reduced) return;
        if (document.hidden) cancelAnimationFrame(raf);
        else {
          clock.getDelta();
          loop();
        }
      };
      document.addEventListener("visibilitychange", onVisibility);

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", onMove);
        document.removeEventListener("visibilitychange", onVisibility);
        themeObserver.disconnect();
        scene.traverse((o) => {
          const m = o as import("three").Mesh;
          m.geometry?.dispose?.();
          const mat = m.material as import("three").Material | import("three").Material[] | undefined;
          (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
      if (disposed) cleanup();
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return <div ref={host} aria-hidden className="pointer-events-none fixed inset-0" data-testid="login-scene" />;
}

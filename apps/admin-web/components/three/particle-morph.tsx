'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import anime from 'animejs';
import { createNoise3D, createNoise4D, type NoiseFunction3D, type NoiseFunction4D } from 'simplex-noise';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

// White/ash palette (not the site's violet brand tokens) — a deliberate
// departure requested for this visual.
const PARTICLE_COLORS = {
  outer: 0xe4e4e7, // ash/zinc-200
  inner: 0xffffff, // white
} as const;

export interface ParticleMorphProps {
  className?: string;
  /** Tunable for the bounded panel size this renders into. Demo default was 15000 (fullscreen). */
  particleCount?: number;
  /** Gentle idle rotation while not morphing. Disabled automatically under prefers-reduced-motion. */
  autoRotate?: boolean;
  /** Click-canvas-to-morph. */
  interactive?: boolean;
  onReady?: (controls: { nextShape: () => void }) => void;
}

type ShapeGenerator = (count: number, size: number) => Float32Array;

const SHAPE_SIZE = 3.4;
const MORPH_DURATION = 2600;
const SWIRL_FACTOR = 3.2;
const NOISE_FREQUENCY = 0.28;
const NOISE_TIME_SCALE = 0.06;
const NOISE_MAX_STRENGTH = 0.7;
const SWARM_DISTANCE_FACTOR = 0.9;
const IDLE_ROTATION_SPEED = 0.06;

/**
 * A soft radial-gradient dot, used as the particle sprite. This is what
 * gives each point its glow — not screen-space bloom (UnrealBloomPass),
 * which was dropped: EffectComposer's render target has no usable alpha
 * channel through the bloom composite, so it always renders onto an opaque
 * backdrop — visible as a hard rectangle behind the particles instead of
 * them sitting transparently over the page background. A glowing sprite
 * texture achieves a similar look and stays genuinely transparent.
 */
function createGlowTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.2, 'rgba(255,255,255,0.85)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.3)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function generateSphere(count: number, size: number): Float32Array {
  const points = new Float32Array(count * 3);
  const phi = Math.PI * (Math.sqrt(5) - 1);
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = phi * i;
    points[i * 3] = Math.cos(theta) * radius * size;
    points[i * 3 + 1] = y * size;
    points[i * 3 + 2] = Math.sin(theta) * radius * size;
  }
  return points;
}

function generateCube(count: number, size: number): Float32Array {
  const points = new Float32Array(count * 3);
  const halfSize = size / 2;
  for (let i = 0; i < count; i++) {
    const face = Math.floor(Math.random() * 6);
    const u = Math.random() * size - halfSize;
    const v = Math.random() * size - halfSize;
    const i3 = i * 3;
    switch (face) {
      case 0:
        points.set([halfSize, u, v], i3);
        break;
      case 1:
        points.set([-halfSize, u, v], i3);
        break;
      case 2:
        points.set([u, halfSize, v], i3);
        break;
      case 3:
        points.set([u, -halfSize, v], i3);
        break;
      case 4:
        points.set([u, v, halfSize], i3);
        break;
      default:
        points.set([u, v, -halfSize], i3);
        break;
    }
  }
  return points;
}

function generatePyramid(count: number, size: number): Float32Array {
  const points = new Float32Array(count * 3);
  const halfBase = size / 2;
  const height = size * 1.2;
  const apex = new THREE.Vector3(0, height / 2, 0);
  const baseVertices = [
    new THREE.Vector3(-halfBase, -height / 2, -halfBase),
    new THREE.Vector3(halfBase, -height / 2, -halfBase),
    new THREE.Vector3(halfBase, -height / 2, halfBase),
    new THREE.Vector3(-halfBase, -height / 2, halfBase),
  ];
  const baseArea = size * size;
  const sideFaceHeight = Math.sqrt(height * height + halfBase * halfBase);
  const sideFaceArea = 0.5 * size * sideFaceHeight;
  const totalArea = baseArea + 4 * sideFaceArea;
  const baseWeight = baseArea / totalArea;
  const sideWeight = sideFaceArea / totalArea;
  const tempVec = new THREE.Vector3();
  const p2 = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const r = Math.random();
    const p = new THREE.Vector3();
    let u: number;
    let v: number;
    if (r < baseWeight) {
      u = Math.random();
      v = Math.random();
      p.lerpVectors(baseVertices[0]!, baseVertices[1]!, u);
      p2.lerpVectors(baseVertices[3]!, baseVertices[2]!, u);
      p.lerp(p2, v);
    } else {
      const faceIndex = Math.floor((r - baseWeight) / sideWeight) % 4;
      const v1 = baseVertices[faceIndex]!;
      const v2 = baseVertices[(faceIndex + 1) % 4]!;
      u = Math.random();
      v = Math.random();
      if (u + v > 1) {
        u = 1 - u;
        v = 1 - v;
      }
      p.addVectors(v1, tempVec.subVectors(v2, v1).multiplyScalar(u));
      p.add(tempVec.subVectors(apex, v1).multiplyScalar(v));
    }
    points.set([p.x, p.y, p.z], i * 3);
  }
  return points;
}

function generateTorus(count: number, size: number): Float32Array {
  const points = new Float32Array(count * 3);
  const R = size * 0.7;
  const r = size * 0.3;
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 2;
    const x = (R + r * Math.cos(phi)) * Math.cos(theta);
    const y = r * Math.sin(phi);
    const z = (R + r * Math.cos(phi)) * Math.sin(theta);
    points[i * 3] = x;
    points[i * 3 + 1] = y;
    points[i * 3 + 2] = z;
  }
  return points;
}

function generateGalaxy(count: number, size: number): Float32Array {
  const points = new Float32Array(count * 3);
  const arms = 4;
  const armWidth = 0.6;
  const bulgeFactor = 0.3;
  for (let i = 0; i < count; i++) {
    const t = Math.pow(Math.random(), 1.5);
    const radius = t * size;
    const armIndex = Math.floor(Math.random() * arms);
    const armOffset = (armIndex / arms) * Math.PI * 2;
    const rotationAmount = (radius / size) * 6;
    const angle = armOffset + rotationAmount;
    const spread = (Math.random() - 0.5) * armWidth * (1 - radius / size);
    const theta = angle + spread;
    points[i * 3] = radius * Math.cos(theta);
    points[i * 3 + 1] = (Math.random() - 0.5) * size * 0.1 * (1 - (radius / size) * bulgeFactor);
    points[i * 3 + 2] = radius * Math.sin(theta);
  }
  return points;
}

function generateWave(count: number, size: number): Float32Array {
  const points = new Float32Array(count * 3);
  const waveScale = size * 0.4;
  const frequency = 3;
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1;
    const v = Math.random() * 2 - 1;
    const x = u * size;
    const z = v * size;
    const dist = Math.sqrt(u * u + v * v);
    const angle = Math.atan2(v, u);
    const y = Math.sin(dist * Math.PI * frequency) * Math.cos(angle * 2) * waveScale * (1 - dist);
    points[i * 3] = x;
    points[i * 3 + 1] = y;
    points[i * 3 + 2] = z;
  }
  return points;
}

const SHAPE_GENERATORS: ShapeGenerator[] = [
  generateSphere,
  generateCube,
  generatePyramid,
  generateTorus,
  generateGalaxy,
  generateWave,
];

function paintColors(colors: Float32Array, positions: Float32Array, count: number, size: number) {
  const inner = new THREE.Color(PARTICLE_COLORS.inner);
  const outer = new THREE.Color(PARTICLE_COLORS.outer);
  const maxRadius = size * 1.15;
  const tmp = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const x = positions[i3]!;
    const y = positions[i3 + 1]!;
    const z = positions[i3 + 2]!;
    const dist = Math.sqrt(x * x + y * y + z * z);
    const t = THREE.MathUtils.clamp(dist / maxRadius, 0, 1);
    tmp.copy(inner).lerp(outer, t);
    tmp.toArray(colors, i3);
  }
}

/**
 * A bounded, click-to-morph particle system for the landing hero. Ported
 * from a fullscreen single-file demo: shape generators and the bezier +
 * noise + swirl morph tween are carried over largely unchanged (they
 * operate in local space), while everything that assumed a fullscreen app
 * — OrbitControls, a starfield background, an HTML loading screen, window
 * resize handling — is dropped or replaced with a container-scoped
 * equivalent. See light-rays.tsx for the sibling WebGL decorative
 * component this mirrors (IntersectionObserver-gated init, full disposal
 * on unmount).
 *
 * Unlike LightRays (which deliberately ignores prefers-reduced-motion —
 * see that file's comment), this DOES respect it: a continuous WebGL
 * particle simulation with bloom postprocessing is a much heavier and more
 * motion-dense ask than light rays. Reduced-motion users get one static
 * shape with no ambient rotation/swirl; an explicit click or button press
 * still morphs once, since that's a discrete user-initiated change rather
 * than ambient motion.
 */
export function ParticleMorph({
  className,
  particleCount = 4500,
  autoRotate = true,
  interactive = true,
  onReady,
}: ParticleMorphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Keep the latest callback props reachable from inside the effect without
  // retriggering the (expensive) scene-setup effect on every render.
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;
  const reducedMotionRef = useRef(prefersReducedMotion);
  reducedMotionRef.current = prefersReducedMotion;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!isVisible || !container) return;

    let disposed = false;
    let rafId: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let anim: anime.AnimeInstance | null = null;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const noise3D: NoiseFunction3D = createNoise3D();
    const noise4D: NoiseFunction4D = createNoise4D();

    const targetPositions = SHAPE_GENERATORS.map((gen) => gen(particleCount, SHAPE_SIZE));
    const currentPositions = new Float32Array(targetPositions[0]!);
    const sourcePositions = new Float32Array(targetPositions[0]!);
    const swarmPositions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    paintColors(colors, currentPositions, particleCount, SHAPE_SIZE);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const glowTexture = createGlowTexture();
    const material = new THREE.PointsMaterial({
      size: 0.11,
      map: glowTexture,
      alphaMap: glowTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let currentShapeIndex = 0;
    let isMorphing = false;
    const morphState = { progress: 0 };

    const sourceVec = new THREE.Vector3();
    const targetVec = new THREE.Vector3();
    const swarmVec = new THREE.Vector3();
    const bezPos = new THREE.Vector3();
    const tempVec = new THREE.Vector3();
    const noiseOffset = new THREE.Vector3();
    const swirlAxis = new THREE.Vector3();
    const offsetDir = new THREE.Vector3();

    function runMorph() {
      if (isMorphing || disposed) return;
      isMorphing = true;

      const positionAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
      sourcePositions.set(currentPositions);
      const nextShapeIndex = (currentShapeIndex + 1) % SHAPE_GENERATORS.length;
      const nextTargets = targetPositions[nextShapeIndex]!;

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        sourceVec.fromArray(sourcePositions, i3);
        targetVec.fromArray(nextTargets, i3);
        swarmVec.lerpVectors(sourceVec, targetVec, 0.5);
        offsetDir
          .set(noise3D(i * 0.05, 10, 10), noise3D(20, i * 0.05, 20), noise3D(30, 30, i * 0.05))
          .normalize();
        const distFactor = sourceVec.distanceTo(targetVec) * 0.15 + SHAPE_SIZE * SWARM_DISTANCE_FACTOR;
        swarmVec.addScaledVector(offsetDir, distFactor * (0.5 + Math.random() * 0.8));
        swarmPositions[i3] = swarmVec.x;
        swarmPositions[i3 + 1] = swarmVec.y;
        swarmPositions[i3 + 2] = swarmVec.z;
      }

      currentShapeIndex = nextShapeIndex;
      morphState.progress = 0;

      if (anim) anim.pause();
      anim = anime({
        targets: morphState,
        progress: 1,
        duration: MORPH_DURATION,
        easing: 'cubicBezier(0.4, 0.0, 0.2, 1.0)',
        update: () => {
          const t = morphState.progress;
          const targets = targetPositions[currentShapeIndex]!;
          const effectStrength = Math.sin(t * Math.PI);
          const currentSwirl = effectStrength * SWIRL_FACTOR * 0.02;
          const currentNoise = effectStrength * NOISE_MAX_STRENGTH;
          const elapsed = performance.now() * 0.001;
          const t_inv = 1 - t;
          const t_inv_sq = t_inv * t_inv;
          const t_sq = t * t;

          for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            sourceVec.fromArray(sourcePositions, i3);
            swarmVec.fromArray(swarmPositions, i3);
            targetVec.fromArray(targets, i3);

            bezPos.copy(sourceVec).multiplyScalar(t_inv_sq);
            bezPos.addScaledVector(swarmVec, 2 * t_inv * t);
            bezPos.addScaledVector(targetVec, t_sq);

            if (currentSwirl > 0.001) {
              tempVec.subVectors(bezPos, sourceVec);
              swirlAxis
                .set(
                  noise3D(i * 0.02, elapsed * 0.1, 0),
                  noise3D(0, i * 0.02, elapsed * 0.1 + 5),
                  noise3D(elapsed * 0.1 + 10, 0, i * 0.02),
                )
                .normalize();
              tempVec.applyAxisAngle(swirlAxis, currentSwirl * (0.5 + Math.random() * 0.5));
              bezPos.copy(sourceVec).add(tempVec);
            }

            if (currentNoise > 0.001) {
              const noiseTime = elapsed * NOISE_TIME_SCALE;
              noiseOffset.set(
                noise4D(bezPos.x * NOISE_FREQUENCY, bezPos.y * NOISE_FREQUENCY, bezPos.z * NOISE_FREQUENCY, noiseTime),
                noise4D(
                  bezPos.x * NOISE_FREQUENCY + 100,
                  bezPos.y * NOISE_FREQUENCY + 100,
                  bezPos.z * NOISE_FREQUENCY + 100,
                  noiseTime,
                ),
                noise4D(
                  bezPos.x * NOISE_FREQUENCY + 200,
                  bezPos.y * NOISE_FREQUENCY + 200,
                  bezPos.z * NOISE_FREQUENCY + 200,
                  noiseTime,
                ),
              );
              bezPos.addScaledVector(noiseOffset, currentNoise);
            }

            currentPositions[i3] = bezPos.x;
            currentPositions[i3 + 1] = bezPos.y;
            currentPositions[i3 + 2] = bezPos.z;
          }

          positionAttr.needsUpdate = true;
          paintColors(colors, currentPositions, particleCount, SHAPE_SIZE);
          (geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
        },
        complete: () => {
          currentPositions.set(targetPositions[currentShapeIndex]!);
          positionAttr.needsUpdate = true;
          sourcePositions.set(targetPositions[currentShapeIndex]!);
          isMorphing = false;
        },
      });
    }

    function handleClick() {
      if (!interactiveRef.current) return;
      runMorph();
    }
    renderer.domElement.addEventListener('click', handleClick);

    onReadyRef.current?.({ nextShape: runMorph });

    const updateSize = () => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) return;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      const pixelRatio = Math.min(window.devicePixelRatio, 2);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(clientWidth, clientHeight, false);
    };

    resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    updateSize();

    let frameRunning = true;
    const loop = () => {
      if (!frameRunning) return;
      rafId = requestAnimationFrame(loop);

      if (autoRotateRef.current && !isMorphing && !reducedMotionRef.current) {
        points.rotation.y += IDLE_ROTATION_SPEED * 0.016;
      }

      renderer.render(scene, camera);

      if (!isReady) setIsReady(true);
    };
    rafId = requestAnimationFrame(loop);

    // Under reduced motion, render one static frame and skip continuous
    // ambient animation entirely rather than running an RAF loop that does
    // nothing but re-render an unchanging scene.
    if (reducedMotionRef.current) {
      frameRunning = false;
      if (rafId) cancelAnimationFrame(rafId);
      updateSize();
      renderer.render(scene, camera);
      setIsReady(true);
    }

    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting && !frameRunning && !reducedMotionRef.current) {
          frameRunning = true;
          rafId = requestAnimationFrame(loop);
        } else if (!entry.isIntersecting && frameRunning) {
          frameRunning = false;
          if (rafId) cancelAnimationFrame(rafId);
        }
      },
      { threshold: 0.1 },
    );
    visibilityObserver.observe(container);

    return () => {
      disposed = true;
      frameRunning = false;
      if (rafId) cancelAnimationFrame(rafId);
      if (anim) anim.pause();
      resizeObserver?.disconnect();
      visibilityObserver.disconnect();
      renderer.domElement.removeEventListener('click', handleClick);

      geometry.dispose();
      material.dispose();
      glowTexture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- particleCount intentionally re-runs full setup; onReady/autoRotate/interactive/prefersReducedMotion are read via refs to avoid tearing down the scene every render.
  }, [isVisible, particleCount]);

  return (
    <div ref={containerRef} className={cn('relative h-full w-full', className)}>
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 bg-white/5 transition-opacity duration-500',
          isReady ? 'opacity-0' : 'animate-pulse opacity-100',
        )}
      />
    </div>
  );
}

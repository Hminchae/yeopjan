import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { AvatarStyle, PublicUser } from '@yeopjan/shared';

interface Props {
  users: PublicUser[];
  selfId: string | null;
  onMove: (x: number, y: number) => void;
}

const avatarColors: Record<AvatarStyle, number> = {
  amber: 0xffc66d,
  burgundy: 0xe86f7a,
  navy: 0x397b92,
  sage: 0x69c6ac,
  plum: 0xa76a91,
  copper: 0xef8b68
};

const normalizedToWorld = (x: number, y: number) => new THREE.Vector3((x - 50) * 0.24, 0, (y - 54) * 0.18);
const worldToNormalized = (point: THREE.Vector3) => ({
  x: Math.max(4, Math.min(96, point.x / 0.24 + 50)),
  y: Math.max(12, Math.min(92, point.z / 0.18 + 54))
});

function material(color: number, roughness = 0.76, metalness = 0.04) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
}

function mesh(
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  position: [number, number, number],
  rotation?: [number, number, number]
) {
  const item = new THREE.Mesh(geometry, surface);
  item.position.set(...position);
  if (rotation) item.rotation.set(...rotation);
  return item;
}

function addBottle(group: THREE.Group, x: number, color: number, height: number) {
  group.add(mesh(new THREE.CylinderGeometry(0.075, 0.13, height, 8), material(color, 0.28, 0.12), [x, height / 2, 0]));
}

function createBarInterior(scene: THREE.Scene) {
  scene.add(mesh(new THREE.PlaneGeometry(28, 23), material(0x174f5d, 0.9), [0, 0, 0], [-Math.PI / 2, 0, 0]));
  for (let z = -10; z < 10; z += 1.35) {
    const seam = mesh(new THREE.BoxGeometry(28, 0.012, 0.035), material(0x267182), [0, 0.016, z]);
    seam.receiveShadow = false;
    scene.add(seam);
  }

  scene.add(
    mesh(new THREE.BoxGeometry(28, 9, 0.35), material(0xc85f70), [0, 4.5, -10]),
    mesh(new THREE.BoxGeometry(0.35, 9, 22), material(0x8f4f68), [-14, 4.5, 0]),
    mesh(new THREE.BoxGeometry(0.35, 9, 22), material(0x8f4f68), [14, 4.5, 0])
  );

  const windowFrame = material(0x174a5a, 0.88);
  scene.add(mesh(new THREE.BoxGeometry(8.3, 5.5, 0.2), windowFrame, [-7.8, 4.6, -9.72]));
  const rainyGlass = new THREE.MeshStandardMaterial({ color: 0x4eb7b4, roughness: 0.42, metalness: 0.02, transparent: true, opacity: 0.68, flatShading: true });
  scene.add(
    mesh(new THREE.BoxGeometry(7.6, 4.8, 0.12), rainyGlass, [-7.8, 4.6, -9.48]),
    mesh(new THREE.BoxGeometry(0.13, 4.8, 0.14), windowFrame, [-7.8, 4.6, -9.34]),
    mesh(new THREE.BoxGeometry(7.6, 0.13, 0.14), windowFrame, [-7.8, 4.6, -9.34])
  );

  const rainGeometry = new THREE.BufferGeometry();
  const rainPositions = new Float32Array(90 * 3);
  for (let index = 0; index < 90; index += 1) {
    rainPositions[index * 3] = -11.4 + Math.random() * 7.2;
    rainPositions[index * 3 + 1] = 2.3 + Math.random() * 4.6;
    rainPositions[index * 3 + 2] = -9.18;
  }
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.Points(rainGeometry, new THREE.PointsMaterial({ color: 0xd8fff0, size: 0.07, transparent: true, opacity: 0.8 }));
  rain.name = 'rain';
  scene.add(rain);

  const shelf = new THREE.Group();
  shelf.position.set(5.1, 3.4, -9.3);
  shelf.add(
    mesh(new THREE.BoxGeometry(9.2, 0.18, 0.8), material(0x713f59), [0, -1.2, 0]),
    mesh(new THREE.BoxGeometry(9.2, 0.18, 0.8), material(0x713f59), [0, 0.55, 0]),
    mesh(new THREE.BoxGeometry(9.2, 0.18, 0.8), material(0x713f59), [0, 2.3, 0])
  );
  const bottleColors = [0x65c9b7, 0xef7981, 0xffd47b, 0x3c8f97, 0xb96888];
  for (let row = 0; row < 3; row += 1) {
    for (let index = 0; index < 11; index += 1) {
      const bottles = new THREE.Group();
      bottles.position.set(-4 + index * 0.78, -0.98 + row * 1.75, 0.05);
      addBottle(bottles, 0, bottleColors[(index + row) % bottleColors.length]!, 0.55 + ((index + row) % 3) * 0.1);
      shelf.add(bottles);
    }
  }
  scene.add(shelf);

  const bar = new THREE.Group();
  bar.position.set(1.2, 0, -2.2);
  bar.add(
    mesh(new THREE.BoxGeometry(17, 1.8, 2.2), material(0x793f59), [0, 0.9, 0]),
    mesh(new THREE.BoxGeometry(17.5, 0.22, 2.65), material(0xf18a7f, 0.7), [0, 1.94, 0]),
    mesh(new THREE.BoxGeometry(16.4, 0.08, 0.08), material(0xffdf9f, 0.6), [0, 1.2, 1.14])
  );
  scene.add(bar);

  const stoolSurface = material(0xd65f70);
  const brass = material(0xffcc78, 0.7, 0.05);
  for (let index = 0; index < 6; index += 1) {
    const x = -6 + index * 2.65;
    scene.add(
      mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.24, 18), stoolSurface, [x, 1.04, 0.35]),
      mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.8, 12), brass, [x, 0.1, 0.35])
    );
  }

  for (const tableX of [-5.4, 5.7]) {
    scene.add(
      mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.18, 12), material(0x9a5166), [tableX, 1.15, 5.2]),
      mesh(new THREE.CylinderGeometry(0.22, 0.32, 1.2, 14), brass, [tableX, 0.55, 5.2])
    );
    for (const [dx, dz] of [[-1.7, 0], [1.7, 0], [0, -1.6], [0, 1.6]] as const) {
      scene.add(
        mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.2, 16), stoolSurface, [tableX + dx, 0.78, 5.2 + dz]),
        mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.4, 10), brass, [tableX + dx, 0.05, 5.2 + dz])
      );
    }
  }

  scene.add(
    mesh(new THREE.BoxGeometry(5.6, 0.55, 1.2), material(0x9a5166), [-8.4, 0.75, -6.8]),
    mesh(new THREE.BoxGeometry(5.6, 2.1, 0.3), material(0x6b435d), [-8.4, 1.6, -7.3])
  );

  const door = new THREE.Group();
  door.position.set(10.4, 2.8, -9.65);
  door.add(
    mesh(new THREE.BoxGeometry(3.2, 5.6, 0.24), material(0xe06c78), [0, 0, 0]),
    mesh(new THREE.BoxGeometry(2.35, 3.1, 0.12), rainyGlass, [0, 0.75, 0.18]),
    mesh(new THREE.SphereGeometry(0.13, 12, 8), brass, [-0.95, -1.2, 0.28])
  );
  scene.add(door);

  for (const x of [-6, 0, 6]) {
    scene.add(
      mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.6, 8), brass, [x, 7.2, -2.4]),
      mesh(new THREE.CylinderGeometry(0.55, 0.82, 0.6, 8, 1, true), material(0xef7880, 0.8), [x, 5.3, -2.4]),
      mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0xffe2a6 }), [x, 5.1, -2.4])
    );
    const light = new THREE.PointLight(0xffb36f, 42, 11, 1.55);
    light.position.set(x, 4.8, -2.4);
    scene.add(light);
  }
}

function createAvatar(user: PublicUser, self: boolean) {
  const group = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(0.82, 1.15, 0.64), material(avatarColors[user.avatar], 0.9), [0, 1.2, 0]);
  body.name = 'body';
  group.add(
    body,
    mesh(new THREE.BoxGeometry(0.68, 0.68, 0.66), material(0xffc59f, 0.9), [0, 2.12, 0]),
    mesh(new THREE.BoxGeometry(0.72, 0.25, 0.7), material(0x234757, 0.95), [0, 2.4, -0.02]),
    mesh(new THREE.BoxGeometry(0.2, 0.34, 0.2), material(0xffdc8c, 0.8), [0.55, 1.42, 0.03])
  );
  if (self) {
    const ring = mesh(new THREE.RingGeometry(0.65, 0.76, 16), new THREE.MeshBasicMaterial({ color: 0xffe49f, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }), [0, 0.035, 0], [-Math.PI / 2, 0, 0]);
    ring.name = 'self-ring';
    group.add(ring);
  }
  group.userData.target = normalizedToWorld(user.x, user.y);
  group.position.copy(group.userData.target as THREE.Vector3);
  group.userData.connected = user.connected;
  group.userData.seated = Boolean(user.seatId);
  return group;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
      child.geometry.dispose();
      const surfaces = Array.isArray(child.material) ? child.material : [child.material];
      surfaces.forEach((surface) => surface.dispose());
    }
  });
}

export function BarScene({ users, selfId, onMove }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const avatarsRef = useRef(new Map<string, THREE.Group>());
  const onMoveRef = useRef(onMove);
  const [failed, setFailed] = useState(false);
  onMoveRef.current = onMove;

  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const compact = container.clientWidth < 720;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: compact ? 'low-power' : 'high-performance' });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(1);
    const pixelScale = compact ? 0.48 : 0.58;
    renderer.setSize(Math.round(container.clientWidth * pixelScale), Math.round(container.clientHeight * pixelScale), false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.domElement.dataset.renderer = 'three-webgl';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x123f50);
    scene.fog = new THREE.FogExp2(0x123f50, 0.022);
    sceneRef.current = scene;
    createBarInterior(scene);
    scene.add(new THREE.HemisphereLight(0x8ee0d3, 0x7f455e, 2.6));
    scene.add(new THREE.AmbientLight(0xffd7ad, 0.72));
    const moonlight = new THREE.DirectionalLight(0x79d1cc, 1.6);
    moonlight.position.set(-8, 10, -5);
    scene.add(moonlight);

    const camera = new THREE.PerspectiveCamera(42, container.clientWidth / Math.max(container.clientHeight, 1), 0.1, 80);
    camera.position.set(0, 14.5, 18.5);
    camera.lookAt(0, 0.7, -1.2);
    cameraRef.current = camera;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    const handlePointer = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(floorPlane, intersection)) {
        const next = worldToNormalized(intersection);
        onMoveRef.current(next.x, next.y);
      }
    };
    renderer.domElement.addEventListener('pointerup', handlePointer);

    const resize = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (!width || !height) return;
      renderer.setSize(Math.round(width * pixelScale), Math.round(height * pixelScale), false);
      camera.aspect = width / height;
      if (width < 720) {
        camera.fov = 65;
        camera.position.set(0, 20, 30);
      } else {
        camera.fov = 42;
        camera.position.set(0, 14.5, 18.5);
      }
      camera.lookAt(0, 0.7, -1.2);
      camera.updateProjectionMatrix();
      if (reducedMotion) renderer.render(scene, camera);
    });
    resize.observe(container);

    const clock = new THREE.Clock();
    let frame = 0;
    let lastRendered = 0;
    const frameInterval = reducedMotion ? 100 : compact ? 80 : 32;
    const render = (now = performance.now()) => {
      if (!reducedMotion) frame = requestAnimationFrame(render);
      if (now - lastRendered < frameInterval) return;
      lastRendered = now;
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      const rain = scene.getObjectByName('rain') as THREE.Points | undefined;
      if (rain && !reducedMotion) {
        const positions = rain.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let index = 0; index < positions.count; index += 1) {
          const nextY = positions.getY(index) - delta * (1.3 + (index % 5) * 0.14);
          positions.setY(index, nextY < 2.2 ? 6.9 : nextY);
        }
        positions.needsUpdate = true;
      }
      avatarsRef.current.forEach((avatar, id) => {
        avatar.position.lerp(avatar.userData.target as THREE.Vector3, reducedMotion ? 1 : 0.09);
        const baseY = avatar.userData.counterSeat ? 0.32 : avatar.userData.seated ? -0.28 : 0;
        avatar.position.y = baseY + (reducedMotion ? 0 : Math.sin(elapsed * 2.1 + id.length) * 0.025);
        avatar.rotation.y = Math.sin(elapsed * 0.42 + id.length) * 0.08;
        avatar.visible = avatar.userData.connected as boolean;
        const ring = avatar.getObjectByName('self-ring');
        if (ring && !reducedMotion) ring.rotation.z = elapsed * 0.22;
      });
      renderer.render(scene, camera);
    };
    render();

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      renderer.domElement.removeEventListener('pointerup', handlePointer);
      avatarsRef.current.clear();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const active = new Set(users.map((user) => user.id));
    avatarsRef.current.forEach((avatar, id) => {
      if (!active.has(id)) {
        scene.remove(avatar);
        disposeObject(avatar);
        avatarsRef.current.delete(id);
      }
    });
    for (const user of users) {
      let avatar = avatarsRef.current.get(user.id);
      if (!avatar) {
        avatar = createAvatar(user, user.id === selfId);
        avatarsRef.current.set(user.id, avatar);
        scene.add(avatar);
      }
      avatar.userData.target = normalizedToWorld(user.x, user.y);
      avatar.userData.connected = user.connected;
      avatar.userData.seated = Boolean(user.seatId);
      avatar.userData.counterSeat = user.seatId?.startsWith('counter-') ?? false;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      avatarsRef.current.forEach((avatar) => {
        avatar.position.copy(avatar.userData.target as THREE.Vector3);
        avatar.position.y = avatar.userData.counterSeat ? 0.32 : avatar.userData.seated ? -0.28 : 0;
      });
      const renderer = rendererRef.current;
      const camera = cameraRef.current;
      if (renderer && camera) renderer.render(scene, camera);
    }
  }, [selfId, users]);

  if (failed) return <div className="scene-loading" role="alert">이 기기에서는 3D 바를 열 수 없어요. WebGL 설정을 확인해 주세요.</div>;
  return <div className="bar-canvas bar-canvas-3d" ref={host} />;
}

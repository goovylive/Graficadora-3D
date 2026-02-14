/**
 * HyperSurf 4D Engine - Intelligent Performance Version
 */

let isAnimating = false;
let animationId = null;
let compiledEq = null;
let lastFrameTime = 0;

// Configuración de Rendimiento
const PERFORMANCE_PROFILES = {
    low: { res: 15, fps: 30, lighting: 'basic' },
    medium: { res: 30, fps: 60, lighting: 'standard' },
    high: { res: 50, fps: 60, lighting: 'high' }
};

let currentProfile = 'medium';
let isMobileDevice = false;

const UI = {
    eq: document.getElementById('equation-input'),
    xmin: document.getElementById('x-min'), xmax: document.getElementById('x-max'),
    ymin: document.getElementById('y-min'), ymax: document.getElementById('y-max'),
    zmin: document.getElementById('z-min'), zmax: document.getElementById('z-max'),
    tmin: document.getElementById('t-min'), tmax: document.getElementById('t-max'),
    quality: document.getElementById('quality-selector'),
    resTag: document.getElementById('res-info-tag'),
    optMsg: document.getElementById('optimization-msg'),
    optText: document.getElementById('opt-text'),
    slider: document.getElementById('t-slider'),
    tDisplay: document.getElementById('t-display'),
    btnPlay: document.getElementById('btn-play'),
    playIcon: document.getElementById('play-icon'),
    pauseIcon: document.getElementById('pause-icon'),
    playText: document.getElementById('play-text'),
    speed: document.getElementById('speed-select'),
    error: document.getElementById('error-overlay'),
    renderInfo: document.getElementById('render-info'),
    plot: document.getElementById('plot')
};

const EXAMPLES = {
    wave: { eq: "sin(sqrt(x^2 + y^2) - t) - z", x: [-5, 5], y: [-5, 5], z: [-2, 2] },
    pulse: { eq: "x^2 + y^2 + z^2 - (2 + sin(t))^2", x: [-4, 4], y: [-4, 4], z: [-4, 4] },
    torus: { eq: "(sqrt(x^2 + y^2) - 2.5)^2 + z^2 - (0.8 + 0.3*cos(t))^2", x: [-4, 4], y: [-4, 4], z: [-2, 2] },
    ripple: { eq: "z - 0.5*sin(x + t)*cos(y + t)", x: [-5, 5], y: [-5, 5], z: [-2, 2] }
};

// --- Inteligencia de Rendimiento ---

function detectDevice() {
    isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || (window.innerWidth < 768)
        || ('ontouchstart' in window);

    if (isMobileDevice) {
        UI.optMsg.style.display = 'flex';
        UI.optText.innerText = "Modo optimizado para móvil activo (30 FPS)";
        currentProfile = 'low';
        console.log("Device: Mobile (Optimized)");
    } else {
        UI.optMsg.style.display = 'none';
        currentProfile = 'medium';
        console.log("Device: Desktop (Standard)");
    }
    syncQualityUI();
}

function syncQualityUI() {
    const mode = UI.quality.value;
    let effectiveProfile = mode === 'auto' ? currentProfile : mode;
    const config = PERFORMANCE_PROFILES[effectiveProfile];
    UI.resTag.innerText = `Resolución: ${config.res}³ | ${config.fps} FPS`;
}

function loadExample(key) {
    const ex = EXAMPLES[key];
    UI.eq.value = ex.eq;
    UI.xmin.value = ex.x[0]; UI.xmax.value = ex.x[1];
    UI.ymin.value = ex.y[0]; UI.ymax.value = ex.y[1];
    UI.zmin.value = ex.z[0]; UI.zmax.value = ex.z[1];
    updatePlot();
}

function updatePlot() {
    try {
        const rawEq = UI.eq.value.split('=')[0].trim();
        compiledEq = math.compile(rawEq);
        compiledEq.evaluate({ x: 0, y: 0, z: 0, t: 0 });
        UI.error.style.display = 'none';

        UI.slider.min = UI.tmin.value;
        UI.slider.max = UI.tmax.value;
        syncQualityUI();
    } catch (err) {
        UI.error.innerText = "Error: " + err.message;
        UI.error.style.display = 'block';
        return;
    }
    renderFrame();
}

async function renderFrame() {
    if (!compiledEq) return;

    const t = parseFloat(UI.slider.value);
    UI.tDisplay.innerText = `t = ${t.toFixed(2)}`;

    // Obtener configuración del perfil actual
    const mode = UI.quality.value;
    const profileKey = mode === 'auto' ? currentProfile : mode;
    const config = PERFORMANCE_PROFILES[profileKey];

    const res = config.res;
    const x0 = parseFloat(UI.xmin.value), x1 = parseFloat(UI.xmax.value);
    const y0 = parseFloat(UI.ymin.value), y1 = parseFloat(UI.ymax.value);
    const z0 = parseFloat(UI.zmin.value), z1 = parseFloat(UI.zmax.value);

    const x = [], y = [], z = [], v = [], intensity = [];
    const dx = (x1 - x0) / (res - 1), dy = (y1 - y0) / (res - 1), dz = (z1 - z0) / (res - 1);
    const start = performance.now();

    for (let i = 0; i < res; i++) {
        const cx = x0 + i * dx;
        for (let j = 0; j < res; j++) {
            const cy = y0 + j * dy;
            for (let k = 0; k < res; k++) {
                const cz = z0 + k * dz;
                x.push(cx); y.push(cy); z.push(cz);
                v.push(compiledEq.evaluate({ x: cx, y: cy, z: cz, t: t }));
                intensity.push(cz);
            }
        }
    }

    // Ajustar iluminación según móvil/desktop
    const lightingConfig = config.lighting === 'basic' ? {
        ambient: 0.8,
        diffuse: 0.6,
        specular: 0.1,
        roughness: 0.5
    } : {
        ambient: 0.6,
        diffuse: 0.7,
        specular: 0.3
    };

    const data = [{
        type: 'isosurface',
        x, y, z, value: v,
        isomin: -0.01, isomax: 0.01,
        intensity: intensity,
        surface: { fill: 1 },
        colorscale: config.lighting === 'basic' ? 'Viridis' : 'Portland',
        showscale: false,
        caps: { show: false },
        lighting: lightingConfig
    }];

    const layout = {
        margin: { t: 0, b: 0, l: 0, r: 0 },
        scene: {
            aspectmode: 'cube',
            xaxis: { gridcolor: "#eee" },
            yaxis: { gridcolor: "#eee" },
            zaxis: { gridcolor: "#eee" },
            camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } }
        },
        paper_bgcolor: 'white'
    };

    await Plotly.react('plot', data, layout, { responsive: true, displaylogo: false });
    UI.renderInfo.innerText = `${(performance.now() - start).toFixed(0)} ms | ${res}³ | ${profileKey}`;
}

// --- Frame Loop con Límite de FPS ---

function animate(currentTime) {
    if (!isAnimating) return;

    // Obtener config
    const mode = UI.quality.value;
    const profileKey = mode === 'auto' ? currentProfile : mode;
    const config = PERFORMANCE_PROFILES[profileKey];
    const targetInterval = 1000 / config.fps;

    const elapsed = currentTime - lastFrameTime;

    if (elapsed > targetInterval) {
        lastFrameTime = currentTime - (elapsed % targetInterval);

        let t = parseFloat(UI.slider.value);
        let speed = parseFloat(UI.speed.value);
        let tMax = parseFloat(UI.tmax.value);
        let tMin = parseFloat(UI.tmin.value);

        t += speed;
        if (t > tMax) t = tMin;
        UI.slider.value = t;

        renderFrame();
    }

    animationId = requestAnimationFrame(animate);
}

function toggleAnimation() {
    isAnimating = !isAnimating;
    if (isAnimating) {
        UI.playIcon.style.display = 'none';
        UI.pauseIcon.style.display = 'block';
        UI.playText.innerText = 'Pausar';
        lastFrameTime = performance.now();
        requestAnimationFrame(animate);
    } else {
        UI.playIcon.style.display = 'block';
        UI.pauseIcon.style.display = 'none';
        UI.playText.innerText = 'Reproducir';
        if (animationId) cancelAnimationFrame(animationId);
    }
}

// Eventos
UI.slider.addEventListener('input', () => { if (!isAnimating) renderFrame(); });
UI.quality.addEventListener('change', () => {
    syncQualityUI();
    if (!isAnimating) renderFrame();
});

window.addEventListener('resize', () => Plotly.Plots.resize(UI.plot));
window.addEventListener('load', () => {
    detectDevice();
    updatePlot();
});

/*
 * Thu số đối chiếu từ Hikrobot Lens Selector (2026-10-29) — chạy TRONG TRÌNH DUYỆT.
 *
 * Hik chặn gọi API thẳng từ máy (trả trang chống bot), nên phải chạy trong chính trang công cụ:
 *   1. Mở https://www.hikrobotics.com/en/machinevision/service/machinevisionTool/?id=3
 *   2. Mở DevTools (F12) → Console, dán toàn bộ file này, Enter. Chờ ~1 phút (nghỉ 0,7 s giữa các lượt).
 *   3. Console in ra một chuỗi JSON → dán vào trường "cases" của scripts/reference/hik-lens-selector-<ngày>.json
 *      (giữ phần "source", "format" như file cũ), rồi chạy npm run verify:lens.
 *
 * Mỗi ca gọi hai chế độ của Hik: choiceType 0 (vùng nhìn + WD → vùng nhìn từng ống ở WD đó) và
 * choiceType 1 (tiêu cự + vùng nhìn → WD từng ống) cho mọi tiêu cự Hik đã gợi ý ở chế độ 0.
 * Vùng nhìn cao = rộng × tỉ lệ cảm biến, để hai bên cùng khớp theo một trục.
 */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const CAMS = {
    'MV-CS004-10GM': { idSensor: 4993, h: 4.968, v: 3.726, d: 6.21, px: [720, 540], pitch: 6.9 },
    'MV-CS050-10GM': { idSensor: 5788, h: 8.4456, v: 7.0656, d: 11.011396946800167, px: [2448, 2048], pitch: 3.45 },
    'MV-CS200-10GM': { idSensor: 5793, h: 13.1328, v: 8.7552, d: 15.783661263471158, px: [5472, 3648], pitch: 2.4 },
  };
  const TASKS = [['nho', 30, 150], ['vua', 100, 300], ['lon', 300, 800], ['can', 15, 100]];
  const call = async (model, cam, custom) => {
    const body = {
      customParam: { choiceType: 0, interfaceType: '', hAngle: '', vAngle: '', ...custom },
      sensorParam: { idSensor: cam.idSensor, h: cam.h, v: cam.v, d: cam.d },
      productContentType: 'CS Area Scan Camera',
      productContentId: cam.idSensor,
      productModel: model,
    };
    const r = await fetch('/en/Api/Foreground/Vision/ListLensData', { method: 'POST', headers: { 'Content-Type': 'application/json;charset=UTF-8' }, body: JSON.stringify(body) });
    await sleep(700);
    return ((await r.json()).data || []).map((l) => ({ model: l.lenModel, f: l.f, beta: l.beta, deltaL: l.deltaL, wd: l.wd, h: l.hfinal, v: l.vfinal, img: l.dmax.replace(/[“”"]/g, 'in'), mount: l.mount }));
  };
  const cases = [];
  for (const [model, cam] of Object.entries(CAMS)) {
    for (const [task, w, wd] of TASKS) {
      const v = +((w * cam.v) / cam.h).toFixed(2);
      const beta = (cam.h / w).toFixed(6);
      const fovWd = await call(model, cam, { f: ((cam.h / w) * wd).toFixed(1), h: String(w), v, beta, wd: String(wd) });
      const fit = new Map();
      for (const f of [...new Set(fovWd.map((l) => l.f))]) for (const l of await call(model, cam, { choiceType: 1, f: String(f), h: String(w), v, beta, wd: '' })) fit.set(l.model, l);
      cases.push({
        camera: model,
        sensor: [cam.h, cam.v, cam.px[0], cam.px[1], cam.pitch],
        task,
        fov: [w, v],
        wd,
        lenses: fovWd.map((l) => {
          const x = fit.get(l.model);
          return [l.model, l.f, l.beta, l.deltaL, l.wd, l.h, l.v, l.img, l.mount, ...(x ? [x.wd, x.h, x.v, x.deltaL] : [null, null, null, null])];
        }),
        fitOnly: [...fit.values()].filter((x) => !fovWd.some((l) => l.model === x.model)).map((x) => [x.model, x.f, x.wd, x.h, x.v, x.deltaL, x.img, x.mount]),
      });
    }
  }
  console.log(JSON.stringify(cases));
})();

/* Группы коров в таблице стада: сухостой, родилка, дойные.
   Запуск из корня репозитория: node tests/herdgroups.test.js
   Раздел 1 — неизменные величины: стадо, надой и число животных не зависят от того,
   как коровы делятся на группы (вариант А — меняется только классификация).
   Раздел 2 — текущая классификация по долям (шаг 1 плана; в шаге 3 заменяется когортной). */
const vm = require('vm'), fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'js');
const files = ['config.js', 'subsidies.js', 'calc-herd.js'];
function load() {
  const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
  files.forEach(f => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f }));
  return ctx.MTF;
}
const M = load();
const c = o => JSON.parse(JSON.stringify(o));
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; };
const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 1e-6 : tol);
const nearArr = (a, b, tol) => a.length === b.length && a.every((x, i) => near(x, b[i], tol));

/* Два проекта: значения по умолчанию и проект с меньшим стартовым стадом (330 нетелей, коровник 400 / блок 122) */
const dflt = c(M.defaults);
const lab = c(M.defaults);
lab.capacity = Object.assign(lab.capacity, { cowPlaces: 400, dryPlaces: 122, calfPlaces: 100, heiferPlaces: 193, bullPlaces: 0, flexHousing: true });
lab.herd = Object.assign(lab.herd, { startHeifers: 330, batches: 2, batchInterval: 6, firstBatchShare: 50,
  heiferPrice: 5, heiferCurrency: 'EUR', gestationOnArrival: 6, restockMode: 'none', restockYears: 3 });
lab.production = Object.assign(lab.production, { heiferShare: 85, salePlanMode: 'steps',
  salePlan: [{ age: 2, share: 33.4, price: 0 }, { age: 6, share: 33.3, price: 220 }, { age: 12, share: 33.3, price: 400 }] });

const snap = {
  dflt: {
    target: 474,
    cows:  [470, 425.1, 474, 474, 474, 474, 474, 474, 474, 474, 474, 474],
    milk:  [1796820.02, 3329010.8, 3359951.15, 3644985.38, 3645620.94, 3645841.58, 3645918.18, 3645944.78, 3645954.01, 3645957.21, 3645958.33, 3645958.71],
    total: [574.21, 682.15, 778.29, 776.82, 779.77, 779.77, 779.77, 779.77, 779.77, 779.77, 779.77, 779.77]
  },
  lab: {
    target: 475,
    cows:  [330, 298.47, 360.38, 433.23, 475, 475, 475, 475, 475, 475, 475, 475],
    milk:  [971004.33, 2316779.03, 2411538.89, 3055505.77, 3492625.21, 3631063.29, 3645809.11, 3650928.41, 3652705.68, 3653322.69, 3653536.9, 3653611.27],
    total: [415.74, 568.83, 713.82, 837.87, 951.96, 895.27, 831.59, 831.59, 831.59, 831.59, 831.59, 831.59]
  }
};

console.log('1. Стадо, надой и число животных не зависят от деления на группы');
[['по умолчанию', dflt, snap.dflt], ['проект 330 нетелей', lab, snap.lab]].forEach(function (x) {
  const h = M.calcHerd(c(x[1]));
  ok(h.meta.target === x[2].target, x[0] + ': мощность = ' + x[2].target);
  ok(nearArr(h.map(y => y.cows), x[2].cows, 0.01), x[0] + ': фуражные коровы по годам');
  ok(nearArr(h.map(y => y.milkLiters), x[2].milk, 0.01), x[0] + ': надой по годам');
  ok(nearArr(h.map(y => y.total), x[2].total, 0.01), x[0] + ': всего животных по годам');
});

console.log('2. Классификация по долям (текущее поведение)');
[['по умолчанию', dflt], ['проект 330 нетелей', lab]].forEach(function (x) {
  const P = c(x[1]), sh = M.herdShares(P.production), h = M.calcHerd(P);
  ok(h.every(y => near(y.dry + y.pen + y.milking, y.cows, 1e-9)), x[0] + ': сухостой + родилка + дойные = фуражные коровы');
  ok(h.every(y => near(y.dry, y.cows * sh.dry, 1e-9) && near(y.pen, y.cows * sh.pen, 1e-9)), x[0] + ': сухостой и родилка — доли от коров');
  ok(h.every(y => y.dry >= 0 && y.pen >= 0 && y.milking >= 0), x[0] + ': группы неотрицательны');
});
const sh0 = M.herdShares(dflt.production);
ok(near(sh0.dry, 60 / M.calvingInterval(dflt.production), 1e-12), 'доля сухостоя = дни сухостоя / межотёльный период');
ok(near(sh0.pen, 14 / M.calvingInterval(dflt.production), 1e-12), 'доля родилки = дни родилки / межотёльный период');

console.log(fails ? '\nЕсть ошибки: ' + fails : '\nВсе проверки пройдены');
process.exit(fails ? 1 : 0);
